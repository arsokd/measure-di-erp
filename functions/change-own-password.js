// Converted from netlify/functions/change-own-password.js - handler body
// unchanged from the version already proven live on Netlify; only the
// export at the bottom wraps it for Firebase Functions v2.
import { onRequest } from 'firebase-functions/v2/https';
import { adaptNetlifyHandler } from './_netlify-adapter.js';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function initFirebaseAdmin() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const saEnv = process.env.SERVICE_ACCOUNT_KEY;
  if (!saEnv) {
    throw new Error('SERVICE_ACCOUNT_KEY environment variable is missing.');
  }

  let serviceAccount;
  try {
    serviceAccount = typeof saEnv === 'string' ? JSON.parse(saEnv) : saEnv;
  } catch (err) {
    throw new Error('Failed to parse SERVICE_ACCOUNT_KEY JSON string: ' + err.message);
  }

  return initializeApp({
    credential: cert(serviceAccount)
  });
}

async function netlifyHandler(event) {
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

export const changeOwnPassword = onRequest(
  { secrets: ['SERVICE_ACCOUNT_KEY'] },
  adaptNetlifyHandler(netlifyHandler)
);
