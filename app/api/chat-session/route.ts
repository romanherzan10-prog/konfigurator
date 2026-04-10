/**
 * POST /api/chat-session        → vytvoří novou session, vrátí { sessionId }
 * PATCH /api/chat-session       → aktualizuje session (např. gdpr_consent_at)
 * GET /api/chat-session?id=...  → načte session (pro resume)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import crypto from "crypto";

export const runtime = "nodejs";

const SESSIONS_PER_IP_PER_HOUR = 10;

// ============================================================
// POST — nová session
// ============================================================

export async function POST(req: NextRequest) {
  const supabase = getSupabaseAdmin();

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const userAgent = req.headers.get("user-agent") ?? "unknown";
  const ipHash = hashIp(ip);

  // Rate limit: max N nových sessions na IP za hodinu
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("chat_sessions")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("started_at", oneHourAgo);

  if ((count ?? 0) >= SESSIONS_PER_IP_PER_HOUR) {
    return NextResponse.json(
      {
        error: `Dosažen limit ${SESSIONS_PER_IP_PER_HOUR} nových konverzací za hodinu. Zkuste to prosím později.`,
      },
      { status: 429 }
    );
  }

  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({
      ip_hash: ipHash,
      user_agent: userAgent.substring(0, 500),
      locale: "cs",
      status: "active",
      extracted: {},
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[/api/chat-session POST] error:", error);
    return NextResponse.json(
      { error: "Nepodařilo se vytvořit session." },
      { status: 500 }
    );
  }

  // Log analytics event
  await supabase.from("chat_events").insert({
    session_id: data.id,
    event_type: "session_start",
    payload: { user_agent: userAgent.substring(0, 200) },
  });

  return NextResponse.json({ sessionId: data.id });
}

// ============================================================
// PATCH — update session (GDPR consent, abandonment)
// ============================================================

export async function PATCH(req: NextRequest) {
  const supabase = getSupabaseAdmin();

  let body: { sessionId?: string; gdpr_consent?: boolean; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatný JSON." }, { status: 400 });
  }

  if (!body.sessionId) {
    return NextResponse.json({ error: "Chybí sessionId." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    last_message_at: new Date().toISOString(),
  };

  if (body.gdpr_consent === true) {
    updates.gdpr_consent_at = new Date().toISOString();
    await supabase.from("chat_events").insert({
      session_id: body.sessionId,
      event_type: "gdpr_accepted",
      payload: {},
    });
  }

  if (body.status && ["active", "abandoned"].includes(body.status)) {
    updates.status = body.status;
    if (body.status === "abandoned") {
      await supabase.from("chat_events").insert({
        session_id: body.sessionId,
        event_type: "session_abandoned",
        payload: {},
      });
    }
  }

  const { error } = await supabase
    .from("chat_sessions")
    .update(updates)
    .eq("id", body.sessionId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// ============================================================
// GET — načti session + historii pro resume
// ============================================================

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin();
  const sessionId = req.nextUrl.searchParams.get("id");

  if (!sessionId) {
    return NextResponse.json({ error: "Chybí id." }, { status: 400 });
  }

  const { data: session, error: sessErr } = await supabase
    .from("chat_sessions")
    .select("id, status, gdpr_consent_at, extracted, started_at")
    .eq("id", sessionId)
    .single();

  if (sessErr || !session) {
    return NextResponse.json({ error: "Session nenalezena." }, { status: 404 });
  }

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("session_id", sessionId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: true });

  return NextResponse.json({
    session,
    messages: messages ?? [],
  });
}

// ============================================================
// Helpers
// ============================================================

function hashIp(ip: string): string {
  return crypto
    .createHash("sha256")
    .update(ip + (process.env.IP_HASH_SALT ?? "konfigurator-salt"))
    .digest("hex")
    .substring(0, 32);
}
