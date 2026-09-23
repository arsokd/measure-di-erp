// Shared helper for the Gmail-sending/reading functions. Uses Google
// Workspace domain-wide delegation: the service account (credentials in
// GMAIL_SERVICE_ACCOUNT_KEY) is authorized in the measuredi.com Workspace
// Admin Console to impersonate any user on that domain for the gmail.send
// and gmail.readonly scopes - so a message sent through this actually
// lands in that employee's own real Gmail Sent folder and threads
// natively with anything sent or received through Gmail itself.
//
// Only works for @measuredi.com mailboxes - impersonation is scoped to
// the verified Workspace domain, so it cannot act as an outside address
// (e.g. a personal gmail.com account). Callers should catch failures here
// and fall back to the existing Brevo-based sender for anyone not yet on
// the Workspace domain.
import { JWT } from 'google-auth-library';

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly'
];

let cachedCredentials = null;

function getServiceAccountCredentials() {
  if (cachedCredentials) return cachedCredentials;

  const raw = process.env.GMAIL_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error('GMAIL_SERVICE_ACCOUNT_KEY environment variable is missing.');
  }

  try {
    cachedCredentials = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (err) {
    throw new Error('Failed to parse GMAIL_SERVICE_ACCOUNT_KEY JSON string: ' + err.message);
  }

  if (!cachedCredentials.client_email || !cachedCredentials.private_key) {
    throw new Error('GMAIL_SERVICE_ACCOUNT_KEY is missing client_email or private_key.');
  }

  return cachedCredentials;
}

// Returns a bearer access token authenticated as impersonatedEmail
// (a real @measuredi.com mailbox), via domain-wide delegation.
export async function getImpersonatedAccessToken(impersonatedEmail) {
  const creds = getServiceAccountCredentials();

  const client = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: GMAIL_SCOPES,
    subject: impersonatedEmail
  });

  let tokenResponse;
  try {
    tokenResponse = await client.getAccessToken();
  } catch (err) {
    throw new Error(
      'Could not authenticate as ' + impersonatedEmail + ' via domain-wide delegation: ' +
      (err.message || err) +
      '. This only works for real @measuredi.com Workspace mailboxes with delegation authorized in the Admin Console.'
    );
  }

  const token = tokenResponse && tokenResponse.token;
  if (!token) {
    throw new Error('Could not obtain a Gmail access token for ' + impersonatedEmail + '.');
  }
  return token;
}

export function base64UrlEncode(str) {
  return Buffer.from(str, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// RFC 2047-encodes a header value if it contains non-ASCII characters
// (e.g. an Indian client name with special characters); left plain
// otherwise, since that's valid and more readable as-is.
export function encodeHeaderValue(value) {
  if (!value) return '';
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return '=?UTF-8?B?' + Buffer.from(value, 'utf-8').toString('base64') + '?=';
}
