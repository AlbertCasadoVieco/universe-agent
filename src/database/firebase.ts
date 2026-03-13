import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const serviceAccountPath = process.env.LOCAL_SERVICE_ACCOUNT_PATH || './service-account.json';
const fullPath = join(process.cwd(), serviceAccountPath);

try {
  if (process.env.FUNCTIONS_EMULATOR || process.env.K_SERVICE) {
    // Running in Cloud Functions (or emulator), use default credentials
    admin.initializeApp({
      projectId: 'universe-agent'
    });
    console.log('✅ Firebase Admin initialized with default credentials (Cloud)');
  } else {
    // Local execution with service account file
    const serviceAccount = JSON.parse(readFileSync(fullPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Firebase Admin initialized with service-account.json (Local)');
  }
} catch (error) {
  console.error('❌ Error initializing Firebase Admin:', error);
}

const firestoreInstance = admin.firestore();
console.log('✅ Firestore instance obtained');
export const db = firestoreInstance;

// Helper to get conversation history
export async function getHistory(userId: number) {
  try {
    console.log(`[Firestore] Fetching history for ${userId}...`);
    const snapshot = await db.collection('conversations')
      .doc(userId.toString())
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .get();
    console.log(`[Firestore] History fetched: ${snapshot.size} messages`);
    return snapshot.docs.map(doc => doc.data());
  } catch (error) {
    console.error(`[Firestore] getHistory Error for ${userId}:`, error);
    throw error;
  }
}

// Helper to save message
export async function saveMessage(userId: number, role: string, content: string) {
  try {
    console.log(`[Firestore] Saving ${role} message for ${userId}...`);
    await db.collection('conversations')
      .doc(userId.toString())
      .collection('messages')
      .add({
        role,
        content,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    console.log(`[Firestore] Message saved for ${userId}`);
  } catch (error) {
    console.error(`[Firestore] saveMessage Error for ${userId}:`, error);
    throw error;
  }
}
