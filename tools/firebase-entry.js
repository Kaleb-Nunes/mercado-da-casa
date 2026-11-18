import { initializeApp } from "firebase/app";
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, signInAnonymously, onAuthStateChanged, connectAuthEmulator } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache, doc, collection, setDoc, deleteDoc, onSnapshot, getDoc, getDocs, writeBatch, serverTimestamp, deleteField, connectFirestoreEmulator } from "firebase/firestore";
window.FBSDK = { initializeApp, initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, signInAnonymously, onAuthStateChanged, connectAuthEmulator,
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache, doc, collection, setDoc, deleteDoc, onSnapshot, getDoc, getDocs, writeBatch, serverTimestamp, deleteField, connectFirestoreEmulator };
