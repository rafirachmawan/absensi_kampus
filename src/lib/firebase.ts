// src/lib/firebase.ts
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env
    .VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  throw new Error(
    "Firebase env belum terisi. Pastikan .env punya VITE_FIREBASE_* dan kamu sudah restart pnpm dev."
  );
}

// ✅ init app utama (hindari double init saat HMR)
const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// ===============================
// ✅ SECONDARY AUTH (buat bikin akun tanpa logout user utama)
// ===============================
let secondaryApp: FirebaseApp | null = null;
let secondaryAuth: Auth | null = null;

export function createSecondaryAuth(): Auth {
  if (!secondaryApp) {
    secondaryApp = initializeApp(firebaseConfig, "secondary");
  }
  if (!secondaryAuth) {
    secondaryAuth = getAuth(secondaryApp);
  }
  return secondaryAuth;
}
