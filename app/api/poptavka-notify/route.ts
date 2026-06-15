import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/poptavka-notify
 * Volá se z prohlížeče po úspěšném odeslání poptávky (fire-and-forget).
 * Server-to-server přepošle do ERP notify endpointu se sdíleným tajemstvím
 * (prohlížeč tajemství držet nemůže). ERP pošle Telegram + e-mail zákazníkovi.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ERP_URL =
  process.env.ERP_NOTIFY_URL || "https://textil-evidence.vercel.app/api/poptavky/notify";

export async function POST(req: NextRequest) {
  const { poptavka_id } = (await req.json().catch(() => ({}))) as { poptavka_id?: string };
  if (!poptavka_id) {
    return NextResponse.json({ ok: false, error: "Chybí poptavka_id" }, { status: 400 });
  }
  const secret = process.env.NOTIFY_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, skipped: "no_secret" });
  }
  try {
    const r = await fetch(ERP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-notify-secret": secret },
      body: JSON.stringify({ poptavka_id }),
    });
    return NextResponse.json({ ok: r.ok });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
