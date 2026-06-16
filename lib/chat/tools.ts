/**
 * Definice tool use pro Claude chat asistenta.
 *
 * Čtyři tools:
 *   1) search_products      — hybridní search v katalogu
 *   2) get_product_detail   — plný detail konkrétního produktu
 *   3) update_session       — průběžně ukládá strukturovaná data z konverzace
 *   4) submit_inquiry       — finální odeslání poptávky do DB
 */

import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { embedQuery } from "@/lib/chat/embed-query";

// ============================================================
// SCHEMATA — tohle se posílá Claude API jako `tools`
// ============================================================

export const CHAT_TOOLS: Tool[] = [
  {
    name: "search_products",
    description:
      "Prohledá katalog 3 606 produktů hybridním searchem (vektor + trigram + fulltext). Vrací top N produktů seřazených podle relevance. POVINNÉ volání, když zákazník zmíní konkrétní produkt nebo vlastnost — nikdy neimprovizuj ceny z hlavy.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Volnotextový dotaz (česky). Např. 'tričko bavlna černá', 'mikina s kapucí', 'softshell bunda'. Může být prázdný, pokud máš jen filtry.",
        },
        filter_kategorie: {
          type: "string",
          enum: [
            "Trička",
            "Polokošile",
            "Mikiny & Svetry",
            "Bundy & Vesty",
            "Košile & Halenky",
            "Čepice & Kšiltovky",
            "Tašky & Batohy",
            "Pracovní oděvy",
            "Ručníky & Textil",
            "Doplňky",
          ],
          description: "Přesná kategorie dle číselníku.",
        },
        filter_znacka: {
          type: "string",
          description:
            "Název značky (Kariban, B&C, Stedman, James & Nicholson...). Substring match.",
        },
        filter_min_cena: {
          type: "number",
          description: "Minimální doporučená prodejní cena s DPH za kus.",
        },
        filter_max_cena: {
          type: "number",
          description: "Maximální doporučená prodejní cena s DPH za kus.",
        },
        filter_min_gsm: {
          type: "number",
          description: "Minimální gramáž (g/m²).",
        },
        filter_max_gsm: {
          type: "number",
          description: "Maximální gramáž (g/m²).",
        },
        only_in_stock: {
          type: "boolean",
          description: "Default true. Vrátit jen produkty, které mají aspoň 1 ks skladem.",
        },
        match_limit: {
          type: "number",
          description: "Kolik top výsledků vrátit (default 5, max 10).",
        },
      },
      required: [],
    },
  },
  {
    name: "get_product_detail",
    description:
      "Vrátí kompletní detail konkrétního produktu podle katalogového kódu — včetně cen pro 1/10/100/500/1000 ks. Použij, když zákazník zná konkrétní množství a ty potřebuješ přesnější cenu než z search_products.",
    input_schema: {
      type: "object",
      properties: {
        kod: {
          type: "string",
          description: "Katalogový kód produktu, např. '01.001T' nebo 'K371'.",
        },
      },
      required: ["kod"],
    },
  },
  {
    name: "update_session",
    description:
      "Ulož strukturovaná data, která jsi z konverzace vytáhl. VOLAT PO KAŽDÉ ZPRÁVĚ uživatele, která přidává novou informaci. Neukládej kontakt (jméno/e-mail/telefon) zde — ten jde až do submit_inquiry.",
    input_schema: {
      type: "object",
      properties: {
        typ_produktu: {
          type: "string",
          description: "Např. 'tričko', 'mikina', 'polokošile', 'kšiltovka'...",
        },
        mnozstvi: {
          type: "number",
          description: "Celkové množství kusů.",
        },
        barvy: {
          type: "string",
          description: "Textový popis barev, např. 'černá', 'modrá + červená', 'mix'.",
        },
        velikosti: {
          type: "string",
          description: "Např. 'S-XXL dospělé', 'mix 20×M, 15×L, 10×XL', 'dětské'.",
        },
        zdobeni_typ: {
          type: "string",
          enum: ["potisk", "vysivka", "bez", "jine"],
          description: "Typ zdobení.",
        },
        zdobeni_velikost: {
          type: "string",
          enum: ["male", "stredni", "velke"],
          description:
            "Velikost loga: malé (do 10×10), střední (do 20×20), velké (do 30×40).",
        },
        zdobeni_umisteni: {
          type: "string",
          description: "Např. 'prsa', 'záda', 'rukáv', 'prsa + záda'.",
        },
        termin: {
          type: "string",
          description: "Datum nebo lhůta kdy zákazník potřebuje dodání. Např. '2026-05-15' nebo 'do 3 týdnů'.",
        },
        ucel: {
          type: "string",
          description: "Proč to potřebuje — 'firemní merch', 'tým', 'event', 'svatba'...",
        },
        poznamka: {
          type: "string",
          description: "Další poznatky z konverzace, které nespadají do ostatních polí.",
        },
      },
      required: [],
    },
  },
  {
    name: "submit_inquiry",
    description:
      "Odešle finální poptávku do systému. TEPRVE až zákazník dá kontakt (jméno, e-mail) a explicitně souhlasí s odesláním nezávazné poptávky. GDPR souhlas se kontroluje na úrovni UI, ne zde.",
    input_schema: {
      type: "object",
      properties: {
        jmeno: { type: "string" },
        prijmeni: { type: "string" },
        email: { type: "string" },
        telefon: { type: "string" },
        firma: { type: "string", description: "Nepovinné — název firmy." },
        souhrn: {
          type: "string",
          description:
            "Krátký textový souhrn poptávky, který se zobrazí v mailu a v CRM — 'Co zákazník chce' v 2-3 větách.",
        },
        produkt_kod: {
          type: "string",
          description:
            "Nepovinné, ale DOPORUČENÉ: katalogový kód hlavního doporučeného produktu (z search_products, např. '01.U01W'). Předvyplní položku poptávky a v ERP se automaticky napáruje nákupní cena z ceníku.",
        },
        cena_ks_orientacni: {
          type: "number",
          description:
            "Nepovinné, ale DOPORUČENÉ: orientační prodejní cena za kus VČ. DPH (střed rozmezí, které jsi zákazníkovi řekl). Předvyplní kalkulaci v ERP, ať se rychle připraví nabídka.",
        },
      },
      required: ["jmeno", "email", "souhrn"],
    },
  },
  {
    name: "navrhni_moznosti",
    description:
      "Zobrazí zákazníkovi 2–6 klikacích rychlých odpovědí (chips) k otázce, kterou se právě ptáš. POVINNĚ použij vždy, když se ptáš na parametr s typickými volbami: účel použití, rozpočet (3 cenové hladiny), počet kusů, typ zdobení (potisk/výšivka/bez), velikost loga, barvy, velikosti, termín. Volej ZÁROVEŇ s textem otázky (text napiš normálně). Zákazník může místo kliknutí napsat i vlastní odpověď — možnosti tedy nemusí být vyčerpávající, slouží k urychlení.",
    input_schema: {
      type: "object",
      properties: {
        moznosti: {
          type: "array",
          items: { type: "string" },
          description:
            "2–6 krátkých konkrétních možností (ideálně do ~30 znaků). Např. rozpočet: ['do 200 Kč/ks','200–400 Kč/ks','400 Kč+ /ks']; zdobení: ['Potisk','Výšivka','Bez potisku']; účel: ['Firemní akce','Merch/dárky','Pracovní oděv','Tým/sport'].",
        },
      },
      required: ["moznosti"],
    },
  },
  {
    name: "zobraz_produkty",
    description:
      "Zobrazí zákazníkovi vizuální kolotoč produktových karet (náhled, název, cena vč. DPH, proklik na produkt). POVINNĚ použij, kdykoliv konkrétně doporučuješ produkty (typicky ve fázi kalkulace) — místo dlouhého textového výčtu. Předej 2–4 katalogové kódy z výsledků search_products. V textu pak produkty zmiň jen krátce; detaily uvidí zákazník na kartách.",
    input_schema: {
      type: "object",
      properties: {
        kody: {
          type: "array",
          items: { type: "string" },
          description: "2–4 katalogové kódy produktů k zobrazení (přesně jak je vrátil search_products, např. '01.U01W').",
        },
      },
      required: ["kody"],
    },
  },
];

