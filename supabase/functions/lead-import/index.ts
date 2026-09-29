import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

// Callers:
//  - CRM app: Authorization: Bearer <user JWT> of an active crm_users member
//  - public lead form: { intake_id } of a fresh, unprocessed crm_lead_intake row (one-shot)
//  - server integrations (Google Apps Script): x-api-key = secret LEAD_IMPORT_API_KEY
//
// Until LEAD_IMPORT_API_KEY is set, the old key (published in the frontend bundle) is
// still accepted so the Apps Script integration keeps working. Setting the secret
// disables it automatically.
const LEGACY_KEY = 'beauty2026secret';

const GR_CAMPAIGN = 'C1gpQ';
const GR_FIELD_NIP = 'nIA4c8';
const GR_FIELD_FIRMA = 'nuEgTC';
const GR_FIELD_TEL = 'nuEgBg';
const GR_FIELD_UBEZP = 'nIA4FW';

const MAX_BODY_BYTES = 256 * 1024;
const MAX_ROWS = 200;
const INTAKE_MAX_AGE_MS = 30 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LIMITS = {
  company: 200, contact: 200, email: 254, phone: 40, nip: 20,
  ubezpieczenie: 200, przychod: 100, tag: 50, lead_source: 50,
} as const;

type Lead = { [K in keyof typeof LIMITS]: string } & { send_to_gr: boolean };
type Caller = 'crm' | 'integration' | 'intake';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-api-key, x-client-info',
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

function clean(v: unknown, max: number): string {
  return String(v ?? '').replace(/\p{Cc}/gu, ' ').trim().slice(0, max);
}

function toLead(row: Record<string, unknown>): Lead {
  return {
    company: clean(row.company, LIMITS.company),
    contact: clean(row.contact, LIMITS.contact),
    email: clean(row.email, LIMITS.email).toLowerCase(),
    phone: clean(row.phone, LIMITS.phone),
    nip: clean(row.nip, LIMITS.nip),
    ubezpieczenie: clean(row.ubezpieczenie, LIMITS.ubezpieczenie),
    przychod: clean(row.przychod, LIMITS.przychod),
    tag: clean(row.tag ?? 'WŁASNY', LIMITS.tag),
    lead_source: clean(row.lead_source ?? 'formularz', LIMITS.lead_source),
    send_to_gr: row.send_to_gr === true,
  };
}

async function isCrmUser(req: Request): Promise<boolean> {
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.toLowerCase().startsWith('bearer ')) return false;
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data, error } = await userClient.rpc('is_crm_user');
  return !error && data === true;
}

function hasValidApiKey(req: Request): boolean {
  const provided = req.headers.get('x-api-key');
  if (!provided) return false;
  const configured = Deno.env.get('LEAD_IMPORT_API_KEY');
  if (configured) return safeEqual(provided, configured);
  console.warn('lead-import: LEAD_IMPORT_API_KEY not set, accepting legacy key');
  return safeEqual(provided, LEGACY_KEY);
}

