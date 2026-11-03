-- =====================================================================
-- Modul Website: „Wir stellen ein“ – Stellenanzeigen und Bewerbungen
--
-- * websites.jobs: Stellenanzeigen des Betriebs (jsonb-Liste, höchstens 10)
--   { id, title, employment, location, start, text, tasks[], profile[], benefits[],
--     salary_min, salary_max, salary_unit (HOUR|MONTH), active, posted_at }
-- * website_applications: Bewerbungen (nur für Admins sichtbar, Lebenslauf optional)
--   Bewerbungen werden nach 6 Monaten automatisch gelöscht.
-- * website_submit_application: Bewerbung absenden (ohne Login, von der Website)
-- * website_public liefert zusätzlich die aktiven Stellen (jobs)
-- Kann gefahrlos mehrfach ausgeführt werden.
-- =====================================================================

begin;

alter table public.websites add column if not exists jobs jsonb not null default '[]'::jsonb;
alter table public.websites drop constraint if exists websites_jobs_array;
alter table public.websites add constraint websites_jobs_array check (jsonb_typeof(jobs) = 'array' and jsonb_array_length(jobs) <= 10);

create table if not exists public.website_applications (
  id              bigserial primary key,
  tenant_id       bigint not null references public.tenants(id) on delete cascade,
  job_id          text,
  job_title       text not null,
  name            text not null,
  email           text,
  phone           text,
  available_from  text,
  experience      text,
  driving_license boolean,
  message         text,
  cv_name         text,
  cv_mime         text,
  cv              bytea,
  status          text not null default 'neu',
  created_at      timestamptz not null default now(),
  constraint website_applications_status check (status in ('neu', 'kontaktiert', 'erledigt'))
);
create index if not exists website_applications_tenant_idx on public.website_applications (tenant_id, created_at desc);

alter table public.website_applications enable row level security;
drop policy if exists website_applications_admin_select on public.website_applications;
create policy website_applications_admin_select on public.website_applications
  for select using (public.website_is_admin(tenant_id));
drop policy if exists website_applications_admin_update on public.website_applications;
create policy website_applications_admin_update on public.website_applications
  for update using (public.website_is_admin(tenant_id)) with check (public.website_is_admin(tenant_id));
drop policy if exists website_applications_admin_delete on public.website_applications;
create policy website_applications_admin_delete on public.website_applications
  for delete using (public.website_is_admin(tenant_id));
grant select, delete on public.website_applications to authenticated;
grant update (status) on public.website_applications to authenticated;

