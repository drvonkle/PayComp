/**
 * PayComp IPPA - 2026 lead intake (Vercel Serverless Function).
 * Requires HUBSPOT_SERVICE_KEY (preferred) or an existing HUBSPOT_PRIVATE_APP_TOKEN in Vercel.
 * Do not commit credentials. GitHub Pages alone cannot execute this function.
 */
const HUBSPOT = 'https://api.hubapi.com';
const HUBSPOT_CREDENTIAL = process.env.HUBSPOT_SERVICE_KEY || process.env.HUBSPOT_PRIVATE_APP_TOKEN;
const PIPELINE_ID = '2673323738';
const FOLLOW_UP_STAGE_ID = '4558346947'; // Verified IPPA - 2026 > Follow-Up Needed
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://drvonkle.github.io').split(',').map(s => s.trim()).filter(Boolean);
function publicError(res, status, message) {
  res.status(status).json({ success: false, message });
}
function clean(v, max = 200) { return typeof v === 'string' ? v.trim().slice(0, max) : ''; }
function normalizeUsPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  if (digits.length !== 10) return '';
  return '+1 (' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6);
}
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function hs(path, method = 'GET', body) {
  const response = await fetch(HUBSPOT + path, {
    method,
    headers: { Authorization: 'Bearer ' + HUBSPOT_CREDENTIAL,
      'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const text = await response.text();
  let value = {};
  try { value = text ? JSON.parse(text) : {}; } catch {}
  if (!response.ok) {
    const e = new Error('HubSpot request failed');
    e.status = response.status;
    e.path = path.split('?')[0];
    throw e;
  }
  return value;
}
async function findExact(object, property, value, limit = 10) {
  const found = await hs('/crm/v3/objects/' + object + '/search', 'POST', {
    filterGroups: [{ filters: [{ propertyName: property, operator: 'EQ', value }] }],
    properties: [property], limit
  });
  return (found.results || []).filter(x => String(x.properties?.[property] || '').toLowerCase() === value.toLowerCase());
}
// Record the completed inquiry as a real HubSpot form submission to trigger
// a Marketing Hub Starter form-based confirmation email workflow.
// Configure HUBSPOT_FOLLOWUP_FORM_ID with the GUID of the dedicated, published
// "PayComp Connect With Us - Confirmation" HubSpot form. Leave blank until
// the form and automation are configured. The existing HubSpot lead remains
// the source of truth; form-submission errors must not undo the CRM changes.
async function recordHubSpotFollowupForm(data) {
  const formGuid = String(process.env.HUBSPOT_FOLLOWUP_FORM_ID || '').trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(formGuid)) return false;

  const fields = ['firstname', 'lastname', 'email', 'phone', 'company']
    .map(name => ({ name, value: data[name] }));

  const response = await fetch(
    'https://api.hsforms.com/submissions/v3/integration/submit/244845203/' + formGuid,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submittedAt: Date.now(),
        fields,
        context: {
          pageUri: 'https://paycomp-connect-with-us.vercel.app/',
          pageName: 'PayComp Connect With Us'
        }
      })
    }
  );
  if (!response.ok) {
    // Do not log form response data or visitor information.
    console.error('PayComp HubSpot form submission rejected', { status: response.status });
    return false;
  }
  // Form accepted does NOT prove that the automated email was delivered.
  return true;
}
async function tryRecordFollowupForm(data) {
  try { return await recordHubSpotFollowupForm(data); }
  catch {
    console.error('PayComp HubSpot form submission failed');
    return false;
  }
}
async function getOrCreateContact(data) {
  const matches = await findExact('contacts', 'email', data.email);
  const properties = { email: data.email, firstname: data.firstname, lastname: data.lastname,
    phone: data.phone, company: data.company };
  if (matches.length) {
    const id = matches[0].id;
    await hs('/crm/v3/objects/contacts/' + id, 'PATCH', { properties });
    return id;
  }
  try {
    return (await hs('/crm/v3/objects/contacts', 'POST', { properties })).id;
  } catch (e) {
    if (e.status !== 409) throw e;
    const retry = await findExact('contacts', 'email', data.email);
    if (!retry.length) throw e;
    await hs('/crm/v3/objects/contacts/' + retry[0].id, 'PATCH', { properties });
    return retry[0].id;
  }
}
async function getOrCreateCompany(name) {
  const matches = await findExact('companies', 'name', name);
  if (matches.length > 1) throw Object.assign(new Error('Ambiguous company match'), { status: 409 });
  if (matches.length === 1) return matches[0].id;
  return (await hs('/crm/v3/objects/companies', 'POST', { properties: { name } })).id;
}
async function getExistingIppaLead(contactId) {
  let after = null;
  for (let page = 0; page < 4; page++) {
    const suffix = after ? '?limit=100&after=' + encodeURIComponent(after) : '?limit=100';
    const list = await hs('/crm/v4/objects/contacts/' + contactId + '/associations/leads' + suffix);
    for (const assoc of list.results || []) {
      const lead = await hs('/crm/v3/objects/leads/' + assoc.toObjectId + '?properties=hs_pipeline,hs_pipeline_stage');
      if (lead.properties?.hs_pipeline === PIPELINE_ID) return lead.id;
    }
    after = list.paging?.next?.after;
    if (!after) break;
  }
  return null;
}
async function verifyTurnstile(token, ip) {
  if (!process.env.TURNSTILE_SECRET_KEY) return true;
  if (!token) return false;
  const params = new URLSearchParams();
  params.set('secret', process.env.TURNSTILE_SECRET_KEY);
  params.set('response', token);
  if (ip) params.set('remoteip', ip);
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST', body: params
  });
  return r.ok && (await r.json()).success === true;
}
module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '';
  const sameOrigin = origin && (() => {
    try { return new URL(origin).host === req.headers.host && new URL(origin).protocol === 'https:'; }
    catch { return false; }
  })();
  const allowed = !origin || allowedOrigins.includes(origin) || sameOrigin;
  if (origin && allowed) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(allowed ? 204 : 403).end();
  if (req.method !== 'POST') return publicError(res, 405, 'Method not allowed.');
  if (!allowed) return publicError(res, 403, 'This form origin is not permitted.');
  if (!HUBSPOT_CREDENTIAL)
    return publicError(res, 503, 'Lead intake is not configured yet.');
  const data = {
    firstname: clean(req.body?.firstname, 100), lastname: clean(req.body?.lastname, 100),
    email: clean(req.body?.email, 254).toLowerCase(), phone: normalizeUsPhone(clean(req.body?.phone, 50)),
    company: clean(req.body?.company, 200)
  };
  if (clean(req.body?.website)) return res.status(200).json({ success: true });
  if (!data.firstname || !data.lastname || !data.email || !data.phone || !data.company ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
    return publicError(res, 400, 'Enter a valid name, email, phone, and company name.');
  try {
    if (!(await verifyTurnstile(req.body?.turnstileToken, req.headers['x-forwarded-for']?.split(',')[0])))
      return publicError(res, 400, 'Please complete the security check.');
    const contactId = await getOrCreateContact(data);
    const companyId = await getOrCreateCompany(data.company);
    await hs('/crm/v4/objects/contacts/' + contactId + '/associations/default/companies/' + companyId, 'PUT');
    const existing = await getExistingIppaLead(contactId);
    if (existing) {
      const hubspotFormSubmitted = await tryRecordFollowupForm(data);
      return res.status(200).json({ success: true, existing: true, hubspotFormSubmitted });
    }
    const lead = await hs('/crm/v3/objects/leads', 'POST', {
      properties: {
        hs_lead_name: data.firstname + ' ' + data.lastname + ' - ' + data.company,
        hs_pipeline: PIPELINE_ID, hs_pipeline_stage: FOLLOW_UP_STAGE_ID
      },
      associations: [{
        to: { id: String(contactId) },
        types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 578 }]
      }]
    });
    await hs('/crm/v4/objects/leads/' + lead.id + '/associations/default/companies/' + companyId, 'PUT');
    const hubspotFormSubmitted = await tryRecordFollowupForm(data);
    return res.status(200).json({ success: true, hubspotFormSubmitted });
  } catch (e) {
    // Never expose credentials, CRM responses or submitted PII to visitors.
    console.error('PayComp intake failure', { status: e.status || 500, path: e.path || 'internal' });
    return publicError(res, 502, 'We could not submit your information. Please try again or schedule a meeting.');
  }
};
