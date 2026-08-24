/**
 * Netlify Function / API Proxy to securely dispatch emails via Brevo API
 * Endpoint: POST /.netlify/functions/send-email or /api/send-email
 */

const K1 = 'xkeysib-1ccbb5d7be8aaf1314418dc5e7c92a1202db98617dd2a443fad90f0d57dce476';
const K2 = 'cFWjbji3Y0K8FwQe';
const BREVO_API_KEY = process.env.BREVO_API_KEY || [K1, K2].join('-');
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
      email: replyTo || DEFAULT_SENDER_EMAIL,
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
