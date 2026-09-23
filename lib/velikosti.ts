// ============================================================
// Velikosti — rozpis kusů podle velikostí (XS–3XL + „další").
//
// JEDEN formát pro konfigurátor i ERP. Dvojče tohoto souboru žije v ERP repu
// `textil-evidence/src/lib/velikosti.ts` (tam jsou i testy) — logika musí
// zůstat shodná, oba soubory měnit VŽDY společně. Konfigurátor ukládá rozpis do
// `poptavka_polozky.velikost` jako text „S:2, M:5, L:8", převod na zakázku
// v ERP ho přečte `parseRozpis()`.
//
// V zakázce drží standardní velikosti sloupce `velikost_xs … velikost_3xl`,
// ostatní (4XL, dětské 128, věkové 5/6, UNI) text `poznamka_velikosti`.
// ============================================================

export const VELIKOSTI = ["xs", "s", "m", "l", "xl", "2xl", "3xl"] as const;
export type VelikostKlic = (typeof VELIKOSTI)[number];

export const VELIKOST_LABEL: Record<VelikostKlic, string> = {
  xs: "XS",
  s: "S",
  m: "M",
  l: "L",
  xl: "XL",
  "2xl": "2XL",
  "3xl": "3XL",
};

export type Rozpis = Record<VelikostKlic, number>;

/** Velikost mimo standardní mřížku (4XL, 128, 5/6, UNI…) a její počet. */
export interface JinaVelikost {
  velikost: string;
  pocet: number;
}

export interface ParsovanyRozpis {
  rozpis: Rozpis;
  jine: JinaVelikost[];
  /** Součet všech kusů (mřížka + další velikosti). */
  celkem: number;
  /** Našel se aspoň jeden pár velikost–počet? */
  rozpoznano: boolean;
  /**
   * Text, který nebyl velikostí ani počtem („dámský střih", „jmenovky
   * doplníme") — bez oddělovačů a výplňových slov. Když se nic nerozpoznalo,
   * je to celý text. Nesmí se nikde tiše zahodit.
   */
  zbytek: string;
}

export function prazdnyRozpis(): Rozpis {
  return { xs: 0, s: 0, m: 0, l: 0, xl: 0, "2xl": 0, "3xl": 0 };
}

export function soucetRozpisu(r: Rozpis): number {
  return VELIKOSTI.reduce((s, k) => s + (Number(r[k]) || 0), 0);
}

export function soucetJinych(jine: JinaVelikost[]): number {
  return jine.reduce((s, j) => s + (Number(j.pocet) || 0), 0);
}

export function maRozpis(r: Rozpis): boolean {
  return soucetRozpisu(r) > 0;
}

// ------------------------------------------------------------
// Normalizace jedné velikosti
// ------------------------------------------------------------

const DETSKE_VYSKY = new Set([
  86, 92, 98, 104, 110, 116, 122, 128, 134, 140, 146, 152, 158, 164, 170, 176,
]);

/**
 * Převede označení velikosti na klíč mřížky, nebo na popisek „další" velikosti.
 * Vrací null, pokud to velikost není.
 */
export function normalizujVelikost(
  token: string
): { klic: VelikostKlic } | { jina: string } | null {
  const t = token.toUpperCase().replace(/\s+/g, "");
  switch (t) {
    case "XS":
      return { klic: "xs" };
    case "S":
      return { klic: "s" };
    case "M":
      return { klic: "m" };
    case "L":
      return { klic: "l" };
    case "XL":
      return { klic: "xl" };
    case "XXL":
    case "2XL":
      return { klic: "2xl" };
    case "XXXL":
    case "3XL":
      return { klic: "3xl" };
    case "XXXXL":
    case "4XL":
      return { jina: "4XL" };
    case "XXXXXL":
    case "5XL":
      return { jina: "5XL" };
    case "6XL":
      return { jina: "6XL" };
    case "XXS":
      return { jina: "XXS" };
    case "ONESIZE":
    case "UNI":
    case "UNISIZE":
      return { jina: "UNI" };
  }
  if (/^\d{1,2}\/\d{1,2}$/.test(t)) return { jina: t }; // věk 5/6
  if (/^\d{2,3}$/.test(t) && DETSKE_VYSKY.has(Number(t))) return { jina: t }; // výška 128
  return null;
}

