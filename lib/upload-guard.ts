/**
 * Ověření nahrávaných souborů podle skutečného obsahu.
 *
 * PROČ: `/api/upload-logo` i `/api/upload-design` jsou veřejné (zákazník
 * nahrává podklady dřív, než má účet). Typ souboru se ale bral z toho, co
 * poslal klient — přípona z názvu, Content-Type z těla requestu. Kdokoliv
 * tak mohl uložit libovolný soubor do 12 MB do veřejného R2 bucketu, který
 * platíme.
 *
 * Whitelist je schválně široký: zákazníci posílají podklady pro tisk, tedy
 * běžně i .ai, .eps a SVG. Zúžit ho na obrázky by rozbilo reálný provoz —
 * všechna tři místa v UI tyhle formáty nabízejí.
 *
 * SVG je jediný povolený formát, který umí nést skript. Ukládá se proto jako
 * `application/octet-stream`, takže si ho prohlížeč stáhne místo vykreslení.
 * Nic to nerozbije: ERP zobrazuje logo jako odkaz ke stažení, ne jako obrázek,
 * a customizer si SVG vykresluje z lokálního souboru ještě před nahráním.
 */

export interface PovolenyTyp {
  /** Content-Type, se kterým se soubor uloží do R2. */
  mime: string;
  /** Výchozí přípona, když ji z názvu nejde převzít. */
  ext: string;
  /** Přípony, které smíme z původního názvu zachovat (tentýž formát uvnitř). */
  aliasy: string[];
}

const PODPISY: (PovolenyTyp & { test: (b: Buffer) => boolean })[] = [
  {
    mime: "image/png",
    ext: "png",
    aliasy: ["png"],
    test: (b) =>
      b.length > 8 &&
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  {
    mime: "image/jpeg",
    ext: "jpg",
    aliasy: ["jpg", "jpeg"],
    test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: "image/webp",
    ext: "webp",
    aliasy: ["webp"],
    test: (b) =>
      b.length > 12 &&
      b.toString("ascii", 0, 4) === "RIFF" &&
      b.toString("ascii", 8, 12) === "WEBP",
  },
  {
    // Novější Illustrator ukládá .ai jako PDF, proto je `ai` mezi aliasy —
    // grafik chce dostat soubor s příponou, jakou poslal.
    mime: "application/pdf",
    ext: "pdf",
    aliasy: ["pdf", "ai"],
    // Podle specifikace smí být %PDF- až po 1024 bajtech úvodního balastu.
    test: (b) => b.subarray(0, 1024).includes(Buffer.from("%PDF-", "ascii")),
  },
  {
    // PostScript: starší .ai i .eps. Binární DOS EPS má vlastní hlavičku.
    mime: "application/postscript",
    ext: "eps",
    aliasy: ["eps", "ai", "ps"],
    test: (b) =>
      (b.length > 11 && b.toString("ascii", 0, 11) === "%!PS-Adobe-") ||
      (b.length > 4 &&
        b[0] === 0xc5 && b[1] === 0xd0 && b[2] === 0xd3 && b[3] === 0xc6),
  },
  {
    // Až nakonec — je to text a nesmí přebít nic konkrétnějšího.
    // Ukládáme jako octet-stream, ať se nespustí případný skript uvnitř.
    mime: "application/octet-stream",
    ext: "svg",
    aliasy: ["svg"],
    test: (b) => {
      const zacatek = b.subarray(0, 1024).toString("utf8").trimStart();
      return zacatek.startsWith("<?xml") || zacatek.startsWith("<svg");
    },
  },
];

/** Pro chybové hlášky uživateli. */
export const POVOLENE_PRIPONY = "PNG, JPEG, WEBP, PDF, AI, EPS nebo SVG";

/**
 * Rozpozná typ z obsahu. Vrací `null`, když soubor není nic z povoleného —
 * volající pak musí odmítnout, ne uložit s výchozím typem.
 */
export function rozpoznatTyp(buf: Buffer): PovolenyTyp | null {
  for (const p of PODPISY) {
    if (p.test(buf)) return { mime: p.mime, ext: p.ext, aliasy: p.aliasy };
  }
  return null;
}

/** Je to skutečně rastrový obrázek (na náhledy z customizeru)? */
export function jeObrazek(typ: PovolenyTyp): boolean {
  return typ.mime.startsWith("image/");
}

/**
 * Přípona k uložení: původní, pokud odpovídá rozpoznanému formátu
 * (aby .ai zůstalo .ai), jinak ta odvozená z obsahu.
 */
export function priponaProUlozeni(nazev: string | undefined, typ: PovolenyTyp): string {
  const puvodni = (nazev ?? "").split(".").pop()?.toLowerCase() ?? "";
  return typ.aliasy.includes(puvodni) ? puvodni : typ.ext;
}

/** Bezpečný základ názvu souboru — bez cest, bez diakritiky, bez přípony. */
export function bezpecnyNazev(nazev: string | undefined, fallback: string): string {
  const bezPripony = (nazev ?? fallback).replace(/\.[^.]*$/, "");
  const ocisteny = bezPripony.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
  return ocisteny || fallback;
}
