import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from './config.js';

if (config.useEmulator) process.env.FIRESTORE_EMULATOR_HOST = config.emulatorHost;

const app = getApps()[0] || initializeApp(
  config.clientEmail && config.privateKey
    ? { credential: cert({ projectId: config.projectId, clientEmail: config.clientEmail, privateKey: config.privateKey }) }
    : { credential: applicationDefault(), projectId: config.projectId }
);

export const db = getFirestore(app);