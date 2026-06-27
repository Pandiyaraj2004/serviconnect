import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const hasRequiredConfig =
  import.meta.env.VITE_FIREBASE_API_KEY &&
  import.meta.env.VITE_FIREBASE_AUTH_DOMAIN &&
  import.meta.env.VITE_FIREBASE_PROJECT_ID &&
  import.meta.env.VITE_FIREBASE_APP_ID;

if (!hasRequiredConfig) {
  console.warn('⚠️  Firebase configuration is incomplete. Please check your .env file.');
  console.warn('Required: VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID');
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Only add databaseURL if it's set
if (import.meta.env.VITE_FIREBASE_DATABASE_URL) {
  firebaseConfig.databaseURL = import.meta.env.VITE_FIREBASE_DATABASE_URL;
}

let app = null;
let db = null;
let rtdb = null;
let auth = null;
let storage = null;
let googleProvider = null;

try {
  if (hasRequiredConfig) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
    googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });
    googleProvider.addScope('email');
    googleProvider.addScope('profile');

    if (import.meta.env.VITE_FIREBASE_DATABASE_URL) {
      rtdb = getDatabase(app);
    }

    console.log('✅ Firebase initialized successfully');
  }
} catch (error) {
  console.error('Firebase initialization error:', error.message);
  app = null;
  db = null;
  rtdb = null;
  auth = null;
  storage = null;
  googleProvider = null;
}

export const isFirebaseConfigured = Boolean(hasRequiredConfig && app && auth && db);
export const isRealtimeDatabaseConfigured = Boolean(isFirebaseConfigured && rtdb);

export { app, db, rtdb, auth, storage, googleProvider };
export default app;
