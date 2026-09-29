-- Public "mienie" form (link with ?token=) goes through the mienie-form Edge Function,
-- which calls these service_role-only functions. They whitelist client-editable columns
-- (no company_id / form_token / status / agent fields from the request) and save the
-- application with its locations in a single transaction.

create or replace function public.mienie_form_client_columns()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'nazwa_firmy', 'nip', 'regon', 'krs', 'adres_siedziby', 'forma_prawna', 'numer_pkd',
    'email_kontaktowy', 'telefon', 'osoba_kontaktu', 'stanowisko',
    'rodzaj_dzialalnosci', 'liczba_pracownikow', 'roczny_obrot', 'zakres',
    'brak_szkod', 'szkody', 'posiada_polise', 'towarzystwo_obecne', 'nr_polisy_obecny',
    'waznosc_do', 'roczna_skladka_obecna', 'uwagi', 'zgoda_prawdziwosc', 'zgoda_rodo'
  ]
$$;

create or replace function public.mienie_form_location_columns()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array[
    'nr', 'nazwa', 'adres', 'typ_lokalu', 'pietro', 'powierzchnia', 'rok_budowy', 'rok_remontu',
    'budynek_wlasny', 'material_scian', 'pokrycie_dachu', 'stan_techniczny', 'ogrzewanie',
    'materialy_palne', 'gasnice_szt', 'hydranty', 'data_przegladu_gasnic', 'sap', 'tryskacze',
    'drogi_ewakuacyjne', 'odleglosc_psp', 'zakaz_palenia', 'alarm_typ', 'ogrodzenie',
    'agencja_ochrony', 'agencja_24h', 'cctv', 'kraty', 'rolety', 'zamki_atestowane',
    'drzwi_atestowane', 'szyby_antywlamaniowe', 'sejf_klasa', 'system_alarmowy',
    'suma_budynek', 'suma_wyposazenie', 'suma_maszyny', 'suma_srodki_obrotowe',
    'suma_elektronika_it', 'suma_sprzet_medyczny', 'suma_gotowka_lokal', 'suma_gotowka_transport',
    'suma_szyby', 'suma_mienie_pracownikow', 'suma_lacznie', 'sprzet_medyczny', 'elektronika_eei'
  ]
$$;

create or replace function public.mienie_form_company(p_token text)
returns public.crm_companies
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.crm_companies;
begin
  if p_token is null or length(p_token) not between 30 and 200 then
    raise exception 'invalid_token' using errcode = '28000';
  end if;
  select * into v from public.crm_companies where form_token = p_token;
  if not found then
    raise exception 'invalid_token' using errcode = '28000';
  end if;
  if v.form_token_expires_at is null or v.form_token_expires_at < now() then
    raise exception 'token_expired' using errcode = '28000';
  end if;
  return v;
end
$$;

