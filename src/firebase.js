// ============================================================
//  firebase.js — Configuração do Firebase
//  Lab de Mitigação de Tempestades — Depto de Física / UFSC
//
//  IMPORTANTE: Substitua os valores abaixo pelas credenciais
//  reais do projeto Firebase do LABMIT.
// ============================================================

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyANL8rYHCCA4uA-fp1hHo9hu-5CNjMi_sE",
  authDomain: "labmit-ufsc.firebaseapp.com",
  projectId: "labmit-ufsc",
  storageBucket: "labmit-ufsc.firebasestorage.app",
  messagingSenderId: "131959818886",
  appId: "1:131959818886:web:4617d2f3b0274a44f2df07",
  measurementId: "G-XRQ4JGCY1H"
};

let app = null;
let db = null;
let auth = null;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
} catch (e) {
  console.warn('[Firebase] Configuração incompleta — dados serão salvos apenas localmente.', e.message);
}

// Autenticação anônima automática
let currentUid = null;

export async function ensureAuth() {
  if (!auth) return null;
  if (currentUid) return currentUid;

  try {
    const result = await signInAnonymously(auth);
    currentUid = result.user.uid;
    console.log('[Firebase] Auth anônimo:', currentUid);
    return currentUid;
  } catch (e) {
    console.warn('[Firebase] Auth falhou:', e.message);
    return null;
  }
}

// Listener para mudanças de auth
if (auth) {
  onAuthStateChanged(auth, (user) => {
    currentUid = user?.uid || null;
  });
}

export { db, auth, currentUid };
export default app;
