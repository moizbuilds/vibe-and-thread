import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBJm2pYoLyXSj6u_XPEb6_xWTyXUyIXZhE',
  authDomain: 'vibethread-ad718.firebaseapp.com',
  projectId: 'vibethread-ad718',
  storageBucket: 'vibethread-ad718.firebasestorage.app',
  messagingSenderId: '810552956904',
  appId: '1:810552956904:web:b791ef6c6d4679a013b65d',
};

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getFirestore(app);
