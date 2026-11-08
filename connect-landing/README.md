# PayComp IPPA - 2026 landing page and HubSpot lead intake

This directory contains a static landing page and a secure Vercel serverless API. The API is intentionally **not** called from GitHub Pages until a backend has been deployed.

## What happens on a successful submission

1. Validate first/last name, email, phone and company.
2. Look up contact by email. Update an existing contact or create one.
3. Match the company by exact name or create a company; associate it with the contact.
4. Use the existing **Follow-Up Needed** stage (HubSpot stage ID `4558346947`) in **IPPA - 2026** (pipeline ID `2673323738`).
5. If the contact already has a lead in this pipeline, do not create a duplicate or reset its stage.
6. Otherwise create a new lead in **Follow-Up Needed**, associated with the contact and company.

No submitted information is sent to GitHub or stored in the browser after submission.

## Hosting and configuration

GitHub Pages is static and **cannot execute `api/lead.js`**.

Deploy this folder as a **Vercel project connected to the existing `drvonkle/PayComp` GitHub repository** with `connect-landing` selected as Root Directory. Framework preset: **Other**. This provides the same landing page plus the secure `/api/lead` endpoint.

In the Vercel project **Settings > Environment Variables**, add:

- `HUBSPOT_SERVICE_KEY`: Secret HubSpot Service Key (Settings > Integrations > Service Keys). Existing legacy private-app tokens can alternatively be set as HUBSPOT_PRIVATE_APP_TOKEN. Set it in Vercel only; never write or share it in GitHub source or page HTML.
- `ALLOWED_ORIGINS=https://drvonkle.github.io`: Optional. Add any additional external domains hosting the form, separated by commas.
- `TURNSTILE_SECRET_KEY`: Optional; requires a corresponding Cloudflare Turnstile widget in the page to obtain visitor tokens.

Grant the HubSpot Service Key least-privilege **read/write** CRM scopes for Contacts, Companies and Leads, using existing pipeline/stage IDs. Use the Service Key as the Bearer token. Never paste it into chat or commit it to GitHub. Use only the scopes needed.

The form automatically posts to `/api/lead` when opened at a `*.vercel.app` URL. To use the original GitHub Pages URL, after deployment set `window.PAYCOMP_API_URL = 'https://YOUR-VERCEL-DOMAIN.vercel.app/api/lead';` in a script tag before the page's existing submit script, and list the GitHub Pages origin in `ALLOWED_ORIGINS`.

**Do not make the form live before a test submission has successfully appeared as a contact, company and associated lead in the proper HubSpot pipeline.**

## Automatic confirmation emails (Resend)

The Vercel API is prepared to send a personalized transactional acknowledgement
after a successful HubSpot CRM submission, **from** `PayComp <sales@paycomp.com>`
and with `sales@paycomp.com` as its Reply-To. No separate HubSpot form,
Marketing Hub workflow, Microsoft Entra application, or Microsoft mailbox
credentials are needed.

**Not active until Resend is configured.** The existing HubSpot CRM intake
remains functional if Resend is not configured or email sending fails.

### Minimal setup

1. Create or sign in to a Resend account at https://resend.com/.
2. Open https://resend.com/domains and add **paycomp.com** (the root sending
   domain is required to use the exact From address sales@paycomp.com).
   Add the DNS records Resend displays at the domain's authoritative DNS host.
   Verify the records in Resend. **Never replace the existing root Microsoft 365
   MX record or SPF record**: Resend's return-path MX/SPF records normally use
   a *separate subdomain* (e.g. send.paycomp.com), plus DKIM records; verify
   actual hostnames before editing. Do not add a second competing SPF TXT record
   at the same hostname.
3. Go to https://resend.com/api-keys and create a new key named
   `PayComp Connect - Production`. Choose **Sending access** restricted to
   the verified `paycomp.com` domain.
4. In Vercel > project `paycomp-connect-landing` > Settings >
   Environment Variables, add a **Sensitive** variable `RESEND_API_KEY`
   targeting **Production**. Never put the key in chat or GitHub.
5. Redeploy the project to activate the key.
6. Test with a personal inbox controlled by PayComp. Confirm the new HubSpot
   contact/company/lead appear in IPPA - 2026 > Follow-Up Needed, then check
   the recipient inbox and Resend Email activity. `emailAccepted: true` in
   the endpoint response means the API accepted the email; it does not mean
   it was delivered.

### Behavior and security

- Subject: **Thanks for connecting with PayComp!**
- Body: PayComp-branded HTML and plain text, first-name greeting, short
  follow-up acknowledgement, PayComp website and reply-to address.
- No marketing contacts or HubSpot Marketing Hub upgrade is required for this
  transactional acknowledgement.
- A per-contact/date Resend idempotency key helps prevent accidental duplicate
  emails from repeated submissions during its 24-hour storage window.
- Add operational rate limiting and a working CAPTCHA to the public form before
  high-volume use. The current form has a honeypot and optional server-side
  Turnstile verification, but its browser-side Turnstile challenge still
  needs configuration. Public autoresponders can be abused to send
  unsolicited messages to third-party addresses.
- Resend send activity will not automatically appear in the Microsoft 365
  shared mailbox's Sent Items folder, even though replies go to sales@paycomp.com.

## Important notes

- Existing contact and company records are reused where unambiguous.
- Existing IPPA leads are not duplicated or moved backward from their current stage by repeat submissions.
- Company matching by name is approximate in the real world; two similarly named companies may be different businesses. If a name matches multiple company records, the API refuses to choose incorrectly.
- Public forms need bot and rate-limit protection before broad distribution. Cloudflare Turnstile verification support is included in the API but its frontend widget is not configured yet.
- If no secure backend is configured, the landing page displays a clear unavailable message and does not imply a submission succeeded.
