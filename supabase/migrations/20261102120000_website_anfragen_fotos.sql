-- =====================================================================
-- Modul Website: Kontaktformular mit Leistungsauswahl und Fotos
--
-- * website_leads bekommt zwei neue Spalten (services, photo_count)
-- * neue Tabelle website_lead_photos (Fotos der Anfrage, nur für Admins sichtbar,
--   werden mit der Anfrage automatisch gelöscht)
-- * neue Funktion website_submit_lead2 (die alte website_submit_lead bleibt bestehen)
-- Kann gefahrlos mehrfach ausgeführt werden.
-- =====================================================================

begin;

alter table public.website_leads add column if not exists services text[] not null default '{}';
alter table public.website_leads add column if not exists photo_count int not null default 0;

create table if not exists public.website_lead_photos (
  id          bigserial primary key,
  lead_id     bigint not null references public.website_leads(id) on delete cascade,
  tenant_id   bigint not null references public.tenants(id) on delete cascade,
  mime        text not null default 'image/jpeg',
  data        bytea not null,
  created_at  timestamptz not null default now()
);
create index if not exists website_lead_photos_lead_idx on public.website_lead_photos (lead_id);
create index if not exists website_lead_photos_tenant_idx on public.website_lead_photos (tenant_id, created_at desc);

alter table public.website_lead_photos enable row level security;
drop policy if exists website_lead_photos_admin_select on public.website_lead_photos;
create policy website_lead_photos_admin_select on public.website_lead_photos
  for select using (public.website_is_admin(tenant_id));
drop policy if exists website_lead_photos_admin_delete on public.website_lead_photos;
create policy website_lead_photos_admin_delete on public.website_lead_photos
  for delete using (public.website_is_admin(tenant_id));
grant select, delete on public.website_lead_photos to authenticated;

-- ---------------------------------------------------------------------
-- Anfrage speichern: wie website_submit_lead, zusätzlich Leistungen und bis zu 3 Fotos
-- p_photos: JPEG-Bilder als Base64-Text (im Browser verkleinert, ohne Standortdaten)
-- ---------------------------------------------------------------------
create or replace function public.website_submit_lead2(
  p_slug text, p_name text, p_email text, p_phone text, p_message text,
  p_services text[] default '{}', p_photos text[] default '{}'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  w public.websites;
  recent int;
  recent_photos int;
  v_name text := left(btrim(coalesce(p_name, '')), 120);
  v_email text := left(btrim(coalesce(p_email, '')), 160);
  v_phone text := left(btrim(coalesce(p_phone, '')), 40);
  v_msg text := left(btrim(coalesce(p_message, '')), 3000);
  v_services text[];
  v_photos bytea[] := '{}';
  v_bin bytea;
  v_txt text;
  v_lead_id bigint;
  cs record;
begin
  select * into w from public.websites where slug = lower(p_slug) and published and contact_form;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;

  -- Leistungen: höchstens 12, je max. 60 Zeichen, ohne leere Einträge
  select coalesce(array_agg(s), '{}') into v_services
    from (select distinct left(btrim(x), 60) as s
            from unnest(coalesce(p_services, '{}')) x
           where btrim(coalesce(x, '')) <> ''
           limit 12) t;

  if v_msg = '' and cardinality(v_services) > 0 then
    v_msg := 'Anfrage zu: ' || array_to_string(v_services, ', ');
  end if;

  if length(v_name) < 2 or length(v_msg) < 5 or (v_email = '' and v_phone = '') then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  if v_email <> '' and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_email');
  end if;

  -- Fotos prüfen: höchstens 3, je max. 1,5 MB, nur JPEG
  if cardinality(coalesce(p_photos, '{}')) > 3 then
    return jsonb_build_object('ok', false, 'error', 'photos');
  end if;
  foreach v_txt in array coalesce(p_photos, '{}') loop
    continue when btrim(coalesce(v_txt, '')) = '';
    begin
      v_bin := decode(regexp_replace(v_txt, '\s', '', 'g'), 'base64');
    exception when others then
      return jsonb_build_object('ok', false, 'error', 'photos');
    end;
    if length(v_bin) > 1572864 or length(v_bin) < 100 or substring(v_bin from 1 for 3) <> '\xffd8ff'::bytea then
      return jsonb_build_object('ok', false, 'error', 'photos');
    end if;
    v_photos := array_append(v_photos, v_bin);
  end loop;

  -- einfacher Schutz gegen Massen-Einträge
  select count(*) into recent from public.website_leads
   where tenant_id = w.tenant_id and created_at > now() - interval '1 hour';
  if recent >= 30 then return jsonb_build_object('ok', false, 'error', 'rate_limited'); end if;
  if cardinality(v_photos) > 0 then
    select count(*) into recent_photos from public.website_lead_photos
     where tenant_id = w.tenant_id and created_at > now() - interval '1 hour';
    if recent_photos >= 30 then v_photos := '{}'; end if;
  end if;

  insert into public.website_leads (tenant_id, name, email, phone, message, services, photo_count)
  values (w.tenant_id, v_name, nullif(v_email, ''), nullif(v_phone, ''), v_msg, v_services, cardinality(v_photos))
  returning id into v_lead_id;

  foreach v_bin in array v_photos loop
    insert into public.website_lead_photos (lead_id, tenant_id, data) values (v_lead_id, w.tenant_id, v_bin);
  end loop;

  select company_name, email into cs from public.company_settings where tenant_id = w.tenant_id;
  return jsonb_build_object('ok', true, 'notify_email', cs.email, 'company', cs.company_name,
                            'services', to_jsonb(v_services), 'photos', cardinality(v_photos));
end;
$$;

revoke all on function public.website_submit_lead2(text, text, text, text, text, text[], text[]) from public;
grant execute on function public.website_submit_lead2(text, text, text, text, text, text[], text[]) to anon, authenticated;

commit;
