/**
 * GET /api/produkt-price/[kod]?barva=...
 *
 * Vrací VEŘEJNOU doporučenou cenu produktu (rozsah od–do), spočítanou
 * na serveru ze velkoobchodních cen. Klient nikdy neuvidí `cena_1000`
 * ani ostatní velkoobchodní ceny — jen výslednou prodejní cenu.
 *
 * Runtime: Node.js — používá service role klíč pro přístup k `ceniky`.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const MARZE = 2; // doporučená cena = VK1000 × 2

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ kod: string }> }
) {
  const { kod } = await params;
  const barvaParam = req.nextUrl.searchParams.get("barva")?.toLowerCase() || null;

  if (!kod || kod.length > 64) {
    return NextResponse.json({ error: "Neplatný kód." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("ceniky")
    .select("cena_1000, barva")
    .eq("katalogove_cislo", kod);

  if (error) {
    return NextResponse.json({ error: "DB error." }, { status: 500 });
  }

  const rows = (data ?? []) as Array<{ cena_1000: number | null; barva: string | null }>;

  const relevant = rows.filter(
    (c) => !c.barva || !barvaParam || c.barva.toLowerCase() === barvaParam
  );

  const ceny = relevant
    .map((c) => (c.cena_1000 != null && c.cena_1000 > 0 ? Math.round(c.cena_1000 * MARZE) : null))
    .filter((v): v is number => v != null);

  if (ceny.length === 0) {
    return NextResponse.json({ cenaOd: null, cenaDo: null });
  }

  const cenaOd = Math.min(...ceny);
  const cenaDo = ceny.length > 1 ? Math.max(...ceny) : null;

  return NextResponse.json({
    cenaOd,
    cenaDo: cenaDo === cenaOd ? null : cenaDo,
  });
}
