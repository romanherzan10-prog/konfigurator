@AGENTS.md

## Poptávky → ERP (textil-evidence)
- Konfigurátor sdílí Supabase projekt s ERP. Poptávku z webu převádí ERP na
  zakázku, takže formát dat tady je smlouva s ERP.
- **Velikosti**: `lib/velikosti.ts` je dvojče `textil-evidence/src/lib/velikosti.ts`
  (testy jsou tam) — logiku měnit v obou souborech současně. Do
  `poptavka_polozky.velikost` jde strojový zápis „S:2, M:5, 4XL:1“
  (`velikostDoPoptavky()` v `lib/cart.ts`); text, kterému parser nerozuměl,
  se připojí za „; “, aby se neztratil.
- `poptavky.firma` / `poptavky.ico` (IČO 8 číslic) — ERP podle IČO a e-mailu
  páruje zákazníka. Neplatné IČO poptávku neshodí, jen se neuloží.
- Počet kusů: `poptavky.mnozstvi` má v DB check 1–5000 (celá poptávka).
  Formulář to hlídá před odesláním (`MAX_KS_TEXTIL`).
