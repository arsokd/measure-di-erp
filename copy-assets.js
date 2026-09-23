import fs from 'fs';
import path from 'path';

try {
  // Ensure dist and dist/js exist
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist', { recursive: true });
  }
  if (!fs.existsSync('dist/js')) {
    fs.mkdirSync('dist/js', { recursive: true });
  }

  // Copy js folder if exists
  if (fs.existsSync('js')) {
    fs.cpSync('js', 'dist/js', { recursive: true });
    console.log('[build] Copied js/ -> dist/js/');
  }

  // Copy root JS/config assets
  const rootFiles = ['auth-guard.js', '_redirects', 'firebase-applet-config.json'];
  for (const f of rootFiles) {
    if (fs.existsSync(f)) {
      fs.copyFileSync(f, path.join('dist', f));
      console.log(`[build] Copied ${f} -> dist/${f}`);
    }
  }

  console.log('[build] Static assets prepared successfully.');
} catch (err) {
  console.warn('[build] Warning during asset copying:', err.message);
  // Do not crash the build
}

// Bake GMAIL_SERVICE_ACCOUNT_KEY into a bundled file at build time instead
// of leaving it as a Netlify Functions runtime env var. All the Netlify
// Functions on this site share one combined 4KB AWS Lambda env-variable
// limit, and this credential (plus FIREBASE_SERVICE_ACCOUNT_KEY) is large
// enough on its own to blow past that. Writing it here - while it's only
// scoped to "Builds" in Netlify, not "Functions"/"Runtime" - means
// esbuild bundles its content directly into netlify/functions/send-gmail.js
// and get-gmail-thread.js at deploy time (see js/_shared/gmail-client.js's
// static import), so it never touches the Lambda env at all.
//
// Always writes something valid (even {} when the env var isn't set, e.g.
// a preview build), so the static JSON import in gmail-client.js never
// fails to resolve; gmail-client.js falls back to reading
// process.env.GMAIL_SERVICE_ACCOUNT_KEY directly if this ends up empty.
try {
  const sharedDir = path.join('netlify', 'functions', '_shared');
  if (!fs.existsSync(sharedDir)) {
    fs.mkdirSync(sharedDir, { recursive: true });
  }
  const gmailKeyEnv = process.env.GMAIL_SERVICE_ACCOUNT_KEY || '';
  let gmailCredsJson = '{}';
  if (gmailKeyEnv) {
    try {
      // Round-trip through JSON.parse/stringify to validate it and to
      // normalize formatting before writing.
      gmailCredsJson = JSON.stringify(JSON.parse(gmailKeyEnv));
      console.log('[build] Bundled GMAIL_SERVICE_ACCOUNT_KEY into netlify/functions/_shared/gmail-credentials.generated.json');
    } catch (parseErr) {
      console.warn('[build] GMAIL_SERVICE_ACCOUNT_KEY is set but is not valid JSON, writing an empty credentials file:', parseErr.message);
    }
  } else {
    console.log('[build] GMAIL_SERVICE_ACCOUNT_KEY not set at build time - writing an empty credentials file.');
  }
  fs.writeFileSync(path.join(sharedDir, 'gmail-credentials.generated.json'), gmailCredsJson);
} catch (err) {
  console.warn('[build] Warning while writing bundled Gmail credentials file:', err.message);
}
