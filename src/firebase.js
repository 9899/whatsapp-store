
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBG9lNFZ2suO2Dun7do0KrZYtsp-EiNgK4",
  authDomain: "whatsapp-store-1188d.firebaseapp.com",
  projectId: "whatsapp-store-1188d",
  storageBucket: "whatsapp-store-1188d.firebasestorage.app",
  messagingSenderId: "1077843818574",
  appId: "1:1077843818574:web:998490548de9631197eb1f",
  measurementId: "G-PM83Z1EQXW"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();