-- ---------------------------------------------------------------------
-- Bewerbung absenden. p_cv = Lebenslauf als Base64 (PDF, JPEG oder PNG, höchstens 3 MB)
-- ---------------------------------------------------------------------
create or replace function public.website_submit_application(
  p_slug text, p_job_id text, p_name text, p_email text, p_phone text,
  p_available text, p_experience text, p_license boolean, p_message text,
  p_cv text default null, p_cv_name text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  w public.websites;
  job jsonb;
  recent int;
  v_name text := left(btrim(coalesce(p_name, '')), 120);
  v_email text := left(btrim(coalesce(p_email, '')), 160);
  v_phone text := left(btrim(coalesce(p_phone, '')), 40);
  v_title text;
  v_cv bytea;
  v_mime text;
  cs record;
begin
  select * into w from public.websites where slug = lower(p_slug) and published;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;

  if coalesce(p_job_id, '') <> '' then
    select j into job from jsonb_array_elements(w.jobs) j
     where j->>'id' = p_job_id and j->'active' = 'true'::jsonb limit 1;
  end if;
  v_title := coalesce(left(job->>'title', 120), 'Initiativbewerbung');

  if length(v_name) < 2 or (v_email = '' and v_phone = '') then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  if v_email <> '' and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_email');
  end if;

  if btrim(coalesce(p_cv, '')) <> '' then
    begin
      v_cv := decode(regexp_replace(p_cv, '\s', '', 'g'), 'base64');
    exception when others then
      return jsonb_build_object('ok', false, 'error', 'cv');
    end;
    v_mime := case
      when substring(v_cv from 1 for 4) = '\x25504446'::bytea then 'application/pdf'
      when substring(v_cv from 1 for 3) = '\xffd8ff'::bytea then 'image/jpeg'
      when substring(v_cv from 1 for 4) = '\x89504e47'::bytea then 'image/png'
    end;
    if v_mime is null or length(v_cv) > 3145728 or length(v_cv) < 100 then
      return jsonb_build_object('ok', false, 'error', 'cv');
    end if;
  end if;

  -- einfacher Schutz gegen Massen-Einträge
  select count(*) into recent from public.website_applications
   where tenant_id = w.tenant_id and created_at > now() - interval '1 hour';
  if recent >= 20 then return jsonb_build_object('ok', false, 'error', 'rate_limited'); end if;

  -- Aufräumen: Bewerbungen älter als 6 Monate löschen
  delete from public.website_applications where tenant_id = w.tenant_id and created_at < now() - interval '6 months';

  insert into public.website_applications
    (tenant_id, job_id, job_title, name, email, phone, available_from, experience, driving_license, message, cv_name, cv_mime, cv)
  values
    (w.tenant_id, case when job is null then null else job->>'id' end, v_title, v_name, nullif(v_email, ''), nullif(v_phone, ''),
     nullif(left(btrim(coalesce(p_available, '')), 60), ''), nullif(left(btrim(coalesce(p_experience, '')), 60), ''), p_license,
     nullif(left(btrim(coalesce(p_message, '')), 3000), ''),
     case when v_cv is null then null else coalesce(nullif(left(regexp_replace(coalesce(p_cv_name, ''), '[^A-Za-z0-9ÄÖÜäöüß._ -]', '', 'g'), 80), ''), 'lebenslauf') end,
     v_mime, v_cv);

  select company_name, email into cs from public.company_settings where tenant_id = w.tenant_id;
  return jsonb_build_object('ok', true, 'notify_email', cs.email, 'company', cs.company_name, 'job_title', v_title, 'cv_mime', v_mime);
end;
$$;

revoke all on function public.website_submit_application(text, text, text, text, text, text, text, boolean, text, text, text) from public;
grant execute on function public.website_submit_application(text, text, text, text, text, text, text, boolean, text, text, text) to anon, authenticated;

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
  -- Erkennung über Adresse (slug) oder freigeschaltete eigene Domain (mit/ohne "www.")
  select * into w from public.websites where slug = lower(p_slug);
  if not found then
    select * into w from public.websites
     where custom_domain is not null and custom_domain_status = 'active'
       and lower(p_slug) in (custom_domain, 'www.' || custom_domain, regexp_replace(custom_domain, '^www\.', ''))
     limit 1;
  end if;
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
    'about_image_url', w.about_image_url,
    'service_area', w.service_area,
    'opening_hours', w.opening_hours,
    'whatsapp_number', w.whatsapp_number,
    'faq', w.faq,
    'booking_enabled', coalesce((w.booking->>'enabled')::boolean, false),
    'jobs', (select coalesce(jsonb_agg(j order by ord), '[]'::jsonb)
               from jsonb_array_elements(case when jsonb_typeof(w.jobs) = 'array' then w.jobs else '[]'::jsonb end) with ordinality as x(j, ord)
              where jsonb_typeof(j) = 'object' and j->'active' = 'true'::jsonb and coalesce(btrim(j->>'title'), '') <> ''),
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
    'custom_domain', case when w.custom_domain_status = 'active' then w.custom_domain end,
    'company', jsonb_build_object(
      'name', cs.company_name, 'street', cs.street, 'zip', cs.zip, 'city', cs.city,
      'phone', cs.phone, 'email', cs.email, 'vat_id', cs.vat_id, 'logo_url', cs.logo_url
    ),
    'references', refs,
    'reviews', jsonb_build_object('count', rv_count, 'average', rv_avg, 'items', rv_items)
  );
end;
$$;

revoke all on function public.website_public(text, text) from public;
grant execute on function public.website_public(text, text) to anon, authenticated;

commit;
