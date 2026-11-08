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

## Automatic confirmation email using Microsoft 365 and Power Automate

**Status: The website API integration is prepared but NOT ACTIVE until the
Power Automate cloud flow exists and its secure trigger URL is added to
Vercel.** Neither Resend nor Microsoft Graph client credentials are needed.

After a successful HubSpot contact, company, and IPPA - 2026 lead submission,
the Vercel backend sends the visitor's `firstname` and `email` to a
Power Automate flow. The flow uses the standard **Office 365 Outlook >
Send an email from a shared mailbox (V2)** action to send from
`sales@paycomp.com`.

### Licensing prerequisite

- The **When an HTTP request is received** trigger is a **Premium** trigger
  in Power Automate. Having Microsoft 365 administration rights or Power
  Automate access does not itself grant Premium licensing. Before activating,
  check the flow owner's Power Automate Premium / Process entitlements.
- Outlook's **Send an email from a shared mailbox (V2)** action is a
  standard connector, and the connection user requires the correct mailbox
  **Send As** access to `sales@paycomp.com`.

### Create the flow

1. At https://make.powerautomate.com, select **Create > Instant cloud
   flow**, then choose the **When an HTTP request is received** trigger.
   Name: `PayComp Connect - Send Confirmation`. If this trigger is shown
   as Premium and no appropriate license is available, stop: do not
   activate a flow that the license cannot run.
2. Configure the trigger to accept this JSON request body schema:

   ```json
   {
     "type": "object",
     "properties": {
       "firstname": { "type": "string" },
       "email": { "type": "string" }
     },
     "required": ["firstname", "email"]
   }
   ```

   The trigger may default to **Any user in my tenant**. The PayComp Vercel
   backend isn't logged in as a Microsoft Entra user. Without a separately
   authorized Entra identity, the simple webhook arrangement requires the
   trigger's **Who can trigger the flow** setting to be **Anyone**.
   **Treat the generated callback URL as a secret**, since any party with
   that URL may invoke the flow. Never expose it in front-end HTML,
   GitHub, publicly shared logs, screenshots or email. Microsoft strongly
   recommends Entra-based auth as the stronger protection.

3. Add action **Office 365 Outlook > Send an email from a shared mailbox (V2)**.
   Connect using a licensed Microsoft 365 user who has Send As permissions
   for the shared mailbox (the shared mailbox itself does not need to sign in).

   - Original Mailbox Address: `sales@paycomp.com`
   - To: select **email** from HTTP request trigger dynamic content.
   - Subject: `Thanks for connecting with PayComp!`
   - Body (HTML supported):
     ```html
     <p>Hi [FIRSTNAME],</p>
     <p>Thank you for your interest in PayComp!</p>
     <p>We've received your information, and a member of our team
     will be reaching out shortly.</p>
     <p>We look forward to connecting with you and showing you how
     PayComp can simplify your payroll and workers' compensation processes.</p>
     <p>Best regards,<br><strong>The PayComp Team</strong></p>
     <p>Connecting people. Simplifying payroll.<br>
     <a href="https://www.paycomp.com">www.paycomp.com</a></p>
     ```
   Replace `[FIRSTNAME]` with the HTTP trigger's **firstname** dynamic content.
   Optionally add PayComp colors and an image URL from the official website.

4. Save the flow. Copy its **HTTP POST URL** carefully. This is a credential
   because it commonly includes a signature.
5. In Vercel project `paycomp-connect-landing` > **Settings >
   Environment Variables**, add one **Sensitive Production** variable:
   `PAYCOMP_CONFIRMATION_FLOW_URL` = the generated HTTP POST URL.
   Do not paste that URL into chat or public code. Redeploy Production.
6. Test one form submission with an email inbox you control. Verify the
   HubSpot IPPA lead in **Follow-Up Needed**, the Power Automate flow run,
   and delivery in the recipient inbox. API response `flowTriggered:true`
   only means the workflow accepted the request, not delivery.

### Security and operational notes

The site continues accepting and storing HubSpot leads if the flow isn't
configured or the email fails. This avoids loss of lead intake when mail
is unavailable.

Before enabling a public autoresponder, configure bot protection and
rate limiting for the public landing page; otherwise an attacker can use
the form to send unsolicited emails to third parties. Optional server-side
Turnstile support is in `api/lead.js`, but a front-end challenge must also
be configured. Restrict access to the flow's URL to website administrators;
renew/revoke its signature if exposed.

References:
- https://learn.microsoft.com/en-us/connectors/office365/
- https://learn.microsoft.com/en-us/power-automate/oauth-authentication
- https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/types

## Important notes

- Existing contact and company records are reused where unambiguous.
- Existing IPPA leads are not duplicated or moved backward from their current stage by repeat submissions.
- Company matching by name is approximate in the real world; two similarly named companies may be different businesses. If a name matches multiple company records, the API refuses to choose incorrectly.
- Public forms need bot and rate-limit protection before broad distribution. Cloudflare Turnstile verification support is included in the API but its frontend widget is not configured yet.
- If no secure backend is configured, the landing page displays a clear unavailable message and does not imply a submission succeeded.
