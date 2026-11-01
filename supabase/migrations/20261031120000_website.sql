-- =====================================================================
-- Modul Website: fertige Firmen-Website pro Betrieb
-- Neue Tabellen, Funktionen und ein öffentlicher Speicher-Bucket.
-- Bestehende Tabellen werden nur gelesen (company_settings, subscriptions).
-- Kann gefahrlos mehrfach ausgeführt werden.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Einstellungen der Website (eine pro Betrieb)
-- ---------------------------------------------------------------------
create table if not exists public.websites (
  tenant_id         bigint primary key references public.tenants(id) on delete cascade,
  slug              text not null unique,
  published         boolean not null default false,
  preview_token     text not null default replace(gen_random_uuid()::text, '-', ''),
  theme             text not null default 'klassisch',
  accent_color      text not null default '#1d4e89',

  hero_title        text,
  hero_subtitle     text,
  hero_image_url    text,
  highlights        jsonb not null default '[]'::jsonb,   -- ["Meisterbetrieb", "Seit 1998", ...]
  services          jsonb not null default '[]'::jsonb,   -- [{ "title": "...", "text": "..." }]
  about_title       text,
  about_text        text,
  service_area      text,                                 -- "Wittlich, Bernkastel-Kues, Trier"
  opening_hours     text,
  sections          jsonb not null default '{"services":true,"references":true,"about":true,"area":true,"contact":true}'::jsonb,
  contact_form      boolean not null default true,
  seo_title         text,
  seo_description   text,

  -- Impressum (Pflichtangaben, ergänzend zu den Firmendaten)
  owner_name        text,      -- Inhaber bzw. Geschäftsführer
  legal_form        text,      -- z. B. Einzelunternehmen, GmbH
  register_court    text,      -- Registergericht
  register_number   text,      -- HRB …
  chamber           text,      -- zuständige Handwerkskammer
  job_title         text default 'Maler- und Lackierer',
  job_title_country text default 'Deutschland',
  privacy_extra     text,

  custom_domain     text unique,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint websites_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'),
  constraint websites_slug_reserved check (slug not in (
    'www','app','api','admin','mail','smtp','imap','pop','ftp','webmail','support','hilfe','help','status',
    'blog','shop','static','assets','cdn','dev','test','staging','demo','docs','login','konto','preise','w'
  )),
  constraint websites_theme check (theme in ('klassisch','modern','frisch')),
  constraint websites_accent check (accent_color ~ '^#[0-9a-fA-F]{6}$')
);

-- ---------------------------------------------------------------------
-- Referenzen (abgeschlossene Aufträge mit Bildern)
-- ---------------------------------------------------------------------
create table if not exists public.website_references (
  id                 bigserial primary key,
  tenant_id          bigint not null references public.tenants(id) on delete cascade,
  order_id           text,
  title              text not null,
  text               text,
  city               text,
  images             jsonb not null default '[]'::jsonb,   -- [{ "url": "...", "path": "...", "alt": "..." }]
  consent_confirmed  boolean not null default false,
  status             text not null default 'entwurf',
  published_at       timestamptz,
  created_by         bigint,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint website_references_status check (status in ('entwurf','veroeffentlicht')),
  constraint website_references_consent check (status = 'entwurf' or consent_confirmed)
);
create index if not exists website_references_tenant_idx on public.website_references (tenant_id, status, published_at desc);

-- ---------------------------------------------------------------------
-- Anfragen über das Kontaktformular
-- ---------------------------------------------------------------------
create table if not exists public.website_leads (
  id          bigserial primary key,
  tenant_id   bigint not null references public.tenants(id) on delete cascade,
  name        text not null,
  email       text,
  phone       text,
  message     text not null,
  status      text not null default 'neu',
  created_at  timestamptz not null default now(),
  constraint website_leads_status check (status in ('neu','erledigt'))
);
create index if not exists website_leads_tenant_idx on public.website_leads (tenant_id, created_at desc);

