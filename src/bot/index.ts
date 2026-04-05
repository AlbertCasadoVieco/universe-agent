import { Bot, InputFile, webhookCallback } from "grammy";
import dotenv from "dotenv";
import { runAgentLoop } from "../agent/loop.js";

import { join } from "path";

dotenv.config();
// For Firebase Functions, sometimes we need to be explicit if it's running from dist
const envPath = join(process.cwd(), '.env');
dotenv.config({ path: envPath });

console.log('Starting bot initialization...');
console.log('CWD:', process.cwd());
console.log('.env path:', envPath);
console.log('TELEGRAM_BOT_TOKEN exists:', !!process.env.TELEGRAM_BOT_TOKEN);
console.log('ALLOWED_USER_IDS:', process.env.TELEGRAM_ALLOWED_USER_IDS);

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("FATAL: TELEGRAM_BOT_TOKEN is missing in process.env");
  // Don't throw just yet, let it fail gracefully during runtime for better logs
}

const bot = new Bot(token || 'dummy');

import { isUpdateProcessed, clearHistory } from "../database/db.js";

// Global logger to see ANY incoming update
bot.use(async (ctx, next) => {
  const updateId = ctx.update.update_id;
  console.log(`--- Incoming Update [${updateId}] ---`);
  
  if (await isUpdateProcessed(updateId)) {
    console.log(`[Bot] Update ${updateId} already processed. Skipping.`);
    return;
  }
  
  console.log('From:', ctx.from?.id, ctx.from?.first_name);
  return await next();
});

// Security Middleware: Whitelist User IDs
const allowedIds = (process.env.TELEGRAM_ALLOWED_USER_IDS || "")
  .split(",")
  .map((id) => parseInt(id.trim()));

bot.use(async (ctx, next) => {
  const userId = ctx.from?.id;
  if (userId && allowedIds.includes(userId)) {
    return await next();
  }
  console.warn(`Unauthorized access attempt from ID: ${userId} (${ctx.from?.first_name})`);
  await ctx.reply(`🚫 *Acceso Denegado*\nTu ID (${userId}) no está en la lista de usuarios autorizados. Contacta con Albert para que te añada.`, { parse_mode: "Markdown" });
});

bot.command("reset", async (ctx) => {
  const userId = ctx.from?.id;
  const masterId = allowedIds[0];
  if (userId !== masterId) {
    await ctx.reply("⛔ *Acceso Denegado:* Solo Albert (Admin) puede reiniciar la memoria global de este bot.");
    return;
  }
  await clearHistory(userId);
  await ctx.reply("🧹 *Memoria borrada.* El historial de esta conversación ha sido eliminado de mi base de datos local.", { parse_mode: "Markdown" });
});

bot.on("message:text", async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text;
  const isMaster = userId === allowedIds[0];
  await handleUserMessage(ctx, userId, text, false, undefined, isMaster);
});

bot.on("message:photo", async (ctx) => {
  const userId = ctx.from.id;
  const caption = ctx.message.caption || "Analiza esta imagen";
  await ctx.replyWithChatAction("typing");

  try {
    const photo = ctx.message.photo;
    const file = await ctx.api.getFile(photo[photo.length - 1].file_id);
    const path = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

    const tempPath = `/tmp/vision_${file.file_id}.jpg`;
    const axios = (await import("axios")).default;
    const response = await axios({
      method: "get",
      url: path,
      responseType: "stream",
    });

    const writer = (await import("fs")).createWriteStream(tempPath);
    (response.data as any).pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    const isMaster = userId === allowedIds[0];
    await handleUserMessage(ctx, userId, caption, false, tempPath, isMaster);

    // Clean up
    (await import("fs")).unlinkSync(tempPath);
  } catch (error) {
    console.error("Photo handling error:", error);
    await ctx.reply("No he podido procesar la imagen.");
  }
});

