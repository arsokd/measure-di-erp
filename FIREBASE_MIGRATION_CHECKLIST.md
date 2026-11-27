# Moving off Netlify, onto Firebase — step-by-step

Everything needed to actually run on Firebase has been built and tested on
this side (against a real local Firebase emulator — not guessed, not
mocked). What's left needs your own login and your own account, so it has
to happen from your own computer, not here.

**Nothing here touches your live Netlify site.** It stays running exactly
as it is through every step below — you only flip over to Firebase once
you've confirmed it works, and you can flip back instantly if anything
looks wrong.

## What changed in the code (already done, already pushed)

- A `functions/` folder — the same 8 server-side jobs your app already
  runs on Netlify (password reset, your own password change, the one-time
  legacy-password cleanup, sending email via Brevo, sending email as your
  own Gmail, reading a Gmail thread, the Google Sheet mirror, and the
  Telegram bot), rewritten to run on Firebase instead. The actual logic
  inside each one is unchanged — only the plumbing around it changed.
- `firebase.json` and `.firebaserc` — tells Firebase what to serve and
  where your Firebase project is (`measure-di-erp-e79e9`, the same project
  your app's database already lives in).
- One small, genuine bug found and fixed along the way (in both the old
  and new copies): if Telegram's own servers were briefly unreachable at
  the exact moment a stranger messaged your bot, that one request would
  have failed loudly instead of being quietly ignored like everything else
  the bot does. Harmless either way, fixed either way.

## Step 1 — Get the Firebase command-line tool talking to your account

On your own computer, in a terminal, inside this project's folder:

```
npm install -g firebase-tools
firebase login
```

This opens a browser window asking you to sign in with the Google account
that owns the `measure-di-erp-e79e9` Firebase project. Sign in with that
account.

## Step 2 — Make sure billing is turned on (Blaze plan)

Cloud Functions (the part that runs your 8 server-side jobs) needs the
**Blaze** pay-as-you-go plan — the free Spark plan can't run them at all.
Blaze still has a generous free allowance every month; for an app this
size you should expect a small monthly bill, usually just a few hundred
rupees once Netlify is fully retired.

- Go to https://console.firebase.google.com/project/measure-di-erp-e79e9/usage/details
- If it says Spark, click to upgrade to Blaze (needs a billing/card on file)
- **Set a budget alert** while you're there (e.g. ₹500 and ₹1,000) — this
  warns you by email if spend looks unusual, though it doesn't stop
  spending on its own.

## Step 3 — Copy your secret values over from Netlify

Open your Netlify site's **Site settings → Environment variables** in one
browser tab, and a terminal in this project's folder in another. For each
one below, Netlify shows you the current value — copy it, then run the
matching command and paste the value in when it asks:

```
firebase functions:secrets:set SERVICE_ACCOUNT_KEY
firebase functions:secrets:set BREVO_API_KEY
firebase functions:secrets:set BREVO_SENDER_EMAIL
firebase functions:secrets:set GMAIL_CREDENTIALS_KEY
firebase functions:secrets:set GOOGLE_SHEET_WEBHOOK_URL
firebase functions:secrets:set TELEGRAM_BOT_TOKEN
firebase functions:secrets:set TELEGRAM_ALLOWED_USER_IDS
```

On Netlify these were named `FIREBASE_SERVICE_ACCOUNT_KEY` /
`GMAIL_SERVICE_ACCOUNT_KEY` — on Firebase the first one is just called
`SERVICE_ACCOUNT_KEY` (Firebase doesn't allow a secret name starting with
"FIREBASE_" — it's reserved for its own internal use; this was caught
during testing, not guessed). Use the exact same value Netlify has for
`FIREBASE_SERVICE_ACCOUNT_KEY`.

If `BREVO_SENDER_EMAIL` or `GOOGLE_SHEET_WEBHOOK_URL` were never set on
Netlify either (some sites never configure every optional one), it's fine
to skip that command — the app already falls back sensibly when they're
missing.

## Step 4 — Deploy

```
npm run build
firebase deploy --only functions,hosting
```

This uploads the 8 server-side jobs and publishes your site's files. It
does **not** touch your live `measuredi-k30-erp.netlify.app` address at
all — this creates a brand-new, separate address.

## Step 5 — Test the new address before anyone else uses it

The deploy's own output prints your new address — something like
`https://measure-di-erp-e79e9.web.app`. Open it and actually use the app
for a few minutes:

- Log in
- Reset someone's password (as an Admin) and confirm it actually works
- Change your own password
- Send a quotation/invoice email
- Open the Lead Registry, make sure everything looks normal

Nothing here is simulated — the same checks already ran successfully
against a real local copy of Firebase before this was handed to you, but
your own real data and your own real Brevo/Gmail/Telegram credentials are
the one thing that genuinely can't be tested from here, so this step
matters.

## Step 6 — Point Telegram at the new address

Telegram doesn't read this from anywhere in the code — it was told the
old Netlify address directly, once, when the bot was first set up. Run
this (with your real bot token in place of `<TOKEN>`, and your real new
address) to switch it over:

```
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" -d "url=https://measure-di-erp-e79e9.web.app/api/telegram-webhook"
```

Only run this once you're ready for the bot to actually switch — the
moment you run it, the old Netlify webhook stops receiving anything.

## Step 7 — Point your real domain at Firebase (only if you use a custom domain)

If people actually type `measuredi-k30-erp.netlify.app` today, there's
nothing to change here — just start sharing the new Firebase address
instead (or set up a custom domain on Firebase now, if you'd rather have a
proper company domain at this point anyway).

If you already have your own domain pointed at the Netlify site:
1. Firebase Console → Hosting → **Add custom domain**
2. Firebase gives you DNS records to add at wherever your domain is
   registered (GoDaddy, Google Domains, etc.) — add them there.
3. DNS changes take anywhere from a few minutes to a few hours to take
   effect. Both the old and new addresses typically keep working
   side-by-side during that window — there's no single risky instant.

## Step 8 — Only once you're confident, retire Netlify

Not before you've used the new address for real for a while and you're
sure. Then:
- Netlify dashboard → Site settings → General → **Delete site** (or just
  downgrade/cancel the plan if you'd rather keep it archived for a bit)
- This is the one genuinely irreversible step in this whole list — there's
  no rush to do it on day one.

## If anything goes wrong

Nothing above deletes or disables Netlify at any point before Step 8. If
the new Firebase address misbehaves at any point: just keep using the old
Netlify address (or point the Telegram webhook/DNS back), fix whatever's
wrong, and try again later. Nothing is one-way until you choose to make it
one-way in Step 8.
