import { NextRequest, NextResponse } from "next/server";
import { uploadToR2 } from "@/lib/r2";

/**
 * POST /api/upload-logo
 * Nahraje logo/grafiku z košíku (Podklady) do R2. Vrací veřejnou URL + název.
 * Tělo: { nazev: string, typ: string, data_base64: string }
 */

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 12 * 1024 * 1024;

function decodeDataUrl(dataUrl: string): Buffer {
  const base64 = dataUrl.replace(/^data:[^;]+;base64,/, "");
  return Buffer.from(base64, "base64");
}

function extFor(typ: string, nazev: string): string {
  const fromName = nazev.includes(".") ? nazev.split(".").pop()!.toLowerCase() : "";
  if (fromName && /^[a-z0-9]{1,5}$/.test(fromName)) return fromName;
  if (typ.includes("svg")) return "svg";
  if (typ.includes("pdf")) return "pdf";
  if (typ.includes("jpeg") || typ.includes("jpg")) return "jpg";
  return "png";
}

export async function POST(req: NextRequest) {
  let body: { nazev?: string; typ?: string; data_base64?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatné tělo požadavku." }, { status: 400 });
  }

  const { nazev, typ, data_base64 } = body;
  if (!data_base64) {
    return NextResponse.json({ error: "Chybí soubor." }, { status: 400 });
  }

  const buf = decodeDataUrl(data_base64);
  if (buf.length === 0 || buf.length > MAX_BYTES) {
    return NextResponse.json({ error: "Neplatný nebo příliš velký soubor." }, { status: 413 });
  }

  const ts = Date.now();
  const safeName = (nazev || "logo").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
  const ext = extFor(typ ?? "", nazev ?? "");

  try {
    const url = await uploadToR2(
      `poptavky/loga/${ts}_${safeName}`.replace(/\.[^.]*$/, "") + `.${ext}`,
      buf,
      typ || "application/octet-stream"
    );
    return NextResponse.json({ url, nazev: nazev ?? `logo.${ext}` });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chyba při nahrávání.";
    console.error("[upload-logo]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
