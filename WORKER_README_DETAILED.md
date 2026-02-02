Cloudflare Worker contact handler (detailed)
===========================================

Overview
--------
This repository includes a Cloudflare Worker (`worker/index.js`) that accepts POST requests with JSON `{ name, email, message }` and forwards the message via an e-mail provider (SendGrid by default). The Worker is deployable from GitHub Actions (free tiers available) using `wrangler` and Cloudflare Workers.

This detailed README covers:
- Cloudflare Worker setup and deployment (commands + notes)
- SendGrid configuration (default email path)
- Optional Twilio SMS notifications (how-to + example)
- Local testing, security, and troubleshooting

Prerequisites
-------------
- Cloudflare account (Workers has a free tier).
- SendGrid account (free tier) or similar transactional email API.
- (Optional) Twilio account for SMS notifications.
- `wrangler` CLI for local testing: `npm install -g wrangler`.

Cloudflare Worker: setup & deploy
--------------------------------
1. Install `wrangler` and login locally (optional):

   ```bash
   npm install -g wrangler
   wrangler login
   ```

2. Create a Cloudflare API token for CI (recommended):
   - Cloudflare Dashboard → My Profile → API Tokens → Create Token
   - Choose the "Edit Cloudflare Workers" template or a minimal token with `Account.Workers Scripts` permission.
   - Save the token as a GitHub Actions secret named `CF_API_TOKEN` in this repository (Settings → Secrets → Actions).

3. Add provider keys & addresses as Cloudflare secrets:
   - `SENDGRID_API_KEY` — SendGrid API Key
   - `FROM_EMAIL` — sender address (e.g., no-reply@chaos.isibangalore)
   - `TO_EMAIL` — recipient inbox (e.g., chaos.isibangalore@gmail.com)

   Example using `wrangler`:

   ```bash
   wrangler secret put SENDGRID_API_KEY
   wrangler secret put FROM_EMAIL
   wrangler secret put TO_EMAIL
   ```

   Or add them in the Cloudflare dashboard (Workers → your Worker → Variables & Secrets).

4. Publish with `wrangler` or CI:
   - Local: `wrangler publish` will upload and give a workers.dev URL.
   - CI: push to `main` (the included workflow `.github/workflows/deploy-worker.yml` runs `wrangler publish` using `CF_API_TOKEN`).

5. Route configuration (optional):
   - Keep `index.html` using `/api/contact` and configure a Cloudflare Worker route to forward `/api/contact` on your domain to the worker.
   - Or update the front end to call the workers.dev URL directly.

Local testing
-------------
Run the worker locally:

```bash
wrangler dev worker/index.js --local
# or
wrangler dev
```

The worker will be available on `http://127.0.0.1:8787` for quick testing. POST JSON `{ name, email, message }` to that address.

Client integration
------------------
`index.html` uses a `CONTACT_ENDPOINT` variable. Options:
- Set `CONTACT_ENDPOINT` to the published worker URL (e.g. `https://<name>.<workers.dev>`), or
- Configure a Cloudflare route so `/api/contact` is proxied to the worker and keep `CONTACT_ENDPOINT` as `/api/contact`.

Example front-end fetch (already present in the page):

```js
fetch(CONTACT_ENDPOINT || '/api/contact', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, email, message })
})
```

SendGrid (email) notes
----------------------
- Worker uses SendGrid Web API v3. Ensure `SENDGRID_API_KEY`, `FROM_EMAIL`, and `TO_EMAIL` are set.
- To use dynamic templates, store the template ID in a secret and reference it in the API payload.

Optional: Twilio SMS notifications
---------------------------------
If you want SMS alerts for new messages, use Twilio alongside SendGrid.

1. Create a Twilio account and collect:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_FROM` (Twilio phone number)
   - `TWILIO_TO` (recipient mobile number)

2. Add secrets to Cloudflare:

```bash
wrangler secret put TWILIO_ACCOUNT_SID
wrangler secret put TWILIO_AUTH_TOKEN
wrangler secret put TWILIO_FROM
wrangler secret put TWILIO_TO
```

3. Example snippet (call Twilio API from the Worker):

```js
// Basic auth for Twilio
const twilioAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)

await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
  method: 'POST',
  headers: {
    Authorization: `Basic ${twilioAuth}`,
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: new URLSearchParams({
    From: TWILIO_FROM,
    To: TWILIO_TO,
    Body: `New contact from ${name} (${email}): ${message.slice(0,160)}`
  })
})
```

Notes about Twilio
- Twilio SMS is paid (trial credits available). Monitor usage and costs.
- Use E.164 format for phone numbers (e.g., `+9198...`).

Security & best practices
-------------------------
- Do not commit keys. Use Cloudflare secrets or GitHub secrets.
- Consider validating an HMAC/token to ensure only your site posts to the worker.
- Add rate-limiting if you expect higher traffic.
- Sanitize and truncate inputs before forwarding in email/SMS.

Troubleshooting
---------------
- `Mail sender not configured`: ensure `SENDGRID_API_KEY` and email secrets exist.
- Twilio `401 Unauthorized`: double-check Twilio credentials and `From` number.
- GitHub Actions `wrangler publish` fails: verify `CF_API_TOKEN` exists and has `Workers Scripts` permission.

Next steps I can do for you
---------------------------
- Add optional Twilio SMS sending to `worker/index.js` (only when Twilio secrets are present).
- Bind the worker to `/api/contact` so the front-end needs no changes.
- After you publish, update `index.html` to set `CONTACT_ENDPOINT` to your worker URL.

---

If you want me to update the original `WORKER_README.md` in-place instead of adding this file, tell me and I'll overwrite it.
