"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import {
  Package,
  Mail,
  LogOut,
  Loader2,
  Check,
  Sparkles,
} from "lucide-react";

interface MojePoptavka {
  id: string;
  created_at: string;
  typ_produktu: string;
  typ_zpracovani: string;
  mnozstvi: number;
  stav: string;
  odhadovana_cena_celkem: number | null;
  logo_soubor_url: string | null;
}

const STAV_LABELS: Record<string, string> = {
  nova: "Nová",
  zpracovava_se: "Zpracovává se",
  nabidka_odeslana: "Nabídka odeslána",
  schvalena: "Schválená",
  zamitnuta: "Zamítnutá",
  zrusena: "Zrušená",
};

const STAV_COLOR: Record<string, { bg: string; fg: string }> = {
  nova: { bg: "var(--primary-50)", fg: "var(--primary)" },
  zpracovava_se: { bg: "#FFFBEB", fg: "#B45309" },
  nabidka_odeslana: { bg: "#EFF6FF", fg: "#1D4ED8" },
  schvalena: { bg: "#ECFDF5", fg: "#047857" },
  zamitnuta: { bg: "#FEF2F2", fg: "#DC2626" },
  zrusena: { bg: "var(--surface-2)", fg: "var(--muted)" },
};

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString("cs-CZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function UcetPage() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [poptavky, setPoptavky] = useState<MojePoptavka[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  const loadPoptavky = useCallback(async () => {
    setLoadingData(true);
    try {
      const sb = getSupabase();
      const { data: sess } = await sb.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) return;
      const res = await fetch("/api/moje-poptavky", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok) setPoptavky(json.poptavky ?? []);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    const sb = getSupabase();
    sb.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setLoading(false);
      if (data.user?.email) loadPoptavky();
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
      if (session?.user?.email) loadPoptavky();
    });
    return () => sub.subscription.unsubscribe();
  }, [loadPoptavky]);

  async function odeslatOdkaz(e: React.FormEvent) {
    e.preventDefault();
    if (!loginEmail.trim()) return;
    setSending(true);
    setError(null);
    try {
      const sb = getSupabase();
      const { error: err } = await sb.auth.signInWithOtp({
        email: loginEmail.trim(),
        options: { emailRedirectTo: `${window.location.origin}/ucet` },
      });
      if (err) throw new Error(err.message);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Odeslání selhalo.");
    } finally {
      setSending(false);
    }
  }

  async function odhlasit() {
    await getSupabase().auth.signOut();
    setEmail(null);
    setPoptavky([]);
  }

  if (loading) {
    return (
      <div className="container py-20 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: "var(--primary)" }} />
      </div>
    );
  }

  // ── Nepřihlášen — formulář ──
  if (!email) {
    return (
      <div className="container" style={{ maxWidth: 460, paddingTop: 48, paddingBottom: 64 }}>
        <div
          className="rounded-2xl p-8"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "var(--primary-50)", color: "var(--primary)" }}
          >
            <Package className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold mb-2 text-center">Přihlášení</h1>
          <p className="text-sm mb-6 text-center" style={{ color: "var(--muted)", lineHeight: 1.6 }}>
            Zadejte e-mail a pošleme vám přihlašovací odkaz. Bez hesla. Po přihlášení uvidíte
            své poptávky a jejich stav.
          </p>

          {sent ? (
            <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: "#ECFDF5" }}>
              <Check className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#047857" }} />
              <p className="text-sm" style={{ color: "#065F46" }}>
                Odkaz odeslán na <strong>{loginEmail}</strong>. Otevřete e-mail a klikněte na odkaz —
                vrátí vás sem přihlášené.
              </p>
            </div>
          ) : (
            <form onSubmit={odeslatOdkaz} className="space-y-3">
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="vas@email.cz"
                className="input text-sm"
              />
              {error && (
                <p className="text-sm px-3 py-2 rounded-lg" style={{ background: "#FEF2F2", color: "#DC2626" }}>
                  {error}
                </p>
              )}
              <button type="submit" disabled={sending} className="btn btn-primary w-full py-3 disabled:opacity-60">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Poslat přihlašovací odkaz
              </button>
            </form>
          )}

          <a href="/" className="block text-center text-sm mt-5" style={{ color: "var(--muted)" }}>
            ← Zpět do katalogu
          </a>
        </div>
      </div>
    );
  }

  // ── Přihlášen — účet + poptávky ──
  return (
    <div className="container" style={{ maxWidth: 720, paddingTop: 40, paddingBottom: 64 }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Můj účet</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>{email}</p>
        </div>
        <button onClick={odhlasit} className="btn btn-ghost text-sm px-4 py-2">
          <LogOut className="w-4 h-4" /> Odhlásit
        </button>
      </div>

      <h2 className="text-base font-semibold mb-3">Moje poptávky</h2>

      {loadingData ? (
        <div className="py-10 text-center">
          <Loader2 className="w-5 h-5 animate-spin mx-auto" style={{ color: "var(--primary)" }} />
        </div>
      ) : poptavky.length === 0 ? (
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <Sparkles className="w-6 h-6 mx-auto mb-3" style={{ color: "var(--primary)" }} />
          <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
            Zatím tu nemáte žádné poptávky. Vyberte produkt v katalogu, navrhněte potisk a odešlete poptávku.
          </p>
          <a href="/" className="btn btn-primary px-5 py-2.5 text-sm">Procházet katalog</a>
        </div>
      ) : (
        <div className="space-y-3">
          {poptavky.map((p) => {
            const c = STAV_COLOR[p.stav] ?? STAV_COLOR.nova;
            return (
              <div
                key={p.id}
                className="rounded-xl p-4 flex items-center gap-4"
                style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
              >
                {p.logo_soubor_url ? (
                  <img
                    src={p.logo_soubor_url}
                    alt="Náhled"
                    className="w-14 h-14 rounded-lg object-contain shrink-0"
                    style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                  />
                ) : (
                  <div
                    className="w-14 h-14 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "var(--surface-2)", color: "var(--muted-light)" }}
                  >
                    <Package className="w-6 h-6" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {p.mnozstvi} ks · {p.typ_zpracovani === "embroidery" ? "výšivka" : p.typ_zpracovani === "clean" ? "bez potisku" : "potisk"}
                  </p>
                  <p className="text-xs" style={{ color: "var(--muted)" }}>
                    {formatDate(p.created_at)}
                    {p.odhadovana_cena_celkem ? ` · odhad ${Math.round(p.odhadovana_cena_celkem).toLocaleString("cs-CZ")} Kč` : ""}
                  </p>
                </div>
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                  style={{ background: c.bg, color: c.fg }}
                >
                  {STAV_LABELS[p.stav] ?? p.stav}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
