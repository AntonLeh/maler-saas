-- =====================================================================
-- Stripe: Preis-ID für den Tarif Enterprise (799 € / Monat)
-- Bisherige Preise bleiben unverändert. Kann gefahrlos mehrfach ausgeführt werden.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_stripe_price_id_for_plan(p_plan text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF p_plan = 'starter' THEN
    RETURN 'price_1U935f2QOB8iolrWZzQQlchr';
  END IF;

  IF p_plan = 'professional' THEN
    RETURN 'price_1U935f2QOB8iolrWvG3ND1a3';
  END IF;

  IF p_plan = 'business' THEN
    RETURN 'price_1U935f2QOB8iolrWAxscoamr';
  END IF;

  IF p_plan = 'enterprise' THEN
    RETURN 'price_1UYLYC2QOB8iolrWVoV7C8xQ';
  END IF;

  RAISE EXCEPTION 'Unbekannter Plan: %', p_plan;
END;
$function$;
