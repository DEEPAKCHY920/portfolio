// firebase.js
// Firebase configuration using credentials from user screenshot
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCBPsDaxf9P_M6vpKgWLqMIvVh4dHofkqI",
  authDomain: "deepak-portfolio-a0632.firebaseapp.com",
  projectId: "deepak-portfolio-a0632",
  storageBucket: "deepak-portfolio-a0632.firebasestorage.app",
  messagingSenderId: "971284835411",
  appId: "1:971284835411:web:f7314bcb29d8d3337eeaa6",
  measurementId: "G-17HJ2XQEHQ"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Export instances to window for global access
window.db = firebase.firestore();
window.auth = firebase.auth();
