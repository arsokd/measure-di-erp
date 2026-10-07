// Proxies app save/delete events to the Google Apps Script Web App that
// mirrors them into the connected Google Sheet. The browser never talks to
// Google directly - it POSTs same-origin to /api/sheet-sync, which avoids
// any CORS/preflight quirks with Apps Script Web Apps, and keeps the real
// Web App URL out of client-side code (it lives only in the
// GOOGLE_SHEET_WEBHOOK_URL Netlify environment variable).
//
// This is a best-effort audit trail, not the system of record - Firestore
// remains canonical. A missing/unreachable webhook must never surface as
// an app-breaking error to the caller, so failures are reported with a
// 200 here too; the caller (store.js) already treats this call as
// fire-and-forget and only logs a console warning either way.
export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
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

  const webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL;
  if (!webhookUrl) {
    // Not configured yet - treat as a no-op rather than an error so the
    // rest of the app keeps working exactly as before this feature existed.
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ skipped: true, reason: 'GOOGLE_SHEET_WEBHOOK_URL is not configured.' })
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

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    const text = await response.text();
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ forwarded: true, appsScriptStatus: response.status, appsScriptBody: text })
    };
  } catch (err) {
    // Swallow - the sheet mirror is best-effort and must never block or
    // surface as a failure to the caller.
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ forwarded: false, error: 'Failed to reach Google Apps Script webhook: ' + (err.message || err) })
    };
  }
}
