import { tools as timeTools } from './time.js';
import { checkIPReputation, checkFileHash } from './threat_intel.js';
import { executeRemoteCommand } from './ssh.js';

export const toolRegistry = {
  ...timeTools,
  checkIPReputation: {
    description: 'Check the reputation of an IP address using VirusTotal.',
    parameters: {
      type: 'object',
      properties: {
        ip: { type: 'string', description: 'The IPv4 address to check.' },
      },
      required: ['ip'],
    },
    execute: async ({ ip }: any) => await checkIPReputation(ip),
  },
  checkFileHash: {
    description: 'Check the reputation of a file hash (SHA-256, SHA-1, MD5) using VirusTotal.',
    parameters: {
      type: 'object',
      properties: {
        hash: { type: 'string', description: 'The file hash to check.' },
      },
      required: ['hash'],
    },
    execute: async ({ hash }: any) => await checkFileHash(hash),
  },
  executeRemoteCommand: {
    description: 'Execute a command on a remote machine via SSH for security auditing.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The command to execute (e.g., ls -la, netstat -ano).' },
      },
      required: ['command'],
    },
    execute: async ({ command }: any, isMaster?: boolean) => {
      if (!isMaster) throw new Error("Acceso Denegado: Solo el Admin (Albert) puede ejecutar comandos SSH.");
      return await executeRemoteCommand(command);
    },
  },
};

export type ToolName = keyof typeof toolRegistry;

export async function executeTool(name: string, args: any, isMaster = false) {
  const tool = toolRegistry[name as ToolName];
  if (!tool) {
    throw new Error(`Tool ${name} not found`);
  }
  return await (tool as any).execute(args, isMaster);
}

export const toolDefinitions = Object.entries(toolRegistry).map(([name, tool]) => ({
  type: 'function',
  function: {
    name,
    description: tool.description,
    parameters: tool.parameters,
  },
}));
