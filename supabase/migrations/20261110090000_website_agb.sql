-- Firmen-Website: optionale AGB-Seite (/agb) mit eigenem Text des Betriebs – 10.11.2026
-- Ohne Text bleibt alles wie bisher (keine Seite, kein Link).

alter table public.websites add column if not exists terms_text text;
alter table public.websites drop constraint if exists websites_terms_text_len;
alter table public.websites add constraint websites_terms_text_len check (terms_text is null or length(terms_text) <= 60000);

-- Öffentlich lesbar, mit denselben Prüfungen wie website_public (veröffentlicht/Vorschau, Abo)
create or replace function public.website_terms(p_slug text, p_preview text default null)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  w   public.websites;
  sub record;
begin
  select * into w from public.websites where slug = lower(p_slug);
  if not found then
    select * into w from public.websites
     where custom_domain is not null and custom_domain_status = 'active'
       and lower(p_slug) in (custom_domain, 'www.' || custom_domain, regexp_replace(custom_domain, '^www\.', ''))
     limit 1;
  end if;
  if not found then return null; end if;
  if not w.published and (p_preview is null or p_preview <> w.preview_token) then return null; end if;

  select plan, status into sub from public.subscriptions where tenant_id = w.tenant_id order by id desc limit 1;
  if sub is null or sub.status not in ('active', 'trialing', 'past_due')
     or not (sub.plan = 'enterprise' or sub.status = 'trialing') then
    return null;
  end if;

  return nullif(btrim(w.terms_text), '');
end;
$$;

revoke all on function public.website_terms(text, text) from public;
grant execute on function public.website_terms(text, text) to anon, authenticated;
