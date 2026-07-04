import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

// Cấu hình Firebase từ firebase-applet-config.json
const firebaseConfig = {
  projectId: "educreate-9e28f",
  appId: "1:593094757464:web:f26a1a01d20c38c2074e2d",
  apiKey: "AIzaSyAxFioRSsmemXr7xaXXxEo99-wi0mt83pY",
  authDomain: "educreate-9e28f.firebaseapp.com",
  storageBucket: "educreate-9e28f.firebasestorage.app",
  messagingSenderId: "593094757464",
  measurementId: ""
};

const app = initializeApp(firebaseConfig);
export const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
