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

export async function getLLMResponse(
  messages: any[], 
  useFallback = false, 
  imagePath?: string,
  onChunk?: (chunk: string) => void | Promise<void>
) {
  let model = 'llama-3.3-70b-versatile';
  let finalMessages = [...messages];

  try {
    if (useFallback) {
      console.log('[LLM] Using OpenRouter Fallback...');
      const axios = (await import('axios')).default;
      const response = await axios({
        method: 'post',
        url: 'https://openrouter.ai/api/v1/chat/completions',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/AlbertCasadoVieco/universe-agent',
          'X-Title': 'Universe Agent',
        },
        data: {
          model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free',
          messages,
        },
      });
      const result = (response.data as any).choices[0].message;
      if (onChunk && result.content) {
        onChunk(result.content);
      }
      return result;
    }

    if (imagePath) {
      console.log(`[LLM] Image detected, using vision model. Path: ${imagePath}`);
      model = 'meta-llama/llama-4-scout-17b-16e-instruct';
      
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      
      const lastMessage = finalMessages[finalMessages.length - 1];
      if (lastMessage.role === 'user') {
        lastMessage.content = [
          { type: 'text', text: lastMessage.content },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`,
            },
          },
        ];
      }
    }
    
    if (onChunk && !imagePath) {
      console.log('[LLM] Starting streaming response...');
      const stream = await groq.chat.completions.create({
        messages: finalMessages,
        model,
        tools: (await import('../tools/index.js')).toolDefinitions as any,
        tool_choice: 'auto',
        stream: true,
      });

      let fullContent = '';
      let toolCalls: any[] = [];

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          fullContent += delta.content;
          if (onChunk) {
            await onChunk(delta.content);
          }
        }
        if (delta?.tool_calls) {
          // Flatten tool calls from chunks
          for (const tc of delta.tool_calls) {
            if (!toolCalls[tc.index]) {
              toolCalls[tc.index] = {
                id: tc.id,
                type: 'function',
                function: { name: '', arguments: '' }
              };
            }
            if (tc.function?.name) toolCalls[tc.index].function.name += tc.function.name;
            if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
          }
        }
      }

      return {
        role: 'assistant',
        content: fullContent || null,
        tool_calls: toolCalls.length > 0 ? toolCalls.filter(Boolean) : undefined,
      };
    }

    const chatCompletion = await groq.chat.completions.create({
      messages: finalMessages,
      model,
      tools: imagePath ? undefined : (await import('../tools/index.js')).toolDefinitions as any,
      tool_choice: imagePath ? undefined : 'auto',
    });

    return chatCompletion.choices[0].message;
  } catch (error: any) {
    console.error('LLM Error:', error?.message || error);
    
    // First Fallback: Try a lighter Groq model if we were using the 70B model
    if (!useFallback && model === 'llama-3.3-70b-versatile') {
      console.log('Switching to lighter Groq model (llama-3.1-8b-instant) due to limits/error...');
      try {
        const fallbackCompletion = await groq.chat.completions.create({
          messages: finalMessages,
          model: 'llama-3.1-8b-instant',
          tools: imagePath ? undefined : (await import('../tools/index.js')).toolDefinitions as any,
          tool_choice: imagePath ? undefined : 'auto',
        });
        if (fallbackCompletion.choices && fallbackCompletion.choices.length > 0) {
          return fallbackCompletion.choices[0].message;
        }
      } catch (lighterError: any) {
        console.error('Lighter Groq model error:', lighterError?.message);
      }
    }

    // Second Fallback: OpenRouter
    if (!useFallback && process.env.OPENROUTER_API_KEY) {
      console.log('Switching to OpenRouter fallback...');
      return await getLLMResponse(messages, true, imagePath, onChunk);
    }
    throw error;
  }
}
