// See send-email.js for why this uses firebase-admin's modular subpath
// imports instead of `import admin from 'firebase-admin'` — the classic
// default import breaks under Netlify's esbuild-bundled ESM functions,
// crashing every invocation with "Cannot read properties of undefined
// (reading 'length')" at admin.apps.length before any real logic runs.
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

  try {
    const userDoc = await getFirestore().collection('users').doc(callerUid).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    const callerRole = userData ? userData.role : null;

    if (callerRole !== 'super_admin' && callerRole !== 'admin') {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Forbidden. Only Super Admin or Admin can reset passwords.' })
      };
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Error verifying authorization role in Firestore: ' + (err.message || err) })
    };
  }

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

  const { targetUid, targetEmail, newPassword } = body || {};

  if ((!targetUid || typeof targetUid !== 'string') && (!targetEmail || typeof targetEmail !== 'string')) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Target employee UID or email is required.' })
    };
  }

  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Password must be at least 6 characters long.' })
    };
  }

  try {
    var uidToUpdate = targetUid || null;
    var createdFresh = false;

    // No known UID (e.g. the employee record was never tagged with one,
    // or this is the very first login being set up for them) — resolve it
    // by email instead. This is what the old client-side fallback tried to
    // do with createUserWithEmailAndPassword() and always failed at: that
    // call rejects with EMAIL_EXISTS the moment the email already has a
    // real account, which is true for almost every existing employee, so
    // the "reset" silently did nothing while the app still reported
    // success. Doing the lookup server-side with the Admin SDK lets us
    // tell the two cases apart correctly and handle both.
    if (!uidToUpdate) {
      try {
        var existingUser = await getAuth().getUserByEmail(targetEmail);
        uidToUpdate = existingUser.uid;
      } catch (lookupErr) {
        if (lookupErr.code === 'auth/user-not-found') {
          var newUser = await getAuth().createUser({ email: targetEmail, password: newPassword });
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, uid: newUser.uid, created: true, message: 'New login created for ' + targetEmail })
          };
        }
        throw lookupErr;
      }
    }

    await getAuth().updateUser(uidToUpdate, { password: newPassword });
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, uid: uidToUpdate, created: false, message: 'Password reset successfully for UID ' + uidToUpdate })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to reset password in Firebase Auth: ' + (err.message || err) })
    };
  }
}
