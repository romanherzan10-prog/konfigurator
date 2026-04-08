/* ── Nastavení z DB ── */

export interface KonfiguratorNastaveni {
  // Ceny produktů
  cena_tricko: number;
  cena_polokosile: number;
  cena_mikina: number;
  cena_bunda: number;
  cena_cepice: number;
  cena_taska: number;
  // 3 velikosti loga — potisk
  potisk_male: number;
  potisk_stredni: number;
  potisk_velke: number;
  // 3 velikosti loga — výšivka
  vysivka_male: number;
  vysivka_stredni: number;
  vysivka_velke: number;
  // Názvy velikostí
  nazev_logo_male: string;
  nazev_logo_stredni: string;
  nazev_logo_velke: string;
  // Množstevní slevy
  sleva_10ks: number;
  sleva_20ks: number;
  sleva_40ks: number;
  sleva_80ks: number;
  sleva_150ks: number;
  sleva_300ks: number;
  // Obecné
  minimalni_cena_ks: number;
  // Texty
  nadpis: string;
  podnadpis: string;
  disclaimer: string;
}

export const DEFAULT_CONFIG: KonfiguratorNastaveni = {
  cena_tricko: 120,
  cena_polokosile: 220,
  cena_mikina: 420,
  cena_bunda: 890,
  cena_cepice: 95,
  cena_taska: 140,
  potisk_male: 35,
  potisk_stredni: 55,
  potisk_velke: 85,
  vysivka_male: 55,
  vysivka_stredni: 85,
  vysivka_velke: 120,
  nazev_logo_male: "Malé (do 10×10 cm)",
  nazev_logo_stredni: "Střední (do 20×20 cm)",
  nazev_logo_velke: "Velké (do 30×40 cm)",
  sleva_10ks: 0.05,
  sleva_20ks: 0.08,
  sleva_40ks: 0.12,
  sleva_80ks: 0.17,
  sleva_150ks: 0.22,
  sleva_300ks: 0.28,
  minimalni_cena_ks: 69,
  nadpis: "Konfigurátor reklamního textilu",
  podnadpis: "Vyberte produkt, způsob zpracování a zadejte parametry. Cenu vidíte ihned v kalkulaci vpravo.",
  disclaimer: "Orientační kalkulace. Konečná cena se může lišit dle složitosti grafiky a zvoleného materiálu. Po odeslání poptávky vám zašleme přesnou cenovou nabídku.",
};

/* ── Typy ── */

export type ProductType = "tricko" | "polokosile" | "mikina" | "bunda" | "cepice" | "taska";
export type ServiceType = "print" | "embroidery" | "clean";
export type LogoSize = "male" | "stredni" | "velke";

export const LOCATION_OPTIONS = [
  { value: "leve-prso", label: "Levé prso" },
  { value: "prave-prso", label: "Pravé prso" },
  { value: "zada", label: "Záda" },
  { value: "rukav", label: "Rukáv" },
  { value: "predni-stred", label: "Přední střed" },
  { value: "vlastni-umisteni", label: "Vlastní umístění" },
];

export interface LogoPlacement {
  location: string;
  size: LogoSize;
}

export interface Estimate {
  unitPrice: number;
  totalPrice: number;
  unitPriceWithDph: number;
  totalPriceWithDph: number;
  baseProductPrice: number;
  zpracovaniPrice: number;
  quantityDiscount: number;
  quantityDiscountPercent: number;
}

/* ── Dynamické generátory ── */

export function getProductTypes(config: KonfiguratorNastaveni) {
  return {
    tricko: { label: "Tričko", basePrice: config.cena_tricko, hint: `od ${config.cena_tricko} Kč` },
    polokosile: { label: "Polokošile", basePrice: config.cena_polokosile, hint: `od ${config.cena_polokosile} Kč` },
    mikina: { label: "Mikina", basePrice: config.cena_mikina, hint: `od ${config.cena_mikina} Kč` },
    bunda: { label: "Softshell bunda", basePrice: config.cena_bunda, hint: `od ${config.cena_bunda} Kč` },
    cepice: { label: "Čepice", basePrice: config.cena_cepice, hint: `od ${config.cena_cepice} Kč` },
    taska: { label: "Taška / vak", basePrice: config.cena_taska, hint: `od ${config.cena_taska} Kč` },
  };
}

export function getLogoSizes(config: KonfiguratorNastaveni, serviceType: ServiceType) {
  if (serviceType === "clean") return [];
  const isPrint = serviceType === "print";
  return [
    { key: "male" as LogoSize, label: config.nazev_logo_male, price: isPrint ? config.potisk_male : config.vysivka_male },
    { key: "stredni" as LogoSize, label: config.nazev_logo_stredni, price: isPrint ? config.potisk_stredni : config.vysivka_stredni },
    { key: "velke" as LogoSize, label: config.nazev_logo_velke, price: isPrint ? config.potisk_velke : config.vysivka_velke },
  ];
}

/* ── Výpočty ── */

export function calculateQuantityDiscount(
  quantity: number,
  config: KonfiguratorNastaveni = DEFAULT_CONFIG
): number {
  if (quantity >= 300) return config.sleva_300ks;
  if (quantity >= 150) return config.sleva_150ks;
  if (quantity >= 80) return config.sleva_80ks;
  if (quantity >= 40) return config.sleva_40ks;
  if (quantity >= 20) return config.sleva_20ks;
  if (quantity >= 10) return config.sleva_10ks;
  return 0;
}

export function calculateZpracovaniPrice(
  placements: LogoPlacement[],
  serviceType: ServiceType,
  config: KonfiguratorNastaveni = DEFAULT_CONFIG
): number {
  if (serviceType === "clean" || placements.length === 0) return 0;
  const isPrint = serviceType === "print";
  const priceMap: Record<LogoSize, number> = {
    male: isPrint ? config.potisk_male : config.vysivka_male,
    stredni: isPrint ? config.potisk_stredni : config.vysivka_stredni,
    velke: isPrint ? config.potisk_velke : config.vysivka_velke,
  };
  return placements.reduce((sum, p) => sum + (priceMap[p.size] ?? 0), 0);
}

export function calculateEstimate(
  productType: ProductType,
  serviceType: ServiceType,
  quantity: number,
  placements: LogoPlacement[],
  config: KonfiguratorNastaveni = DEFAULT_CONFIG
): Estimate {
  const productTypes = getProductTypes(config);
  const baseProductPrice = productTypes[productType].basePrice;
  const zpracovaniPrice = calculateZpracovaniPrice(placements, serviceType, config);

  const subtotal = baseProductPrice + zpracovaniPrice;
  const discountPercent = calculateQuantityDiscount(quantity, config);
  const discountAmount = Math.round(subtotal * discountPercent);

  const unitPrice = Math.max(config.minimalni_cena_ks, subtotal - discountAmount);
  const totalPrice = unitPrice * quantity;

  const DPH = 1.21;

  return {
    unitPrice,
    totalPrice,
    unitPriceWithDph: Math.round(unitPrice * DPH),
    totalPriceWithDph: Math.round(totalPrice * DPH),
    baseProductPrice,
    zpracovaniPrice,
    quantityDiscount: discountAmount,
    quantityDiscountPercent: discountPercent,
  };
}

export function formatPrice(value: number): string {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(value);
}
