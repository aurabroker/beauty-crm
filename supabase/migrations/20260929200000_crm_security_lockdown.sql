-- CRM security lockdown
-- Before: anon could SELECT every crm_companies row (PII + form tokens) and ANY
-- authenticated user of this shared Supabase project had full CRUD on all crm_* tables.
-- After: only active crm_users (matched by confirmed auth email) can access CRM data,
-- destructive operations are admin-only, every change is written to crm_audit_log.


-- ---------------------------------------------------------------------------
-- 1. Identity helpers
-- ---------------------------------------------------------------------------
create or replace function public.crm_current_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select cu.role
  from public.crm_users cu
  join auth.users au on lower(au.email::text) = lower(cu.email)
  where au.id = auth.uid()
    and au.email_confirmed_at is not null
    and au.deleted_at is null
    and (au.banned_until is null or au.banned_until < now())
    and cu.active is true
  limit 1
$$;

create or replace function public.is_crm_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.crm_current_role() is not null
$$;

create or replace function public.is_crm_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.crm_current_role() = 'admin', false)
$$;

revoke execute on function public.crm_current_role() from public, anon;
revoke execute on function public.is_crm_user() from public, anon;
revoke execute on function public.is_crm_admin() from public, anon;
grant execute on function public.crm_current_role() to authenticated, service_role;
grant execute on function public.is_crm_user() to authenticated, service_role;
grant execute on function public.is_crm_admin() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Table privileges (defense in depth under RLS)
-- ---------------------------------------------------------------------------
revoke all on table
  public.crm_companies, public.crm_history, public.crm_reminders, public.crm_policies,
  public.crm_users, public.crm_settings, public.crm_lead_intake
from anon;

revoke truncate, trigger, references on table
  public.crm_companies, public.crm_history, public.crm_reminders, public.crm_policies,
  public.crm_users, public.crm_settings, public.crm_lead_intake
from authenticated;

-- Public lead form: insert only, only form columns (no processed/status/created_at).
grant insert (id, imie, nazwisko, firma, nip, email, telefon, ubezpieczenie, przychod, rodo)
  on public.crm_lead_intake to anon;

alter table public.crm_users alter column active set not null;
create unique index if not exists crm_users_email_lower_key on public.crm_users (lower(email));

alter table public.crm_lead_intake
  add constraint crm_lead_intake_lengths_check check (
    length(imie) <= 100 and length(nazwisko) <= 100 and length(coalesce(firma, '')) <= 200
    and length(coalesce(nip, '')) <= 20 and length(email) <= 254 and length(coalesce(telefon, '')) <= 30
    and length(coalesce(ubezpieczenie, '')) <= 200 and length(coalesce(przychod, '')) <= 100
  );

-- ---------------------------------------------------------------------------
-- 3. RLS policies
-- ---------------------------------------------------------------------------
drop policy if exists crm_companies_select_anon on public.crm_companies;
drop policy if exists auth_all_companies on public.crm_companies;
drop policy if exists auth_all_history on public.crm_history;
drop policy if exists auth_all_reminders on public.crm_reminders;
drop policy if exists auth_all_policies on public.crm_policies;
drop policy if exists auth_all_users on public.crm_users;
drop policy if exists auth_all_settings on public.crm_settings;
drop policy if exists auth_all_intake on public.crm_lead_intake;
drop policy if exists public_can_insert on public.crm_lead_intake;

-- (select fn()) is evaluated once per statement instead of once per row.

-- crm_companies: CRM users read/write, only admins delete (delete cascades to policies/history).
create policy crm_companies_select on public.crm_companies for select to authenticated
  using ((select public.is_crm_user()));
create policy crm_companies_insert on public.crm_companies for insert to authenticated
  with check ((select public.is_crm_user()));
create policy crm_companies_update on public.crm_companies for update to authenticated
  using ((select public.is_crm_user())) with check ((select public.is_crm_user()));
create policy crm_companies_delete on public.crm_companies for delete to authenticated
  using ((select public.is_crm_admin()));

-- crm_policies: same model.
create policy crm_policies_select on public.crm_policies for select to authenticated
  using ((select public.is_crm_user()));
create policy crm_policies_insert on public.crm_policies for insert to authenticated
  with check ((select public.is_crm_user()));
create policy crm_policies_update on public.crm_policies for update to authenticated
  using ((select public.is_crm_user())) with check ((select public.is_crm_user()));
create policy crm_policies_delete on public.crm_policies for delete to authenticated
  using ((select public.is_crm_admin()));

-- crm_history: append-only for users, admins may correct/delete.
create policy crm_history_select on public.crm_history for select to authenticated
  using ((select public.is_crm_user()));
create policy crm_history_insert on public.crm_history for insert to authenticated
  with check ((select public.is_crm_user()));
create policy crm_history_update on public.crm_history for update to authenticated
  using ((select public.is_crm_admin())) with check ((select public.is_crm_admin()));
create policy crm_history_delete on public.crm_history for delete to authenticated
  using ((select public.is_crm_admin()));

