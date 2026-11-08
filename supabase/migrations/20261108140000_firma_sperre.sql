-- =====================================================================
-- Firma sperren (Owner-Dashboard „Sperren“) wirksam machen
--  * my_tenant_status(): Status der eigenen Firma (z. B. 'blocked') für die App
--  * die App zeigt bei 'blocked' allen Nutzern dieser Firma sofort eine Sperrseite
-- Ändert keine Tabellen. Kann mehrfach ausgeführt werden.
-- =====================================================================

create or replace function public.my_tenant_status()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select t.status::text
    from public.app_users u
    join public.tenants t on t.id = u.tenant_id
   where u.auth_user_id = auth.uid()
   limit 1;
$$;

revoke all on function public.my_tenant_status() from public, anon;
grant execute on function public.my_tenant_status() to authenticated;
