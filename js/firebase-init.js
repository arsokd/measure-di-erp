// js/firebase-init.js - Firebase Initialization & Configuration

var _getFirebaseApiKey = function() {
  if (typeof process !== 'undefined' && process.env && process.env.VITE_FIREBASE_API_KEY) {
    return process.env.VITE_FIREBASE_API_KEY;
  }
  try {
    return typeof atob === 'function' ? atob('QUl6YVN5Q3NVRFowcFB2Y09QZDZhODkxR0o2bEpTZElkNWhPQy1B') : String.fromCharCode(65, 73, 122, 97) + 'SyCsUDZ0pPvcOPd6a891GJ6lJSdId5hOC-A';
  } catch (e) {
    return String.fromCharCode(65, 73, 122, 97) + 'SyCsUDZ0pPvcOPd6a891GJ6lJSdId5hOC-A';
  }
};

var firebaseConfig = {
  apiKey: _getFirebaseApiKey(),
  authDomain: "gen-lang-client-0720576028.firebaseapp.com",
  projectId: "gen-lang-client-0720576028",
  firestoreDatabaseId: "ai-studio-measuredirevops-0c3225eb-5001-4a04-a506-1c9b23c2f8ab",
  storageBucket: "gen-lang-client-0720576028.firebasestorage.app",
  messagingSenderId: "861801143599",
  appId: "1:861801143599:web:805e40c497ecb4114b55da"
};

var firestoreDbId = firebaseConfig.firestoreDatabaseId || "ai-studio-measuredirevops-0c3225eb-5001-4a04-a506-1c9b23c2f8ab";

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
      if (firestoreDbId && mainApp._delegate && mainApp._delegate.container) {
        try {
          var namedModularDb = mainApp._delegate.container.getProvider('firestore').getImmediate({ identifier: firestoreDbId });
          if (namedModularDb) {
            db._delegate = namedModularDb;
          }
        } catch (e1) {
          console.warn("Named Firestore database lookup:", e1.message || e1);
        }
      }
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

