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

// Attachments arrive from the browser in one of two shapes:
//  - { name, type, data } - a full data: URI (older, still-small records
//    that keep their file inline as base64, e.g. legacy Service Ticket
//    attachments). Split off the base64 payload directly.
//  - { name, type, url } - a Firebase Storage-backed attachment (the
//    normal case since the 100 MB attachment migration). The browser
//    deliberately does NOT fetch/base64-encode this itself before
//    posting here - Netlify Functions cap inbound request bodies at
//    ~6 MB regardless of Storage's 100 MB cap, so a multi-MB attachment
//    would never survive that leg. Fetching it here instead, as an
//    outbound call this function makes on its own, isn't subject to
//    that inbound limit.
function splitDataUri(dataUri) {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUri || '');
  if (!match) return { mime: 'application/octet-stream', base64: '' };
  return { mime: match[1], base64: match[2] };
}

async function resolveAttachmentBase64(att) {
  if (att && att.data) {
    const { mime, base64 } = splitDataUri(att.data);
    return { mime: att.type || mime, base64 };
  }
  if (att && att.url) {
    const res = await fetch(att.url);
    if (!res.ok) {
      throw new Error('Could not fetch attachment "' + (att.name || 'file') + '" for sending (HTTP ' + res.status + ').');
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return { mime: att.type || res.headers.get('content-type') || 'application/octet-stream', base64: buf.toString('base64') };
  }
  return { mime: att.type || 'application/octet-stream', base64: '' };
}

// Combined byte size of the already-resolved (base64) attachments -
// matches Gmail's own well-documented per-message sending limit. Checked
// here as a backstop; the browser already warns the user before this
// call (js/store.js EMAIL_ATTACHMENT_LIMIT_BYTES), but a server-side
// guard still matters for any other future caller of this function.
const EMAIL_ATTACHMENT_LIMIT_BYTES = 25 * 1024 * 1024;

function totalBase64Bytes(resolvedAttachments) {
  return resolvedAttachments.reduce(function(sum, att) {
    return sum + Math.floor((att.base64 || '').length * 0.75);
  }, 0);
}

// Above this raw-MIME-message size, switch from the plain JSON {raw:
// base64url(...)} send call to Gmail's multipart media-upload endpoint
// instead (see sendMimeMessage below). The JSON path re-encodes the
// already-base64 attachment data in base64url again, inflating it by a
// further ~33% on top of MIME's own base64 overhead - fine for the
// small attachments this app has always sent, but wasteful and prone to
// hitting request-size limits for anything multi-MB. The threshold is
// set well under that so only genuinely large attachments take the new,
// less-exercised code path; every send this app has made in production
// so far stays on the original, proven path.
const SIMPLE_JSON_SEND_THRESHOLD_BYTES = 4 * 1024 * 1024;

// Builds the multipart/related body for Gmail's "multipart" upload type:
// a JSON metadata part (for fields like threadId, which the plain
// media-upload body has no room for) followed by the raw RFC822 message
// as its own part.
function buildMultipartUploadBody(boundary, metadata, rawMessageBuffer) {
  const head = Buffer.from(
    '--' + boundary + '\r\n' +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) + '\r\n' +
    '--' + boundary + '\r\n' +
    'Content-Type: message/rfc822\r\n\r\n',
    'utf-8'
  );
  const tail = Buffer.from('\r\n--' + boundary + '--', 'utf-8');
  return Buffer.concat([head, rawMessageBuffer, tail]);
}

async function sendMimeMessage(accessToken, rawMessage, threadId) {
  const rawMessageBuffer = Buffer.from(rawMessage, 'utf-8');

  if (rawMessageBuffer.length <= SIMPLE_JSON_SEND_THRESHOLD_BYTES) {
    const gmailPayload = { raw: base64UrlEncode(rawMessage) };
    if (threadId) gmailPayload.threadId = threadId;
    return fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(gmailPayload)
    });
  }

  const boundary = 'measuredi_upload_' + Date.now().toString(36);
  const metadata = {};
  if (threadId) metadata.threadId = threadId;
  return fetch('https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=multipart', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'multipart/related; boundary=' + boundary
    },
    body: buildMultipartUploadBody(boundary, metadata, rawMessageBuffer)
  });
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
    const filename = encodeHeaderValue(att.name || 'attachment');
    parts.push(
      '--' + boundary + '\r\n' +
      'Content-Type: ' + (att.mime || 'application/octet-stream') + '; name="' + filename + '"\r\n' +
      'Content-Disposition: attachment; filename="' + filename + '"\r\n' +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      wrapBase64(att.base64 || '')
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
        notOnWorkspaceDomain: true
      })
    };
  }

  let resolvedAttachments;
  try {
    resolvedAttachments = await Promise.all((attachments || []).map(async function(att) {
      const { mime, base64 } = await resolveAttachmentBase64(att);
      return { name: att.name, mime, base64 };
    }));
  } catch (err) {
    return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: err.message || 'Could not prepare an attachment for sending.' }) };
  }

  const totalBytes = totalBase64Bytes(resolvedAttachments);
  if (totalBytes > EMAIL_ATTACHMENT_LIMIT_BYTES) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'These attachments total ' + (totalBytes / (1024 * 1024)).toFixed(1) + ' MB, over the 25 MB-per-email limit Gmail allows.'
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
    attachments: resolvedAttachments
  });

  try {
    const gmailRes = await sendMimeMessage(accessToken, rawMessage, threadId);
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
