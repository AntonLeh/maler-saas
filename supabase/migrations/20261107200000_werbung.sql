-- =====================================================================
-- Modul Website: Werbung (KI-Beiträge für Website, Instagram, Facebook, Google-Profil, WhatsApp)
--  * marketing_posts: Beiträge je Betrieb (Vorschlag der KI, Entwurf, veröffentlicht, verworfen)
--  * Zugriff nur für Admins des Betriebs (wie die übrigen Website-Tabellen)
--  * Zeitplan: täglich 9:00 Uhr (Winterzeit) legt die Funktion „website-marketing“ Vorschläge aus
--    neu abgeschlossenen Aufträgen mit Fotos an (höchstens 2 pro Betrieb und Woche) und schickt eine E-Mail.
-- VORHER: DEIN-TOKEN unten durch denselben Wert ersetzen wie beim Zeitplan der Löschfristen
--   (Secret DELETION_HOOK_TOKEN). Kann mehrfach ausgeführt werden.
-- =====================================================================

create table if not exists public.marketing_posts (
  id            bigserial primary key,
  tenant_id     bigint not null references public.tenants(id) on delete cascade,
  order_id      text,
  reference_id  bigint references public.website_references(id) on delete set null,
  source        text not null default 'manuell',
  status        text not null default 'entwurf',
  title         text,
  city          text,
  -- { website, instagram, facebook, google, whatsapp }
  texts         jsonb not null default '{}'::jsonb,
  -- [{ image_id } aus dem Auftrag oder { url, path } eigene Fotos; jeweils kind: vorher/nachher]
  images        jsonb not null default '[]'::jsonb,
  -- Hinweise der KI (z. B. Gesicht oder Autokennzeichen zu sehen)
  warnings      jsonb not null default '[]'::jsonb,
  -- { instagram: "2026-11-07T…", facebook: … } – wann zuletzt geteilt
  shared        jsonb not null default '{}'::jsonb,
  consent_confirmed boolean not null default false,
  created_by    bigint,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint marketing_posts_source check (source in ('manuell', 'vorschlag')),
  constraint marketing_posts_status check (status in ('vorschlag', 'entwurf', 'veroeffentlicht', 'verworfen'))
);
create index if not exists marketing_posts_tenant_idx on public.marketing_posts (tenant_id, created_at desc);
create index if not exists marketing_posts_order_idx on public.marketing_posts (tenant_id, order_id);

alter table public.marketing_posts enable row level security;
drop policy if exists marketing_posts_admin_all on public.marketing_posts;
create policy marketing_posts_admin_all on public.marketing_posts
  for all using (public.website_is_admin(tenant_id)) with check (public.website_is_admin(tenant_id));
grant select, insert, update, delete on public.marketing_posts to authenticated;
grant usage, select on sequence public.marketing_posts_id_seq to authenticated;

-- Vorschläge der KI ein/aus (Einstellung im Reiter „Werbung“)
alter table public.websites add column if not exists marketing_auto boolean not null default true;

-- ---------------------------------------------------------------------
-- Zeitplan für die Vorschläge
-- ---------------------------------------------------------------------
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'werbung-vorschlaege';

select cron.schedule(
  'werbung-vorschlaege',
  '0 8 * * *',
  $$
  select net.http_post(
    url := 'https://udzgxfjmpeygylgrcdsc.supabase.co/functions/v1/website-marketing?hook=DEIN-TOKEN',
    headers := '{"content-type": "application/json"}'::jsonb,
    body := '{"action": "suggest"}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);