// ============================================================
// IMPLEMENTACE — volají se z /api/chat při tool_use eventu
// ============================================================

export interface ToolContext {
  sessionId: string;
  ipHash?: string;
}

export interface ToolResult {
  tool_name: string;
  result: unknown;
  error?: string;
}

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case "search_products":
        return { tool_name: toolName, result: await toolSearchProducts(input) };
      case "get_product_detail":
        return { tool_name: toolName, result: await toolGetProductDetail(input) };
      case "update_session":
        return {
          tool_name: toolName,
          result: await toolUpdateSession(input, ctx),
        };
      case "submit_inquiry":
        return {
          tool_name: toolName,
          result: await toolSubmitInquiry(input, ctx),
        };
      case "navrhni_moznosti":
        // Žádný side-effect — možnosti se zákazníkovi doručí jako SSE event z /api/chat.
        return { tool_name: toolName, result: { ok: true, zobrazeno: input.moznosti ?? [] } };
      case "zobraz_produkty":
        return { tool_name: toolName, result: await toolZobrazProdukty(input) };
      default:
        return {
          tool_name: toolName,
          result: null,
          error: `Unknown tool: ${toolName}`,
        };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[tool:${toolName}] error:`, msg);
    return { tool_name: toolName, result: null, error: msg };
  }
}

// ------------------------------------------------------------
// 1) search_products
// ------------------------------------------------------------

async function toolSearchProducts(input: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const query = String(input.query || "").trim();

  // Pokud máme query, zkusíme embeddings (zrychlí sémantický match).
  // Pokud OpenAI selže, pokračujeme bez embeddingu — trigram/FTS to zvládne.
  let embedding: number[] | null = null;
  if (query) {
    try {
      embedding = await embedQuery(query);
    } catch (err) {
      console.warn("[search_products] embedQuery fallback:", err);
    }
  }

  const { data, error } = await supabase.rpc("match_produkty", {
    query_text: query,
    query_embedding: embedding as unknown as string | null, // pgvector v Supabase akceptuje string/array
    filter_kategorie: input.filter_kategorie ?? null,
    filter_znacka: input.filter_znacka ?? null,
    filter_min_cena: input.filter_min_cena ?? null,
    filter_max_cena: input.filter_max_cena ?? null,
    filter_min_gsm: input.filter_min_gsm ?? null,
    filter_max_gsm: input.filter_max_gsm ?? null,
    only_in_stock: input.only_in_stock ?? true,
    match_limit: Math.min(Number(input.match_limit ?? 5), 10),
  });

  if (error) throw new Error(`search_products RPC: ${error.message}`);

  // Kompaktní shape pro Claude (~80 tokenů/produkt místo 500+)
  return {
    pocet: data?.length ?? 0,
    poznamka_ceny: "Ceny jsou orientační prodejní VČETNĚ DPH za kus. Vždy to zákazníkovi takto uveď.",
    produkty: (data ?? []).map((p: Record<string, unknown>) => ({
      kod: p.kod,
      nazev: p.nazev,
      znacka: p.znacka,
      kategorie: p.kategorie,
      gsm: p.gsm ? `${p.gsm} g/m²` : null,
      cena_od: p.cena_od ? `od ${p.cena_od} Kč vč. DPH (při 1000+ ks)` : null,
      material: p.material,
      barev: p.barvy_pocet,
      velikosti: (p.velikosti_skladem as string[] | null)?.join(", "),
      skladem: p.skladem_celkem,
    })),
  };
}

// ------------------------------------------------------------
// 2) get_product_detail
// ------------------------------------------------------------

async function toolGetProductDetail(input: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  const kod = String(input.kod || "").trim();
  if (!kod) throw new Error("Chybí kód produktu.");

  const { data, error } = await supabase.rpc("get_product_detail", {
    product_kod: kod,
  });

  if (error) throw new Error(`get_product_detail RPC: ${error.message}`);
  if (!data || data.length === 0) {
    return { nalezeno: false, zprava: `Produkt ${kod} nenalezen.` };
  }

  const p = data[0];
  return {
    nalezeno: true,
    kod: p.kod,
    nazev: p.nazev,
    znacka: p.znacka,
    kategorie: p.kategorie,
    gsm: p.gsm,
    material: p.material,
    popis: p.popis,
    poznamka_ceny: "Ceny jsou orientační prodejní VČETNĚ DPH za kus. Uváděj je vždy jako 'vč. DPH'.",
    ceny: {
      "1 ks": p.cena_1ks ? `${p.cena_1ks} Kč` : null,
      "10 ks": p.cena_10ks ? `${p.cena_10ks} Kč` : null,
      "100 ks": p.cena_100ks ? `${p.cena_100ks} Kč` : null,
      "500 ks": p.cena_500ks ? `${p.cena_500ks} Kč` : null,
      "1000 ks": p.cena_1000ks ? `${p.cena_1000ks} Kč` : null,
    },
    barvy: p.barvy,
    barvy_pocet: p.barvy_pocet,
    velikosti_skladem: p.velikosti_skladem,
    skladem_celkem: p.skladem_celkem,
  };
}

// ------------------------------------------------------------
// 3) update_session — merge do chat_sessions.extracted
// ------------------------------------------------------------

async function toolUpdateSession(
  input: Record<string, unknown>,
  ctx: ToolContext
) {
  const supabase = getSupabaseAdmin();

  // Načti aktuální extracted, zmerguj s novými daty
  const { data: current } = await supabase
    .from("chat_sessions")
    .select("extracted")
    .eq("id", ctx.sessionId)
    .single();

  const mergedExtracted = {
    ...(current?.extracted ?? {}),
    ...Object.fromEntries(
      Object.entries(input).filter(([, v]) => v !== null && v !== undefined && v !== "")
    ),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("chat_sessions")
    .update({
      extracted: mergedExtracted,
      last_message_at: new Date().toISOString(),
    })
    .eq("id", ctx.sessionId);

  if (error) throw new Error(`update_session: ${error.message}`);

  return { ok: true, extracted: mergedExtracted };
}

// ------------------------------------------------------------
// 4) submit_inquiry — zápis do tabulky `poptavky` + event
// ------------------------------------------------------------

async function toolSubmitInquiry(
  input: Record<string, unknown>,
  ctx: ToolContext
) {
  const supabase = getSupabaseAdmin();

  // Načti session data pro extracted
  const { data: session } = await supabase
    .from("chat_sessions")
    .select("extracted, gdpr_consent_at")
    .eq("id", ctx.sessionId)
    .single();

  // GDPR souhlas musí být zaznamenaný UI předem
  if (!session?.gdpr_consent_at) {
    return {
      ok: false,
      zprava:
        "Pro odeslání poptávky je potřeba souhlas se zpracováním osobních údajů. Prosím zaškrtněte souhlas v UI.",
    };
  }

  const extracted = session.extracted ?? {};

  // Mapuj na poptavky schéma
  const typMap: Record<string, string> = {
    tričko: "tricko",
    trika: "tricko",
    polokošile: "polokosile",
    polokosile: "polokosile",
    mikina: "mikina",
    bunda: "bunda",
    čepice: "cepice",
    cepice: "cepice",
    kšiltovka: "cepice",
    taška: "taska",
    taska: "taska",
  };
  const typProduktu =
    typMap[String(extracted.typ_produktu ?? "").toLowerCase()] ?? "tricko";

  const zpracovMap: Record<string, string> = {
    potisk: "print",
    vysivka: "embroidery",
    bez: "clean",
  };
  const typZpracovani =
    zpracovMap[String(extracted.zdobeni_typ ?? "")] ?? "clean";

  const mnozstvi = Math.max(1, Math.min(5000, Number(extracted.mnozstvi ?? 1)));

  // Orientační cena (vč. DPH) + kód produktu z konverzace → předvyplní kalkulaci v ERP
  const cenaKs =
    Number(input.cena_ks_orientacni) > 0 ? Math.round(Number(input.cena_ks_orientacni)) : null;
  const cenaCelkem = cenaKs != null ? cenaKs * mnozstvi : null;
  const produktKod = input.produkt_kod ? String(input.produkt_kod).trim() : null;
  // Logo, které zákazník případně přiložil v chatu (uloženo do extracted.logo_url přes UI)
  const logoUrl = (extracted as { logo_url?: string }).logo_url ?? null;

  // Čistá poznámka (žádný JSON dump) — strukturovaná data jdou do extracted_from_chat + poptavka_polozky
  const cistaPoznamka = [
    input.souhrn,
    input.firma ? `Firma: ${input.firma}` : null,
    "(Poptávka vznikla přes chat s Michalem.)",
  ]
    .filter(Boolean)
    .join("\n\n");

  const { data: inquiry, error } = await supabase
    .from("poptavky")
    .insert({
      jmeno: input.jmeno,
      prijmeni: input.prijmeni ?? "",
      email: input.email,
      telefon: input.telefon ?? "",
      typ_produktu: typProduktu,
      typ_zpracovani: typZpracovani,
      mnozstvi,
      dalsi_info: cistaPoznamka,
      logo_soubor_url: logoUrl,
      logo_soubor_nazev: logoUrl ? "Logo z chatu" : null,
      odhadovana_cena_ks: cenaKs,
      odhadovana_cena_celkem: cenaCelkem,
      chat_session_id: ctx.sessionId,
      extracted_from_chat: extracted as object,
      stav: "nova",
    })
    .select("id")
    .single();

  if (error) throw new Error(`submit_inquiry insert: ${error.message}`);

  // Strukturovaná položka — aby poptávka z chatu vypadala v ERP stejně jako z formuláře,
  // s orientační cenou + kódem produktu (předvyplní kalkulaci a převod na zakázku).
  await supabase.from("poptavka_polozky").insert({
    poptavka_id: inquiry!.id,
    poradi: 0,
    kind: "textil",
    katalogove_cislo: produktKod,
    nazev: String(extracted.typ_produktu || input.souhrn || "Poptávka z chatu").slice(0, 120),
    kategorie: null,
    typ_zpracovani: typZpracovani,
    barva: extracted.barvy ? String(extracted.barvy).slice(0, 120) : null,
    velikost: extracted.velikosti ? String(extracted.velikosti).slice(0, 120) : null,
    mnozstvi,
    cena_ks_s_dph: cenaKs,
    cena_celkem_s_dph: cenaCelkem,
    nahled_url: logoUrl,
  });

  // Označ session jako completed + zapiš analytics event
  await supabase
    .from("chat_sessions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", ctx.sessionId);

  await supabase.from("chat_events").insert({
    session_id: ctx.sessionId,
    event_type: "inquiry_submitted",
    payload: { inquiry_id: inquiry?.id, email: input.email },
  });

  // Notifikace (Telegram staff + potvrzovací e-mail zákazníkovi) — stejně jako z formuláře
  try {
    const notifyUrl =
      process.env.ERP_NOTIFY_URL || "https://textil-evidence.vercel.app/api/poptavky/notify";
    const secret = process.env.NOTIFY_SECRET;
    if (secret && inquiry?.id) {
      await fetch(notifyUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-notify-secret": secret },
        body: JSON.stringify({ poptavka_id: inquiry.id }),
      });
    }
  } catch (e) {
    console.warn("[submit_inquiry] notify failed:", e);
  }

  return {
    ok: true,
    inquiry_id: inquiry?.id,
    zprava:
      "Poptávka byla uložena. Ozveme se do 1 hodiny s finální nabídkou na zadaný e-mail.",
  };
}

// ------------------------------------------------------------
// 6) zobraz_produkty — kolotoč karet (náhled + cena vč. DPH + proklik)
// ------------------------------------------------------------

export interface ProduktKarta {
  kod: string;
  nazev: string;
  cena: string | null;
  obrazek_url: string | null;
  url: string;
}

async function toolZobrazProdukty(input: Record<string, unknown>) {
  const kody = (Array.isArray(input.kody) ? input.kody : [])
    .map((k) => String(k).trim())
    .filter(Boolean)
    .slice(0, 6);
  if (kody.length === 0) return { ok: false, produkty: [] as ProduktKarta[] };

  const supabase = getSupabaseAdmin();
  const produkty: ProduktKarta[] = [];

  const textilKody = kody.filter((k) => !k.startsWith("PF-"));
  const merchKody = kody.filter((k) => k.startsWith("PF-"));

  if (textilKody.length) {
    const { data } = await supabase
      .from("produkty_katalog_flat")
      .select("kod, nazev, cena_od, obrazek_url")
      .in("kod", textilKody);
    for (const p of (data ?? []) as Record<string, unknown>[]) {
      produkty.push({
        kod: String(p.kod),
        nazev: String(p.nazev),
        cena: p.cena_od != null ? `od ${Math.round(Number(p.cena_od))} Kč vč. DPH` : null,
        obrazek_url: (p.obrazek_url as string) ?? null,
        url: `/katalog/${encodeURIComponent(String(p.kod))}`,
      });
    }
  }

  if (merchKody.length) {
    const { data } = await supabase
      .from("printify_produkty")
      .select("kod, nazev, obrazek_url, min_cena")
      .in("kod", merchKody)
      .eq("visible", true);
    for (const p of (data ?? []) as Record<string, unknown>[]) {
      produkty.push({
        kod: String(p.kod),
        nazev: String(p.nazev),
        cena: p.min_cena != null ? `od ${Math.round(Number(p.min_cena))} Kč vč. DPH` : null,
        obrazek_url: (p.obrazek_url as string) ?? null,
        url: `/merch/${encodeURIComponent(String(p.kod))}`,
      });
    }
  }

  // zachovej pořadí dle vstupních kódů
  const order = new Map(kody.map((k, i) => [k, i]));
  produkty.sort((a, b) => (order.get(a.kod) ?? 99) - (order.get(b.kod) ?? 99));

  return { ok: true, produkty };
}
