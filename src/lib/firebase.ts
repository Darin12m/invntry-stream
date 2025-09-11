import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBAHGk6bSlI2k_txvG2WutJO-hnkTQFdqo",
  authDomain: "wepartyinventory.firebaseapp.com",
  projectId: "wepartyinventory",
  storageBucket: "wepartyinventory.firebasestorage.app",
  messagingSenderId: "78560816510",
  appId: "1:78560816510:web:e8c206018d0f115b43972f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

export default app;