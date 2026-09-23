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
// Generated at build time by copy-assets.js from the GMAIL_SERVICE_ACCOUNT_KEY
// env var (which is scoped to "Builds" only in Netlify, not "Functions" or
// "Runtime"). esbuild inlines this JSON's content directly into the bundled
// function at deploy time, so the credential never counts against the
// combined 4KB AWS Lambda environment-variable limit every function on this
// site shares. It's gitignored and always exists with at least `{}` by the
// time this file is bundled - see copy-assets.js for the write step.
import bundledGmailCredentials from './gmail-credentials.generated.json';

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly'
];

let cachedCredentials = null;

function getServiceAccountCredentials() {
  if (cachedCredentials) return cachedCredentials;

  let raw = null;
  let source = '';

  if (bundledGmailCredentials && bundledGmailCredentials.client_email && bundledGmailCredentials.private_key) {
    raw = bundledGmailCredentials;
    source = 'bundled build-time file';
  } else if (process.env.GMAIL_SERVICE_ACCOUNT_KEY) {
    // Fallback for local dev / any environment where the build-time bundling
    // step didn't run (e.g. `netlify dev`), so this still works there.
    raw = process.env.GMAIL_SERVICE_ACCOUNT_KEY;
    source = 'GMAIL_SERVICE_ACCOUNT_KEY environment variable';
  } else {
    throw new Error('No Gmail service account credentials found (checked the bundled build-time file and the GMAIL_SERVICE_ACCOUNT_KEY environment variable).');
  }

  try {
    cachedCredentials = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (err) {
    throw new Error('Failed to parse Gmail service account credentials from ' + source + ': ' + err.message);
  }

  if (!cachedCredentials.client_email || !cachedCredentials.private_key) {
    throw new Error('Gmail service account credentials (from ' + source + ') are missing client_email or private_key.');
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
