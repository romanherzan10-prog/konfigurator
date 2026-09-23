/**
 * Odborná knihovna doporučení LOOOKU.
 *
 * Centrální místo know-how pro Michala (AI asistenta). Roman edituje přímo
 * tady (nebo pošle text a doplníme).
 *
 * ⚠️ TRÉNINK 16.7.2026: obsah ukotven v reálných datech z DB (orchestrátor,
 * 3 výzkumní agenti — produkty / retailové ceny / skutečná poptávka zákazníků).
 * Všechny kódy produktů ověřeny proti katalogu (aktivní, viditelné značky).
 * Ceny = VÝHRADNĚ retailové („vč. DPH“) — nikdy nákupní ceny ani marže.
 *
 * POZOR: čísla níž jsou opsaná ručně a ZASTARÁVAJÍ. Při kontrole 9/2026 byly
 * dvě mimo (PA 396 uváděla 588 místo 530, Severny 290 místo 271) a nikdo si
 * toho nevšiml. Ověřit jde takto:
 *
 *   select kod, cena_od, round(cena_od*1.21) as s_dph
 *   from produkty_katalog_flat where kod in ('20.P396', ...);
 *
 * Správné řešení je generovat tuhle sekci z databáze, ne ji přepisovat.
 *
 * STRUKTURA:
 * - DOPORUCENI_DLE_UCELU — co doporučit podle účelu
 * - DOPORUCENI_DLE_PRODUKTU — ověřené produkty/značky s kódy
 * - CENOVE_HLADINY — reálné cenové mapy a množstevní slevy
 * - CO_LIDE_CHTEJI — chování dle skutečné poptávky (chaty + poptávky)
 * - TIPY_A_VAROVANI — obecné rady
 */

// ============================================================
// 1) DOPORUČENÍ DLE ÚČELU
// ============================================================

export const DOPORUCENI_DLE_UCELU = `
## Doporučení podle účelu použití

### Firemní eventy a teambuildingy
- Priorita: cena — nosí se 1–3×. Základní trička 150–170 g.
- Doporuč: Fruit of the Loom Valueweight T (kod 16.1036, 165 g) nebo SOL'S Regent (kod 25.1380, 150 g).
- Zdobení: DTF potisk — plnobarevný, levný, rychlý.
- Pozor: pod 150 g bývá tričko průsvitné.

### Firemní merch / dárky pro klienty
- Priorita: vnímaná kvalita. Trička 175–200 g.
- Doporuč: SOL'S Legend (kod 25.3981, 175 g, bio bavlna — náš kurátorský TOP) nebo B&C #E190 (kod 01.003T, 185 g; dámská 01.004T, dětská 01.008T).
- Mikiny: Kariban K474 klokanka (kod 20.K474) / K477 se zipem (kod 20.K477); sportovnější Kariban ProAct PA 396 (kod 20.P396 — kurátorský TOP, retail od 530 Kč vč. DPH).
- Zdobení: výšivka pro prémiový dojem, DTF pro plnobarevná loga.

### Denní pracovní oblečení (kancelář, prodejna)
- Priorita: odolnost, profesionální vzhled. Polokošile 180–240 g.
- Doporuč: Kariban K 241 (kod 20.K241, piqué) nebo James & Nicholson JN 727 (kod 02.0727, 240 g česaná bavlna). Levnější start: F.O.L. Premium Polo (kod 16.3218, 180 g).
- Zdobení: výšivka — vydrží 100+ praní.
- Vždy nabídni pánskou i dámskou verzi (jiný střih, ne jen menší velikost).

### Stavba, dílna, venkovní práce
- Priorita: odolnost, hi-vis, certifikace. Značky: James & Nicholson workwear, Projob, Result, Helly Hansen (prémium).
- Gramáž: trička 250+ g, mikiny 350+ g. Fleece: Kariban K 911 (kod 20.K911, protižmolkový) nebo Result R 036X (kod 30.036X, 580 g).
- Zdobení: výšivka (potisk se v drsném provozu loupe).

### Sport a outdoor (běh, cyklo, fitness tým)
- Funkční polyester, rychleschnoucí: Kariban ProAct, SOL'S sport řada, Stedman Active. 130–160 g.
- POZOR: na polyester nejde sítotisk — jen DTF nebo sublimace (sublimace jen bílý polyester).

### Školní a dětské akce
- Dětské verze: F.O.L. Kids Valueweight, B&C #E190 kids (kod 01.008T), Stedman Classic Sweatshirt Kids (kod 05.4370 — kurátorský TOP mikina).
- Pozor na velikosti: dětský střih ≠ zmenšený dospělý; vždy potvrdit věk.

### Jednorázová akce (festival, koncert, charita)
- Maximálně levně: SOL'S Urban (kod 26.7060, retail od 51 Kč vč. DPH) nebo F.O.L. Valueweight T (kod 16.1036).
- Sítotisk při 200+ ks (1–2 barvy), DTF při menším množství.

### Udržitelnost (bio / recyklované) — máme velký výběr
- Bio bavlna: ~430 produktů (nejvíc trička, mikiny). Tipy: SOL'S Legend (25.3981), B&C Inspire řada (tričko 01.TM44, polo 01.0430), Neutral (bio + Fairtrade, např. čepice 77.9356).
- Recyklované: ~620 produktů (nejvíc bundy, čepice). Tipy: Result Recycled R 906X (30.906X), Atlantis Chao čepice (33.0299, bio+recykl).
- NEDOPORUČUJ Stanley/Stella — momentálně 0 aktivních produktů v katalogu.
`.trim();

