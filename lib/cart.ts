import type { ProductType, ServiceType, LogoPlacement } from "./pricing";
import {
  prazdnyRozpis,
  rozpisDoTextu,
  slucRozpis,
  type JinaVelikost,
  type Rozpis,
} from "./velikosti";

// "textil" = konfigurovatelný textil s cenotvorbou (calculateEstimate);
// "merch" = hotový produkt z Printify s fixní cenou za variantu.
export type CartKind = "textil" | "merch";

export interface CartItem {
  id: string;
  kind?: CartKind; // undefined => textil (zpětná kompatibilita se starým košíkem)
  // Z katalogu (null pro generické produkty)
  catalogKod: string | null;
  catalogNazev: string | null;
  catalogCena: number | null; // doporučená cena bez DPH
  catalogBarva: string | null;
  catalogKategorie: string | null;
  // Konfigurace
  productType: ProductType;
  serviceType: ServiceType;
  quantity: number;
  placements: LogoPlacement[];
  // Náhled návrhu z customizeru (R2 URL) — pokud zákazník navrhl potisk
  nahledUrl?: string | null;
  // Merch (Printify) — fixní cena za kus, varianta barva/velikost
  merchUnitCena?: number | null; // CZK vč. DPH
  merchVelikost?: string | null;
  // Rozpis velikostí textilu (nepovinný). Staré košíky pole nemají → prázdný rozpis.
  rozpis?: Rozpis | null; // mřížka XS–3XL
  dalsiVelikosti?: string | null; // volný text „4XL 2, dětské 128: 5"
}

// Je položka merch? (kind, nebo PF- kód ze starých košíků / customizeru)
export function isMerch(item: CartItem): boolean {
  return item.kind === "merch" || !!item.catalogKod?.startsWith("PF-");
}

// Cena řádku merch (vč. DPH) = fixní cena × množství.
export function merchLineTotal(item: CartItem): number {
  return Math.round((item.merchUnitCena ?? item.catalogCena ?? 0) * item.quantity);
}

// ── Počet kusů a rozpis velikostí (textil) ──────────────────────────
// Ručně zadaný počet kusů textilu drží rozmezí MIN–MAX. Jakmile má položka
// rozpis velikostí, počet kusů = součet velikostí (může být i pod minimem —
// zákazník dostane jen upozornění).

export const MIN_KS_TEXTIL = 5;
export const MAX_KS_TEXTIL = 5000;

/** Má položka rozpis velikostí? Merch má vlastní variantu, čepice a tašky velikosti nemají. */
export function maVelikosti(item: CartItem): boolean {
  return !isMerch(item) && item.productType !== "cepice" && item.productType !== "taska";
}

export interface RozpisPolozky {
  /** Mřížka + standardní velikosti napsané do „Další velikosti". */
  rozpis: Rozpis;
  /** Velikosti mimo mřížku (4XL, 128, 5/6 …) z „Další velikosti". */
  jine: JinaVelikost[];
  celkem: number;
  /**
   * Text z „Další velikosti", který není velikostí s počtem („dámský střih",
   * „doplníme později") — jinak null. Posílá se dál, nesmí se ztratit.
   */
  nerozpoznano: string | null;
}

export function rozpisPolozky(item: CartItem): RozpisPolozky {
  if (!maVelikosti(item)) return { rozpis: prazdnyRozpis(), jine: [], celkem: 0, nerozpoznano: null };
  // slucRozpis bere z localStorage jen celá nezáporná čísla a „S 5" napsané
  // do dalších velikostí přičte do mřížky.
  const s = slucRozpis(item.rozpis, item.dalsiVelikosti);
  return { rozpis: s.rozpis, jine: s.jine, celkem: s.celkem, nerozpoznano: s.zbytek || null };
}

/** Počet kusů pro cenu i poptávku: součet velikostí, když je rozpis vyplněný, jinak zadaný počet. */
export function efektivniMnozstvi(item: CartItem): number {
  const soucet = rozpisPolozky(item).celkem;
  return soucet > 0 ? soucet : item.quantity;
}

