"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { Package, Sparkles } from "lucide-react";

interface MerchProdukt {
  kod: string;
  nazev: string;
  obrazek_url: string | null;
  min_cena: number | null;
  max_cena: number | null;
  mena: string;
  barvy: { nazev: string; hex: string | null }[];
}

function formatCena(v: number | null, mena: string): string {
  if (v == null) return "";
  if (mena === "USD") return `$${v.toFixed(2)}`;
  if (mena === "EUR") return `${v.toFixed(2)} €`;
  return `${Math.round(v).toLocaleString("cs-CZ")} Kč`;
}

export function MerchGrid() {
  const [produkty, setProdukty] = useState<MerchProdukt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sb = getSupabase();
    sb.from("printify_produkty")
      .select("kod, nazev, obrazek_url, min_cena, max_cena, mena, barvy")
      .eq("visible", true)
      .order("nazev")
      .then(({ data }) => {
        setProdukty((data as MerchProdukt[]) ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl overflow-hidden animate-pulse"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="aspect-square" style={{ background: "var(--surface-2)" }} />
            <div className="p-4 space-y-2">
              <div className="h-4 rounded w-3/4" style={{ background: "var(--surface-3)" }} />
              <div className="h-3 rounded w-1/2" style={{ background: "var(--surface-3)" }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (produkty.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: "var(--surface-2)", color: "var(--muted-light)" }}
        >
          <Package className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--foreground)" }}>
          Merch se připravuje
        </h2>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Brzy zde najdete hotové produkty s našimi designy.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
        {produkty.length} {produkty.length === 1 ? "produkt" : produkty.length < 5 ? "produkty" : "produktů"} · hotové designy, lze i s vlastním potiskem
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {produkty.map((p) => (
          <a
            key={p.kod}
            href={`/merch/${encodeURIComponent(p.kod)}`}
            className="group rounded-2xl overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-sm)",
              textDecoration: "none",
            }}
          >
            <div
              className="aspect-square flex items-center justify-center overflow-hidden p-3 relative"
              style={{ background: "var(--surface-2)" }}
            >
              {p.obrazek_url ? (
                <img
                  src={p.obrazek_url}
                  alt={p.nazev}
                  loading="lazy"
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <Package className="w-10 h-10" style={{ color: "var(--muted-light)" }} />
              )}
              <span
                className="absolute top-2 left-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
                style={{ background: "var(--primary)", color: "#fff" }}
              >
                <Sparkles className="w-3 h-3" /> Merch
              </span>
            </div>
            <div className="p-4 flex flex-col flex-1">
              <h3
                className="font-semibold text-sm leading-tight mb-1 line-clamp-2"
                style={{ color: "var(--foreground)" }}
              >
                {p.nazev}
              </h3>
              {p.min_cena != null && (
                <div className="mt-auto pt-2">
                  <span className="text-sm font-bold" style={{ color: "var(--primary)" }}>
                    od {formatCena(p.min_cena, p.mena)}
                  </span>
                </div>
              )}
              {p.barvy && p.barvy.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                  {p.barvy.slice(0, 8).map((b, i) => (
                    <span
                      key={i}
                      title={b.nazev}
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: b.hex || "#ccc", border: "1px solid var(--border)" }}
                    />
                  ))}
                  {p.barvy.length > 8 && (
                    <span className="text-[10px] ml-0.5" style={{ color: "var(--muted-light)" }}>
                      +{p.barvy.length - 8}
                    </span>
                  )}
                </div>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