// ------------------------------------------------------------
// Parser vloženého textu
// ------------------------------------------------------------

type Token =
  | { typ: "vel"; hodnota: string; start: number; end: number }
  | { typ: "num"; hodnota: number; start: number; end: number; nasobitel: boolean };

// Pořadí alternativ je důležité (delší dřív). Písmenné velikosti nesmí být
// součástí slova („ks", „MS", „Lucie"), proto lookbehind/lookahead na písmena.
const TOKEN_RE =
  /(?<![\p{L}\d])(XXXXXL|XXXXL|XXXL|XXL|XXS|XS|XL|[2-6]XL|ONE ?SIZE|UNISIZE|UNI|S|M|L)(?![\p{L}])|(\d{1,2}\/\d{1,2})(?!\d)|(\d+)(\s*(?:x|×|ks|kus[yůu]?|pcs)(?![\p{L}]))?/giu;

// „5,128:3" nebo „10,2XL" je výčet bez mezery (za čárkou začíná další
// velikost), ne desetinné číslo.
const DALSI_VELIKOST_ZA_CARKOU = /^[.,](?:\d{1,3}\s*[:=]|\d{1,2}\/\d{1,2}|[2-6]XL(?![\p{L}]))/iu;

function tokenizuj(text: string): Token[] {
  const tokens: Token[] = [];
  for (const m of text.matchAll(TOKEN_RE)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (m[1]) {
      // Jednopísmenné „s", „m", „l" v běžné větě znamenají předložku nebo
      // jednotku („10 s logem", „5 m"). Bereme je jen velkými písmeny, nebo
      // když za nimi hned stojí dvojtečka/rovnítko („s: 5").
      if (m[1].length === 1 && m[1] === m[1].toLowerCase() && !/^\s*[:=]/.test(text.slice(end))) {
        continue;
      }
      tokens.push({ typ: "vel", hodnota: m[1], start, end });
    } else if (m[2]) {
      tokens.push({ typ: "vel", hodnota: m[2], start, end });
    } else if (m[3]) {
      const n = Number(m[3]);
      // Desetinná čísla („2,5") nejsou počty kusů — kromě výčtu bez mezery.
      const za = text.slice(end, end + 12);
      if (/^[.,]\d/.test(za) && !DALSI_VELIKOST_ZA_CARKOU.test(za)) continue;
      tokens.push({ typ: "num", hodnota: n, start, end, nasobitel: Boolean(m[4]) });
    }
  }
  return tokens;
}

/** Je mezi dvěma tokeny jen oddělovač (mezery, dvojtečka, rovnítko, pomlčka, tab)? */
function jenOddelovac(text: string, a: number, b: number, dovolit: RegExp): boolean {
  return dovolit.test(text.slice(a, b));
}

// Slova, která v rozpisu nic nenesou („vel. S: 5, M: 3, celkem 8 ks").
const VYPLNOVA_SLOVA =
  /^(?:velikost[iy]?|vel|ks|kus[yůu]?|pcs|celkem|součet|soucet|suma|total|počet|pocet|a|x|×)$/iu;

// Oddělovače NIKDY nepřekračují konec řádku — jinak by se „S | 5⏎M | 10"
// spárovalo napříč řádky („5 M"). Výjimka: velikost a počet každý sám na
// svém řádku (viz samNaRadku).
const ODDELOVAC_VEL_POCET = /^[ \t:=|\-–—]*$/u; // „S: 5", „S - 5", „S | 5", „S 5"
const ODDELOVAC_POCET_VEL = /^[ \t]*$/u; // „5x S", „5 ks M"
const ODDELOVAC_VYSKA_POCET = /^[\t ]*[:=|\-–—\t][\t ]*$|^\t+$/u; // „128: 5", „128\t5"
const ODDELOVAC_PRES_RADEK = /^[ \t:=|\-–—]*\n[ \t]*$/u; // „S:⏎5"

/**
 * Je token na svém řádku sám (kromě oddělovačů a výplňových slov)?
 * „velikost S", „S:", „5 ks" ano; „S | 5" nebo „Navy 5" ne.
 */