// ============================================================
// 2) DOPORUČENÍ DLE PRODUKTU / ZNAČKY (kódy ověřené v katalogu)
// ============================================================

export const DOPORUCENI_DLE_PRODUKTU = `
## Ověřené produkty a značky (kódy z katalogu)

### Kurátorské TOPy (doporučuj přednostně, majitel je vybral)
1. SOL'S Legend — tričko 175 g, bio bavlna (kod 25.3981)
2. Kariban ProAct PA 396 — mikina (kod 20.P396, retail od 530 Kč vč. DPH)
3. Stedman Classic Sweatshirt Kids — dětská mikina (kod 05.4370)
4. Atlantis Severny — zimní čepice (kod 33.0307, retail od 271 Kč vč. DPH)

### Trička (435 aktivních; top značky: SOL'S, J&N, Kariban, B&C, F.O.L.)
- Basic: F.O.L. Valueweight T (16.1036, 165 g) · SOL'S Urban (26.7060, od 52 Kč)
- Střed: SOL'S Regent (25.1380, 150 g) · B&C #E190 (01.003T, 185 g, nesráží se, široká paleta barev; varianty LSL/dámské/dětské 01.004T–01.010T)
- Prémium: SOL'S Legend (25.3981, bio) · Tee Jays TJ 8000 (18.8000)

### Polokošile (215 aktivních)
- Basic: F.O.L. Premium Polo (16.3218) · SOL'S Pitcher (25.4442, od 198 Kč)
- Střed: Kariban K 241 (20.K241, 220 g piqué — standard pro firmy) · J&N JN 727 (02.0727, 240 g) · Kariban K 232 (20.K232)
- Prémium: Cutter & Buck Advantage (68.4420) · funkční Kariban WK 271 (20.W271)

### Mikiny & Svetry (519 aktivních)
- Basic: Russell Athletic 265M (10.265M, 280 g) · Jerzees řada (od 86 Kč)
- Střed: Kariban K474 klokanka / K477 zip (20.K474 / 20.K477, 310 g — nejprodávanější) · B&C Hooded (01.0620) · SOL'S Calipso (25.4237)
- Prémium/heavy: Promodoro 5505 (40.5505, 500 g) · Build your Brand BY 268 (56.0268, 500 g)
- Fleece: Kariban K 911 (20.K911) · Result R 036X (30.036X, 580 g)

### Bundy & Vesty (569 aktivních; J&N, Result, Kariban, Regatta)
- Střed: James & Nicholson JN 1328 (02.1328) · Result Core řada (dostupné softshelly)
- Prémium: Kariban Premium PK 6020 (20.6020, vlněný kepr)

### Čepice & Kšiltovky (695 aktivních; Beechfield 235, Flexfit 161, Atlantis 159)
- Basic: Kariban KP 450IC (20.0450, od 26 Kč) · Result RC 044X (28.044X pletená)
- Střed: Atlantis Snap Five (33.0064) · Atlantis Chao (33.0299, bio+recykl) · Atlantis Severny (33.0307 — TOP)
- Prémium: Flexfit 6689M (55.6689, vlna) — fitted, zákazníci značku znají
- Nejčastěji poptávané: Atlantis Beat (33.0135) a Atlantis Case (33.5070) — výborné na výšivku.

### Tašky & Batohy (342 aktivních; BagBase 95, Westford Mill 80, Halfar 64)
- Basic plátěnky: Westford Mill W 115 / W 415 (50.0115 / 50.0415, od 22 Kč)
- Střed: Halfar 1801059 / 1818049 (47.1059 / 47.8049, od ~440 Kč) · bio: Neutral O 90053 (77.0053, Fairtrade)
- Prémium: KiMood KI 0960 (19.0960) · Helly Hansen 79572 (59.9572, voděodolná)

### NEEXISTUJE / NENABÍZET (ověřeno proti katalogu)
- „Kariban K371“ a „TEE JAYS Luxury Stretch“ v katalogu NEJSOU — nikdy je nezmiňuj.
- B&C Safran a B&C ID.003 jsou NEAKTIVNÍ — nenabízet.
- Stanley/Stella: 0 aktivních produktů — nenabízet, dokud se nedoplní.
`.trim();

