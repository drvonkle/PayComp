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
// Send transactional acknowledgement only after the HubSpot write succeeds.
// Requires a verified paycomp.com sending domain and RESEND_API_KEY in Vercel.
// SMTP/Microsoft 365 MX and existing SPF records should never be replaced.
function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}
async function sendPayCompConfirmation(data, contactId) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false; // CRM intake must continue working without email setup.
  const firstName = escapeHtml(data.firstname);
  const greeting = 'Hi ' + data.firstname + ',';
  const subject = 'Thanks for connecting with PayComp!';
  const plain = [
    greeting, '',
    'Thank you for your interest in PayComp.',
    "We've received your information, and a member of our team will be reaching out shortly.",
    '',
    'We look forward to connecting with you and showing you how PayComp can simplify your payroll and workers’ compensation processes.',
    '',
    'Best regards,',
    'The PayComp Team',
    'Connecting people. Simplifying payroll.',
    'https://www.paycomp.com'
  ].join('\n');
  const html = [
    '<!doctype html><html lang="en"><head><meta charset="utf-8"></head>',
    '<body style="margin:0;background:#f3f7fc;font-family:Arial,Helvetica,sans-serif;color:#152b47;">',
    '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;padding:30px 14px"><tr><td align="center">',
    '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:570px;background:#fff;border:1px solid #dfebf7;border-radius:14px;overflow:hidden">',
    '<tr><td style="height:7px;background:#0d4ca3"></td></tr>',
    '<tr><td style="padding:35px 35px 28px">',
    '<div style="font-size:30px;font-weight:800;color:#083e91;letter-spacing:-1px">Pay<span style="color:#1274bd">Comp</span></div>',
    '<div style="font-size:11px;letter-spacing:2px;font-weight:700;color:#dc890f;margin-top:3px">PAYROLL. SIMPLIFIED.</div>',
    '<h1 style="font-size:24px;line-height:1.25;color:#0b2b62;margin:31px 0 20px">Thanks for connecting with PayComp!</h1>',
    '<p style="font-size:15px;line-height:1.7">Hi ' + firstName + ',</p>',
    '<p style="font-size:15px;line-height:1.7">Thank you for your interest in PayComp. We&rsquo;ve received your information, and a member of our team will be reaching out shortly.</p>',
    '<p style="font-size:15px;line-height:1.7">We look forward to connecting with you and showing you how PayComp can simplify your payroll and workers&rsquo; compensation processes.</p>',
    '<p style="font-size:15px;line-height:1.7;margin:28px 0 0">Best regards,<br><strong>The PayComp Team</strong></p>',
    '<div style="border-top:1px solid #edf1f7;padding-top:20px;margin-top:30px;font-size:12px;color:#667a93">',
    'Connecting people. Simplifying payroll.<br><a href="https://www.paycomp.com" style="color:#0d57b5">www.paycomp.com</a>',
    '</div></td></tr></table></td></tr></table></body></html>'
  ].join('');
  // Stable per-recipient/day key stops simple retry floods within Resend's window.
  const crypto = require('crypto');
  const day = new Date().toISOString().slice(0, 10);
  const digest = crypto.createHash('sha256').update('paycomp-ippa-ack-v1:' + contactId + ':' + day).digest('hex');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      'Idempotency-Key': 'paycomp-ippa-' + digest
    },
    body: JSON.stringify({
      from: 'PayComp <sales@paycomp.com>',
      to: [data.email],
      reply_to: 'sales@paycomp.com',
      subject,
      text: plain,
      html
    })
  });
  if (!response.ok) {
    console.error('PayComp acknowledgement delivery rejected', { status: response.status });
    return false;
  }
  return true;
}
async function tryConfirmationEmail(data, contactId) {
  try { return await sendPayCompConfirmation(data, contactId); }
  catch (error) {
    console.error('PayComp acknowledgement delivery failed');
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
      const emailSent = await tryConfirmationEmail(data, contactId);
      return res.status(200).json({ success: true, existing: true, emailSent });
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
    const emailSent = await tryConfirmationEmail(data, contactId);
    return res.status(200).json({ success: true, emailSent });
  } catch (e) {
    // Never expose credentials, CRM responses or submitted PII to visitors.
    console.error('PayComp intake failure', { status: e.status || 500, path: e.path || 'internal' });
    return publicError(res, 502, 'We could not submit your information. Please try again or schedule a meeting.');
  }
};
