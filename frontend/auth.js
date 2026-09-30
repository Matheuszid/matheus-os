import {
  auth,
  firebaseEnabled,
  googleProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from './firebase.js';

export async function loginWithGoogle() {
  if (!firebaseEnabled || !auth) {
    throw new Error('Firebase não configurado. Preencha as variáveis de ambiente do projeto.');
  }

  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function logoutCurrentUser() {
  if (!firebaseEnabled || !auth) {
    return;
  }

  await signOut(auth);
}

export function observeAuthState(callback) {
  if (!firebaseEnabled || !auth) {
    return () => {};
  }

  return onAuthStateChanged(auth, callback);
}
