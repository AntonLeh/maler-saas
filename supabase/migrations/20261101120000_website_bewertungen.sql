-- =====================================================================
-- Modul Website: Kundenbewertungen aus dem Kundenportal auf der Website
--
-- Bestehende Tabellen und Funktionen des Kundenportals bleiben UNVERÄNDERT
-- (customer_reviews, submit_customer_review, Punkte für Mitarbeiter).
-- Neu ist nur:
--   * Tabelle website_review_consents  (Einwilligung des Kunden + Freigabe durch den Betrieb)
--   * Funktionen für Kundenportal, Admin und öffentliche Website
--   * website_public liefert zusätzlich "reviews"
-- Mitarbeiterbewertungen werden NIE veröffentlicht.
-- Kann gefahrlos mehrfach ausgeführt werden.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Einwilligung zur Veröffentlichung (eine Zeile pro Bewertung)
-- ---------------------------------------------------------------------
create table if not exists public.website_review_consents (
  review_id     bigint primary key references public.customer_reviews(id) on delete cascade,
  tenant_id     bigint not null references public.tenants(id) on delete cascade,
  display_name  text not null,          -- z. B. "Maria S."
  city          text,                   -- nur Ort, keine Adresse
  consent_text  text not null,          -- genauer Wortlaut, dem der Kunde zugestimmt hat
  consented_at  timestamptz not null default now(),
  approved      boolean not null default false,   -- vom Betrieb für die Website freigegeben
  approved_at   timestamptz
);
create index if not exists website_review_consents_tenant_idx
  on public.website_review_consents (tenant_id, approved, consented_at desc);

alter table public.website_review_consents enable row level security;

-- Admins dürfen lesen, freigeben/ausblenden und löschen (z. B. bei Widerruf).
-- Anlegen nur über die Funktion website_review_consent (Kundenportal).
drop policy if exists website_review_consents_admin_select on public.website_review_consents;
create policy website_review_consents_admin_select on public.website_review_consents
  for select using (public.website_is_admin(tenant_id));
drop policy if exists website_review_consents_admin_update on public.website_review_consents;
create policy website_review_consents_admin_update on public.website_review_consents
  for update using (public.website_is_admin(tenant_id)) with check (public.website_is_admin(tenant_id));
drop policy if exists website_review_consents_admin_delete on public.website_review_consents;
create policy website_review_consents_admin_delete on public.website_review_consents
  for delete using (public.website_is_admin(tenant_id));

grant select, update, delete on public.website_review_consents to authenticated;