async function sendToGR(d: Lead | Record<string, string>, apiKey: string): Promise<boolean> {
  if (!apiKey || !d.email) return false;
  const digits = String(d.phone ?? '').replace(/\D/g, '');
  const tel = digits.length === 9 ? '+48' + digits : digits ? '+' + digits : '';
  const customFieldValues = [];
  if (d.nip) customFieldValues.push({ customFieldId: GR_FIELD_NIP, value: [d.nip] });
  if (d.company) customFieldValues.push({ customFieldId: GR_FIELD_FIRMA, value: [d.company] });
  if (tel) customFieldValues.push({ customFieldId: GR_FIELD_TEL, value: [tel] });
  if (d.ubezpieczenie) customFieldValues.push({ customFieldId: GR_FIELD_UBEZP, value: [d.ubezpieczenie] });
  try {
    const r = await fetch('https://api.getresponse.com/v3/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Auth-Token': 'api-key ' + apiKey },
      body: JSON.stringify({
        name: d.contact || d.company,
        email: d.email,
        dayOfCycle: '0',
        campaign: { campaignId: GR_CAMPAIGN },
        customFieldValues,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    return r.status === 201 || r.status === 202 || r.status === 409;
  } catch {
    return false;
  }
}

async function mergeInterest(sb: SupabaseClient, id: number, current: string, incoming: string) {
  const merged = current && incoming && !current.includes(incoming) ? `${current}, ${incoming}` : current || incoming;
  if (merged !== current) await sb.from('crm_companies').update({ zainteresowania: merged }).eq('id', id);
}

async function importLead(sb: SupabaseClient, lead: Lead, grKey: string) {
  if (!lead.company) return { company: '', status: 'skip', gr: 'skip' };

  let status: 'ok' | 'merged' | 'error' = 'ok';
  let detail: string | undefined;

  const existing = lead.nip
    ? (await sb.from('crm_companies').select('id, zainteresowania').eq('nip', lead.nip).maybeSingle()).data
    : null;

  if (existing) {
    await mergeInterest(sb, existing.id, String(existing.zainteresowania ?? ''), lead.ubezpieczenie);
    status = 'merged';
  } else {
    const { error } = await sb.from('crm_companies').insert({
      company: lead.company, contact: lead.contact, email: lead.email, phone: lead.phone, nip: lead.nip,
      ubezpieczenie: lead.ubezpieczenie, zainteresowania: lead.ubezpieczenie, przychod: lead.przychod,
      industry: 'Beauty & Wellness', status: 'lead', lead_source: lead.lead_source, tag: lead.tag, assigned_to: '',
    });
    if (error?.code === '23505' && lead.nip) {
      const { data: raced } = await sb.from('crm_companies').select('id, zainteresowania').eq('nip', lead.nip).maybeSingle();
      if (raced) await mergeInterest(sb, raced.id, String(raced.zainteresowania ?? ''), lead.ubezpieczenie);
      status = 'merged';
    } else if (error) {
      console.error('lead-import insert failed', error.code, error.message);
      status = 'error';
      detail = error.message;
    }
  }

  let gr = 'skip';
  if (status !== 'error' && lead.send_to_gr) gr = (await sendToGR(lead, grKey)) ? 'ok' : 'fail';
  return { company: lead.company, status, gr, detail };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: 'payload_too_large' }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'bad_json' }, 400);
  }

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const grKey = Deno.env.get('GR_API_KEY') ?? '';

  const obj = (body && typeof body === 'object' && !Array.isArray(body) ? body : {}) as Record<string, unknown>;

  let caller: Caller;
  let leads: Lead[];

  if (typeof obj.intake_id === 'string') {
    if (!UUID_RE.test(obj.intake_id)) return json({ error: 'invalid_intake' }, 400);
    const { data: intake } = await sb
      .from('crm_lead_intake')
      .update({ processed: true, status: 'przetworzony' })
      .eq('id', obj.intake_id)
      .eq('processed', false)
      .eq('rodo', true)
      .gte('created_at', new Date(Date.now() - INTAKE_MAX_AGE_MS).toISOString())
      .select()
      .maybeSingle();
    if (!intake) return json({ error: 'invalid_intake' }, 404);
    const person = `${intake.imie ?? ''} ${intake.nazwisko ?? ''}`.trim();
    caller = 'intake';
    leads = [toLead({
      company: intake.firma || person, contact: person, email: intake.email, phone: intake.telefon,
      nip: intake.nip, ubezpieczenie: intake.ubezpieczenie, przychod: intake.przychod,
      tag: 'własny', lead_source: 'formularz', send_to_gr: true,
    })];
  } else if (hasValidApiKey(req)) {
    caller = 'integration';
    const rows = Array.isArray(body) ? body : [body];
    if (rows.length > MAX_ROWS) return json({ error: 'too_many_rows', max: MAX_ROWS }, 413);
    leads = rows.map((r) => toLead((r ?? {}) as Record<string, unknown>));
  } else if (await isCrmUser(req)) {
    caller = 'crm';
    if (obj.action === 'send_to_gr') {
      const id = Number(obj.company_id);
      if (!Number.isInteger(id)) return json({ error: 'invalid_company' }, 400);
      const { data: co } = await sb
        .from('crm_companies')
        .select('company, contact, email, phone, nip, ubezpieczenie')
        .eq('id', id)
        .maybeSingle();
      if (!co) return json({ error: 'not_found' }, 404);
      const ok = await sendToGR(co as Record<string, string>, grKey);
      const gr_status = ok ? 'ok' : 'error';
      const gr_sent_at = new Date().toISOString();
      await sb.from('crm_companies').update({ gr_status, gr_sent_at }).eq('id', id);
      return json({ success: ok, gr_status, gr_sent_at });
    }
    const rows = Array.isArray(body) ? body : [body];
    if (rows.length > MAX_ROWS) return json({ error: 'too_many_rows', max: MAX_ROWS }, 413);
    leads = rows.map((r) => toLead((r ?? {}) as Record<string, unknown>));
  } else {
    return json({ error: 'unauthorized' }, 401);
  }

  const details = [];
  for (const lead of leads) details.push(await importLead(sb, lead, grKey));

  return json({
    success: true,
    imported: details.filter((d) => d.status === 'ok').length,
    merged: details.filter((d) => d.status === 'merged').length,
    errors: details.filter((d) => d.status === 'error').length,
    gr_sent: details.filter((d) => d.gr === 'ok').length,
    details: caller === 'crm' ? details : details.map(({ detail: _detail, ...rest }) => rest),
  });
});