/**
 * Srovná `quantity` s rozpisem (volat po každé změně textilní položky):
 * s rozpisem = součet velikostí, bez něj zůstane poslední počet (v rozmezí 5–5000).
 */
export function srovnejMnozstvi(item: CartItem): CartItem {
  if (isMerch(item)) return item;
  const soucet = rozpisPolozky(item).celkem;
  const rucne = Math.round(Number(item.quantity)) || MIN_KS_TEXTIL;
  const quantity = soucet > 0 ? soucet : Math.min(MAX_KS_TEXTIL, Math.max(MIN_KS_TEXTIL, rucne));
  return quantity === item.quantity ? item : { ...item, quantity };
}

/**
 * Hodnota `poptavka_polozky.velikost`: merch = zvolená varianta, textil = rozpis
 * „S:2, M:5, 4XL:1" (čte ho ERP přes parseRozpis). Text z „Další velikosti",
 * který není velikostí („dámský střih"), se připojí za „; " — ať se nic neztratí.
 */
export function velikostDoPoptavky(item: CartItem): string | null {
  if (isMerch(item)) return item.merchVelikost ?? null;
  const r = rozpisPolozky(item);
  const casti = [rozpisDoTextu(r.rozpis, r.jine), r.nerozpoznano].filter(Boolean);
  return casti.length > 0 ? casti.join("; ") : null;
}

const STORAGE_KEY = "loooku_cart";

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("cart-changed"));
}

export function clearCart() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("cart-changed"));
}

// Mapování kategorie z katalogu → typ produktu v konfigurátoru
const KATEGORIE_TO_TYPE: Record<string, ProductType> = {
  "Trička": "tricko",
  "Polokošile": "polokosile",
  "Mikiny & Svetry": "mikina",
  "Bundy & Vesty": "bunda",
  "Čepice & Kšiltovky": "cepice",
  "Tašky & Batohy": "taska",
};

export function kategorieToType(kat: string | null): ProductType {
  if (kat && KATEGORIE_TO_TYPE[kat]) return KATEGORIE_TO_TYPE[kat];
  return "tricko";
}

export function createCartItemFromCatalog(params: {
  kod: string;
  nazev: string;
  cena: number;
  barva: string | null;
  kategorie: string | null;
  serviceType?: ServiceType;
  nahledUrl?: string | null;
}): CartItem {
  return {
    id: generateId(),
    catalogKod: params.kod,
    catalogNazev: params.nazev,
    catalogCena: params.cena,
    catalogBarva: params.barva,
    catalogKategorie: params.kategorie,
    productType: kategorieToType(params.kategorie),
    serviceType: params.serviceType ?? "print",
    quantity: 25,
    placements: [{ location: "leve-prso", size: "male" as const }],
    nahledUrl: params.nahledUrl ?? null,
  };
}

export function createMerchCartItem(params: {
  kod: string;
  nazev: string;
  cena: number; // fixní cena za kus (CZK vč. DPH)
  barva?: string | null;
  velikost?: string | null;
  nahledUrl?: string | null;
}): CartItem {
  const hasPotisk = !!params.nahledUrl;
  return {
    id: generateId(),
    kind: "merch",
    catalogKod: params.kod,
    catalogNazev: params.nazev,
    catalogCena: params.cena,
    catalogBarva: params.barva ?? null,
    catalogKategorie: "Merch",
    productType: "tricko", // nepoužije se pro cenu merch
    serviceType: hasPotisk ? "print" : "clean",
    quantity: 1,
    placements: [],
    nahledUrl: params.nahledUrl ?? null,
    merchUnitCena: params.cena,
    merchVelikost: params.velikost ?? null,
  };
}

export function createEmptyCartItem(): CartItem {
  return {
    id: generateId(),
    catalogKod: null,
    catalogNazev: null,
    catalogCena: null,
    catalogBarva: null,
    catalogKategorie: null,
    productType: "tricko",
    serviceType: "print",
    quantity: 25,
    placements: [{ location: "leve-prso", size: "male" as const }],
  };
}