create or replace function public.mienie_form_load(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_company public.crm_companies := public.mienie_form_company(p_token);
  v_wniosek public.mienie_wnioski;
  v_locked boolean := false;
begin
  select * into v_wniosek from public.mienie_wnioski where form_token = p_token;
  if found then
    v_locked := v_wniosek.status is not null and v_wniosek.status not in ('roboczy', 'zlozony');
  end if;

  return jsonb_build_object(
    'company', jsonb_build_object(
      'company', v_company.company, 'nip', v_company.nip, 'regon', v_company.regon,
      'email', v_company.email, 'phone', v_company.phone, 'city', v_company.city
    ),
    'locked', v_locked,
    'wniosek', case when v_wniosek.id is null then null else (
      select jsonb_object_agg(key, value)
      from jsonb_each(to_jsonb(v_wniosek))
      where key = any(public.mienie_form_client_columns())
    ) end,
    'lokalizacje', coalesce((
      select jsonb_agg((
        select jsonb_object_agg(key, value)
        from jsonb_each(to_jsonb(l))
        where key = any(public.mienie_form_location_columns())
      ) order by l.nr)
      from public.mienie_lokalizacje l
      where v_wniosek.id is not null and l.wniosek_id = v_wniosek.id
    ), '[]'::jsonb)
  );
end
$$;

create or replace function public.mienie_form_save(p_token text, p_wniosek jsonb, p_lokalizacje jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company public.crm_companies := public.mienie_form_company(p_token);
  v_wniosek_id uuid;
  v_status text;
  v_w jsonb;
  v_l jsonb;
  v_loc jsonb;
  v_cols text;
begin
  if jsonb_typeof(p_wniosek) is distinct from 'object' or jsonb_typeof(p_lokalizacje) is distinct from 'array' then
    raise exception 'invalid_payload' using errcode = '22023';
  end if;
  if jsonb_array_length(p_lokalizacje) > 20 then
    raise exception 'too_many_locations' using errcode = '22023';
  end if;

  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into v_w
  from jsonb_each(p_wniosek)
  where key = any(public.mienie_form_client_columns());

  select id, status into v_wniosek_id, v_status
  from public.mienie_wnioski where form_token = p_token
  for update;

  if v_wniosek_id is null then
    v_w := v_w || jsonb_build_object('company_id', v_company.id, 'form_token', p_token);
    select string_agg(format('%I', k), ', ') into v_cols from jsonb_object_keys(v_w) as k;
    execute format(
      'insert into public.mienie_wnioski (%s) select %s from jsonb_populate_record(null::public.mienie_wnioski, $1) returning id',
      v_cols, v_cols
    ) into v_wniosek_id using v_w;
  else
    if v_status is not null and v_status not in ('roboczy', 'zlozony') then
      raise exception 'locked' using errcode = '42501';
    end if;
    v_w := v_w || jsonb_build_object('updated_at', now());
    select string_agg(format('%I', k), ', ') into v_cols from jsonb_object_keys(v_w) as k;
    execute format(
      'update public.mienie_wnioski set (%s) = (select %s from jsonb_populate_record(null::public.mienie_wnioski, $1)) where id = $2',
      v_cols, v_cols
    ) using v_w, v_wniosek_id;
  end if;

  delete from public.mienie_lokalizacje where wniosek_id = v_wniosek_id;

  for v_loc in select value from jsonb_array_elements(p_lokalizacje) loop
    if jsonb_typeof(v_loc) is distinct from 'object' then
      raise exception 'invalid_payload' using errcode = '22023';
    end if;
    select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into v_l
    from jsonb_each(v_loc)
    where key = any(public.mienie_form_location_columns());
    v_l := v_l || jsonb_build_object('wniosek_id', v_wniosek_id, 'company_id', v_company.id, 'form_token', p_token);
    select string_agg(format('%I', k), ', ') into v_cols from jsonb_object_keys(v_l) as k;
    execute format(
      'insert into public.mienie_lokalizacje (%s) select %s from jsonb_populate_record(null::public.mienie_lokalizacje, $1)',
      v_cols, v_cols
    ) using v_l;
  end loop;

  return v_wniosek_id;
end
$$;

-- CRM: generate/rotate a form link server-side (random 256-bit token, 30-day expiry).
create or replace function public.crm_issue_form_token(p_company_id integer, p_valid_days integer default 30)
returns table (form_token text, form_token_expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_crm_user() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_valid_days not between 1 and 365 then
    raise exception 'invalid_validity' using errcode = '22023';
  end if;
  return query
    update public.crm_companies c
       set form_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
           form_token_expires_at = now() + make_interval(days => p_valid_days)
     where c.id = p_company_id
    returning c.form_token, c.form_token_expires_at;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end
$$;

revoke execute on function public.mienie_form_client_columns() from public, anon, authenticated;
revoke execute on function public.mienie_form_location_columns() from public, anon, authenticated;
revoke execute on function public.mienie_form_company(text) from public, anon, authenticated;
revoke execute on function public.mienie_form_load(text) from public, anon, authenticated;
revoke execute on function public.mienie_form_save(text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.mienie_form_load(text) to service_role;
grant execute on function public.mienie_form_save(text, jsonb, jsonb) to service_role;

revoke execute on function public.crm_issue_form_token(integer, integer) from public, anon;
grant execute on function public.crm_issue_form_token(integer, integer) to authenticated;

-- Links issued by the old client code had no expiry (= never expired).
update public.crm_companies
   set form_token_expires_at = now() + interval '30 days'
 where form_token is not null and form_token_expires_at is null;
