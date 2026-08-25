/**
 * Netlify Function / API Proxy to securely dispatch emails via Brevo API
 * Endpoint: POST /.netlify/functions/send-email or /api/send-email
 *
 * Requires a valid Firebase ID token (Authorization: Bearer <token>) from a
 * signed-in app user. The Brevo API key lives only in this function's
 * environment — it is never embedded in client code.
 */

// Use firebase-admin's modular subpath imports (firebase-admin/app, /auth),
// not the classic `import admin from 'firebase-admin'` default import. The
// classic default import goes through a CJS/ESM interop layer that breaks
// under Netlify's esbuild-bundled ESM functions — `admin` resolves to
// something that isn't the real namespace object, so `admin.apps` is
// undefined and every invocation crashes immediately with
// "Cannot read properties of undefined (reading 'length')" before the
// function ever reaches Brevo. The modular imports below don't go through
// that interop path.
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

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

const DEFAULT_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'measuredichennai@gmail.com';
const DEFAULT_SENDER_NAME = 'Measure DI Systems & Services';

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
      body: JSON.stringify({ success: false, error: 'Method Not Allowed. Use POST.' })
    };
  }

  if (!process.env.BREVO_API_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: 'Email service is not configured.' })
    };
  }
  const BREVO_API_KEY = process.env.BREVO_API_KEY;

  try {
    initFirebaseAdmin();
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message || 'Firebase Admin initialization failed.' })
    };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ success: false, error: 'Unauthorized. Missing or invalid Bearer token.' })
    };
  }

  const idToken = authHeader.split('Bearer ')[1];
  let senderEmail = null;
  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    senderEmail = decodedToken.email || null;
  } catch (err) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ success: false, error: 'Unauthorized. Invalid or expired Firebase ID token: ' + (err.message || err) })
    };
  }

  let body;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  } catch (err) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'Invalid JSON request payload.' })
    };
  }

  const {
    to,
    toName,
    cc,
    bcc,
    subject,
    htmlContent,
    textContent,
    attachment,
    replyTo
  } = body || {};

  if (!to) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'Recipient email address (to) is required.' })
    };
  }

  if (!subject) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'Email subject is required.' })
    };
  }

  // Parse recipient list
  let recipients = [];
  if (Array.isArray(to)) {
    recipients = to.map(item => typeof item === 'string' ? { email: item.trim() } : { email: item.email.trim(), name: item.name });
  } else if (typeof to === 'string') {
    recipients = to.split(',').map(em => em.trim()).filter(Boolean).map(em => ({
      email: em,
      name: toName || em
    }));
  }

  if (recipients.length === 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ success: false, error: 'No valid recipient email provided.' })
    };
  }

  // Parse CC list
  let ccList = [];
  if (Array.isArray(cc)) {
    ccList = cc.map(item => typeof item === 'string' ? { email: item.trim() } : { email: item.email.trim(), name: item.name });
  } else if (typeof cc === 'string' && cc.trim()) {
    ccList = cc.split(',').map(em => em.trim()).filter(Boolean).map(em => ({ email: em }));
  }

  // Always CC the sender on their own outgoing mail, using their verified
  // login email — not something the client can override. Skip if they're
  // already a recipient or already in the CC list.
  if (senderEmail) {
    const alreadyIncluded =
      recipients.some(r => r.email.toLowerCase() === senderEmail.toLowerCase()) ||
      ccList.some(c => c.email.toLowerCase() === senderEmail.toLowerCase());
    if (!alreadyIncluded) {
      ccList.push({ email: senderEmail });
    }
  }

  // Parse BCC list
  let bccList = [];
  if (Array.isArray(bcc)) {
    bccList = bcc.map(item => typeof item === 'string' ? { email: item.trim() } : { email: item.email.trim(), name: item.name });
  } else if (typeof bcc === 'string' && bcc.trim()) {
    bccList = bcc.split(',').map(em => em.trim()).filter(Boolean).map(em => ({ email: em }));
  }

  // Construct Brevo transactional payload
  const brevoPayload = {
    sender: {
      email: DEFAULT_SENDER_EMAIL,
      name: DEFAULT_SENDER_NAME
    },
    to: recipients,
    subject: subject,
    htmlContent: htmlContent || `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b;"><pre style="white-space: pre-wrap; font-family: inherit;">${textContent || ''}</pre></div>`,
    replyTo: {
      // Always the sender's own verified login email, so the client's
      // reply reaches them directly — not something the client can
      // override via the request body.
      email: senderEmail || replyTo || DEFAULT_SENDER_EMAIL,
      name: DEFAULT_SENDER_NAME
    }
  };

  if (textContent) {
    brevoPayload.textContent = textContent;
  }

  if (ccList.length > 0) {
    brevoPayload.cc = ccList;
  }

  if (bccList.length > 0) {
    brevoPayload.bcc = bccList;
  }

  if (Array.isArray(attachment) && attachment.length > 0) {
    brevoPayload.attachment = attachment;
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify(brevoPayload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Brevo Error]', data);
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({
          success: false,
          error: data.message || data.error || 'Failed to dispatch email via Brevo API.',
          details: data
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        messageId: data.messageId,
        message: 'Email dispatched successfully via Brevo.',
        deliveredTo: recipients.map(r => r.email)
      })
    };
  } catch (err) {
    console.error('[SendEmail Exception]', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: err.message || 'Internal server error while connecting to Brevo.'
      })
    };
  }
}
