import 'jsr:@supabase/functions-js@2/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Public "mienie" form backend. The token from the link is the only credential; all
// validation (expiry, column whitelist, edit lock, atomic save) lives in the
// service_role-only SQL functions mienie_form_load / mienie_form_save.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
};

const MAX_BODY_BYTES = 512 * 1024;

const ERRORS: Record<string, [number, string]> = {
  invalid_token: [401, 'invalid_token'],
  token_expired: [401, 'token_expired'],
  locked: [409, 'locked'],
  invalid_payload: [400, 'invalid_payload'],
  too_many_locations: [400, 'too_many_locations'],
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function fail(message: string | undefined): Response {
  const known = message ? ERRORS[message] : undefined;
  if (known) return json({ error: known[1] }, known[0]);
  console.error('mienie-form error', message);
  return json({ error: 'server_error' }, 500);
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const token = new URL(req.url).searchParams.get('token') ?? '';
  if (token.length < 30 || token.length > 200) return json({ error: 'invalid_token' }, 401);

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  if (req.method === 'GET') {
    const { data, error } = await sb.rpc('mienie_form_load', { p_token: token });
    return error ? fail(error.message) : json(data);
  }

  if (req.method === 'POST') {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return json({ error: 'payload_too_large' }, 413);
    let body: { wniosek?: unknown; lokalizacje?: unknown };
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: 'invalid_json' }, 400);
    }
    const { data, error } = await sb.rpc('mienie_form_save', {
      p_token: token,
      p_wniosek: body.wniosek ?? {},
      p_lokalizacje: body.lokalizacje ?? [],
    });
    return error ? fail(error.message) : json({ success: true, wniosekId: data });
  }

  return json({ error: 'method_not_allowed' }, 405);
});
