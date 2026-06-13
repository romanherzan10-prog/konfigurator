import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/moje-poptavky
 * Vrátí poptávky přihlášeného zákazníka (shoda dle e-mailu).
 * Ověří Supabase JWT z Authorization hlavičky, čte přes service_role
 * (poptavky.SELECT je jinak jen pro staff) → zákazník vidí jen svoje.
 */

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const authz = req.headers.get("authorization");
  const token = authz?.startsWith("Bearer ") ? authz.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // ověření tokenu → uživatel
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: authErr,
  } = await userClient.auth.getUser();

  if (authErr || !user?.email) {
    return NextResponse.json({ error: "Neplatná session" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from("poptavky")
    .select(
      "id, created_at, typ_produktu, typ_zpracovani, mnozstvi, stav, odhadovana_cena_celkem, logo_soubor_url, dalsi_info"
    )
    .ilike("email", user.email)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ email: user.email, poptavky: data ?? [] });
}
