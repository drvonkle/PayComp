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

## Important notes

- Existing contact and company records are reused where unambiguous.
- Existing IPPA leads are not duplicated or moved backward from their current stage by repeat submissions.
- Company matching by name is approximate in the real world; two similarly named companies may be different businesses. If a name matches multiple company records, the API refuses to choose incorrectly.
- Public forms need bot and rate-limit protection before broad distribution. Cloudflare Turnstile verification support is included in the API but its frontend widget is not configured yet.
- If no secure backend is configured, the landing page displays a clear unavailable message and does not imply a submission succeeded.
