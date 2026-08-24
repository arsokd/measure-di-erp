// js/firebase-init.js - Firebase Initialization & Configuration

var firebaseConfig = {
  apiKey: "AIzaSyDnSkQzFdmpsc-HugVsYLxCdCG1NmTUnvA",
  authDomain: "measure-di-erp-e79e9.firebaseapp.com",
  projectId: "measure-di-erp-e79e9",
  storageBucket: "measure-di-erp-e79e9.firebasestorage.app",
  messagingSenderId: "805261041805",
  appId: "1:805261041805:web:8cf1aa26763d70365982c4"
};

var mainApp = null;
if (typeof firebase !== 'undefined') {
  if (firebase.apps && !firebase.apps.length) {
    try {
      mainApp = firebase.initializeApp(firebaseConfig);
    } catch (e) {
      console.warn("Firebase initializeApp caught error:", e);
    }
  } else if (firebase.apps && firebase.apps.length) {
    mainApp = firebase.app();
  }
}

var db = null;
var auth = null;
if (typeof firebase !== 'undefined') {
  try {
    if (mainApp && typeof mainApp.firestore === 'function') {
      db = mainApp.firestore();
    } else if (typeof firebase.firestore === 'function') {
      db = firebase.firestore();
    }
    if (mainApp && typeof mainApp.auth === 'function') {
      auth = mainApp.auth();
    } else if (typeof firebase.auth === 'function') {
      auth = firebase.auth();
    }
  } catch (e) {
    console.warn("Firebase firestore/auth init fallback:", e);
  }
}

window.db = db;
window.auth = auth;
window.firebaseConfig = firebaseConfig;
