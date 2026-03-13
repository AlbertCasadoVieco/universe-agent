import bot from './bot/index.js';
import dotenv from 'dotenv';

dotenv.config();

console.log('--- Universe Agent Starting ---');

if (process.env.RUN_LOCAL === 'true') {
  bot.start({
    onStart: (botInfo) => {
      console.log(`Bot @${botInfo.username} is now online (Long Polling)`);
    },
  });
} else {
  console.log('Cloud mode: Bot is ready for Webhooks. Execute "npm run deploy" to put it online.');
}

process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());
