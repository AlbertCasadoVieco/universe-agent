# 🌌 Universe Agent

> An AI-powered Telegram bot running 24/7 on the cloud, with voice interaction, persistent memory, and a modular agent architecture. Built by **Albert** (alias [notinc](https://github.com/notinc)).

---

## ✨ Features

- 🗣️ **Voice in, Voice out** — Send a voice note, get a voice reply (ElevenLabs TTS + Groq Whisper)
- 🧠 **Persistent Memory** — Full conversation history stored in Firebase Firestore
- 🤖 **Agent Loop** — Think → Act → Observe cycle powered by Llama 3.3 70B via Groq
- 🛠️ **Extensible Tools** — Easy to add new capabilities (web search, timezones, etc.)
- 🔐 **User Whitelist** — Only approved Telegram User IDs can interact
- ☁️ **Serverless** — Runs on Firebase Cloud Functions (no server to manage, zero idle cost)

---

## 🏗️ Architecture

```
Telegram User
     │
     ▼ (voice/text message)
Firebase Cloud Function (Webhook)
     │
     ├─ Audio? → Groq Whisper (transcription)
     │
     ▼
Agent Loop (runAgentLoop)
     │
     ├─ Load History (Firestore)
     ├─ Call LLM (Groq / Llama 3.3)
     ├─ Execute Tools (if needed)
     └─ Save response (Firestore)
     │
     ▼
     │
     ├─ Text reply? → ctx.reply()
     └─ Voice reply? → ElevenLabs TTS → ctx.replyWithVoice()
```

---

## 🛠️ Tech Stack

| Component | Technology |
|---|---|
| Platform | Firebase Cloud Functions (Gen 2) |
| Database | Firebase Firestore |
| Bot Framework | [grammY](https://grammy.dev/) |
| LLM | Groq API (Llama 3.3 70B) |
| Transcription | Groq Whisper Large v3 |
| Text-to-Speech | ElevenLabs (Rachel voice) |
| Language | TypeScript / Node.js 20 |

---

## ⚙️ Setup

### 1. Clone the repo
```bash
git clone https://github.com/notinc/universe-agent.git
cd universe-agent
npm install
```

### 2. Configure environment variables
Copy the example file and fill in your keys:
```bash
# Create your .env file (never commit this!)
```

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_ALLOWED_USER_IDS=your_telegram_user_id
GROQ_API_KEY=your_groq_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
LOCAL_SERVICE_ACCOUNT_PATH=./service-account.json
```

To get your Telegram User ID, message `@userinfobot` on Telegram.

### 3. Firebase setup
- Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
- Enable **Firestore** and **Cloud Functions**
- Download your service account key → save as `service-account.json` in the project root
- Log in to Firebase CLI: `firebase login`
- Set the project: `firebase use your-project-id`

### 4. Set Telegram Webhook
After deploying, set the webhook once:
```bash
curl "https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook?url=<YOUR_FUNCTION_URL>"
```

---

## 🚀 Deployment

```bash
npm run deploy
```

This builds the TypeScript and deploys to Firebase in one command.

For automatic deployments via GitHub Actions, see `.github/workflows/deploy.yml`.

---

## 🔧 Adding New Tools

Create a new function in `src/tools/` and register it in `src/tools/index.ts`. The agent will automatically pick it up.

---

## 📁 Project Structure

```
src/
├── webhook.ts         # Firebase Cloud Function entry point
├── bot/
│   └── index.ts      # Telegram bot handlers (text + voice)
├── agent/
│   ├── loop.ts       # Main agent loop (Think→Act→Observe)
│   └── llm.ts        # Groq LLM, Whisper transcription, ElevenLabs TTS
├── database/
│   └── firebase.ts   # Firestore helpers
└── tools/
    └── index.ts      # Tool registry and definitions
```

---

## 📄 License

MIT — Made with ❤️ by Albert (notinc)
