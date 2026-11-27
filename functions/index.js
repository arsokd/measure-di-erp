// Entry point Firebase Functions actually loads - just re-exports every
// converted function under the name firebase.json's Hosting rewrites
// (and Telegram's setWebhook URL) refer to it by.
export { resetPassword } from './reset-password.js';
export { changeOwnPassword } from './change-own-password.js';
export { cleanupLegacyPasswords } from './cleanup-legacy-passwords.js';
export { getGmailThread } from './get-gmail-thread.js';
export { sendEmail } from './send-email.js';
export { sendGmail } from './send-gmail.js';
export { sheetSync } from './sheet-sync.js';
export { telegramWebhook } from './telegram-webhook.js';
