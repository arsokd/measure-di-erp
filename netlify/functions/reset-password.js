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

  // Whatever Firebase Auth account we end up resetting/creating, make sure
  // its users/{uid} authorization doc actually matches this person's real
  // employee record. Without this, a brand-new account (e.g. someone's
  // first login under a newly-assigned domain email) authenticates fine
  // but has no role/employeeId anywhere the app can find — it renders as
  // a generic "User"/"staff" account with none of their real access,
  // even though the password reset itself succeeded. This also quietly
  // self-heals an EXISTING account whose users/{uid} doc was missing or
  // stale, the same way an admin resetting a password already fixes it.
  async function syncUsersDocFromEmployeeRecord(uid, email) {
    try {
      var empSnap = await getFirestore().collection('employees')
        .where('email', '==', email)
        .limit(1)
        .get();
      if (empSnap.empty) return;
      var emp = empSnap.docs[0].data() || {};
      await getFirestore().collection('users').doc(uid).set({
        role: emp.role || 'staff',
        employeeId: emp.employeeId || '',
        isPrimaryApprover: emp.isPrimaryApprover === true,
        isDirector: emp.isDirector === true,
        isFinalApprover: emp.isFinalApprover === true,
        isFinanceHead: emp.isFinanceHead === true,
        isMasterDataAdmin: emp.isMasterDataAdmin === true
      }, { merge: true });
    } catch (errSync) {
      // Never let this block the actual password reset — worst case the
      // login-time self-heal in the app itself catches it on next sign-in.
      console.warn('Could not sync users/{uid} from employee record:', errSync);
    }
  }

  try {
    var uidToUpdate = null;

    // Resolve by EMAIL first, whenever an email is given — email is the
    // sole real login identifier now (login is email-only), so it's the
    // only thing guaranteed to be current. A client-cached targetUid can
    // be stale (e.g. left over from an earlier broken attempt, or never
    // refreshed after some other change) and silently point at the WRONG
    // Firebase Auth account — updating that account's password would
    // report success while doing nothing for the account the person
    // actually logs in with. Only fall back to the client-supplied
    // targetUid when no email was provided at all.
    if (targetEmail) {
      try {
        var existingUser = await getAuth().getUserByEmail(targetEmail);
        uidToUpdate = existingUser.uid;
      } catch (lookupErr) {
        if (lookupErr.code === 'auth/user-not-found') {
          // No real account for this email — this is what the old
          // client-side fallback (createUserWithEmailAndPassword) tried
          // and always failed at for anyone who already had a real
          // account, since that call rejects with EMAIL_EXISTS the
          // moment the email is already registered. Doing this
          // server-side with the Admin SDK lets us tell "genuinely new"
          // and "already exists" apart correctly and handle both.
          var newUser = await getAuth().createUser({ email: targetEmail, password: newPassword });
          await syncUsersDocFromEmployeeRecord(newUser.uid, targetEmail);
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, uid: newUser.uid, created: true, message: 'New login created for ' + targetEmail })
          };
        }
        throw lookupErr;
      }
    } else if (targetUid) {
      uidToUpdate = targetUid;
    }

    if (!uidToUpdate) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Could not resolve which account to reset.' })
      };
    }

    await getAuth().updateUser(uidToUpdate, { password: newPassword });
    if (targetEmail) {
      await syncUsersDocFromEmployeeRecord(uidToUpdate, targetEmail);
    }
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
