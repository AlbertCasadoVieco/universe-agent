import { getLLMResponse } from './llm.js';
import { executeTool } from '../tools/index.js';
import { getHistory, saveMessage } from '../database/db.js';
import { SYSTEM_PROMPT } from './prompt.js';

export async function runAgentLoop(userId: number, userInput: string, imagePath?: string) {
  const maxIterations = imagePath ? 1 : 10; // Increased to 10 for better audit capabilities
  let iterations = 0;

  console.log(`[AgentLoop] Starting for user ${userId}${imagePath ? ' (with image)' : ''}`);

  try {
    // Load history from Firestore
    console.log('[AgentLoop] Loading history...');
    const chatHistory = await getHistory(userId);
    console.log(`[AgentLoop] History loaded: ${chatHistory.length} messages`);

    const messages: any[] = [
      { 
        role: 'system', 
        content: SYSTEM_PROMPT
      },
      ...chatHistory.map((msg: any) => ({ role: msg.role, content: msg.content })),
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