-- ---------------------------------------------------------------------
-- Zugriff: nur Admins des eigenen Betriebs (role_id 1/2)
-- ---------------------------------------------------------------------
create or replace function public.website_is_admin(p_tenant_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_users u
    where u.auth_user_id = auth.uid() and u.tenant_id = p_tenant_id and u.role_id in (1, 2)
  );
$$;

alter table public.websites enable row level security;
alter table public.website_references enable row level security;
alter table public.website_leads enable row level security;

drop policy if exists websites_admin_all on public.websites;
create policy websites_admin_all on public.websites
  for all using (public.website_is_admin(tenant_id)) with check (public.website_is_admin(tenant_id));

drop policy if exists website_references_admin_all on public.website_references;
create policy website_references_admin_all on public.website_references
  for all using (public.website_is_admin(tenant_id)) with check (public.website_is_admin(tenant_id));

drop policy if exists website_leads_admin_select on public.website_leads;
create policy website_leads_admin_select on public.website_leads
  for select using (public.website_is_admin(tenant_id));
drop policy if exists website_leads_admin_update on public.website_leads;
create policy website_leads_admin_update on public.website_leads
  for update using (public.website_is_admin(tenant_id)) with check (public.website_is_admin(tenant_id));
drop policy if exists website_leads_admin_delete on public.website_leads;
create policy website_leads_admin_delete on public.website_leads
  for delete using (public.website_is_admin(tenant_id));

-- ---------------------------------------------------------------------
-- Öffentliche Daten einer Website (für die Vercel-Funktion, ohne Login)
-- p_preview: Vorschau-Schlüssel -> auch unveröffentlichte Website anzeigen
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
    'references', refs
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Kontaktformular: Anfrage speichern (ohne Login)
-- ---------------------------------------------------------------------
create or replace function public.website_submit_lead(
  p_slug text, p_name text, p_email text, p_phone text, p_message text
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
  v_name text := left(btrim(coalesce(p_name, '')), 120);
  v_email text := left(btrim(coalesce(p_email, '')), 160);
  v_phone text := left(btrim(coalesce(p_phone, '')), 40);
  v_msg text := left(btrim(coalesce(p_message, '')), 3000);
  cs record;
begin
  select * into w from public.websites where slug = lower(p_slug) and published and contact_form;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;

  if length(v_name) < 2 or length(v_msg) < 5 or (v_email = '' and v_phone = '') then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  if v_email <> '' and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_email');
  end if;

  -- einfacher Schutz gegen Massen-Einträge
  select count(*) into recent from public.website_leads
   where tenant_id = w.tenant_id and created_at > now() - interval '1 hour';
  if recent >= 30 then return jsonb_build_object('ok', false, 'error', 'rate_limited'); end if;

  insert into public.website_leads (tenant_id, name, email, phone, message)
  values (w.tenant_id, v_name, nullif(v_email, ''), nullif(v_phone, ''), v_msg);

  select company_name, email into cs from public.company_settings where tenant_id = w.tenant_id;
  return jsonb_build_object('ok', true, 'notify_email', cs.email, 'company', cs.company_name);
end;
$$;

revoke all on function public.website_public(text, text) from public;
revoke all on function public.website_submit_lead(text, text, text, text, text) from public;
grant execute on function public.website_public(text, text) to anon, authenticated;
grant execute on function public.website_submit_lead(text, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Öffentlicher Bucket für Website-Bilder (Ordner = tenant_id)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('website-media', 'website-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists website_media_admin_insert on storage.objects;
create policy website_media_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'website-media' and public.website_is_admin(((storage.foldername(name))[1])::bigint));

drop policy if exists website_media_admin_update on storage.objects;
create policy website_media_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'website-media' and public.website_is_admin(((storage.foldername(name))[1])::bigint));

drop policy if exists website_media_admin_delete on storage.objects;
create policy website_media_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'website-media' and public.website_is_admin(((storage.foldername(name))[1])::bigint));

commit;
