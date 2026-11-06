-- =====================================================================
-- E-Rechnung (ZUGFeRD / XRechnung): zusätzliche Angaben beim Kunden
-- Werden beim Erstellen einer Rechnung automatisch mit eingefroren (snapshot).
-- Nur neue Spalten – bestehende Daten bleiben unverändert. Kann mehrfach ausgeführt werden.
-- =====================================================================

alter table public.customers
  add column if not exists vat_id text,            -- USt-IdNr. des Kunden (z. B. DE123456789), Pflicht bei § 13b
  add column if not exists einvoice_email text,    -- E-Mail für E-Rechnungen (leer = normale E-Mail)
  add column if not exists buyer_reference text;   -- Käuferreferenz / Leitweg-ID (Behörden)
