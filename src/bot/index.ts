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

// Global logger to see ANY incoming update
bot.use(async (ctx, next) => {
  console.log('--- Incoming Update ---');
  console.log('Update ID:', ctx.update.update_id);
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
  console.warn(`Unauthorized access attempt from ID: ${userId}`);
});

bot.on("message:text", async (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text;
  await handleUserMessage(ctx, userId, text);
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

    await handleUserMessage(ctx, userId, caption, false, tempPath);

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
    await handleUserMessage(ctx, userId, transcribedText, true);
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
  imagePath?: string
) {
  // Show "typing" status
  await ctx.replyWithChatAction("typing");

  try {
    const response = await runAgentLoop(userId, text, imagePath);

    if (sendVoice) {
      try {
        await ctx.replyWithChatAction("record_voice");
        const { generateSpeech } = await import("../agent/llm.js");
        const audioPath = await generateSpeech(response);
        await ctx.replyWithVoice(new InputFile(audioPath));
        // Clean up audio file
        (await import("fs")).unlinkSync(audioPath);
      } catch (ttsError) {
        console.error("TTS Fallback to text:", ttsError);
        await ctx.reply(`(No he podido generar el audio, te respondo por texto):\n\n${response}`);
      }
    } else {
      await ctx.reply(response);
    }
  } catch (error: any) {
    console.error("Error in bot message handler:", error);
    const errorMessage = error?.message || "Error desconocido";
    await ctx.reply(`Lo siento, ha ocurrido un error al procesar tu mensaje.\n\n(Detalle: ${errorMessage.substring(0, 100)})`);
  }
}

// Global error handler
bot.catch((err) => {
  console.error(`[BotError] ${err.message}`, err);
});

export default bot;
