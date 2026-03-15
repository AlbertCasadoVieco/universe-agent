import { getLLMResponse } from './llm.js';
import { executeTool } from '../tools/index.js';
import { getHistory, saveMessage } from '../database/firebase.js';

export async function runAgentLoop(userId: number, userInput: string, imagePath?: string) {
  const maxIterations = imagePath ? 1 : 5; // Limit to 1 iteration for vision to keep it simple
  let iterations = 0;

  console.log(`[AgentLoop] Starting for user ${userId}${imagePath ? ' (with image)' : ''}`);

  try {
    // Load history from Firestore
    console.log('[AgentLoop] Loading history...');
    const history = await getHistory(userId);
    console.log(`[AgentLoop] History loaded: ${history.length} messages`);

    const messages: any[] = [
      { 
        role: 'system', 
        content: 'Eres Universe Agent, un asistente de IA especializado en ciberseguridad creado por Albert Casadó Vieco, un estudiante de ciberseguridad e inteligencia artificial con grandes aspiraciones y curiosidades. Tu propósito es realizar auditorías de ciberseguridad y apoyar al equipo defensivo (Blue Team). Puedes ayudar monitorizando la red, analizando archivos pcap, encontrando persistencia de atacantes y fortaleciendo sistemas. Si te preguntan quién te creó, di que fue Albert Casadó Vieco y menciónalo como un estudiante apasionado por estos campos. Sé profesional, técnico y conciso.' 
      },
      ...history.map((msg: any) => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: userInput }
    ];

    // Save user message to Firestore
    console.log('[AgentLoop] Saving user message...');
    await saveMessage(userId, 'user', imagePath ? `[Imagen enviada] ${userInput}` : userInput);
    console.log('[AgentLoop] User message saved.');

    while (iterations < maxIterations) {
      iterations++;
      console.log(`[AgentLoop] Iteration ${iterations} - Calling LLM...`);
      const response = await getLLMResponse(messages, false, imagePath);
      console.log('[AgentLoop] LLM responded.');

      if (response.tool_calls && !imagePath) {
        console.log(`[AgentLoop] Tool calls detected: ${response.tool_calls.length}`);
        messages.push(response);
        
        for (const toolCall of response.tool_calls) {
          console.log(`[AgentLoop] Executing tool: ${toolCall.function.name}`);
          const result = await executeTool(toolCall.function.name, JSON.parse(toolCall.function.arguments));
          console.log(`[AgentLoop] Tool result obtained: ${JSON.stringify(result)}`);
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: JSON.stringify(result),
          });
        }
        continue;
      }

      // Regular text response
      if (response.content) {
        console.log('[AgentLoop] Saving assistant response...');
        await saveMessage(userId, 'assistant', response.content);
        console.log('[AgentLoop] Assistant response saved.');
        return response.content;
      }
    }

    console.log('[AgentLoop] Limit reached.');
    return imagePath ? "No he podido procesar la imagen correctamente." : "I've reached my iteration limit. How else can I help you?";
  } catch (error) {
    console.error('[AgentLoop] Error:', error);
    throw error;
  }
}
