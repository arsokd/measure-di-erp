// Lets any signed-in person change their OWN password - unlike
// reset-password.js (deliberately Super Admin/Admin only, and able to
// target anyone), this function only ever touches the account of whoever
// the verified Firebase ID token belongs to. There is no targetUid/
// targetEmail parameter here on purpose: the account to change is always
// resolved from the token itself, so this endpoint can never be used to
// change someone else's password no matter what a caller sends it.
//
// See send-email.js for why this uses firebase-admin's modular subpath
// imports instead of `import admin from 'firebase-admin'` — the classic
// default import breaks under Netlify's esbuild-bundled ESM functions.
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function initFirebaseAdmin() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!saEnv) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is missing.');
  }

  let serviceAccount;
  try {
    serviceAccount = typeof saEnv === 'string' ? JSON.parse(saEnv) : saEnv;
  } catch (err) {
    throw new Error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON string: ' + err.message);
  }

  return initializeApp({
    credential: cert(serviceAccount)
  });
}

export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed. Use POST.' })
    };
  }

  try {
    initFirebaseAdmin();
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message || 'Firebase Admin initialization failed.' })
    };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized. Missing or invalid Bearer token.' })
    };
  }

  const idToken = authHeader.split('Bearer ')[1];
  let decodedToken;
  try {
    decodedToken = await getAuth().verifyIdToken(idToken);
  } catch (err) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized. Invalid or expired Firebase ID token: ' + (err.message || err) })
    };
  }

  const callerUid = decodedToken.uid;
  const callerEmail = decodedToken.email || '';

  let body;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  } catch (err) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid JSON request body.' })
    };
  }

  const { newPassword } = body || {};

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Password must be at least 6 characters long.' })
    };
  }

  try {
    await getAuth().updateUser(callerUid, { password: newPassword });
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to update password in Firebase Auth: ' + (err.message || err) })
    };
  }

  // Clear the forced-change flag and restart the 90-day clock on the
  // matching employee record. Resolved by email (the login identifier),
  // same lookup reset-password.js already uses - never let a failure here
  // undo the password change that already succeeded above.
  try {
    if (callerEmail) {
      var empSnap = await getFirestore().collection('employees')
        .where('email', '==', callerEmail)
        .limit(1)
        .get();
      if (!empSnap.empty) {
        await empSnap.docs[0].ref.set({
          mustChangePassword: false,
          passwordLastUpdated: new Date().toISOString()
        }, { merge: true });
      }
    }
  } catch (errEmpUpdate) {
    console.warn('Password changed, but could not update employees record:', errEmpUpdate);
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, uid: callerUid })
  };
}
