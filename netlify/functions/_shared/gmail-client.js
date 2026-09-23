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
import crypto from 'crypto';
import { JWT } from 'google-auth-library';
// The Gmail credential is committed here AES-256-GCM encrypted (safe to
// commit - meaningless without the passphrase) rather than stored as a
// Netlify env var. Netlify's free plan can't scope a variable away from
// the "Functions" runtime, and every function on this site shares one
// combined 4KB AWS Lambda environment-variable limit - the full
// credential JSON alone (even trimmed) is too large to fit alongside
// FIREBASE_SERVICE_ACCOUNT_KEY within that. Only the tiny decryption key
// (GMAIL_CREDENTIALS_KEY, ~44 bytes) lives in Netlify's env vars; the
// encrypted blob is bundled straight into the function code by esbuild's
// JSON loader at deploy time, so it never touches the Lambda env at all.
import encryptedGmailCredentials from './gmail-credentials.encrypted.json';

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly'
];

let cachedCredentials = null;

// Decrypts an AES-256-GCM blob produced by the browser-based encryptor
// tool: base64(12-byte IV || ciphertext || 16-byte auth tag), using a
// base64-encoded 32-byte key.
function decryptCredentialBlob(blobBase64, passphraseBase64) {
  const key = Buffer.from(passphraseBase64, 'base64');
  const combined = Buffer.from(blobBase64, 'base64');
  const iv = combined.subarray(0, 12);
  const ciphertextAndTag = combined.subarray(12);
  const authTag = ciphertextAndTag.subarray(ciphertextAndTag.length - 16);
  const ciphertext = ciphertextAndTag.subarray(0, ciphertextAndTag.length - 16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf-8');
}

function getServiceAccountCredentials() {
  if (cachedCredentials) return cachedCredentials;

  let raw = null;
  let source = '';

  const blob = encryptedGmailCredentials && encryptedGmailCredentials.blob;
  const passphrase = process.env.GMAIL_CREDENTIALS_KEY;

  if (blob && passphrase) {
    try {
      raw = decryptCredentialBlob(blob, passphrase);
      source = 'encrypted bundled credential';
    } catch (err) {
      throw new Error('Could not decrypt the bundled Gmail credential - check GMAIL_CREDENTIALS_KEY matches the passphrase used to encrypt it: ' + err.message);
    }
  } else if (process.env.GMAIL_SERVICE_ACCOUNT_KEY) {
    // Fallback for local dev, or if the encrypted-blob approach isn't set
    // up yet - a plain (large) credential JSON directly in the env.
    raw = process.env.GMAIL_SERVICE_ACCOUNT_KEY;
    source = 'GMAIL_SERVICE_ACCOUNT_KEY environment variable';
  } else {
    throw new Error('No Gmail service account credentials found (checked the encrypted bundled credential + GMAIL_CREDENTIALS_KEY, and the GMAIL_SERVICE_ACCOUNT_KEY environment variable).');
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
