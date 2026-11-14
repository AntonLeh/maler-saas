-- Land bei der Registrierung: Währung und Mehrwertsteuer passend setzen – 14.11.2026
-- Zusätzliche Automatik NACH der bestehenden (on_auth_user_created_company_signup bleibt unverändert).
-- Trigger gleicher Art laufen in alphabetischer Reihenfolge; der neue Name sortiert hinter dem bestehenden.
-- Fehler hier dürfen die Registrierung nie verhindern.

create or replace function public.handle_company_signup_country()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_country text := new.raw_user_meta_data ->> 'country';
  v_tenant bigint;
begin
  if coalesce(new.raw_user_meta_data ->> 'signup_type', '') <> 'company'
     or coalesce(v_country, '') not in ('Deutschland', 'Österreich', 'Schweiz') then
    return new;
  end if;
  begin
    select tenant_id into v_tenant from public.app_users where auth_user_id = new.id limit 1;
    if v_tenant is not null then
      update public.company_settings
      set country = v_country,
          currency = case when v_country = 'Schweiz' then 'CHF' else 'EUR' end,
          currency_symbol = case when v_country = 'Schweiz' then 'CHF' else '€' end,
          tax_rate_default = case v_country when 'Deutschland' then 19 when 'Österreich' then 20 else 8.1 end,
          updated_at = now()
      where tenant_id = v_tenant;
    end if;
  exception when others then
    raise warning 'handle_company_signup_country: %', sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.handle_company_signup_country() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_company_signup_country on auth.users;
create trigger on_auth_user_created_company_signup_country
  after insert on auth.users
  for each row execute function public.handle_company_signup_country();