// ============================================================
// 3) CENOVÉ HLADINY (retail vč. DPH; zdroj: reálný ceník)
// ============================================================

export const CENOVE_HLADINY = `
## Cenové hladiny (orientační retail, vč. DPH, za kus bez zdobení)

| Kategorie | Od | Běžný střed (medián) | Prémiová čtvrtina od |
|---|---|---|---|
| Trička | 52 Kč | ~254 Kč | 363 Kč |
| Polokošile | 198 Kč | ~528 Kč | 708 Kč |
| Mikiny & Svetry | 86 Kč | ~940 Kč | 1 225 Kč |
| Bundy & Vesty | ~90 Kč (lehké) | ~1 614 Kč | 2 230 Kč |
| Čepice & Kšiltovky | 26 Kč | ~234 Kč | 323 Kč |
| Tašky & Batohy | 22 Kč | ~413 Kč | 783 Kč |
| Košile & Halenky | 68 Kč | ~974 Kč | 1 520 Kč |
| Pracovní oděvy | 82 Kč | ~870 Kč | 1 864 Kč |

- Kotvy do řeči: kvalitní firemní tričko ~250 Kč, polokošile ~530 Kč, mikina ~940 Kč, kšiltovka ~230 Kč (vč. DPH, bez zdobení).
- Vždy dodej: finální cena závisí na množství a zdobení — přesně ji spočítá konfigurátor/nabídka.

### Množstevní slevy (reálná ceníková pásma 1/10/100/500/1000 ks)
- Největší zlom je mezi 10 a 100 ks: cena/ks klesne o ~8–9 %.
- 1000 ks vs 1 ks: cena/ks celkem o ~18 % nižší (trička i mikiny).
- Do řeči: „při 100 kusech se dostanete zhruba o desetinu níž na kus než při deseti“.
`.trim();

// ============================================================
// 4) CO LIDÉ CHTĚJÍ (z reálných chatů a poptávek) — chování Michala
// ============================================================

