-- The CRM's own "mienie" form (link with crm_companies.form_token) was replaced by the
-- separate mienie application; its backend functions are removed. mienie_* tables and
-- crm_companies.form_token* columns are left untouched (owned/used by the new app).

drop function if exists public.mienie_form_save(text, jsonb, jsonb);
drop function if exists public.mienie_form_load(text);
drop function if exists public.mienie_form_company(text);
drop function if exists public.mienie_form_client_columns();
drop function if exists public.mienie_form_location_columns();
drop function if exists public.crm_issue_form_token(integer, integer);
