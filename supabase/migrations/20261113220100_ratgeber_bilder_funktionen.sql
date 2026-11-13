-- Ratgeber: öffentliche Funktionen liefern zusätzlich das Titelbild – 13.11.2026

create or replace function public.ratgeber_list()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'slug', a.slug, 'title', a.title, 'intro', a.intro, 'published_at', a.published_at, 'updated_at', a.updated_at,
    'image_public', a.image_public, 'image_alt', a.image_alt
  ) order by a.published_at desc), '[]'::jsonb)
  from public.owner_articles a where a.status = 'veroeffentlicht';
$$;

create or replace function public.ratgeber_get(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(x) from (
    select a.slug, a.title, a.meta_title, a.meta_description, a.intro, a.body, a.faq, a.related_pages, a.published_at, a.updated_at,
           a.image_public, a.image_alt, a.image_ai_label
    from public.owner_articles a
    where a.status = 'veroeffentlicht' and a.slug = lower(left(coalesce(p_slug, ''), 80))
  ) x;
$$;

revoke all on function public.ratgeber_list() from public;
revoke all on function public.ratgeber_get(text) from public;
grant execute on function public.ratgeber_list() to anon, authenticated;
grant execute on function public.ratgeber_get(text) to anon, authenticated;
