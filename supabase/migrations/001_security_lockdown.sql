-- ============================================================
-- 001_security_lockdown.sql
-- ============================================================
-- Zakázat přístup anon roli k citlivým tabulkám a sloupcům.
-- Aplikace přistupuje k cenám přes server-side API endpoint
-- /api/produkt-price/[kod], který používá service_role klíč.
--
-- Spustit v Supabase SQL Editoru (production projekt).
-- ============================================================

-- 1) Odebrat anon přístup k celé tabulce ceniky
--    Tabulka obsahuje velkoobchodní ceny (cena_1, ..., cena_1000),
--    které nesmí být viditelné v browseru přes anon klíč.
REVOKE ALL ON TABLE public.ceniky FROM anon;
REVOKE ALL ON TABLE public.ceniky FROM authenticated;

-- RLS zapnout pro jistotu (i kdyby někdo později přidal policy)
ALTER TABLE public.ceniky ENABLE ROW LEVEL SECURITY;

-- 2) produkt_sklad.cena_nakupni — nákupní cena na skladě nesmí unikat
--    Anon smí číst jen `id`, `velikost`, `skladem` (+ FK na produkt_barvy).
--    Odebereme přístup k cena_nakupni sloupci.
REVOKE SELECT (cena_nakupni) ON public.produkt_sklad FROM anon;
REVOKE SELECT (cena_nakupni) ON public.produkt_sklad FROM authenticated;

-- Pro aktivaci column-level revoke je třeba nejdřív omezit obecný SELECT,
-- pak povolit explicitní sloupce. Supabase PostgREST to respektuje.
REVOKE SELECT ON public.produkt_sklad FROM anon;
REVOKE SELECT ON public.produkt_sklad FROM authenticated;
GRANT SELECT (id, barva_id, velikost, skladem) ON public.produkt_sklad TO anon;
GRANT SELECT (id, barva_id, velikost, skladem) ON public.produkt_sklad TO authenticated;

-- 3) Kontrola: anon smí číst jen public katalogová data
--    (produkty, znacky, kategorie, produkt_barvy, produkt_sklad bez cena_nakupni).
--    Žádné ceny, žádné sklad.cena_nakupni.

-- 4) chat_* tabulky — pokud ještě nemají RLS, zapneme ji.
--    Service role (API) obchází RLS, anon by neměl mít žádný přístup.
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.chat_sessions FROM anon;
REVOKE ALL ON TABLE public.chat_messages FROM anon;
REVOKE ALL ON TABLE public.chat_events FROM anon;
