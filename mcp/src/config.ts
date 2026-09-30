import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function serviceAccountValue(name: 'client_email' | 'private_key'): string | undefined {
  const file = process.env.FIREBASE_SERVICE_ACCOUNT_FILE?.trim();
  if (file) {
    const filePath = path.resolve(process.cwd(), file);
    const account = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, string>;
    if (account[name]) return account[name];
  }
  return process.env[name === 'client_email' ? 'FIREBASE_CLIENT_EMAIL' : 'FIREBASE_PRIVATE_KEY']?.replace(/\\n/g, '\n') || undefined;
}

export const config = {
  projectId: required('FIREBASE_PROJECT_ID'),
  uid: required('MATHEUS_OS_UID'),
  clientEmail: serviceAccountValue('client_email')?.trim() || undefined,
  privateKey: serviceAccountValue('private_key'),
  useEmulator: process.env.USE_FIREBASE_EMULATOR === 'true',
  emulatorHost: process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080',
  apiKey: process.env.MCP_API_KEY?.trim() || '',
  port: Number(process.env.PORT || 8787)
};