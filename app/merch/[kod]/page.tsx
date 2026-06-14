"use client";

import { useState, useEffect, use } from "react";
import { getSupabase } from "@/lib/supabase";
import { Sparkles, Mail, Loader2 } from "lucide-react";

interface MerchDetail {
  kod: string;
  nazev: string;
  popis: string | null;
  obrazek_url: string | null;
  images: { src: string }[];
  barvy: { nazev: string; hex: string | null }[];
  velikosti: string[];
  min_cena: number | null;
  max_cena: number | null;
  mena: string;
}

function formatCena(v: number | null, mena: string): string {
  if (v == null) return "—";
  if (mena === "USD") return `$${v.toFixed(2)}`;
  if (mena === "EUR") return `${v.toFixed(2)} €`;
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

  useEffect(() => {
    const sb = getSupabase();
    sb.from("printify_produkty")
      .select("kod, nazev, popis, obrazek_url, images, barvy, velikosti, min_cena, max_cena, mena")
      .eq("kod", kod)
      .eq("visible", true)
      .single()
      .then(({ data, error }) => {
        if (error || !data) setNotFound(true);
        else setProdukt(data as MerchDetail);
        setLoading(false);
      });
  }, [kod]);

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
  const cena =
    produkt.min_cena != null && produkt.max_cena != null && produkt.min_cena !== produkt.max_cena
      ? `od ${formatCena(produkt.min_cena, produkt.mena)}`
      : formatCena(produkt.min_cena, produkt.mena);

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
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted)" }}>Cena</p>
              <span className="text-2xl font-bold" style={{ color: "var(--primary)" }}>{cena}</span>
            </div>
          </div>

          {produkt.barvy && produkt.barvy.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Barvy ({produkt.barvy.length})</h3>
              <div className="flex flex-wrap gap-1.5">
                {produkt.barvy.slice(0, 24).map((b, i) => (
                  <span
                    key={i}
                    title={b.nazev}
                    className="w-7 h-7 rounded-full"
                    style={{ backgroundColor: b.hex || "#ccc", border: "1px solid var(--border)" }}
                  />
                ))}
                {produkt.barvy.length > 24 && (
                  <span className="text-xs self-center ml-1" style={{ color: "var(--muted)" }}>+{produkt.barvy.length - 24}</span>
                )}
              </div>
            </div>
          )}

          {produkt.velikosti && produkt.velikosti.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Velikosti</h3>
              <div className="flex flex-wrap gap-2">
                {produkt.velikosti.map((v, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 rounded-lg text-sm"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                  >
                    {v}
                  </span>
                ))}
              </div>
            </div>
          )}

          {produkt.popis && (
            <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{produkt.popis}</p>
          )}

          <div className="flex flex-wrap gap-3 pt-1">
            <a
              href={`/navrhnout/${encodeURIComponent(produkt.kod)}`}
              className="inline-flex items-center gap-2 px-6 py-3 font-semibold rounded-lg text-white"
              style={{ background: "var(--primary)" }}
            >
              <Sparkles className="w-4 h-4" /> Navrhnout potisk
            </a>
            <a
              href={`mailto:info@loooku.cz?subject=${encodeURIComponent("Zájem o " + produkt.nazev)}`}
              className="inline-flex items-center gap-2 px-6 py-3 font-medium rounded-lg"
              style={{ background: "var(--surface)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
            >
              <Mail className="w-4 h-4" /> Mám zájem
            </a>
          </div>
          <p className="text-xs" style={{ color: "var(--muted-light)" }}>
            Ceny jsou orientační (z Printify). Finální cenu a dostupnost potvrdíme v nabídce.
          </p>
        </div>
      </div>
    </div>
  );
}
