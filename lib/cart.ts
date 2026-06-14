import type { ProductType, ServiceType, LogoPlacement } from "./pricing";

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
}

// Je položka merch? (kind, nebo PF- kód ze starých košíků / customizeru)
export function isMerch(item: CartItem): boolean {
  return item.kind === "merch" || !!item.catalogKod?.startsWith("PF-");
}

// Cena řádku merch (vč. DPH) = fixní cena × množství.
export function merchLineTotal(item: CartItem): number {
  return Math.round((item.merchUnitCena ?? item.catalogCena ?? 0) * item.quantity);
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