bot.on("message:voice", async (ctx) => {
  const userId = ctx.from.id;
  await ctx.replyWithChatAction("typing");

  try {
    const file = await ctx.getFile();
    const path = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

    const tempPath = `/tmp/voice_${file.file_id}.ogg`;

    const axios = (await import("axios")).default;
    const response = await axios({
      method: "get",
      url: path,
      responseType: "stream",
    });

    const writer = (await import("fs")).createWriteStream(tempPath);
    (response.data as any).pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    const { transcribeAudio } = await import("../agent/llm.js");
    const transcribedText = await transcribeAudio(tempPath);

    (await import("fs")).unlinkSync(tempPath);

    await ctx.reply(`🎤 *Transcripción:* ${transcribedText}`, {
      parse_mode: "Markdown",
    });
    const isMaster = userId === allowedIds[0];
    await handleUserMessage(ctx, userId, transcribedText, true, undefined, isMaster);
  } catch (error) {
    console.error("Voice handling error:", error);
    await ctx.reply("No he podido procesar el audio.");
  }
});
async function handleUserMessage(
  ctx: any,
  userId: number,
  text: string,
  sendVoice = false,
  imagePath?: string,
  isMaster = false
) {
  await ctx.replyWithChatAction("typing");

  let statusMessage: any = null;
  let isCreatingStatusMessage = false;
  let fullResponse = "";
  let lastUpdateTime = 0;
  const UPDATE_INTERVAL = 1500; // 1.5 seconds to avoid Telegram 429

  const onChunk = async (chunk: string) => {
    fullResponse += chunk;
    const now = Date.now();

    // Only update if we have a status message and enough time has passed
    if (statusMessage && now - lastUpdateTime > UPDATE_INTERVAL && fullResponse.trim()) {
      try {
        await ctx.api.editMessageText(
          ctx.chat.id,
          statusMessage.message_id,
          fullResponse + "..."
        );
        lastUpdateTime = now;
      } catch (e: any) {
        // Ignore "message is not modified" errors or "message to edit not found"
        if (!e.message.includes("message is not modified") && !e.message.includes("message to edit not found")) {
          console.error("Non-critical edit error:", e.message);
        }
      }
    } else if (!statusMessage && !isCreatingStatusMessage && fullResponse.trim().length > 10) {
      // Create the initial message once we have some content
      isCreatingStatusMessage = true;
      try {
        console.log(`[Bot] Creating initial stream message for ${userId}...`);
        statusMessage = await ctx.reply(fullResponse + "...", { parse_mode: "Markdown" }).catch(() => 
          ctx.reply(fullResponse + "...")
        );
        lastUpdateTime = now;
      } catch (e) {
        console.error("Initial stream message error:", e);
      } finally {
        isCreatingStatusMessage = false;
      }
    }
  };

  try {
    const response = await runAgentLoop(userId, text, imagePath, onChunk, isMaster);

    // Final update to the message (remove the dots, finalize markdown)
    if (statusMessage) {
      try {
        const { sendSafeMessage } = await import("../utils/telegram.js");
        // We delete the temporary streaming message and send the final "safe" (split if needed) message
        // Or just update the last one if it fits.
        if (response.length < 4000) {
          await ctx.api.editMessageText(ctx.chat.id, statusMessage.message_id, response, { parse_mode: "Markdown" })
            .catch(() => ctx.api.editMessageText(ctx.chat.id, statusMessage.message_id, response));
        } else {
          await ctx.api.deleteMessage(ctx.chat.id, statusMessage.message_id).catch(() => {});
          await sendSafeMessage(ctx, response);
        }
      } catch (e) {
        const { sendSafeMessage } = await import("../utils/telegram.js");
        await sendSafeMessage(ctx, response);
      }
    } else if (!sendVoice) {
      // If no status message was created (e.g. tool calls took all the time or response was too short)
      const { sendSafeMessage } = await import("../utils/telegram.js");
      await sendSafeMessage(ctx, response);
    }


    if (sendVoice) {
      try {
        await ctx.replyWithChatAction("record_voice");
        const { generateSpeech } = await import("../agent/llm.js");
        const audioPath = await generateSpeech(response);
        await ctx.api.sendVoice(ctx.chat.id, new InputFile(audioPath));
        (await import("fs")).unlinkSync(audioPath);
      } catch (ttsError) {
        console.error("TTS Fallback:", ttsError);
        // If voice fails, the text is already there or we send it now
        if (!statusMessage) {
          const { sendSafeMessage } = await import("../utils/telegram.js");
          await sendSafeMessage(ctx, `(Audio fallido):\n\n${response}`);
        }
      }
    }
  } catch (error: any) {
    console.error("Error in bot message handler:", error);
    
    let description = "Ha ocurrido un error inesperado al procesar tu mensaje.";
    const status = error?.status || error?.response?.status;
    const message = error?.message?.toLowerCase() || "";

    if (status === 429 || message.includes("rate limit")) {
      description = "⚠️ *Límite de velocidad excedido:* He recibido demasiadas peticiones en poco tiempo. Por favor, espera un minuto antes de volver a intentarlo.";
    } else if (status === 404) {
      description = "❌ *Error de Conexión:* No he podido encontrar el servidor de IA. Es posible que el modelo configurado ya no esté disponible.";
    } else if (status === 401 || status === 403) {
      description = "🔑 *Error de Autenticación:* Hay un problema con las llaves de API en el archivo .env.";
    } else if (message.includes("network") || message.includes("timeout")) {
      description = "🌐 *Error de Red:* La conexión es inestable o el servidor está tardando demasiado en responder.";
    }

    await ctx.reply(`🧐 *Análisis del Error:*\n\n${description}\n\n_Detalle técnico: ${error?.message || "Sin datos"}_`, { parse_mode: "Markdown" }).catch(() => {});
  }
}

// Global error handler
bot.catch((err) => {
  console.error(`[BotError] ${err.message}`, err);
});

export default bot;
