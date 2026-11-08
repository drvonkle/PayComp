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

## Confirmation email via HubSpot Marketing Hub Starter

**Status: backend prepared, email NOT ACTIVE until the dedicated HubSpot form, its simple workflow, and its form GUID environment variable are configured.**

The Vercel form keeps its existing layout, HubSpot contact/company upsert,
IPPA - 2026 lead creation, and Follow-Up Needed stage.

After a successful CRM submission, the backend can make a matching HubSpot
**Forms Submission API** call to a dedicated published form. That HubSpot
form's **simple automation** then sends a follow-up marketing email from
`sales@paycomp.com`. This replaces the unused Resend and Microsoft Graph
integrations. Do not create Microsoft Entra app credentials or buy Resend for
this feature.

### HubSpot editor: complete these steps

1. **Marketing > Forms > Create form**. Name it exactly
   `PayComp Connect With Us - Confirmation`. Choose a HubSpot form with
   contact properties `firstname`, `lastname`, `email`, `phone`, and
   `company` (company text property on the contact). Publish the form.
   It does **not** need to be visibly embedded: the Vercel backend submits
   to it securely using the form GUID.
2. In that form's **Automation** section, click
   **Send an email after form submission > Create this workflow**.
   Select a confirmation email with:
   - Sender: `PayComp <sales@paycomp.com>`
   - Subject: `Thanks for connecting with PayComp!`
   - Body:
     ```text
     Hi [First Name],

     Thank you for your interest in PayComp!

     We've received your information, and a member of our team will be
     reaching out shortly.

     We look forward to connecting with you and showing you how PayComp
     can simplify your payroll and workers' compensation processes.

     Best regards,
     The PayComp Team
     Connecting people. Simplifying payroll.
     www.paycomp.com
     ```
   Use HubSpot's personalization tool for first name (fallback: `there`).
   Verify `sales@paycomp.com` as the From address and publish the email
   and turn on the simple workflow.
3. **Marketing contact eligibility:** HubSpot's form workflow emails
   require eligible **marketing contacts** under Marketing Hub plans.
   Configure the form's marketing-contact/consent settings in accordance
   with PayComp's policies and subscription allowances. Do not silently
   turn all CRM contacts into marketing contacts.
4. Copy the **form GUID** from the form's embed code or form URL.
   In the Vercel project `paycomp-connect-landing`, add a **Production**
   variable `HUBSPOT_FOLLOWUP_FORM_ID` set to that GUID, and redeploy.
5. Test using an email inbox you control. Confirm the HubSpot contact,
   company, associated lead, recorded **form submission**, and delivered
   confirmation email. The API response field `hubspotFormSubmitted` is
   **not** proof that an email arrived.

**Safety:** Before enabling a public autoresponder, deploy rate limiting and
bot protection to prevent third parties from using it to send unsolicited
messages. The API has a honeypot and optional server-side Turnstile check,
but the client-side Turnstile integration is not configured yet.

HubSpot reference:
https://knowledge.hubspot.com/forms/form-automations

## Important notes

- Existing contact and company records are reused where unambiguous.
- Existing IPPA leads are not duplicated or moved backward from their current stage by repeat submissions.
- Company matching by name is approximate in the real world; two similarly named companies may be different businesses. If a name matches multiple company records, the API refuses to choose incorrectly.
- Public forms need bot and rate-limit protection before broad distribution. Cloudflare Turnstile verification support is included in the API but its frontend widget is not configured yet.
- If no secure backend is configured, the landing page displays a clear unavailable message and does not imply a submission succeeded.