-- crm_reminders: day-to-day working data.
create policy crm_reminders_all on public.crm_reminders for all to authenticated
  using ((select public.is_crm_user())) with check ((select public.is_crm_user()));

-- crm_users / crm_settings: read for users, write for admins only.
create policy crm_users_select on public.crm_users for select to authenticated
  using ((select public.is_crm_user()));
create policy crm_users_write on public.crm_users for all to authenticated
  using ((select public.is_crm_admin())) with check ((select public.is_crm_admin()));

create policy crm_settings_select on public.crm_settings for select to authenticated
  using ((select public.is_crm_user()));
create policy crm_settings_write on public.crm_settings for all to authenticated
  using ((select public.is_crm_admin())) with check ((select public.is_crm_admin()));

-- crm_lead_intake: anonymous form may only insert fresh, consented rows.
create policy crm_lead_intake_anon_insert on public.crm_lead_intake for insert to anon
  with check (rodo is true and coalesce(processed, false) = false and coalesce(status, 'nowy') = 'nowy');
create policy crm_lead_intake_crm_all on public.crm_lead_intake for all to authenticated
  using ((select public.is_crm_user())) with check ((select public.is_crm_user()));

-- ---------------------------------------------------------------------------
-- 4. Never lose the last admin
-- ---------------------------------------------------------------------------
create or replace function public.crm_users_keep_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.crm_users where role = 'admin' and active) then
    raise exception 'CRM musi mieć co najmniej jednego aktywnego administratora';
  end if;
  return null;
end
$$;

drop trigger if exists crm_users_keep_admin on public.crm_users;
create trigger crm_users_keep_admin
  after update or delete on public.crm_users
  for each statement execute function public.crm_users_keep_admin();

-- ---------------------------------------------------------------------------
-- 5. Audit log (append-only, readable by CRM admins)
-- ---------------------------------------------------------------------------
create table if not exists public.crm_audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  table_name text not null,
  op text not null,
  row_pk text,
  actor_id uuid,
  actor_email text,
  actor_role text,
  old_row jsonb,
  new_row jsonb
);
comment on table public.crm_audit_log is 'Append-only audit trail of CRM changes (companies, policies, users, settings).';

create index if not exists crm_audit_log_row_idx on public.crm_audit_log (table_name, row_pk, at desc);
create index if not exists crm_audit_log_at_idx on public.crm_audit_log (at desc);

alter table public.crm_audit_log enable row level security;
revoke all on table public.crm_audit_log from anon, authenticated;
grant select on table public.crm_audit_log to authenticated;
create policy crm_audit_log_admin_select on public.crm_audit_log for select to authenticated
  using ((select public.is_crm_admin()));

create or replace function public.crm_audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
begin
  if tg_op = 'UPDATE' and v_old = v_new then
    return null;
  end if;
  insert into public.crm_audit_log (table_name, op, row_pk, actor_id, actor_email, actor_role, old_row, new_row)
  values (
    tg_table_name,
    tg_op,
    coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'key', v_old ->> 'key'),
    nullif(v_claims ->> 'sub', '')::uuid,
    v_claims ->> 'email',
    coalesce(v_claims ->> 'role', session_user),
    v_old,
    v_new
  );
  return null;
end
$$;

drop trigger if exists crm_audit on public.crm_companies;
create trigger crm_audit after insert or update or delete on public.crm_companies
  for each row execute function public.crm_audit_trigger();
drop trigger if exists crm_audit on public.crm_policies;
create trigger crm_audit after insert or update or delete on public.crm_policies
  for each row execute function public.crm_audit_trigger();
drop trigger if exists crm_audit on public.crm_users;
create trigger crm_audit after insert or update or delete on public.crm_users
  for each row execute function public.crm_audit_trigger();
drop trigger if exists crm_audit on public.crm_settings;
create trigger crm_audit after insert or update or delete on public.crm_settings
  for each row execute function public.crm_audit_trigger();
drop trigger if exists crm_audit on public.crm_history;
create trigger crm_audit after update or delete on public.crm_history
  for each row execute function public.crm_audit_trigger();

-- ---------------------------------------------------------------------------
-- 6. crm_companies.id: sequence was behind max(id) (clients computed max+1 → races)
-- ---------------------------------------------------------------------------
select setval('public.crm_companies_id_seq', (select max(id) from public.crm_companies));

create or replace function public.crm_companies_sync_id_seq()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- last_value is non-transactional, so we never move the sequence backwards
  -- past a value another in-flight transaction already took.
  perform setval(
    'public.crm_companies_id_seq',
    greatest(
      coalesce((select max(id) from public.crm_companies), 1),
      (select last_value from public.crm_companies_id_seq)
    )
  );
  return null;
end
$$;

drop trigger if exists crm_companies_sync_id_seq on public.crm_companies;
create trigger crm_companies_sync_id_seq
  after insert on public.crm_companies
  for each statement execute function public.crm_companies_sync_id_seq();

revoke execute on function public.crm_users_keep_admin() from public, anon, authenticated;
revoke execute on function public.crm_audit_trigger() from public, anon, authenticated;
revoke execute on function public.crm_companies_sync_id_seq() from public, anon, authenticated;

