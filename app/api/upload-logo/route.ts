import { NextRequest, NextResponse } from "next/server";
import { uploadToR2 } from "@/lib/r2";
import {
  rozpoznatTyp,
  bezpecnyNazev,
  priponaProUlozeni,
  POVOLENE_PRIPONY,
} from "@/lib/upload-guard";

/**
 * POST /api/upload-logo
 * Nahraje logo/grafiku z košíku (Podklady) do R2. Vrací veřejnou URL + název.
 * Tělo: { nazev: string, typ: string, data_base64: string }
 *
 * Routa je veřejná (zákazník nahrává podklady dřív, než má účet), takže typ
 * souboru se určuje z obsahu, ne z toho, co pošle klient — viz lib/upload-guard.
 */

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 12 * 1024 * 1024;

function decodeDataUrl(dataUrl: string): Buffer {
  const base64 = dataUrl.replace(/^data:[^;]+;base64,/, "");
  return Buffer.from(base64, "base64");
}

export async function POST(req: NextRequest) {
  let body: { nazev?: string; typ?: string; data_base64?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatné tělo požadavku." }, { status: 400 });
  }

  const { nazev, data_base64 } = body;
  if (!data_base64) {
    return NextResponse.json({ error: "Chybí soubor." }, { status: 400 });
  }

  const buf = decodeDataUrl(data_base64);
  if (buf.length === 0 || buf.length > MAX_BYTES) {
    return NextResponse.json({ error: "Neplatný nebo příliš velký soubor." }, { status: 413 });
  }

  // Typ z magic bytes. Přípona z názvu ani hlavička od klienta se nepoužívají —
  // dřív šlo přejmenováním nahrát cokoliv.
  const typ = rozpoznatTyp(buf);
  if (!typ) {
    return NextResponse.json(
      { error: `Nepodporovaný formát souboru. Pošlete prosím ${POVOLENE_PRIPONY}.` },
      { status: 415 }
    );
  }

  const ts = Date.now();
  const safeName = bezpecnyNazev(nazev, "logo");
  const ext = priponaProUlozeni(nazev, typ);

  try {
    const url = await uploadToR2(
      `poptavky/loga/${ts}_${safeName}.${ext}`,
      buf,
      typ.mime
    );
    return NextResponse.json({ url, nazev: nazev ?? `logo.${ext}` });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chyba při nahrávání.";
    console.error("[upload-logo]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
