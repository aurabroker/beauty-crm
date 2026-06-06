import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

function respond(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";

  if (!token) {
    return respond({ error: "missing_token" }, 400);
  }

  // Walidacja tokenu i sprawdzenie wygaśnięcia
  const { data: company, error: compErr } = await supabase
    .from("crm_companies")
    .select("id, company, nip, regon, krs, email, phone, city, state, form_token_expires_at")
    .eq("form_token", token)
    .maybeSingle();

  if (compErr || !company) {
    return respond({ error: "invalid_token" }, 401);
  }

  if (
    company.form_token_expires_at &&
    new Date(company.form_token_expires_at) < new Date()
  ) {
    return respond({ error: "token_expired" }, 401);
  }

  // GET: załaduj dane formularza
  if (req.method === "GET") {
    const { data: wniosek } = await supabase
      .from("mienie_wnioski")
      .select("*")
      .eq("form_token", token)
      .maybeSingle();

    let lokalizacje: unknown[] = [];
    if (wniosek?.id) {
      const { data: loks } = await supabase
        .from("mienie_lokalizacje")
        .select("*")
        .eq("wniosek_id", wniosek.id)
        .order("nr");
      lokalizacje = loks ?? [];
    }

    return respond({ company, wniosek: wniosek ?? null, lokalizacje });
  }

  // POST: zapisz dane formularza
  if (req.method === "POST") {
    let body: { payload?: Record<string, unknown>; lokalizacje?: Record<string, unknown>[] };
    try {
      body = await req.json();
    } catch {
      return respond({ error: "invalid_json" }, 400);
    }

    const { payload = {}, lokalizacje: locData = [] } = body;

    // Znajdź istniejący wniosek dla tego tokenu
    const { data: existing } = await supabase
      .from("mienie_wnioski")
      .select("id")
      .eq("form_token", token)
      .maybeSingle();

    let wniosekId: string;

    if (existing?.id) {
      const { error } = await supabase
        .from("mienie_wnioski")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) return respond({ error: error.message }, 500);
      wniosekId = existing.id;
    } else {
      const { data: created, error } = await supabase
        .from("mienie_wnioski")
        .insert(payload)
        .select("id")
        .single();
      if (error) return respond({ error: error.message }, 500);
      wniosekId = created.id;
    }

    // Zastąp lokalizacje (usuń stare, wstaw nowe)
    const { error: delErr } = await supabase
      .from("mienie_lokalizacje")
      .delete()
      .eq("wniosek_id", wniosekId);

    if (delErr) return respond({ error: delErr.message }, 500);

    for (const loc of locData) {
      const { error: locErr } = await supabase
        .from("mienie_lokalizacje")
        .insert({ ...loc, wniosek_id: wniosekId });
      if (locErr) {
        return respond({ error: "Błąd zapisu lokalizacji: " + locErr.message }, 500);
      }
    }

    return respond({ success: true, wniosekId });
  }

  return new Response("Method Not Allowed", { status: 405, headers: CORS });
});
