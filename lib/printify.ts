// ---------------------------------------------------------------------------
// Printify API klient — server-only. Token: PRINTIFY_API_TOKEN, shop: PRINTIFY_SHOP_ID.
// ---------------------------------------------------------------------------

const BASE = "https://api.printify.com/v1";

interface PrintifyOptionValue {
  id: number;
  title: string;
  colors?: string[];
}
interface PrintifyOption {
  name: string;
  type: string; // 'color' | 'size' | 'surface' | ...
  values: PrintifyOptionValue[];
}
interface PrintifyVariant {
  id: number;
  title: string;
  price: number; // v centech
  is_enabled: boolean;
  options: number[];
}
interface PrintifyImage {
  src: string;
  variant_ids: number[];
  is_default: boolean;
}
export interface PrintifyProduct {
  id: string;
  title: string;
  description: string;
  options: PrintifyOption[];
  variants: PrintifyVariant[];
  images: PrintifyImage[];
  visible: boolean;
  tags?: string[];
}

function headers(): Record<string, string> {
  const t = process.env.PRINTIFY_API_TOKEN;
  if (!t) throw new Error("Chybí PRINTIFY_API_TOKEN.");
  return { Authorization: `Bearer ${t}`, "User-Agent": "LOOOKU/1.0" };
}

export async function fetchAllProducts(shopId: string): Promise<PrintifyProduct[]> {
  const out: PrintifyProduct[] = [];
  let page = 1;
  while (page <= 20) {
    const res = await fetch(`${BASE}/shops/${shopId}/products.json?limit=50&page=${page}`, {
      headers: headers(),
    });
    if (!res.ok) throw new Error(`Printify products ${res.status}`);
    const j = (await res.json()) as { data?: PrintifyProduct[] };
    const data = j.data ?? [];
    out.push(...data);
    if (data.length < 50) break;
    page++;
  }
  return out;
}

export interface MappedPrintify {
  printify_id: string;
  kod: string;
  nazev: string;
  popis: string | null;
  obrazek_url: string | null;
  images: { src: string }[];
  barvy: { nazev: string; hex: string | null }[];
  velikosti: string[];
  variants: {
    id: number;
    nazev: string;
    cena: number;
    color: string | null;
    size: string | null;
  }[];
  min_cena: number | null;
  max_cena: number | null;
  mena: string;
  visible: boolean;
}

// Přepočet ceny z Printify (USD) na české maloobchodní CZK.
// PRINTIFY_USD_CZK = kurz, PRINTIFY_MARKUP = přirážka (Printify cena už je retail → default 1).
// Zaokrouhlení nahoru na celé desetikoruny pro hezké ceny.
function usdToCzk(usd: number): number {
  const rate = Number(process.env.PRINTIFY_USD_CZK) || 23.5;
  const markup = Number(process.env.PRINTIFY_MARKUP) || 1;
  const czk = usd * rate * markup;
  return Math.ceil(czk / 10) * 10;
}

export function mapProduct(p: PrintifyProduct): MappedPrintify {
  const colorOpt = p.options.find((o) => o.type === "color");
  const sizeOpt = p.options.find((o) => o.type === "size");

  const titleOf = (id: number): string => {
    for (const o of p.options) {
      const v = o.values.find((vv) => vv.id === id);
      if (v) return v.title;
    }
    return "";
  };

  const barvy = (colorOpt?.values ?? []).map((v) => ({
    nazev: v.title,
    hex: v.colors?.[0] ?? null,
  }));
  const velikosti = (sizeOpt?.values ?? []).map((v) => v.title);

  const enabled = p.variants.filter((v) => v.is_enabled);
  const variants = enabled.map((v) => {
    const colorId = colorOpt
      ? v.options.find((id) => colorOpt.values.some((cv) => cv.id === id))
      : undefined;
    const sizeId = sizeOpt
      ? v.options.find((id) => sizeOpt.values.some((sv) => sv.id === id))
      : undefined;
    return {
      id: v.id,
      nazev: v.title,
      cena: usdToCzk(Math.round(v.price) / 100),
      color: colorId ? titleOf(colorId) : null,
      size: sizeId ? titleOf(sizeId) : null,
    };
  });

  const ceny = variants.map((v) => v.cena);
  const defImg =
    p.images.find((i) => i.is_default)?.src ?? p.images[0]?.src ?? null;

  return {
    printify_id: String(p.id),
    kod: `PF-${p.id}`,
    nazev: p.title,
    popis: (p.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000) || null,
    obrazek_url: defImg,
    images: p.images.map((i) => ({ src: i.src })).slice(0, 10),
    barvy,
    velikosti,
    variants,
    min_cena: ceny.length ? Math.min(...ceny) : null,
    max_cena: ceny.length ? Math.max(...ceny) : null,
    mena: "CZK",
    visible: p.visible !== false,
  };
}
