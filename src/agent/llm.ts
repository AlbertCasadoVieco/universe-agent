import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import fs from 'fs';

import { join } from 'path';

dotenv.config();
dotenv.config({ path: join(process.cwd(), '.env') });

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function transcribeAudio(filePath: string) {
  try {
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: "whisper-large-v3",
    });
    return transcription.text;
  } catch (error) {
    console.error('Transcription Error:', error);
    throw error;
  }
}

export async function generateSpeech(text: string) {
  const key = process.env.ELEVENLABS_API_KEY || '';
  console.log(`[TTS] Using key: ${key.substring(0, 4)}...${key.substring(key.length - 4)}`);
  try {
    const axios = (await import('axios')).default;
    const response = await axios({
      method: 'post',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`,
      headers: {
        'Accept': 'audio/mpeg',
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      data: {
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        },
      } as any,
      responseType: 'arraybuffer',
    });

    const tempPath = `/tmp/speech_${Date.now()}.mp3`;
    fs.writeFileSync(tempPath, Buffer.from(response.data as ArrayBuffer));
    console.log(`[TTS] Speech generated successfully: ${tempPath}`);
    return tempPath;
  } catch (error: any) {
    if (error.response) {
      console.error('TTS Error Response Data:', error.response.data.toString());
      console.error('TTS Error Status:', error.response.status);
    } else {
      console.error('TTS Error Message:', error.message);
    }
    throw error;
  }
}

export async function getLLMResponse(messages: any[], useFallback = false) {
  try {
    const model = useFallback 
      ? (process.env.OPENROUTER_MODEL || 'openrouter/free')
      : 'llama-3.3-70b-versatile';

    // If using OpenRouter, we would normally use a different SDK or fetch call.
    // For simplicity, we'll try to use Groq primary and log fallback intent.
    // In a real scenario, you'd have a secondary client here.
    
    const chatCompletion = await groq.chat.completions.create({
      messages,
      model: model.includes('/') ? 'llama-3.3-70b-versatile' : model, // Fallback logic simplification
      tools: useFallback ? undefined : (await import('../tools/index.js')).toolDefinitions as any,
      tool_choice: 'auto',
    });

    return chatCompletion.choices[0].message;
  } catch (error) {
    console.error('LLM Error:', error);
    if (!useFallback) {
      console.log('Switching to fallback...');
      return getLLMResponse(messages, true);
    }
    throw error;
  }
}