-- ---------------------------------------------------------------------
-- Hilfsfunktion: Name und Ort, wie sie auf der Website erscheinen würden
-- ---------------------------------------------------------------------
create or replace function public.website_review_identity(p_tenant_id bigint, p_customer_id bigint, p_order_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  c record;
  v_city text;
  v_name text;
begin
  select first_name, last_name, company_name, city into c
    from public.customers where id = p_customer_id and tenant_id = p_tenant_id;

  select nullif(btrim(o.address_city), '') into v_city
    from public.orders o where o.id = p_order_id and o.tenant_id = p_tenant_id;
  v_city := coalesce(v_city, nullif(btrim(c.city), ''));

  if nullif(btrim(c.first_name), '') is not null then
    v_name := btrim(c.first_name)
      || coalesce(' ' || upper(left(nullif(btrim(c.last_name), ''), 1)) || '.', '');
  elsif nullif(btrim(c.company_name), '') is not null then
    v_name := btrim(c.company_name);
  else
    v_name := 'Kunde';
  end if;

  return jsonb_build_object('display_name', left(v_name, 80), 'city', left(v_city, 80));
end;
$$;
revoke all on function public.website_review_identity(bigint, bigint, bigint) from public;

-- Wortlaut der Einwilligung (ein Ort für Portal und Speicherung)
create or replace function public.website_review_consent_text(p_name text, p_city text, p_company text)
returns text
language sql
immutable
as $$
  select 'Ja, meine Bewertung (Sterne und Kommentar) darf mit der Angabe „'
    || p_name || coalesce(', ' || p_city, '') || '“ auf der Website von '
    || coalesce(nullif(btrim(p_company), ''), 'diesem Betrieb')
    || ' veröffentlicht werden. Bewertungen einzelner Mitarbeiter bleiben intern. '
    || 'Ich kann diese Einwilligung jederzeit beim Betrieb widerrufen.';
$$;

-- Gültigen Portalzugang zum Token finden (gleiche Regeln wie im Kundenportal)
create or replace function public.website_portal_access(p_token text)
returns public.customer_portal_access
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select cpa.* from public.customer_portal_access cpa
   where p_token is not null and btrim(p_token) <> ''
     and cpa.access_token = p_token
     and cpa.is_active = true
     and (cpa.expires_at is null or cpa.expires_at > now())
   order by cpa.id desc
   limit 1;
$$;
revoke all on function public.website_portal_access(text) from public;

-- ---------------------------------------------------------------------
-- Kundenportal: Soll das Häkchen angezeigt werden? (nur wenn der Betrieb eine Website hat)
-- ---------------------------------------------------------------------
create or replace function public.website_review_consent_info(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  a public.customer_portal_access;
  ident jsonb;
  v_company text;
begin
  a := public.website_portal_access(p_token);
  if a.id is null or a.order_id is null then
    return jsonb_build_object('available', false);
  end if;
  if not exists (select 1 from public.websites w where w.tenant_id = a.tenant_id) then
    return jsonb_build_object('available', false);
  end if;

  ident := public.website_review_identity(a.tenant_id, a.customer_id, a.order_id);
  select company_name into v_company from public.company_settings
   where tenant_id = a.tenant_id order by id desc limit 1;

  return jsonb_build_object(
    'available', true,
    'display_name', ident->>'display_name',
    'city', ident->>'city',
    'consent_text', public.website_review_consent_text(ident->>'display_name', ident->>'city', v_company)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Kundenportal: Einwilligung speichern (direkt nach submit_customer_review)
-- ---------------------------------------------------------------------
create or replace function public.website_review_consent(p_token text, p_review_id bigint)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $$
declare
  a public.customer_portal_access;
  r public.customer_reviews;
  ident jsonb;
  v_company text;
begin
  a := public.website_portal_access(p_token);
  if a.id is null then
    raise exception 'Ungültiger oder abgelaufener Kundenlink';
  end if;

  select * into r from public.customer_reviews
   where id = p_review_id
     and tenant_id = a.tenant_id
     and order_id = a.order_id
     and customer_id = a.customer_id;
  if r.id is null then
    raise exception 'Bewertung nicht gefunden';
  end if;
  -- nur direkt beim Bewerten möglich
  if r.created_at < now() - interval '1 day' then
    raise exception 'Die Einwilligung kann nur direkt beim Bewerten erteilt werden';
  end if;
  if not exists (select 1 from public.websites w where w.tenant_id = a.tenant_id) then
    return jsonb_build_object('ok', false, 'error', 'no_website');
  end if;

  ident := public.website_review_identity(a.tenant_id, a.customer_id, a.order_id);
  select company_name into v_company from public.company_settings
   where tenant_id = a.tenant_id order by id desc limit 1;

  insert into public.website_review_consents (review_id, tenant_id, display_name, city, consent_text)
  values (
    r.id, a.tenant_id, ident->>'display_name', ident->>'city',
    public.website_review_consent_text(ident->>'display_name', ident->>'city', v_company)
  )
  on conflict (review_id) do nothing;

  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------
-- Admin: Übersicht (alle Bewertungen zählen, Texte nur mit Einwilligung)
-- ---------------------------------------------------------------------
create or replace function public.website_admin_reviews(p_tenant_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_count int;
  v_avg numeric;
  v_items jsonb;
begin
  if not public.website_is_admin(p_tenant_id) then
    raise exception 'Keine Berechtigung';
  end if;

  select count(*), round(avg(overall_rating)::numeric, 1)
    into v_count, v_avg
    from public.customer_reviews where tenant_id = p_tenant_id and overall_rating between 1 and 5;

  select coalesce(jsonb_agg(jsonb_build_object(
           'review_id', x.review_id,
           'overall_rating', x.overall_rating,
           'comment', x.comment,
           'display_name', x.display_name,
           'city', x.city,
           'created_at', x.created_at,
           'approved', x.approved,
           'order_title', x.order_title)
           order by x.created_at desc), '[]'::jsonb)
    into v_items
    from (
      select c.review_id, cr.overall_rating, cr.comment, c.display_name, c.city, cr.created_at, c.approved, o.title as order_title
        from public.website_review_consents c
        join public.customer_reviews cr on cr.id = c.review_id
        left join public.orders o on o.id = cr.order_id and o.tenant_id = cr.tenant_id
       where c.tenant_id = p_tenant_id
       order by cr.created_at desc
       limit 300
    ) x;

  return jsonb_build_object(
    'count', v_count,
    'average', v_avg,
    'without_consent', v_count - (select count(*) from public.website_review_consents where tenant_id = p_tenant_id),
    'items', v_items
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Öffentliche Daten der Website: wie bisher + "reviews"
-- Durchschnitt aus ALLEN Bewertungen (ehrlich), Zitate nur mit Einwilligung UND Freigabe.
-- ---------------------------------------------------------------------
create or replace function public.website_public(p_slug text, p_preview text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  w  public.websites;
  cs record;
  sub record;
  refs jsonb;
  rv_count int;
  rv_avg numeric;
  rv_items jsonb;
begin
  select * into w from public.websites
   where slug = lower(p_slug) or (custom_domain is not null and custom_domain = lower(p_slug));
  if not found then return null; end if;

  if not w.published and (p_preview is null or p_preview <> w.preview_token) then
    return null;
  end if;

  -- Nur mit laufendem Abo
  select plan, status into sub from public.subscriptions
   where tenant_id = w.tenant_id order by id desc limit 1;
  if sub is null or sub.status not in ('active', 'trialing', 'past_due') then
    return null;
  end if;

  select company_name, street, zip, city, phone, email, website, vat_id, logo_url
    into cs from public.company_settings where tenant_id = w.tenant_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id, 'title', r.title, 'text', r.text, 'city', r.city,
           'images', r.images, 'published_at', r.published_at)
           order by r.published_at desc), '[]'::jsonb)
    into refs
    from (select * from public.website_references
           where tenant_id = w.tenant_id and status = 'veroeffentlicht'
           order by published_at desc limit 24) r;

  select count(*), round(avg(overall_rating)::numeric, 1)
    into rv_count, rv_avg
    from public.customer_reviews where tenant_id = w.tenant_id and overall_rating between 1 and 5;

  select coalesce(jsonb_agg(jsonb_build_object(
           'rating', x.overall_rating, 'text', x.comment, 'name', x.display_name,
           'city', x.city, 'date', x.created_at)
           order by x.created_at desc), '[]'::jsonb)
    into rv_items
    from (select cr.overall_rating, cr.comment, c.display_name, c.city, cr.created_at
            from public.website_review_consents c
            join public.customer_reviews cr on cr.id = c.review_id and cr.tenant_id = c.tenant_id
           where c.tenant_id = w.tenant_id and c.approved
           order by cr.created_at desc limit 12) x;

  return jsonb_build_object(
    'slug', w.slug,
    'published', w.published,
    'theme', w.theme,
    'accent_color', w.accent_color,
    'hero_title', w.hero_title,
    'hero_subtitle', w.hero_subtitle,
    'hero_image_url', w.hero_image_url,
    'highlights', w.highlights,
    'services', w.services,
    'about_title', w.about_title,
    'about_text', w.about_text,
    'service_area', w.service_area,
    'opening_hours', w.opening_hours,
    'sections', w.sections,
    'contact_form', w.contact_form,
    'seo_title', w.seo_title,
    'seo_description', w.seo_description,
    'owner_name', w.owner_name,
    'legal_form', w.legal_form,
    'register_court', w.register_court,
    'register_number', w.register_number,
    'chamber', w.chamber,
    'job_title', w.job_title,
    'job_title_country', w.job_title_country,
    'privacy_extra', w.privacy_extra,
    'custom_domain', w.custom_domain,
    'company', jsonb_build_object(
      'name', cs.company_name, 'street', cs.street, 'zip', cs.zip, 'city', cs.city,
      'phone', cs.phone, 'email', cs.email, 'vat_id', cs.vat_id, 'logo_url', cs.logo_url
    ),
    'references', refs,
    'reviews', jsonb_build_object('count', rv_count, 'average', rv_avg, 'items', rv_items)
  );
end;
$$;

revoke all on function public.website_review_consent_text(text, text, text) from public;
revoke all on function public.website_review_consent_info(text) from public;
revoke all on function public.website_review_consent(text, bigint) from public;
revoke all on function public.website_admin_reviews(bigint) from public;
revoke all on function public.website_public(text, text) from public;
grant execute on function public.website_review_consent_info(text) to anon, authenticated;
grant execute on function public.website_review_consent(text, bigint) to anon, authenticated;
grant execute on function public.website_admin_reviews(bigint) to authenticated;
grant execute on function public.website_public(text, text) to anon, authenticated;

commit;
