import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { uploadToR2 } from "@/lib/r2";
import { hashIp, extractIp } from "@/lib/chat/ip-hash";

/**
 * POST /api/upload-design
 * Uloží návrh z customizeru: PNG náhled (povinné) + volitelně originál loga.
 * Nahraje do R2, zapíše řádek do `navrhy` (přes service_role).
 */

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 8 * 1024 * 1024;

function decodeDataUrl(dataUrl: string): Buffer {
  const base64 = dataUrl.replace(/^data:[^;]+;base64,/, "");
  return Buffer.from(base64, "base64");
}

export async function POST(req: NextRequest) {
  let body: {
    produkt_kod?: string;
    produkt_nazev?: string;
    barva?: string;
    typ_zpracovani?: string;
    umisteni?: string;
    nahled_base64?: string;
    logo_base64?: string;
    logo_typ?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatné tělo požadavku." }, { status: 400 });
  }

  const { produkt_kod, nahled_base64 } = body;
  if (!produkt_kod || !nahled_base64) {
    return NextResponse.json(
      { error: "Chybí produkt_kod nebo náhled." },
      { status: 400 }
    );
  }

  const previewBuf = decodeDataUrl(nahled_base64);
  if (previewBuf.length === 0 || previewBuf.length > MAX_BYTES) {
    return NextResponse.json({ error: "Neplatný nebo příliš velký náhled." }, { status: 413 });
  }

  const ts = Date.now();
  const safeKod = String(produkt_kod).replace(/[^a-zA-Z0-9._-]/g, "_");

  try {
    const nahledUrl = await uploadToR2(
      `navrhy/${safeKod}_${ts}.png`,
      previewBuf,
      "image/png"
    );

    let logoUrl: string | null = null;
    if (body.logo_base64) {
      const logoBuf = decodeDataUrl(body.logo_base64);
      if (logoBuf.length > 0 && logoBuf.length <= MAX_BYTES) {
        const typ = body.logo_typ ?? "image/png";
        const ext = typ.includes("svg")
          ? "svg"
          : typ.includes("jpeg") || typ.includes("jpg")
            ? "jpg"
            : "png";
        logoUrl = await uploadToR2(
          `navrhy/loga/${safeKod}_${ts}.${ext}`,
          logoBuf,
          typ
        );
      }
    }

    const supabase = getSupabaseAdmin();
    const ipHash = hashIp(extractIp(req));
    const { data, error } = await supabase
      .from("navrhy")
      .insert({
        produkt_kod,
        produkt_nazev: body.produkt_nazev ?? null,
        barva: body.barva ?? null,
        typ_zpracovani: body.typ_zpracovani ?? "potisk",
        umisteni: body.umisteni ?? null,
        nahled_url: nahledUrl,
        logo_url: logoUrl,
        ip_hash: ipHash,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      id: data.id,
      nahled_url: nahledUrl,
      logo_url: logoUrl,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chyba při ukládání návrhu.";
    console.error("[upload-design]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
