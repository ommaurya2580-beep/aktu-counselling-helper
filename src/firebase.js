import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC0Hce1w_Ov5r3DlPjxDGjBEM8n3auUqd0",
  authDomain: "aktu-counselling-data.firebaseapp.com",
  projectId: "aktu-counselling-data",
  storageBucket: "aktu-counselling-data.firebasestorage.app",
  messagingSenderId: "65649831543",
  appId: "1:65649831543:web:3b453d92bc8bff2ee82072",
  measurementId: "G-Q5P1HXBLQB"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
