"use client";

import { useState, useEffect, use, useMemo } from "react";
import { getSupabase } from "@/lib/supabase";
import { Sparkles, ShoppingCart, Loader2, Check } from "lucide-react";

interface MerchVariant {
  id: number;
  nazev: string;
  cena: number;
  color: string | null;
  size: string | null;
}

interface MerchDetail {
  kod: string;
  nazev: string;
  popis: string | null;
  obrazek_url: string | null;
  images: { src: string }[];
  barvy: { nazev: string; hex: string | null }[];
  velikosti: string[];
  variants: MerchVariant[];
  min_cena: number | null;
  max_cena: number | null;
  mena: string;
}

function formatCena(v: number | null): string {
  if (v == null) return "—";
  return `${Math.round(v).toLocaleString("cs-CZ")} Kč`;
}

export default function MerchDetailPage({
  params,
}: {
  params: Promise<{ kod: string }>;
}) {
  const { kod } = use(params);
  const [produkt, setProdukt] = useState<MerchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeImg, setActiveImg] = useState(0);

  // Výběr varianty
  const [barva, setBarva] = useState<string | null>(null);
  const [velikost, setVelikost] = useState<string | null>(null);
  const [mnozstvi, setMnozstvi] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    const sb = getSupabase();
    sb.from("printify_produkty")
      .select("kod, nazev, popis, obrazek_url, images, barvy, velikosti, variants, min_cena, max_cena, mena")
      .eq("kod", kod)
      .eq("visible", true)
      .single()
      .then(({ data, error }) => {
        if (error || !data) setNotFound(true);
        else {
          const p = data as MerchDetail;
          setProdukt(p);
          if (p.barvy?.length) setBarva(p.barvy[0].nazev);
          if (p.velikosti?.length) setVelikost(p.velikosti[0]);
        }
        setLoading(false);
      });
  }, [kod]);

  // Vybraná varianta podle barvy + velikosti → cena
  const selectedVariant = useMemo(() => {
    if (!produkt?.variants?.length) return null;
    const vs = produkt.variants;
    const match = vs.find(
      (v) =>
        (barva == null || v.color == null || v.color === barva) &&
        (velikost == null || v.size == null || v.size === velikost)
    );
    return match ?? vs[0];
  }, [produkt, barva, velikost]);

  const unitCena = selectedVariant?.cena ?? produkt?.min_cena ?? 0;

  function addToCart() {
    if (!produkt) return;
    const qp = new URLSearchParams({
      produkt: produkt.kod,
      nazev: produkt.nazev,
      cena: String(Math.round(unitCena)),
    });
    if (barva) qp.set("barva", barva);
    if (velikost) qp.set("velikost", velikost);
    setAdded(true);
    // krátká vizuální odezva, pak do košíku (×množství nastaví uživatel tam)
    window.location.href = `/konfigurator?${qp.toString()}`;
  }

  if (loading) {
    return (
      <div className="container py-20 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: "var(--primary)" }} />
      </div>
    );
  }

  if (notFound || !produkt) {
    return (
      <div className="container py-24 text-center" style={{ maxWidth: 560 }}>
        <h1 className="text-2xl font-bold mb-2">Produkt nenalezen</h1>
        <a href="/" className="btn btn-primary mt-4 inline-flex">Zpět do katalogu</a>
      </div>
    );
  }

  const imgs = produkt.images?.length ? produkt.images : produkt.obrazek_url ? [{ src: produkt.obrazek_url }] : [];

  return (
    <div className="container py-8" style={{ maxWidth: 1100 }}>
      <nav className="text-sm mb-6 flex items-center gap-2 flex-wrap" style={{ color: "var(--muted)" }}>
        <a href="/" className="hover:underline">Katalog</a>
        <span>/</span>
        <span style={{ color: "var(--primary)" }}>Merch</span>
        <span>/</span>
        <span style={{ color: "var(--foreground)" }}>{produkt.nazev}</span>
      </nav>

      <div className="flex flex-col lg:flex-row gap-10 lg:items-start">
        {/* Galerie */}
        <div className="lg:w-1/2 lg:sticky lg:top-20 w-full">
          <div
            className="aspect-square rounded-2xl flex items-center justify-center overflow-hidden mb-3"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
          >
            {imgs[activeImg] && (
              <img src={imgs[activeImg].src} alt={produkt.nazev} className="w-full h-full object-contain p-6" />
            )}
          </div>
          {imgs.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {imgs.slice(0, 6).map((im, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  className="w-16 h-16 rounded-lg overflow-hidden shrink-0"
                  style={{
                    border: `2px solid ${i === activeImg ? "var(--primary)" : "var(--border)"}`,
                    background: "var(--surface-2)",
                  }}
                >
                  <img src={im.src} alt="" className="w-full h-full object-contain p-1" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="lg:w-1/2 space-y-5">
          <div>
            <span
              className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full mb-2"
              style={{ background: "var(--primary-50)", color: "var(--primary)" }}
            >
              <Sparkles className="w-3 h-3" /> Merch · hotový design
            </span>
            <h1 className="text-2xl font-bold">{produkt.nazev}</h1>
          </div>

          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <div className="px-5 py-4" style={{ background: "var(--primary-50)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted)" }}>Cena za kus</p>
              <span className="text-2xl font-bold" style={{ color: "var(--primary)" }}>{formatCena(unitCena)}</span>
            </div>
          </div>

          {/* Výběr barvy */}
          {produkt.barvy && produkt.barvy.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">
                Barva{barva && <span className="font-normal" style={{ color: "var(--muted)" }}> · {barva}</span>}
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {produkt.barvy.map((b, i) => {
                  const sel = b.nazev === barva;
                  return (
                    <button
                      key={i}
                      title={b.nazev}
                      onClick={() => setBarva(b.nazev)}
                      className="w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                      style={{
                        backgroundColor: b.hex || "#ccc",
                        border: `2px solid ${sel ? "var(--primary)" : "var(--border)"}`,
                        boxShadow: sel ? "0 0 0 2px var(--primary-50)" : "none",
                      }}
                    >
                      {sel && <Check className="w-4 h-4" style={{ color: "#fff", mixBlendMode: "difference" }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Výběr velikosti */}
          {produkt.velikosti && produkt.velikosti.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Velikost</h3>
              <div className="flex flex-wrap gap-2">
                {produkt.velikosti.map((v, i) => {
                  const sel = v === velikost;
                  return (
                    <button
                      key={i}
                      onClick={() => setVelikost(v)}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                      style={{
                        background: sel ? "var(--primary)" : "var(--surface)",
                        color: sel ? "#fff" : "var(--foreground)",
                        border: `1.5px solid ${sel ? "var(--primary)" : "var(--border)"}`,
                      }}
                    >
                      {v}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Množství */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Množství</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMnozstvi((q) => Math.max(1, q - 1))}
                className="w-9 h-9 rounded-lg border text-lg"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                −
              </button>
              <input
                type="number"
                min={1}
                max={500}
                value={mnozstvi}
                onChange={(e) => setMnozstvi(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
                className="w-16 text-center rounded-lg border px-2 py-1.5 text-sm outline-none"
                style={{ borderColor: "var(--border)" }}
              />
              <button
                onClick={() => setMnozstvi((q) => Math.min(500, q + 1))}
                className="w-9 h-9 rounded-lg border text-lg"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                +
              </button>
              <span className="text-sm ml-2" style={{ color: "var(--muted)" }}>
                = <strong style={{ color: "var(--primary)" }}>{formatCena(unitCena * mnozstvi)}</strong>
              </span>
            </div>
          </div>

          {produkt.popis && (
            <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{produkt.popis}</p>
          )}

          <div className="flex flex-wrap gap-3 pt-1">
            <button
              onClick={addToCart}
              disabled={added}
              className="inline-flex items-center gap-2 px-6 py-3 font-semibold rounded-lg text-white disabled:opacity-70"
              style={{ background: "var(--primary)" }}
            >
              {added ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
              {added ? "Přidávám…" : "Přidat do košíku"}
            </button>
            <a
              href={`/navrhnout/${encodeURIComponent(produkt.kod)}`}
              className="inline-flex items-center gap-2 px-6 py-3 font-medium rounded-lg"
              style={{ background: "var(--surface)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
            >
              <Sparkles className="w-4 h-4" /> Navrhnout potisk
            </a>
          </div>
          <p className="text-xs" style={{ color: "var(--muted-light)" }}>
            Uvedené ceny jsou bez potisku. Finální cenu vč. potisku a dostupnost potvrdíme v nabídce.
          </p>
        </div>
      </div>
    </div>
  );
}
