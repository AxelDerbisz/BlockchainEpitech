import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBaGqJHEZxvG_3XoesPge31_gn5x0J3rtY",
    authDomain: "blockchain-epitech.firebaseapp.com",
    projectId: "blockchain-epitech",
    storageBucket: "blockchain-epitech.firebasestorage.app",
    messagingSenderId: "369197253643",
    appId: "1:369197253643:web:9dc3b74e182ff2483ff30e",
    measurementId: "G-WFMN3LPBZB"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
