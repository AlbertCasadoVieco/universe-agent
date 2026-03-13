import { tools as timeTools } from './time.js';

export const toolRegistry = {
  ...timeTools,
};

export type ToolName = keyof typeof toolRegistry;

export async function executeTool(name: string, args: any) {
  const tool = toolRegistry[name as ToolName];
  if (!tool) {
    throw new Error(`Tool ${name} not found`);
  }
  return await (tool as any).execute(args);
}

export const toolDefinitions = Object.entries(toolRegistry).map(([name, tool]) => ({
  type: 'function',
  function: {
    name,
    description: tool.description,
    parameters: tool.parameters,
  },
}));
