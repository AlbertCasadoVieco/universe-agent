import bot from './bot/index.js';
import dotenv from 'dotenv';

dotenv.config();

console.log('--- Universe Agent Starting ---');

// Force local mode for maximum performance and stability
const runLocal = process.env.RUN_LOCAL !== 'false'; 

if (runLocal) {
  // Ensure no webhooks are active to avoid "Conflict" error
  await bot.api.deleteWebhook();
  bot.start({
    onStart: (botInfo) => {
      console.log(`🚀 Universe Agent @${botInfo.username} ONLINE (Local High-Performance Mode)`);
      console.log(`🧠 Local Memory (SQLite) active.`);
    },
  });
} else {
  console.log('Cloud mode: Waiting for Webhooks.');
}

process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());
