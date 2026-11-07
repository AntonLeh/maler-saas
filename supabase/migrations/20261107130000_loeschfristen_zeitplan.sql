-- =====================================================================
-- Zeitplan: täglich um 8:00 Uhr (Winterzeit, 7:00 UTC) die Löschfristen prüfen
-- → Vorwarnungen an die Betriebe + Übersicht an den Plattform-Inhaber (Funktion „deletion-check“).
-- VORHER: DEIN-TOKEN unten durch denselben Wert ersetzen, den du mit
--   npx supabase secrets set DELETION_HOOK_TOKEN=...
-- gesetzt hast. Kann mehrfach ausgeführt werden (alter Zeitplan wird ersetzt).
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'loeschfristen-pruefen';

select cron.schedule(
  'loeschfristen-pruefen',
  '0 7 * * *',
  $$
  select net.http_post(
    url := 'https://udzgxfjmpeygylgrcdsc.supabase.co/functions/v1/deletion-check?hook=DEIN-TOKEN',
    headers := '{"content-type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
