// Sends an email as the signed-in employee's own real Gmail mailbox
// (via Google Workspace domain-wide delegation), so it lands in their
// actual Sent folder and threads natively with the client's replies -
// unlike the Brevo-based send-email.js, which always sends from a single
// shared address with reply-to redirected to the employee.
//
// Endpoint: POST /.netlify/functions/send-gmail
// Requires a valid Firebase ID token (Authorization: Bearer <token>).
// Only works for the caller's own @measuredi.com mailbox - the caller
// cannot send as anyone else.
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getImpersonatedAccessToken, base64UrlEncode, encodeHeaderValue } from './_shared/gmail-client.js';

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

// Splits a base64 string into RFC-compliant 76-char lines.
function wrapBase64(b64) {
  return b64.replace(/(.{76})/g, '$1\r\n');
}

// Attachments arrive as { name, type, data } where data is a full
// data: URI (what FileReader.readAsDataURL produces) - split off the
// base64 payload from the "data:<mime>;base64," prefix.
function splitDataUri(dataUri) {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUri || '');
  if (!match) return { mime: 'application/octet-stream', base64: '' };
  return { mime: match[1], base64: match[2] };
}

function buildRawMimeMessage({ fromEmail, fromName, to, cc, subject, htmlContent, inReplyTo, references, attachments }) {
  const headers = [];
  headers.push('From: ' + (fromName ? '"' + encodeHeaderValue(fromName) + '" <' + fromEmail + '>' : fromEmail));
  headers.push('To: ' + to);
  if (cc) headers.push('Cc: ' + cc);
  headers.push('Subject: ' + encodeHeaderValue(subject));
  headers.push('MIME-Version: 1.0');
  if (inReplyTo) headers.push('In-Reply-To: ' + inReplyTo);
  if (references) headers.push('References: ' + references);

  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
  if (!hasAttachments) {
    headers.push('Content-Type: text/html; charset="UTF-8"');
    headers.push('Content-Transfer-Encoding: 7bit');
    return headers.join('\r\n') + '\r\n\r\n' + htmlContent;
  }

  const boundary = 'measuredi_boundary_' + Date.now().toString(36);
  headers.push('Content-Type: multipart/mixed; boundary="' + boundary + '"');

  const parts = [];
  parts.push(
    '--' + boundary + '\r\n' +
    'Content-Type: text/html; charset="UTF-8"\r\n' +
    'Content-Transfer-Encoding: 7bit\r\n\r\n' +
    htmlContent
  );

  attachments.forEach(att => {
    const { mime, base64 } = splitDataUri(att.data);
    const filename = encodeHeaderValue(att.name || 'attachment');
    parts.push(
      '--' + boundary + '\r\n' +
      'Content-Type: ' + (att.type || mime) + '; name="' + filename + '"\r\n' +
      'Content-Disposition: attachment; filename="' + filename + '"\r\n' +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      wrapBase64(base64)
    );
  });

  parts.push('--' + boundary + '--');

  return headers.join('\r\n') + '\r\n\r\n' + parts.join('\r\n\r\n');
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
  let decodedToken;
  try {
    decodedToken = await getAuth().verifyIdToken(idToken);
  } catch (err) {
    return { statusCode: 401, headers, body: JSON.stringify({ success: false, error: 'Unauthorized. Invalid or expired Firebase ID token: ' + (err.message || err) }) };
  }

  const senderEmail = decodedToken.email;
  if (!senderEmail) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Signed-in account has no email on its token.' }) };
  }

  let body;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  } catch (err) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Invalid JSON request payload.' }) };
  }

  const { to, cc, subject, htmlContent, senderName, threadId, inReplyTo, references, attachments } = body || {};

  if (!to) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Recipient email address (to) is required.' }) };
  }
  if (!subject) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Email subject is required.' }) };
  }
  if (!htmlContent) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: 'Email body (htmlContent) is required.' }) };
  }

  let accessToken;
  try {
    accessToken = await getImpersonatedAccessToken(senderEmail);
  } catch (err) {
    return {
      statusCode: 422,
      headers,
      body: JSON.stringify({
        success: false,
        error: err.message,
        notOnWorkspaceDomain: true,
        diagnostic: err.diagnostic || null
      })
    };
  }

  const rawMessage = buildRawMimeMessage({
    fromEmail: senderEmail,
    fromName: senderName || senderEmail,
    to,
    cc: cc || '',
    subject,
    htmlContent,
    inReplyTo,
    references,
    attachments
  });

  const gmailPayload = { raw: base64UrlEncode(rawMessage) };
  if (threadId) gmailPayload.threadId = threadId;

  try {
    const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(gmailPayload)
    });

    const gmailData = await gmailRes.json();

    if (!gmailRes.ok) {
      console.error('[Gmail API Error]', gmailData);
      return {
        statusCode: gmailRes.status,
        headers,
        body: JSON.stringify({ success: false, error: (gmailData.error && gmailData.error.message) || 'Gmail API rejected the send.', details: gmailData })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        messageId: gmailData.id,
        threadId: gmailData.threadId,
        sentAs: senderEmail,
        message: 'Email sent from ' + senderEmail + "'s real Gmail mailbox."
      })
    };
  } catch (err) {
    console.error('[SendGmail Exception]', err);
    return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: err.message || 'Internal server error while connecting to Gmail API.' }) };
  }
}
