-- =====================================================================
-- Modul Website: Besucherzähler (ohne Cookies, ohne IP-Adressen, nur Tageswerte)
--   kind = 'page'   -> key = Seite ("" = Startseite, "impressum", "<leistung>")  : Seitenaufrufe
--   kind = 'source' -> key = google | bing | social | direkt | andere          : Besuche (Einstiege von außen)
-- Gezählt wird über website_track (öffentlich, vom kleinen Skript auf der Website).
-- Admins lesen die Auswertung über website_admin_stats. Kann gefahrlos mehrfach ausgeführt werden.
-- =====================================================================

begin;

create table if not exists public.website_stats (
  tenant_id  bigint not null references public.tenants(id) on delete cascade,
  day        date   not null,
  kind       text   not null,
  key        text   not null default '',
  count      int    not null default 0,
  primary key (tenant_id, day, kind, key),
  constraint website_stats_kind check (kind in ('page', 'source'))
);

alter table public.website_stats enable row level security;
drop policy if exists website_stats_admin_select on public.website_stats;
create policy website_stats_admin_select on public.website_stats
  for select using (public.website_is_admin(tenant_id));
grant select on public.website_stats to authenticated;

-- ---------------------------------------------------------------------
-- Zählen (ohne Login). p_site = Web-Adresse (slug) oder eigene Domain.
-- ---------------------------------------------------------------------
create or replace function public.website_track(p_site text, p_page text, p_source text default null)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  w public.websites;
  v_page text := left(lower(coalesce(p_page, '')), 70);
  v_source text := lower(coalesce(p_source, ''));
  v_day date := (now() at time zone 'Europe/Berlin')::date;
  v_total int;
begin
  select * into w from public.websites where slug = lower(p_site) and published;
  if not found then
    select * into w from public.websites
     where published and custom_domain is not null and custom_domain_status = 'active'
       and lower(p_site) in (custom_domain, regexp_replace(custom_domain, '^www\.', ''))
     limit 1;
  end if;
  if not found then return; end if;

  -- nur plausible Seitennamen (Startseite, Rechtsseiten, Leistungsseiten)
  if v_page <> '' and v_page !~ '^[a-z0-9-]{1,70}$' then return; end if;

  -- Schutz vor künstlichem Aufblähen: höchstens 20.000 Zählungen pro Website und Tag
  select coalesce(sum(count), 0) into v_total from public.website_stats where tenant_id = w.tenant_id and day = v_day;
  if v_total >= 20000 then return; end if;

  insert into public.website_stats (tenant_id, day, kind, key, count)
  values (w.tenant_id, v_day, 'page', v_page, 1)
  on conflict (tenant_id, day, kind, key) do update set count = public.website_stats.count + 1;

  if v_source in ('google', 'bing', 'social', 'direkt', 'andere') then
    insert into public.website_stats (tenant_id, day, kind, key, count)
    values (w.tenant_id, v_day, 'source', v_source, 1)
    on conflict (tenant_id, day, kind, key) do update set count = public.website_stats.count + 1;
  end if;

  -- Aufräumen: Werte älter als 13 Monate löschen (gelegentlich, ca. bei jedem 200. Aufruf)
  if random() < 0.005 then
    delete from public.website_stats where tenant_id = w.tenant_id and day < (v_day - interval '13 months');
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Auswertung für Admins: Tageswerte, beliebteste Seiten, Herkunft, Anfragen
-- ---------------------------------------------------------------------
create or replace function public.website_admin_stats(p_tenant_id bigint, p_days int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_days int := greatest(7, least(coalesce(p_days, 30), 400));
  v_to date := (now() at time zone 'Europe/Berlin')::date;
  v_from date := v_to - (v_days - 1);
begin
  if not public.website_is_admin(p_tenant_id) then
    raise exception 'Keine Berechtigung';
  end if;

  return jsonb_build_object(
    'from', v_from,
    'to', v_to,
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'views', coalesce(v.views, 0), 'visits', coalesce(s.visits, 0), 'leads', coalesce(l.leads, 0)) order by d.day), '[]'::jsonb)
        from (select g::date as day from generate_series(v_from, v_to, interval '1 day') g) d
        left join (select day, sum(count)::int as views from public.website_stats where tenant_id = p_tenant_id and kind = 'page' and day between v_from and v_to group by day) v on v.day = d.day
        left join (select day, sum(count)::int as visits from public.website_stats where tenant_id = p_tenant_id and kind = 'source' and day between v_from and v_to group by day) s on s.day = d.day
        left join (select (created_at at time zone 'Europe/Berlin')::date as day, count(*)::int as leads from public.website_leads
                    where tenant_id = p_tenant_id and created_at >= v_from group by 1) l on l.day = d.day
    ),
    'pages', (
      select coalesce(jsonb_agg(jsonb_build_object('page', key, 'views', views) order by views desc), '[]'::jsonb)
        from (select key, sum(count)::int as views from public.website_stats
               where tenant_id = p_tenant_id and kind = 'page' and day between v_from and v_to
               group by key order by views desc limit 10) x
    ),
    'sources', (
      select coalesce(jsonb_agg(jsonb_build_object('source', key, 'visits', visits) order by visits desc), '[]'::jsonb)
        from (select key, sum(count)::int as visits from public.website_stats
               where tenant_id = p_tenant_id and kind = 'source' and day between v_from and v_to
               group by key) x
    )
  );
end;
$$;

revoke all on function public.website_track(text, text, text) from public;
revoke all on function public.website_admin_stats(bigint, int) from public;
grant execute on function public.website_track(text, text, text) to anon, authenticated;
grant execute on function public.website_admin_stats(bigint, int) to authenticated;

commit;
