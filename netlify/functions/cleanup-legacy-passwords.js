// One-time cleanup: strips the legacy plaintext `password`/`customPassword`
// fields that used to be written to each employees/{docId} document
// alongside the real Firebase Auth reset. That collection is readable by
// every signed-in user (needed for dropdowns/approval routing), so those
// fields let anyone read anyone else's real login password. The app no
// longer writes them (see js/employees.js), but documents created before
// that fix still have them sitting in production - this function removes
// them. Safe to run more than once: it only ever deletes fields, never
// touches anything else on the document, and does nothing once there's
// nothing left to clean.
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

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
        body: JSON.stringify({ error: 'Forbidden. Only Super Admin or Admin can run this cleanup.' })
      };
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Error verifying authorization role in Firestore: ' + (err.message || err) })
    };
  }

  try {
    const db = getFirestore();
    const snap = await db.collection('employees').get();

    let checked = 0;
    let cleaned = 0;
    let batch = db.batch();
    let opsInBatch = 0;

    for (const doc of snap.docs) {
      checked++;
      const data = doc.data();
      if ('password' in data || 'customPassword' in data) {
        batch.update(doc.ref, {
          password: FieldValue.delete(),
          customPassword: FieldValue.delete()
        });
        cleaned++;
        opsInBatch++;

        if (opsInBatch >= 400) {
          await batch.commit();
          batch = db.batch();
          opsInBatch = 0;
        }
      }
    }

    if (opsInBatch > 0) {
      await batch.commit();
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        totalChecked: checked,
        cleaned: cleaned,
        message: cleaned === 0
          ? 'No plaintext password fields found - nothing to clean.'
          : 'Removed plaintext password fields from ' + cleaned + ' of ' + checked + ' employee record(s).'
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Cleanup failed: ' + (err.message || err) })
    };
  }
}
