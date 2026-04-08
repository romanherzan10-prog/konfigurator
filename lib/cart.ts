import type { ProductType, ServiceType, LogoPlacement } from "./pricing";

export interface CartItem {
  id: string;
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
}

export function clearCart() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
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
}): CartItem {
  return {
    id: generateId(),
    catalogKod: params.kod,
    catalogNazev: params.nazev,
    catalogCena: params.cena,
    catalogBarva: params.barva,
    catalogKategorie: params.kategorie,
    productType: kategorieToType(params.kategorie),
    serviceType: "print",
    quantity: 25,
    placements: [{ location: "leve-prso", size: "male" as const }],
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
