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

## Automatic confirmation emails

The follow-up API includes a branded **transactional acknowledgement** from `PayComp <sales@paycomp.com>`, personalized with the visitor's first name. This runs **after** the contact, company, and lead have been written to HubSpot. It runs for a successful repeat submission without creating a duplicate IPPA lead.

Sending remains **disabled** until a verified sending domain and `RESEND_API_KEY` are configured. HubSpot CRM submissions continue to succeed if the email provider is unavailable, and the API returns `emailSent: false` rather than reporting email delivery.

To activate in Resend:

1. Create a Resend account and add `paycomp.com` to **Domains**. Verify sending by adding the exact DNS records Resend gives you. **Do not replace** your existing Microsoft 365 mail routing, MX, or root SPF records; work with the domain administrator to add the required verification and sender records safely.
2. Create a **Sending access** API key in Resend, scoped to the verified domain where possible.
3. In Vercel project `paycomp-connect-landing`, add a **Sensitive / Production** environment variable named `RESEND_API_KEY` with the copied key. Never put it in GitHub or chat.
4. Redeploy the Production build so the new variable is loaded.
5. Submit a test inquiry using an email inbox you control. Verify the test HubSpot contact, associated company, and IPPA lead. Confirm the acknowledgement is accepted in Resend and delivered to the inbox (and check spam).

**Email template**

- From and reply-to: `sales@paycomp.com`
- Subject: `Thanks for connecting with PayComp!`
- Content: personalized acknowledgement with an estimated response of "shortly", PayComp branding, and the website.
- This is an acknowledgement of an inquiry, not a marketing subscription or sales blast.
- A per-contact daily idempotency key reduces accidental duplicate emails on retries.
- Public forms should have a working CAPTCHA and rate limiting before unrestricted sending at scale.

## Important notes

- Existing contact and company records are reused where unambiguous.
- Existing IPPA leads are not duplicated or moved backward from their current stage by repeat submissions.
- Company matching by name is approximate in the real world; two similarly named companies may be different businesses. If a name matches multiple company records, the API refuses to choose incorrectly.
- Public forms need bot and rate-limit protection before broad distribution. Cloudflare Turnstile verification support is included in the API but its frontend widget is not configured yet.
- If no secure backend is configured, the landing page displays a clear unavailable message and does not imply a submission succeeded.
