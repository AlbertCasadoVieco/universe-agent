import { Context } from "grammy";

/**
 * Sends a message to Telegram, splitting it if it exceeds the character limit (4096).
 */
export async function sendSafeMessage(ctx: Context, text: string, options: any = {}) {
  const MAX_LENGTH = 4000; // Leaving some buffer
  
  if (text.length <= MAX_LENGTH) {
    return await ctx.reply(text, options);
  }

  const chunks = [];
  for (let i = 0; i < text.length; i += MAX_LENGTH) {
    chunks.push(text.substring(i, i + MAX_LENGTH));
  }

  console.log(`[Telegram] Splitting message into ${chunks.length} chunks.`);
  
  for (const chunk of chunks) {
    await ctx.reply(chunk, options);
  }
}