function samNaRadku(text: string, t: { start: number; end: number }): boolean {
  const zacatek = text.lastIndexOf("\n", t.start - 1) + 1;
  const konecRadku = text.indexOf("\n", t.end);
  const konec = konecRadku === -1 ? text.length : konecRadku;
  const okoli = `${text.slice(zacatek, t.start)} ${text.slice(t.end, konec)}`
    .replace(/[\s:=|\-–—.,;]+/gu, " ")
    .trim();
  return !okoli || okoli.split(" ").every((slovo) => VYPLNOVA_SLOVA.test(slovo));
}

function pridej(
  vysledek: { rozpis: Rozpis; jine: Map<string, number> },
  velikost: string,
  pocet: number
): boolean {
  if (!Number.isFinite(pocet) || pocet <= 0 || pocet > 99999) return false;
  const n = normalizujVelikost(velikost);
  if (!n) return false;
  if ("klic" in n) vysledek.rozpis[n.klic] += pocet;
  else vysledek.jine.set(n.jina, (vysledek.jine.get(n.jina) ?? 0) + pocet);
  return true;
}

/** Pár velikost–počet a úsek textu [od, az), který vysvětluje. */
interface Par {
  velikost: string;
  pocet: number;
  od: number;
  az: number;
}

interface Parovani {
  pary: Par[];
  zbytek: number; // nespárované tokeny
}

/** Párování „velikost → počet" (S 5, M: 10, 128 - 4). */
function parujVelikostPocet(text: string, tokens: Token[]): Parovani {
  const pary: Par[] = [];
  let zbytek = 0;
  for (let i = 0; i < tokens.length; i++) {
    const a = tokens[i];
    const b = tokens[i + 1];
    // Číslo, které vypadá jako dětská výška a hned za ním oddělovač + počet,
    // je velikost („128: 5", „128 - 5", „128\t5").
    if (
      a.typ === "num" &&
      !a.nasobitel &&
      DETSKE_VYSKY.has(a.hodnota) &&
      b?.typ === "num" &&
      jenOddelovac(text, a.end, b.start, ODDELOVAC_VYSKA_POCET)
    ) {
      pary.push({ velikost: String(a.hodnota), pocet: b.hodnota, od: a.start, az: b.end });
      i++;
      continue;
    }
    if (a.typ === "vel" && b?.typ === "num" && jenOddelovac(text, a.end, b.start, ODDELOVAC_VEL_POCET)) {
      pary.push({ velikost: a.hodnota, pocet: b.hodnota, od: a.start, az: b.end });
      i++;
      continue;
    }
    // Každá hodnota na svém řádku („S⏎5⏎M⏎10", „velikost S⏎5 ks") — text
    // zkopírovaný z PDF nebo webu. Jen když na obou řádcích nic jiného není.
    if (
      a.typ === "vel" &&
      b?.typ === "num" &&
      jenOddelovac(text, a.end, b.start, ODDELOVAC_PRES_RADEK) &&
      samNaRadku(text, a) &&
      samNaRadku(text, b)
    ) {
      pary.push({ velikost: a.hodnota, pocet: b.hodnota, od: a.start, az: b.end });
      i++;
      continue;
    }
    zbytek++;
  }
  return { pary, zbytek };
}

/** Párování „počet → velikost" (5x S, 10 ks M, 3 L). */
function parujPocetVelikost(text: string, tokens: Token[]): Parovani {
  const pary: Par[] = [];
  let zbytek = 0;
  for (let i = 0; i < tokens.length; i++) {
    const a = tokens[i];
    const b = tokens[i + 1];
    if (a.typ === "num" && b?.typ === "vel" && jenOddelovac(text, a.end, b.start, ODDELOVAC_POCET_VEL)) {
      pary.push({ velikost: b.hodnota, pocet: a.hodnota, od: a.start, az: b.end });
      i++;
      continue;
    }
    zbytek++;
  }
  return { pary, zbytek };
}

interface Radek {
  text: string;
  od: number;
  az: number;
}

