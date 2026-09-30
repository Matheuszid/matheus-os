import { db } from '../firebase.js';
import { config } from '../config.js';

const capturesRef = () => db.collection('users').doc(config.uid).collection('captures');

export async function addCapture(text: string) {
  const reference = capturesRef().doc();
  await reference.set({ text, status: 'inbox', createdAt: new Date(), convertedProjectId: null });
  return { id: reference.id, text, status: 'inbox' };
}

export async function listCaptures(status = 'inbox') {
  const snapshot = await capturesRef().where('status', '==', status).get();
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}