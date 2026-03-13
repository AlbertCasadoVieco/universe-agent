import { onRequest } from "firebase-functions/v2/https";
import { webhookCallback } from "grammy";
import bot from "./bot/index.js";

// Export the Cloud Function with public access allowed
export const telegramWebhook = onRequest({ 
  cors: true, 
  maxInstances: 10,
  invoker: "public",
  memory: "512MiB",
  timeoutSeconds: 60
}, async (req, res) => {
  console.log(`[Webhook] Incoming ${req.method} request`);
  
  if (req.method === 'GET') {
    res.status(200).send("Universe Agent Bot is Online! 🚀 Waiting for Telegram updates...");
    return;
  }

  try {
    const handler = webhookCallback(bot, "express");
    await handler(req, res);
    console.log(`[Webhook] Successfully processed ${req.method}`);
  } catch (err: any) {
    console.error(`[Webhook] Fatal Error:`, err);
    res.status(500).send(`Internal Error: ${err.message}`);
  }
});
