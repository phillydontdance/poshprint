// Firebase configuration
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyDHKIB41S1B5elpqKw5fh_BnO1zpFt0Q_E",
  authDomain: "posh-print.firebaseapp.com",
  projectId: "posh-print",
  storageBucket: "posh-print.firebasestorage.app",
  messagingSenderId: "534213473406",
  appId: "1:534213473406:web:2e1c4b9c95d1da5b7a942f",
  measurementId: "G-RHPHGDLMFS",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export default app;
