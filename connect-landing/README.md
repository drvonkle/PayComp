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

## Automatic confirmation emails (Microsoft 365 shared mailbox)

The Vercel API is prepared to send a **transactional confirmation message from**
`sales@paycomp.com` using Microsoft Graph **after** the HubSpot contact,
company, and IPPA - 2026 lead operations succeed. For successful repeat
submissions, the existing lead is not duplicated or moved. The email handler
is separate: mail errors do **not** undo the CRM submission.

Email sending is **not yet active** until Microsoft Entra credentials and
Exchange Online mailbox-scoped authorization are configured. The backend
returns `emailAccepted: false` when mail is unavailable, and
`emailAccepted: true` when Microsoft Graph returns HTTP 202 (accepted for
processing, **not a guarantee of delivery**). The frontend must not promise
email delivery.

### 1. Register one single-tenant Microsoft Entra application

Go to https://entra.microsoft.com > **Identity > Applications >
App registrations > New registration**. Set name `PayComp Landing
Confirmation Email`, supported accounts `Accounts in this organizational
directory only`. Do not register a redirect URI for this server-to-server
integration.

From **Overview**, copy:
- **Directory (tenant) ID** -> `MS365_TENANT_ID`
- **Application (client) ID** -> `MS365_CLIENT_ID`

Go to **Certificates & secrets > Client secrets > New client secret**. Set
appropriate expiry and copy the **Value** (not the secret ID) *once* ->
`MS365_CLIENT_SECRET`. Manage its expiration and rotation. Do not share it
in a chat, GitHub, or email.

### 2. Scope app-only Mail.Send to ONLY sales@paycomp.com

Microsoft recommends **Exchange Online Application RBAC** for narrowly scoped
app-only mailbox permissions. An unscoped Microsoft Graph **Mail.Send
application grant in Entra ID** allows sending as any mailbox and is
**independent** of Exchange RBAC. Do NOT grant unscoped Mail.Send in Entra when
using the scoped RBAC approach. Have a qualified Exchange admin configure
a scoped **Application Mail.Send** role assignment to the service principal
for this Entra application.

Microsoft docs:
- https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac
- https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0

Exchange Online PowerShell illustration (requires Exchange administrator
permissions and an Exchange Application RBAC-capable organization):

```powershell
Connect-ExchangeOnline
# Copy Enterprise Applications > PayComp Landing Confirmation Email > Object ID
# (service principal object ID, NOT the app registration object ID).
New-ServicePrincipal -AppId "<Application (client) ID>" -ObjectId "<Enterprise service principal Object ID>" -DisplayName "PayComp Landing Confirmation Email"

New-ManagementScope -Name "PayComp-Sales-Mailbox-Only" -RecipientRestrictionFilter "PrimarySmtpAddress -eq 'sales@paycomp.com'"
New-ManagementRoleAssignment -Name "PayComp-Sales-Confirmation-Send" -App "<Application (client) ID>" -Role "Application Mail.Send" -CustomResourceScope "PayComp-Sales-Mailbox-Only"
Test-ServicePrincipalAuthorization -Identity "<Application (client) ID>" -Resource "sales@paycomp.com"
```

Confirm `InScope=True` for **sales@paycomp.com** and
`InScope=False` for an unrelated mailbox before enabling the production
secret. Make sure the recipient filter actually matches only the sales
mailbox. Mailbox-scope changes may take time to propagate. Only qualified
admins should run these commands.

### 3. Add secrets in Vercel and redeploy

In Vercel project `paycomp-connect-landing`, go to **Settings >
Environment Variables** and add **Sensitive** variables for **Production**:
- `MS365_TENANT_ID` — Microsoft Entra directory tenant ID
- `MS365_CLIENT_ID` — client ID from app registration
- `MS365_CLIENT_SECRET` — client secret VALUE (not ID)

Then **Redeploy** to apply them. Do not configure `RESEND_API_KEY`:
Resend was removed from the integration. The shared mailbox account itself
requires **no password** in Vercel.

### 4. Complete a safe end-to-end test

Submit one request using a test email address you control. Confirm HubSpot
created or matched the contact/company/lead in **Follow-Up Needed**. Confirm
the mail appears in the `sales@paycomp.com` Sent Items folder and is
delivered to the test inbox. If not, inspect **Vercel Functions logs** and
Microsoft Entra/Exchange scope diagnostics (never paste secrets in logs).

**Important:** Add a functional CAPTCHA and rate limiting to this public form
before enabling automatic sending at scale. A public autoresponder can
otherwise be abused to send unsolicited email to third parties. Turnstile
server-side verification already exists in `api/lead.js`, but the front-end
challenge must also be configured before setting `TURNSTILE_SECRET_KEY`.

**Email content:** Subject `Thanks for connecting with PayComp!`, from
`sales@paycomp.com`, personalized salutation and PayComp acknowledgement,
reply-to `sales@paycomp.com`.

## Important notes

- Existing contact and company records are reused where unambiguous.
- Existing IPPA leads are not duplicated or moved backward from their current stage by repeat submissions.
- Company matching by name is approximate in the real world; two similarly named companies may be different businesses. If a name matches multiple company records, the API refuses to choose incorrectly.
- Public forms need bot and rate-limit protection before broad distribution. Cloudflare Turnstile verification support is included in the API but its frontend widget is not configured yet.
- If no secure backend is configured, the landing page displays a clear unavailable message and does not imply a submission succeeded.