export const CO_LIDE_CHTEJI = `
## Co zákazníci skutečně řeší (data z chatů a poptávek)

- Nejčastější témata: BARVA a VELIKOSTI (suverénně nejvíc dotazů), pak mikiny, potisk, logo, kšiltovky. Doplňky (tašky/hrnky/deštníky) skoro nikdo sám nezmíní — nenabízej je proaktivně, dokud se nehodí.
- Typická objednávka: 25–50 ks, potisk. Kšiltovky se poptávají na VÝŠIVKU (top položky: Atlantis Beat 33.0135, Atlantis Case 33.5070).

### Pravidla chování (opřená o data):
1. BARVU a VELIKOSTNÍ ROZPIS řeš brzy a strukturovaně. Nabídni default: „standardní mix S–XXL (S 10 % / M 25 % / L 30 % / XL 25 % / XXL 10 %)“ — zákazník ho jen upraví. Hlídej nesoulad počtu lidí vs. kusů.
2. CENU A TERMÍN říkej PROAKTIVNĚ před finalizací (kotvy z cenových hladin + standardní termín 7–10 dní) — jsou to tiché blokátory odeslání.
3. VELKÉ OBJEMY (100+ ks): hned zmiň množstevní slevu (~10 % na kus proti malé sérii) a naveď rovnou k nezávazné poptávce — právě tyto zakázky se nejčastěji ztrácely.
4. U kšiltovek a merche aktivně doporučuj VÝŠIVKU (drží, působí prémiově) + konkrétní model (Atlantis Beat/Case, Severny na zimu).
5. Jakmile zákazník řekne „chci nabídku“ nebo dá kontakt — PRIORITA č. 1 je odeslat poptávku (submit_inquiry). I když selže katalog nebo náhled, poptávku dokonči s tím, co víš; detaily doladí kolega e-mailem.
6. Když nefunguje vyhledávání katalogu, NEZASTAVUJ konverzaci: doporuč z této knihovny (ověřené kódy výše) a pokračuj k poptávce.
`.trim();

// ============================================================
// 5) OBECNÉ TIPY A VAROVÁNÍ
// ============================================================

export const TIPY_A_VAROVANI = `
## Tipy a důležitá varování

### Gramáž a kvalita
- 150–170 g základní (jednorázové akce) · 175–200 g zlatý střed (merch, dárky) · 200–250 g prémium (denní nošení) · 250+ g heavy duty (workwear).

### Zdobení — co k čemu
- Sítotisk: nejlevnější při 100+ ks, 1–4 barvy, jednoduchá loga. NE na polyester.
- DTF potisk: plnobarevný, fotorealistický, ideální 10–100 ks.
- Výšivka: nejtrvanlivější, prémiový dojem; ideál pro polokošile, mikiny, čepice.
- Sublimace: jen bílý polyester (sportovní dresy, celopotisk). Nikdy na bavlnu.

### Na co si dát pozor
- Bílá/světlá trička pod 170 g mohou být průsvitná — upozorni.
- Bavlna = potisk/výšivka; polyester = DTF/sublimace.
- Dámský střih je užší, ne jen menší — vždy nabídni obě verze.
- Termín 7–10 dní standard; pod 5 dní = expresní příplatek.
- Potisk vydrží 50–80 praní (40 °C, lícem dovnitř), výšivka prakticky neomezeně.
- Skladovou dostupnost barev/velikostí vždy ověř přes tool (ne z hlavy).
`.trim();

/**
 * Sestav kompletní knowledge base pro vložení do system promptu.
 */
export function buildKnowledgeBase(): string {
  return [
    "# Odborná knihovna doporučení LOOOKU",
    "",
    DOPORUCENI_DLE_UCELU,
    "",
    "---",
    "",
    DOPORUCENI_DLE_PRODUKTU,
    "",
    "---",
    "",
    CENOVE_HLADINY,
    "",
    "---",
    "",
    CO_LIDE_CHTEJI,
    "",
    "---",
    "",
    TIPY_A_VAROVANI,
  ].join("\n");
}
