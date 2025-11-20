import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// TODO: Replace every placeholder with your project keys from the Firebase console.
const firebaseConfig = {
    apiKey: "AIzaSyA2dgBwntUckU5oUtFhbiwdbnRSt2Tl2fw",
    authDomain: "studybuddy-3e4cf.firebaseapp.com",
    projectId: "studybuddy-3e4cf",
    storageBucket: "studybuddy-3e4cf.firebasestorage.app",
    messagingSenderId: "447281269418",
    appId: "1:447281269418:web:b6ab0023997792734cded3"
  };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };

