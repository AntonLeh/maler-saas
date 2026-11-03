-- =====================================================================
-- Tarife: Firmen-Website (und damit alle öffentlichen Website-Seiten) nur noch
-- im Tarif Enterprise – in der Testphase (status 'trialing') für alle Tarife.
-- website_public liefert sonst nichts mehr -> die Website ist offline (Seite nicht gefunden).
-- Die gespeicherten Inhalte bleiben erhalten; nach einem Wechsel auf Enterprise ist alles wieder da.
-- Kann gefahrlos mehrfach ausgeführt werden.
-- =====================================================================

begin;

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
  -- Firmen-Website gehört zum Tarif Enterprise (in der Testphase für alle)
  if sub is null or sub.status not in ('active', 'trialing', 'past_due')
     or not (sub.plan = 'enterprise' or sub.status = 'trialing') then
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
