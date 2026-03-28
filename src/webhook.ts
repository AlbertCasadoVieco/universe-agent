import { onRequest } from "firebase-functions/v2/https";
import { webhookCallback } from "grammy";
import bot from "./bot/index.js";

// Export the Cloud Function with public access allowed
export const telegramWebhook = onRequest({ 
  cors: true, 
  maxInstances: 10,
  invoker: "public",
  memory: "512MiB",
  timeoutSeconds: 120
}, async (req, res) => {
  console.log(`[Webhook] Incoming ${req.method} request`);
  
  if (req.method === 'GET') {
    res.status(200).send("Universe Agent Bot is Online! 🚀 Waiting for Telegram updates...");
    return;
  }

  const update = req.body;
  if (!update || !update.update_id) {
    res.status(200).send("No update_id found");
    return;
  }

  try {
    const { isUpdateProcessed } = await import("./database/db.js");
    if (await isUpdateProcessed(update.update_id)) {
      console.log(`[Webhook] Update ${update.update_id} already processed. Skipping.`);
      res.status(200).send("Already processed");
      return;
    }

    const handler = webhookCallback(bot, "express");
    // We don't await handler directly to respond 200 OK fast and avoid retries
    // But since this is a Cloud Function, it might terminate if we don't await.
    // However, grammy's webhookCallback handles res.send.
    await handler(req as any, res as any);
    console.log(`[Webhook] Update ${update.update_id} handled.`);
  } catch (err: any) {
    console.error(`[Webhook] Fatal Error:`, err);
    // Always return 200 to stop retries if we handled it partially
    if (!res.headersSent) res.status(200).send(`Internal error handled`);
  }
});
