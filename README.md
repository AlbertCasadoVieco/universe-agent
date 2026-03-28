# 🌌 Universe Agent
Un agente de IA avanzado diseñado para **Forense Digital y Threat Hunting**, optimizado para ejecución local de alto rendimiento. Cuenta con una arquitectura modular, memoria persistente ultrarrápida y una base de conocimientos experta mapeada a MITRE ATT&CK. Construido por Albert (alias notinc).

## ✨ Características Principales
*   🗣️ **Interacción por Voz**: Entrada y salida de voz fluida (ElevenLabs TTS + Groq Whisper).
*   🧠 **Memoría Local (SQLite)**: Migración de Firestore a SQLite local para eliminar latencia y permitir búsquedas instantáneas en auditorías complejas.
*   🤖 **Bucle de Agente (Think → Act → Observe)**: Ciclo cognitivo potenciado por **Llama 3.3 70B** vía Groq (con fallback a OpenRouter).
*   🛡️ **Especialista BTL1 / Forense**: Experto en **Autopsy, Splunk, TShark y DeepBlueCLI**.
*   ⚔️ **Inteligencia de Ataque**: Conocimiento profundo de **Metasploit, Mimikatz y Maldocs (PDF)**.
*   📊 **Mapeo MITRE ATT&CK**: Correlación automática de artefactos y TTPs con el framework MITRE (T1003, T1558, etc.).
*   🔐 **Blindaje Técnico**: Sanitización de conocimientos para evitar alucinaciones en valores críticos (ej: 0x17/0x12 en Kerberos).

## 🏗️ Arquitectura
**Usuario de Telegram**
     │
     ▼ (mensaje de voz/texto)
**Instancia Local / Cloud (Modo High-Performance)**
     │
     ├─ Audio? → Groq Whisper (transcripción)
     │
     ▼
**Agent Loop (runAgentLoop)**
     │
     ├─ Carga de Historial (SQLite)
     ├─ Llamada a LLM (Groq / Llama 3.3 70B)
     ├─ Mapeo de Técnicas MITRE
     ├─ Ejecución de Herramientas (Forense/Red)
     └─ Guardado de respuesta (SQLite)
     │
     ▼
     │
     ├─ Respuesta Texto? → ctx.reply()
     └─ Respuesta Voz? → ElevenLabs TTS → ctx.replyWithVoice()

## 🛠️ Stack Tecnológico
| Componente | Tecnología |
| :--- | :--- |
| **Plataforma** | Node.js 20 / Firebase Cloud Functions (Gen 2) |
| **Base de Datos** | **SQLite (Local Memory)** / Firebase Firestore |
| **Bot Framework** | grammY |
| **LLM Principal** | **Groq API (Llama 3.3 70B)** |
| **LLM Fallback** | **OpenRouter** |
| **Transcripción** | Groq Whisper Large v3 |
| **TTS** | ElevenLabs (Voz: Rachel) |
| **Framework Forense** | MITRE ATT&CK Mapping |

## 📁 Estructura del Proyecto
```text
src/
├── webhook.ts         # Punto de entrada de la función (Firebase/Webhook)
├── index.ts           # Inicialización del bot y modo local
├── bot/
│   └── index.ts       # Handlers de Telegram (Texto + Voz)
├── agent/
│   ├── loop.ts        # Bucle principal Think→Act→Observe
│   ├── prompt.ts      # SYSTEM_PROMPT (Experticia Forense y Blindaje Técnico)
│   └── llm.ts         # Integración Groq, Whisper y ElevenLabs
├── database/
│   ├── db.ts          # Gestión de SQLite (Memoria de alto rendimiento)
│   └── firebase.ts    # Helpers de Firestore (Legacy/Backup)
├── tools/
│   ├── index.ts       # Registro y definiciones de herramientas
│   └── ...            # Herramientas de búsqueda, forense y red
└── utils/             # Utilidades de Telegram y procesamiento de datos
```

## 🚀 Despliegue y Ejecución
1.  **Modo Local (Recomendado para Auditorías)**: `npm run dev`
    *   Activa la memoria SQLite para respuestas instantáneas.
2.  **Despliegue Cloud**: `npm run deploy`
    *   Compila TypeScript y despliega en Firebase Cloud Functions.

---
**MIT License** — Made with ❤️ by Albert (notinc)