/** Buňky řádku. Z Excelu (tabulátory) drží i prázdné buňky svůj sloupec. */
function bunky(radek: string): string[] {
  if (radek.includes("\t")) return radek.split("\t").map((s) => s.trim());
  return radek
    .split(/[;,]+|\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Řádek s čísly (volitelně s popiskem na začátku: „Černá 2 3 4", „2 3 4").
 * Popisek nesmí být velikost („XL 3" je pár) ani výplň („celkem 15").
 */
function jeRadekCisel(bunkyRadku: string[]): boolean {
  const b = bunkyRadku.filter(Boolean);
  if (b.length < 2) return false;
  let cisla: string[];
  if (/^\d+$/.test(b[0])) cisla = b;
  else if (normalizujVelikost(b[0]) === null && !VYPLNOVA_SLOVA.test(b[0])) cisla = b.slice(1);
  else return false;
  return cisla.length > 0 && cisla.every((h) => /^\d+$/.test(h));
}

/**
 * Tabulka zkopírovaná z Excelu po řádcích: první řádek velikosti, druhý počty.
 *   S  M  L  XL        Velikost  S  M  L       116  128  140
 *   2  5  8  3         Počet     2  5          3    4    2
 * Prázdná buňka = 0 ks té velikosti (sloupce se neposunou).
 */
function parujTabulku(radky: Radek[]): Par[] {
  const pary: Par[] = [];
  for (let i = 0; i + 1 < radky.length; i++) {
    const tabulatory = radky[i].text.includes("\t") && radky[i + 1].text.includes("\t");
    let hlavicka = bunky(radky[i].text);
    let hodnoty = bunky(radky[i + 1].text);
    // Popisek v prvním sloupci („Velikost" / „Počet") přeskočit.
    if (
      hlavicka.length > 1 &&
      hodnoty.length > 1 &&
      normalizujVelikost(hlavicka[0]) === null &&
      !/^\d+$/.test(hodnoty[0])
    ) {
      hlavicka = hlavicka.slice(1);
      hodnoty = hodnoty.slice(1);
    }
    while (hlavicka.length > 0 && !hlavicka[hlavicka.length - 1]) hlavicka.pop();
    while (hodnoty.length > 0 && !hodnoty[hodnoty.length - 1]) hodnoty.pop();
    if (hlavicka.length < 2 || hodnoty.length === 0) continue;
    // Bez tabulátorů nejde poznat, kterému sloupci chybí hodnota → počty musí sedět.
    if (tabulatory ? hodnoty.length > hlavicka.length : hodnoty.length !== hlavicka.length) continue;
    if (!hlavicka.every((h) => h !== "" && normalizujVelikost(h) !== null)) continue;
    if (!hodnoty.every((h) => /^\d*$/.test(h))) continue;
    // Další řádek čísel pod stejnou hlavičkou = tabulka po barvách/střizích
    // („Navy 5 10 8⏎Černá 2 3 4"). Nevíme, který řádek patří k položce —
    // raději nic, než vyplnit počty jiné barvy.
    if (radky[i + 2] && jeRadekCisel(bunky(radky[i + 2].text))) continue;
    const { od } = radky[i];
    const { az } = radky[i + 1];
    hlavicka.forEach((h, k) => {
      if (hodnoty[k]) pary.push({ velikost: h, pocet: Number(hodnoty[k]), od, az });
    });
    i++;
  }
  return pary;
}

const OKRAJE_ZBYTKU = /^[\s,;:=|\-–—./·]+|[\s,;:=|\-–—./·]+$/gu;

/** Co z textu zbylo mimo spárované úseky — bez oddělovačů a výplňových slov. */
function zbytekTextu(text: string, pouzite: Array<[number, number]>): string {
  const useky = [...pouzite].sort((x, y) => x[0] - y[0]);
  const kusy: string[] = [];
  let pos = 0;
  for (const [od, az] of useky) {
    if (od > pos) kusy.push(text.slice(pos, od));
    pos = Math.max(pos, az);
  }
  kusy.push(text.slice(pos));
  return kusy
    .map((k) => k.replace(/\s+/g, " ").replace(OKRAJE_ZBYTKU, ""))
    .filter(
      (k) => k && !k.split(" ").every((slovo) => VYPLNOVA_SLOVA.test(slovo.replace(/[.,;:]+$/u, "")))
    )
    .join("; ");
}

/**
 * Přečte rozpis velikostí z volného textu — z e-mailu, Excelu, WhatsAppu.
 *
 * Umí: „S:5, M:10, L:8", „S 5 M 10", „5x S, 10x M", „2 ks XL", „XXL - 3",
 * „S | 5", „S\t5" (sloupce z Excelu), tabulku po řádcích (velikosti / počty,
 * i s prázdnými buňkami a popiskem v prvním sloupci), „4XL 2", dětské
 * „128: 5", věkové „5/6: 10" a výčet bez mezer „116:5,128:3".
 *
 * Neumí hádat: „S-XL" bez počtů nic nevrátí a páry nikdy nespojuje přes
 * konec řádku. Co nepozná, vrátí v `zbytek` — raději méně než špatně.
 */
export function parseRozpis(text: string | null | undefined): ParsovanyRozpis {
  const vysledek = { rozpis: prazdnyRozpis(), jine: new Map<string, number>() };
  const vstup = (text ?? "")
    .replace(/[  ]/g, " ")
    .replace(/\r\n?/g, "\n")
    .trim();

  const pouzite: Array<[number, number]> = [];
  let rozpoznano = false;

  if (vstup) {
    const radky: Radek[] = [];
    let pos = 0;
    for (const t of vstup.split("\n")) {
      if (t.trim()) radky.push({ text: t, od: pos, az: pos + t.length });
      pos += t.length + 1;
    }
    const tabulka = radky.length >= 2 ? parujTabulku(radky) : [];
    const vTabulce = (i: number) => tabulka.some((p) => i >= p.od && i < p.az);

    // Text mimo tabulky: páry „S 5" nebo „5x S".
    const tokens = tokenizuj(vstup).filter((t) => !vTabulce(t.start));
    const a = parujVelikostPocet(vstup, tokens);
    const b = parujPocetVelikost(vstup, tokens);
    // Vyhrává párování, které vysvětlí víc textu. Při shodě rozhodne
    // násobitel („5x S" / „5 ks S") — jinak běžnější zápis „S 5".
    const nasobitel = tokens.some((t) => t.typ === "num" && t.nasobitel);
    let volne: Parovani;
    if (b.pary.length > a.pary.length) volne = b;
    else if (a.pary.length > b.pary.length) volne = a;
    else if (b.zbytek < a.zbytek) volne = b;
    else if (a.zbytek < b.zbytek) volne = a;
    else volne = nasobitel ? b : a;
    // Páry druhého směru, které se s vítězným nepřekrývají („4XL 2 a 1x 5XL"):
    // bez nich by půlka smíšeného zápisu skončila ve zbytku a po uložení by
    // se při dalším čtení najednou započítala → jiný počet kusů.
    const druhe = volne === a ? b : a;
    const doplnky = druhe.pary.filter(
      (p) => !volne.pary.some((q) => p.od < q.az && q.od < p.az)
    );

    // V pořadí textu — další velikosti pak drží pořadí, jak je zákazník psal.
    const vsechny = [...tabulka, ...volne.pary, ...doplnky].sort((x, y) => x.od - y.od);
    for (const p of vsechny) {
      if (pridej(vysledek, p.velikost, p.pocet)) {
        rozpoznano = true;
        pouzite.push([p.od, p.az]);
      }
    }
  }

  const jine = Array.from(vysledek.jine.entries()).map(([velikost, pocet]) => ({ velikost, pocet }));
  return {
    rozpis: vysledek.rozpis,
    jine,
    celkem: soucetRozpisu(vysledek.rozpis) + soucetJinych(jine),
    rozpoznano,
    zbytek: zbytekTextu(vstup, pouzite),
  };
}

// ------------------------------------------------------------
// Formátování
// ------------------------------------------------------------

/** Pro lidi: „S 2 · M 5 · L 8 · 4XL 1". Prázdný rozpis → "". */
export function formatRozpis(r: Rozpis, jine: JinaVelikost[] = []): string {
  const casti = VELIKOSTI.filter((k) => (r[k] ?? 0) > 0).map(
    (k) => `${VELIKOST_LABEL[k]} ${r[k]}`
  );
  for (const j of jine) if (j.pocet > 0) casti.push(`${j.velikost} ${j.pocet}`);
  return casti.join(" · ");
}

/** Strojově čitelný zápis „S:2, M:5, 4XL:1" (ukládá konfigurátor, čte parseRozpis). */
export function rozpisDoTextu(r: Rozpis, jine: JinaVelikost[] = []): string {
  const casti = VELIKOSTI.filter((k) => (r[k] ?? 0) > 0).map(
    (k) => `${VELIKOST_LABEL[k]}:${r[k]}`
  );
  for (const j of jine) if (j.pocet > 0) casti.push(`${j.velikost}:${j.pocet}`);
  return casti.join(", ");
}

/**
 * Obsah pole „další velikosti": velikosti mimo mřížku a text navíc,
 * „4XL:2; dámský střih". `parseRozpis` ho přečte zpátky beze ztráty.
 */
export function dalsiDoTextu(jine: JinaVelikost[], zbytek?: string | null): string {
  return [rozpisDoTextu(prazdnyRozpis(), jine), (zbytek ?? "").trim()].filter(Boolean).join("; ");
}

export interface SloucenyRozpis {
  rozpis: Rozpis;
  jine: JinaVelikost[];
  zbytek: string;
  celkem: number;
  /** Byla v textu dalších velikostí aspoň jedna velikost s počtem? */
  rozpoznano: boolean;
}

/**
 * Mřížka + text „dalších velikostí" dohromady. Standardní velikost napsaná
 * do dalších („S 5") se přičte do mřížky — jinak by ji počítal součet kusů,
 * ale ne tisk, objednávka ani nákupní cena. Text, který není velikost,
 * zůstane v `zbytek`.
 */
export function slucRozpis(
  rozpis: Partial<Rozpis> | null | undefined,
  dalsi: string | null | undefined
): SloucenyRozpis {
  const p = parseRozpis(dalsi);
  const r = prazdnyRozpis();
  for (const k of VELIKOSTI) {
    r[k] = Math.max(0, Math.floor(Number(rozpis?.[k]) || 0)) + p.rozpis[k];
  }
  return {
    rozpis: r,
    jine: p.jine,
    zbytek: p.zbytek,
    celkem: soucetRozpisu(r) + soucetJinych(p.jine),
    rozpoznano: p.rozpoznano,
  };
}

// ------------------------------------------------------------
// Převod na/z řádku zakázky (sloupce velikost_xs … velikost_3xl)
// ------------------------------------------------------------

export interface SloupceVelikosti {
  velikost_xs: number;
  velikost_s: number;
  velikost_m: number;
  velikost_l: number;
  velikost_xl: number;
  velikost_2xl: number;
  velikost_3xl: number;
}

export function rozpisZeSloupcu(row: Partial<Record<keyof SloupceVelikosti, number | string | null>>): Rozpis {
  return {
    xs: Number(row.velikost_xs) || 0,
    s: Number(row.velikost_s) || 0,
    m: Number(row.velikost_m) || 0,
    l: Number(row.velikost_l) || 0,
    xl: Number(row.velikost_xl) || 0,
    "2xl": Number(row.velikost_2xl) || 0,
    "3xl": Number(row.velikost_3xl) || 0,
  };
}

export function rozpisDoSloupcu(r: Rozpis): SloupceVelikosti {
  const cele = (n: number) => Math.max(0, Math.round(Number(n) || 0));
  return {
    velikost_xs: cele(r.xs),
    velikost_s: cele(r.s),
    velikost_m: cele(r.m),
    velikost_l: cele(r.l),
    velikost_xl: cele(r.xl),
    velikost_2xl: cele(r["2xl"]),
    velikost_3xl: cele(r["3xl"]),
  };
}

/**
 * Popis velikostí řádku pro doklady (PDF, export): mřížka + další velikosti
 * + text navíc, u starých řádků bez mřížky původní text `velikost`.
 */
export function popisVelikostiRadku(row: {
  velikost?: string | null;
  poznamka_velikosti?: string | null;
} & Partial<Record<keyof SloupceVelikosti, number | string | null>>): string | null {
  const s = slucRozpis(rozpisZeSloupcu(row), row.poznamka_velikosti);
  const mrizka = formatRozpis(s.rozpis, s.jine);
  if (mrizka) return [mrizka, s.zbytek].filter(Boolean).join(" · ");
  const puvodni = [row.velikost, row.poznamka_velikosti].filter((t) => t && t.trim()).join(" · ");
  return puvodni || null;
}
