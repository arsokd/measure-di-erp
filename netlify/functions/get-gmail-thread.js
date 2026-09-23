// Reads back a Gmail thread (the client's replies included) by
// impersonating the mailbox that owns it, via Google Workspace
// domain-wide delegation. This is what makes the Communication Timeline
// two-way: whatever the client replies with in their inbox shows up here
// too, not just what the app itself sent.
//
// Endpoint: POST /.netlify/functions/get-gmail-thread
// Requires a valid Firebase ID token. Any signed-in user may read any
// thread they have a threadId for - the same trust level this app
// already gives to reading the underlying Quotation/Invoice record
// itself (see firestore.rules), not a new escalation.
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getImpersonatedAccessToken } from './_shared/gmail-client.js';

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
  return initializeApp({ credential: cert(serviceAccount) });
}

function decodeBase64Url(data) {
  if (!data) return '';
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf-8');
}

function getHeader(headersList, name) {
  const found = (headersList || []).find(h => h.name.toLowerCase() === name.toLowerCase());
  return found ? found.value : '';
}

// Gmail message payloads can be a single part or a MIME tree; walk it to
// find the best body to show (prefer HTML, fall back to plain text).
function extractBody(payload) {
  if (!payload) return { html: '', text: '' };

  if (payload.body && payload.body.data && payload.mimeType) {
    if (payload.mimeType === 'text/html') return { html: decodeBase64Url(payload.body.data), text: '' };
    if (payload.mimeType === 'text/plain') return { html: '', text: decodeBase64Url(payload.body.data) };
  }

  let html = '';
  let text = '';
  (payload.parts || []).forEach(part => {
    if (part.mimeType === 'text/html' && part.body && part.body.data && !html) {
      html = decodeBase64Url(part.body.data);
    } else if (part.mimeType === 'text/plain' && part.body && part.body.data && !text) {
      text = decodeBase64Url(part.body.data);
    } else if (part.parts) {
      const nested = extractBody(part);
      if (nested.html && !html) html = nested.html;
      if (nested.text && !text) text = nested.text;
    }
  });
  return { html, text };
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
    return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: 'Method Not Allowed. Use POST.' }) };
  }

  try {
    initFirebaseAdmin();
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: err.message || 'Firebase Admin initialization failed.' }) };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return { statusCode: 401, headers, body: JSON.stringify({ success: false, error: 'Unauthorized. Missing or invalid Bearer token.' }) };
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    await getAuth().verifyIdToken(idToken);
  } catch (err) {
    return { statusCode: 401, headers, body: JSON.stringify({ success: false, error: 'Unauthorized. Invalid or expired Firebase ID token: ' + (err.message || err) }) };
  }

  let body;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  } catch (err) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Invalid JSON request payload.' }) };
  }

  const { threadId, mailboxOwner } = body || {};
  if (!threadId) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'threadId is required.' }) };
  }
  if (!mailboxOwner) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'mailboxOwner (the @measuredi.com mailbox this thread lives in) is required.' }) };
  }

  let accessToken;
  try {
    accessToken = await getImpersonatedAccessToken(mailboxOwner);
  } catch (err) {
    return { statusCode: 422, headers, body: JSON.stringify({ success: false, error: err.message, notOnWorkspaceDomain: true }) };
  }

  try {
    const gmailRes = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/threads/' + encodeURIComponent(threadId) + '?format=full',
      { headers: { 'Authorization': 'Bearer ' + accessToken } }
    );
    const gmailData = await gmailRes.json();

    if (!gmailRes.ok) {
      console.error('[Gmail Thread Fetch Error]', gmailData);
      return {
        statusCode: gmailRes.status,
        headers,
        body: JSON.stringify({ success: false, error: (gmailData.error && gmailData.error.message) || 'Gmail API rejected the thread fetch.', details: gmailData })
      };
    }

    const messages = (gmailData.messages || []).map(msg => {
      const msgHeaders = msg.payload ? msg.payload.headers : [];
      const { html, text } = extractBody(msg.payload);
      return {
        id: msg.id,
        from: getHeader(msgHeaders, 'From'),
        to: getHeader(msgHeaders, 'To'),
        subject: getHeader(msgHeaders, 'Subject'),
        date: getHeader(msgHeaders, 'Date'),
        snippet: msg.snippet || '',
        html,
        text,
        internalDate: msg.internalDate
      };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, threadId: gmailData.id, messages })
    };
  } catch (err) {
    console.error('[GetGmailThread Exception]', err);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: err.message || 'Internal server error while connecting to Gmail API.' }) };
  }
}
