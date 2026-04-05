import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import { join } from 'path';

dotenv.config();

const dbPath = process.env.DB_PATH || './memory.db';
const db = new Database(dbPath);

// Optimization pragmas for local high-performance
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -16000'); // 16MB cache

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS memory (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS processed_updates (
    id INTEGER PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

/**
 * Retrieves the conversation history for a specific user.
 * Limit is set higher for audit context (50 messages).
 */
export async function getHistory(userId: number) {
  try {
    const stmt = db.prepare('SELECT role, content FROM messages WHERE user_id = ? ORDER BY timestamp DESC LIMIT 50');
    const rows = stmt.all(userId);
    // Reverse to get chronological order
    return (rows as any[]).reverse();
  } catch (error) {
    console.error(`[SQLite] getHistory Error for ${userId}:`, error);
    return [];
  }
}

/**
 * Saves a message to the local SQLite database.
 */
export async function saveMessage(userId: number, role: string, content: string) {
  try {
    const stmt = db.prepare('INSERT INTO messages (user_id, role, content) VALUES (?, ?, ?)');
    stmt.run(userId, role, content);
  } catch (error) {
    console.error(`[SQLite] saveMessage Error for ${userId}:`, error);
  }
}

/**
 * Helper to check and mark an update as processed (Idempotency).
 * Useful for switching between Webhooks and Long Polling.
 */
export async function isUpdateProcessed(updateId: number) {
  try {
    const checkStmt = db.prepare('SELECT id FROM processed_updates WHERE id = ?');
    const exists = checkStmt.get(updateId);
    if (exists) return true;

    const insertStmt = db.prepare('INSERT INTO processed_updates (id) VALUES (?)');
    insertStmt.run(updateId);
    return false;
  } catch (error) {
    return false;
  }
}

export async function clearHistory(userId: number) {
  try {
    const stmt = db.prepare('DELETE FROM messages WHERE user_id = ?');
    stmt.run(userId);
    console.log(`[DB] History cleared for user ${userId}`);
  } catch (error) {
    console.error(`[DB] clearHistory Error for ${userId}:`, error);
  }
}

export default db;
