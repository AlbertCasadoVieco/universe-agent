import SSH2Promise from 'ssh2-promise';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Executes a command on a remote machine via SSH.
 * This is used for cybersecurity audits (e.g., checking persistence, logs, etc.)
 */
export async function executeRemoteCommand(command: string) {
  if (!process.env.SSH_HOST || !process.env.SSH_USER) {
    return { error: 'SSH target not configured in .env' };
  }

  const config = {
    host: process.env.SSH_HOST as string,
    username: process.env.SSH_USER as string,
    password: process.env.SSH_PASSWORD,
  };

  const ssh = new SSH2Promise(config as any);
  try {
    await ssh.connect();
    console.log(`[SSH] Running command: ${command}`);
    const output = await ssh.exec(command);
    await ssh.close();
    return { command, output };
  } catch (error: any) {
    console.error('SSH Error:', error.message);
    return { error: `SSH Command failed: ${error.message}` };
  }
}
