/**
 * Odborná knihovna doporučení LOOOKU.
 *
 * Toto je centrální místo, kde Roman (majitel) sepisuje své
 * know-how a doporučení k produktům. Jarda Kužel (AI asistent)
 * z toho čerpá při odpovídání zákazníkům.
 *
 * STRUKTURA:
 * - DOPORUCENI_DLE_UCELU — co doporučit podle toho, k čemu to zákazník chce
 * - DOPORUCENI_DLE_PRODUKTU — odborné poznámky ke konkrétním produktům/značkám
 * - TIPY_A_VAROVÁNÍ — obecné rady, na co si dát pozor
 *
 * Roman: edituj přímo tady, Jarda to bude mít okamžitě po deployi.
 */

// ============================================================
// 1) DOPORUČENÍ DLE ÚČELU
// ============================================================

export const DOPORUCENI_DLE_UCELU = `
## Doporučení podle účelu použití

### Firemní eventy a teambuildingy
- **Priorita**: cena, ne trvanlivost — nosí se 1–3×
- **Doporučuji**: základní trička 150–170 g (Fruit of the Loom Valueweight, SOL's Regent)
- **Proč**: šetříte peníze, tričko stejně nikdo nenosí denně
- **Zdobení**: DTF potisk — plnobarevný, levný, rychlý
- **Pozor**: pod 150 g je tričko průsvitné, nepůsobí dobře

### Firemní merch / dárky pro klienty
- **Priorita**: kvalita vnímání, „wow" efekt — zákazník si tričko/mikinu spojí s vaší značkou
- **Doporučuji**: prémiová trička 180–200 g (B&C #E190, Kariban K371, Stanley/Stella)
- **Proč**: lepší omak, drží tvar po praní, zákazník to opravdu nosí
- **Mikiny**: Kariban K474 (klokanka, 310 g) nebo K477 (zip) — dobrý poměr cena/kvalita
- **Zdobení**: výšivka pro prémiový dojem, potisk pro plnobarevné logy

### Denní pracovní oblečení (kancelář, prodejna)
- **Priorita**: odolnost a pohodlí — nosí se denně, pere se často
- **Doporučuji**: polokošile 200–220 g (Kariban K241, B&C Safran) nebo trička 190+ g
- **Proč**: polokošile působí profesionálněji, vydrží 100+ praní
- **Zdobení**: výšivka — drží déle než potisk při častém praní
- **Pozor**: u polokošil vždy doporučit pánskou i dámskou verzi, aby seděly

### Stavba, dílna, venkovní práce
- **Priorita**: odolnost, reflexní prvky, certifikace
- **Doporučuji**: Result, James & Nicholson workwear řada, hi-vis varianty
- **Gramáž**: 250+ g pro trička, 350+ g pro mikiny
- **Zdobení**: výšivka (potisk se v drsných podmínkách loupe)

### Sport a outdoor (běh, cyklo, fitness tým)
- **Priorita**: funkční materiály, rychleschnoucí, prodyšné
- **Doporučuji**: polyesterové dresy — SOL's Sporty, Kariban ProAct, Stedman Active
- **Pozor**: na polyester se NEDÁ sítotisk — pouze DTF/sublimace
- **Gramáž**: 130–160 g (lehké, odvádí vlhkost)

### Školní a dětské akce
- **Doporučuji**: dětské verze (B&C #E190 /kids, Fruit of the Loom Kids Valueweight)
- **Pozor**: velikosti! Dětské jsou jiný střih, vždy potvrdit věkové rozmezí
- **Zdobení**: DTF potisk — barevný, odolný, dětsky atraktivní

### Jednorázová akce (festival, koncert, charita)
- **Priorita**: maximálně levné, rychlé dodání
- **Doporučuji**: Fruit of the Loom Valueweight (160 g) — nejlevnější varianta v katalogu
- **Proč**: masová akce = nízká cena za kus je klíčová
- **Zdobení**: potisk 1–2 barvami (sítotisk při 200+ ks, DTF při menším množství)
`.trim();

// ============================================================
// 2) DOPORUČENÍ DLE PRODUKTU / ZNAČKY
// ============================================================

