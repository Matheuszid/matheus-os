import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';

import { db, firebaseEnabled } from './firebase.js';

function guard() {
  if (!firebaseEnabled || !db) {
    throw new Error('Firebase Firestore não inicializado. Verifique as variáveis de ambiente.');
  }
}

export async function getProjects(uid) {
  guard();
  const ref = collection(db, 'users', uid, 'projects');
  const snapshot = await getDocs(ref);
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

export function listenProjects(uid, callback, onError) {
  guard();
  return onSnapshot(collection(db, 'users', uid, 'projects'), (snapshot) => {
    callback(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
  }, onError);
}

export async function getProject(uid, projectId) {
  guard();
  const ref = doc(db, 'users', uid, 'projects', projectId);
  const snapshot = await getDoc(ref);
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function createProject(uid, projectId, projectData) {
  guard();
  const ref = doc(db, 'users', uid, 'projects', projectId);
  await setDoc(ref, {
    ...projectData,
    createdAt: projectData.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
    completedAt: projectData.completedAt || null,
    status: projectData.status || 'active',
    mode: projectData.mode || 'fast'
  });
  return { id: projectId, ...projectData };
}

export async function updateProject(uid, projectId, data) {
  guard();
  const ref = doc(db, 'users', uid, 'projects', projectId);
  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp()
  });
}

export async function saveAnswer(uid, projectId, phase, question, answer) {
  guard();
  const answerQuestion = answer === undefined ? phase : question;
  const answerValue = answer === undefined ? question : answer;
  const safeId = String(answerQuestion).trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const ref = doc(db, 'users', uid, 'projects', projectId, 'answers', safeId || 'answer');
  await setDoc(ref, {
    question: answerQuestion,
    answer: answerValue,
    updatedAt: serverTimestamp()
  });
  return safeId;
}

export async function loadAnswers(uid, projectId) {
  return getAnswers(uid, projectId);
}

export async function getAnswers(uid, projectId) {
  guard();
  const ref = collection(db, 'users', uid, 'projects', projectId, 'answers');
  const snapshot = await getDocs(ref);
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

export async function addLearning(uid, projectId, text) {
  guard();
  const ref = doc(db, 'users', uid, 'projects', projectId, 'learnings', `${Date.now()}`);
  await setDoc(ref, {
    text,
    createdAt: serverTimestamp()
  });
}

export async function getLearnings(uid, projectId) {
  guard();
  const ref = collection(db, 'users', uid, 'projects', projectId, 'learnings');
  const snapshot = await getDocs(ref);
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

export async function getCaptures(uid) {
  guard();
  const ref = collection(db, 'users', uid, 'captures');
  const snapshot = await getDocs(ref);
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

export function listenCaptures(uid, callback, onError) {
  guard();
  return onSnapshot(collection(db, 'users', uid, 'captures'), (snapshot) => {
    callback(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
  }, onError);
}

export async function createCapture(uid, text) {
  guard();
  const ref = doc(collection(db, 'users', uid, 'captures'));
  await setDoc(ref, {
    text: typeof text === 'string' ? text : text.text,
    status: 'inbox',
    createdAt: serverTimestamp(),
    convertedProjectId: null
  });
  return ref.id;
}

export async function updateCapture(uid, captureId, data) {
  guard();
  const ref = doc(db, 'users', uid, 'captures', captureId);
  await updateDoc(ref, data);
}

export async function deleteCapture(uid, captureId) {
  guard();
  await deleteDoc(doc(db, 'users', uid, 'captures', captureId));
}

export async function getRelations(uid) {
  guard();
  const ref = collection(db, 'users', uid, 'relations');
  const snapshot = await getDocs(ref);
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

export function listenRelations(uid, callback, onError) {
  guard();
  return onSnapshot(collection(db, 'users', uid, 'relations'), (snapshot) => {
    callback(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
  }, onError);
}

export async function createRelation(uid, relationData) {
  guard();
  const relationId = relationData.id || `${relationData.from}--${relationData.to}`;
  const ref = doc(db, 'users', uid, 'relations', relationId);
  await setDoc(ref, {
    ...relationData,
    createdAt: serverTimestamp(),
    type: relationData.type || 'related'
  }, { merge: true });
  return relationId;
}

export async function getAchievements(uid) {
  guard();
  const ref = collection(db, 'users', uid, 'achievements');
  const snapshot = await getDocs(ref);
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

export function listenAchievements(uid, callback, onError) {
  guard();
  return onSnapshot(collection(db, 'users', uid, 'achievements'), (snapshot) => {
    callback(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
  }, onError);
}

export async function createAchievement(uid, achievementData) {
  guard();
  const ref = doc(db, 'users', uid, 'achievements', achievementData.projectId || `${Date.now()}`);
  await setDoc(ref, {
    ...achievementData,
    completedAt: serverTimestamp()
  }, { merge: true });
  return ref.id;
}

export async function completeProject(uid, projectId, title) {
  guard();
  const batch = writeBatch(db);
  const now = serverTimestamp();
  const projectRef = doc(db, 'users', uid, 'projects', projectId);
  const achievementRef = doc(db, 'users', uid, 'achievements', projectId);
  batch.update(projectRef, {
    status: 'completed',
    completedAt: now,
    updatedAt: now
  });
  batch.set(achievementRef, {
    title: title || 'Projeto concluído',
    area: 'Pessoal',
    projectId,
    completedAt: now
  });
  await batch.commit();
}
