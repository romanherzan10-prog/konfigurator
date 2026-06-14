import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { fetchAllProducts, mapProduct } from "@/lib/printify";

/**
 * POST /api/printify/sync
 * Stáhne produkty z Printify shopu a upsertne do printify_produkty.
 * Auth: Bearer CRON_SECRET (ruční trigger i Vercel Cron).
 */

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shopId = process.env.PRINTIFY_SHOP_ID;
  if (!shopId) {
    return NextResponse.json({ error: "Chybí PRINTIFY_SHOP_ID." }, { status: 500 });
  }

  try {
    const products = await fetchAllProducts(shopId);
    const rows = products.map((p) => ({
      ...mapProduct(p),
      synced_at: new Date().toISOString(),
    }));

    const supabase = getSupabaseAdmin();
    if (rows.length > 0) {
      const { error } = await supabase
        .from("printify_produkty")
        .upsert(rows, { onConflict: "printify_id" });
      if (error) throw new Error(error.message);
    }

    return NextResponse.json({ success: true, synced: rows.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Neznámá chyba";
    console.error("[printify/sync]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET = stejné jako POST (pro Vercel Cron, který volá GET)
export async function GET(req: NextRequest) {
  return POST(req);
}
