-- =====================================================================
-- Owner-Werbung: Automatikmodus – täglich um 9:15 Uhr (Winterzeit, 8:15 UTC)
-- Ab dem 25. erstellt der Agent den Plan für den nächsten Monat (falls eingeschaltet)
-- und schreibt nach und nach die Texte (je Lauf bis zu 3 Beiträge).
-- VORHER: DEIN-TOKEN durch denselben Wert ersetzen wie bei den anderen Zeitplänen
--   (Secret DELETION_HOOK_TOKEN). Kann mehrfach ausgeführt werden.
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'owner-werbung-agent';

select cron.schedule(
  'owner-werbung-agent',
  '15 8 * * *',
  $$
  select net.http_post(
    url := 'https://udzgxfjmpeygylgrcdsc.supabase.co/functions/v1/owner-marketing?hook=DEIN-TOKEN',
    headers := '{"content-type": "application/json"}'::jsonb,
    body := '{"action": "auto"}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);
