import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage'; // Import getStorage

const firebaseConfig = {
  apiKey: 'AIzaSyBAHGk6bSlI2k_txvG2WutJO-hnkTQFdqo',
  authDomain: 'wepartyinventory.firebaseapp.com',
  projectId: 'wepartyinventory',
  storageBucket: 'wepartyinventory.firebasestorage.app',
  messagingSenderId: '78560816510',
  appId: '1:78560816510:web:e8c206018d0f115b43972f',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Auth
export const auth = getAuth(app);

// Initialize Storage
export const storage = getStorage(app); // Export storage

export default app;