export const DOPORUCENI_DLE_PRODUKTU = `
## Poznámky ke konkrétním produktům a značkám

### Trička
- **B&C #E190** (185 g) — náš bestseller pro firemní merch. Předepraná prstencová bavlna, nesvraští se po praní. Široká paleta barev. Dobře drží potisk i výšivku.
- **Kariban K371** (180 g) — srovnatelné s E190, užší střih. Populární u firem, které chtějí modernější siluetu.
- **Fruit of the Loom Valueweight** (160 g) — nejlevnější varianta v katalogu. Pro jednorázové akce a velké náklady. Kvalita OK, ale po 20+ praních ztrácí tvar.
- **SOL's Regent** (150 g) — lehké, příjemné na léto. Pozor: tenčí materiál = může být průsvitné ve světlých barvách.
- **Stanley/Stella** — ekologická prémiová řada. Organic cotton, fair trade. Dražší, ale zákazníci kteří to hledají zaplatí rádi.

### Polokošile
- **Kariban K241** (220 g, piqué) — standard pro firemní prostředí. Odolný límec, neroluje se.
- **B&C Safran** (180 g) — lehčí varianta, příjemnější v létě. Méně odolná než K241.
- **TEE JAYS Luxury Stretch** — prémiová polokošile s elastanem. Pro firmy, kde záleží na image.

### Mikiny
- **Kariban K474** (310 g, klokanka) — nejprodávanější mikina. Dobrý poměr cena/kvalita/vzhled.
- **Kariban K477** (310 g, zip) — stejná kvalita jako K474, varianta se zipem.
- **Kariban K911** (470 g, fleece) — protižmolkový fleece. Pro venkovní použití, stavby, outdoor.
- **Result R036X** (580 g) — nejtěžší fleece v katalogu. Extrémní tepelný komfort.
- **B&C ID.003** (280 g) — lehčí klokanka, vhodná pro potisk velkého motivu na záda.

### Bundy
- **Result Core** řada — cenově dostupné softshelly a větrovky. Pro firemní outdoor.
- **James & Nicholson** — širší výběr materiálů a střihů. Dražší, ale kvalitnější zpracování.

### Čepice a kšiltovky
- **Beechfield** — dominantní značka v katalogu, 200+ modelů. Vhodné pro výšivku.
- **Flexfit** — prémiové fitted kšiltovky. Zákazníci je znají, oblíbené jako merch.
- **Atlantis** — dobrý poměr cena/kvalita pro klasické baseballky.

### Tašky
- **BagBase** — široká řada od plátěnek po batohy. Oblíbené jako dárkové předměty.
`.trim();

// ============================================================
// 3) OBECNÉ TIPY A VAROVÁNÍ
// ============================================================

export const TIPY_A_VAROVANI = `
## Tipy a důležitá varování

### Gramáž a kvalita
- **150–170 g** = základní, levné, pro jednorázové akce
- **180–200 g** = zlatý střed, firemní merch, dárky
- **200–250 g** = prémiové, denní nošení, odolné
- **250+ g** = heavy duty, pracovní oděvy

### Zdobení — co k čemu
- **Sítotisk**: nejlevnější při 100+ ks, ale omezené barvy (1–4 barvy). Nejlepší pro jednoduché loga.
- **DTF potisk**: plnobarevný, vhodný i pro 10–100 ks. Fotorealistické motivy, gradenty.
- **Výšivka**: nejtrvanlivější, prémiový dojem. Dražší, ale drží i po 200 praních. Ideální pro polokošile a mikiny.
- **Sublimace**: pouze na bílý polyester! Nelze na bavlnu. Pro sportovní dresy, celopotisky.

### Na co si dát pozor
- **Bílá trička pod 170 g** mohou být průsvitná — vždy upozorni zákazníka.
- **Bavlna vs. polyester**: bavlna = potisk/výšivka, polyester = sublimace/DTF. Nikdy sítotisk na polyester.
- **Dámské vs. pánské**: vždy se zeptej, jestli potřebují obě verze. Dámský střih je užší, ne jen menší.
- **Termín 7–10 dní** je standard. Pod 5 dní = příplatek za expresní zpracování.
- **Praní a údržba**: potisk vydrží 50–80 praní (max 40°C, lícem dovnitř), výšivka prakticky neomezeně.
- **Skladové barvy**: ne všechny barvy jsou skladem ve všech velikostech. Vždy ověřit dostupnost přes tool.
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
    TIPY_A_VAROVANI,
  ].join("\n");
}
