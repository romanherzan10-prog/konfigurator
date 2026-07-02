"use client";

import { useState, useEffect } from "react";
import { use } from "react";
import { getSupabase } from "@/lib/supabase";

interface SkladItem {
  id: string;
  velikost: string;
  skladem: number;
}

interface Barva {
  id: string;
  nazev: string;
  hex_kod: string | null;
  obrazek_url: string | null;
  kod_barvy: string | null;
  sklad: SkladItem[];
}

interface ProduktDetail {
  id: string;
  kod: string;
  nazev: string;
  popis: string | null;
  material: string | null;
  gramaz: string | null;
  hmotnost_g: number | null;
  obrazek_url: string | null;
  znacka: { nazev: string; logo_url: string | null } | null;
  kategorie: { nazev: string } | null;
  barvy: Barva[];
}

const VELIKOST_PORADI = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL"];

function sortVelikosti(a: SkladItem, b: SkladItem): number {
  const ia = VELIKOST_PORADI.indexOf(a.velikost.toUpperCase());
  const ib = VELIKOST_PORADI.indexOf(b.velikost.toUpperCase());
  if (ia === -1 && ib === -1) return a.velikost.localeCompare(b.velikost);
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}

function formatKc(val: number | null | undefined): string {
  if (val == null) return "—";
  return val.toLocaleString("cs-CZ") + " Kč";
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 animate-pulse">
      <div className="h-4 rounded w-48 mb-8" style={{ background: "var(--surface-2)" }} />
      <div className="flex flex-col lg:flex-row gap-10">
        <div className="lg:w-1/2">
          <div className="aspect-square rounded-xl" style={{ background: "var(--surface-2)" }} />
        </div>
        <div className="lg:w-1/2 space-y-4">
          <div className="h-8 rounded w-3/4" style={{ background: "var(--surface-2)" }} />
          <div className="h-4 rounded w-1/3" style={{ background: "var(--surface-2)" }} />
          <div className="h-4 rounded w-1/2" style={{ background: "var(--surface-2)" }} />
          <div className="h-20 rounded" style={{ background: "var(--surface-2)" }} />
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-8 h-8 rounded-full" style={{ background: "var(--surface-2)" }} />
            ))}
          </div>
          <div className="h-40 rounded" style={{ background: "var(--surface-2)" }} />
        </div>
      </div>
    </div>
  );
}

export default function ProduktDetailPage({
  params,
}: {
  params: Promise<{ kod: string }>;
}) {
  const { kod } = use(params);
  const [produkt, setProdukt] = useState<ProduktDetail | null>(null);
  const [cenaOd, setCenaOd] = useState<number | null>(null);
  const [cenaDo, setCenaDo] = useState<number | null>(null);
  const [cenaLoading, setCenaLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedBarvaId, setSelectedBarvaId] = useState<string | null>(null);
  const [mockupy, setMockupy] = useState<string[]>([]);
  const [activeImg, setActiveImg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const sb = getSupabase();
        const { data, error } = await sb
          .from("produkty")
          .select(
            "id, kod, nazev, popis, material, gramaz, hmotnost_g, obrazek_url, znacka:znacky(nazev, logo_url), kategorie:kategorie(nazev), barvy:produkt_barvy(id, nazev, hex_kod, obrazek_url, kod_barvy, sklad:produkt_sklad(id, velikost, skladem))"
          )
          .eq("kod", kod)
          .eq("aktivni", true)
          .single();

        if (error || !data) {
          setNotFound(true);
        } else {
          const p = data as unknown as ProduktDetail;
          setProdukt(p);
          if (p.barvy && p.barvy.length > 0) {
            setSelectedBarvaId(p.barvy[0].id);
          }
          // Kurované mockup fotky (s logem) z katalog_kurace
          const { data: kur } = await sb
            .from("katalog_kurace")
            .select("mockup_fotky")
            .eq("kod", kod)
            .maybeSingle();
          const mk = (kur?.mockup_fotky as string[] | null) ?? [];
          setMockupy(Array.isArray(mk) ? mk.filter(Boolean) : []);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [kod]);

  // Při změně barvy zruš ruční výběr náhledu (velký obrázek pak sleduje barvu)
  useEffect(() => {
    setActiveImg(null);
  }, [selectedBarvaId]);

  useEffect(() => {
    if (!produkt) return;
    const barvaParam = produkt.barvy?.find((b) => b.id === selectedBarvaId)?.nazev;
    const url = `/api/produkt-price/${encodeURIComponent(kod)}${
      barvaParam ? `?barva=${encodeURIComponent(barvaParam)}` : ""
    }`;
    setCenaLoading(true);
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { cenaOd: number | null; cenaDo: number | null } | null) => {
        setCenaOd(j?.cenaOd ?? null);
        setCenaDo(j?.cenaDo ?? null);
      })
      .catch(() => {
        setCenaOd(null);
        setCenaDo(null);
      })
      .finally(() => setCenaLoading(false));
  }, [kod, selectedBarvaId, produkt]);

  if (loading) return <DetailSkeleton />;

  if (notFound || !produkt) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <div className="text-5xl mb-4">🔍</div>
        <h1 className="text-2xl font-bold mb-2">Produkt nenalezen</h1>
        <p className="mb-6" style={{ color: "var(--muted)" }}>
          Produkt s kódem &quot;{kod}&quot; nebyl nalezen v katalogu.
        </p>
        <a
          href="/katalog"
          className="inline-flex items-center px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary-hover transition-colors"
        >
          Zpět na katalog
        </a>
      </div>
    );
  }

  const selectedBarva = produkt.barvy?.find((b) => b.id === selectedBarvaId) || null;
  const displayImage = selectedBarva?.obrazek_url || produkt.obrazek_url || null;
  const galerie = [displayImage, ...mockupy].filter(Boolean) as string[];
  const bigImage = activeImg && galerie.includes(activeImg) ? activeImg : displayImage;
  const skladItems = selectedBarva?.sklad ? [...selectedBarva.sklad].sort(sortVelikosti) : [];

  const hasCeny = cenaOd != null;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        <a href="/katalog" className="hover:text-primary transition-colors">
          Katalog
        </a>
        <span className="mx-2">/</span>
        <span style={{ color: "var(--foreground)" }}>{produkt.nazev}</span>
      </nav>

      <div className="flex flex-col lg:flex-row gap-10 lg:items-start">
        {/* Obrázek vlevo — na desktopu sticky */}
        <div className="lg:w-1/2 lg:sticky lg:top-24 lg:self-start w-full">
          <div
            className="aspect-square rounded-2xl flex items-center justify-center overflow-hidden"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
          >
            {bigImage ? (
              <img
                src={bigImage}
                alt={selectedBarva ? `${produkt.nazev} - ${selectedBarva.nazev}` : produkt.nazev}
                className="w-full h-full object-contain p-6"
              />
            ) : (
              <span className="text-8xl opacity-20">👕</span>
            )}
          </div>
          {/* Náhledové dlaždice — produkt + mockup fotky s logem */}
          {galerie.length > 1 && (
            <div className="flex gap-2 flex-wrap mt-3">
              {galerie.map((src, i) => {
                const aktivni = src === bigImage;
                const jeMockup = mockupy.includes(src);
                return (
                  <button
                    key={i}
                    onClick={() => setActiveImg(src)}
                    className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0"
                    style={{
                      border: `2px solid ${aktivni ? "var(--primary)" : "var(--border)"}`,
                      background: "var(--surface-2)",
                    }}
                  >
                    <img src={src} alt="" className="w-full h-full object-contain p-1" />
                    {jeMockup && (
                      <span
                        className="absolute bottom-0 inset-x-0 text-[8px] font-bold text-center py-0.5"
                        style={{ background: "var(--primary)", color: "#fff" }}
                      >
                        UKÁZKA
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Info vpravo */}
        <div className="lg:w-1/2 space-y-5">
          <div>
            <h1 className="text-2xl font-bold mb-1">{produkt.nazev}</h1>
            <div className="flex items-center gap-3 text-sm" style={{ color: "var(--muted)" }}>
              {produkt.znacka && <span>{produkt.znacka.nazev}</span>}
              <span style={{ color: "var(--muted-light)" }}>·</span>
              <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: "var(--surface-2)" }}>{produkt.kod}</span>
            </div>
          </div>

          {/* Doporučená cena */}
          {hasCeny ? (
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <div className="px-5 py-4" style={{ background: "var(--primary-50)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--muted)" }}>
                  Doporučená cena
                </p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-primary tabular-nums">
                    {cenaOd === cenaDo || cenaDo == null
                      ? formatKc(cenaOd)
                      : `od ${formatKc(cenaOd)}`}
                  </span>
                  <span className="text-sm" style={{ color: "var(--muted-light)" }}>bez DPH / ks</span>
                </div>
              </div>
              <div className="px-5 py-2.5 space-y-1" style={{ background: "var(--surface-2)", borderTop: "1px solid var(--border)" }}>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  {cenaOd === cenaDo || cenaDo == null
                    ? `${Math.round(cenaOd! * 1.21).toLocaleString("cs-CZ")} Kč s DPH`
                    : `od ${Math.round(cenaOd! * 1.21).toLocaleString("cs-CZ")} Kč s DPH`}
                </p>
                <p className="text-xs" style={{ color: "var(--muted-light)" }}>
                  Cena za samotný produkt bez potisku/výšivky. Finální cenu včetně
                  zdobení a množstevní slevy vám potvrdíme v nezávazné nabídce.
                </p>
              </div>
            </div>
          ) : cenaLoading ? (
            <div className="rounded-xl px-5 py-4 animate-pulse" style={{ border: "1px solid var(--border)", background: "var(--surface-2)" }}>
              <p className="text-sm" style={{ color: "var(--muted)" }}>Načítám cenu…</p>
            </div>
          ) : (
            <div className="rounded-xl px-5 py-4" style={{ border: "1px solid var(--border)", background: "var(--surface-2)" }}>
              <p className="text-sm font-semibold">Cena na dotaz</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                Cenu se nepodařilo načíst. Přidejte produkt do poptávky, nebo se
                zeptejte v chatu — cenu vám rádi spočítáme.
              </p>
            </div>
          )}

          {/* Parametry */}
          <div className="text-sm space-y-1" style={{ color: "var(--muted)" }}>
            {produkt.material && (
              <p>
                <span className="font-medium" style={{ color: "var(--foreground)" }}>Materiál:</span>{" "}
                {produkt.material}
              </p>
            )}
            {produkt.gramaz && (
              <p>
                <span className="font-medium" style={{ color: "var(--foreground)" }}>Gramáž:</span>{" "}
                {produkt.gramaz} g/m²
              </p>
            )}
            {produkt.hmotnost_g && (
              <p>
                <span className="font-medium" style={{ color: "var(--foreground)" }}>Hmotnost:</span>{" "}
                {produkt.hmotnost_g} g
              </p>
            )}
            {produkt.kategorie && (
              <p>
                <span className="font-medium" style={{ color: "var(--foreground)" }}>Kategorie:</span>{" "}
                {produkt.kategorie.nazev}
              </p>
            )}
          </div>

          {produkt.popis && (
            <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>{produkt.popis}</p>
          )}

          {/* Výběr barvy */}
          {produkt.barvy && produkt.barvy.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">
                Barva:{" "}
                <span className="font-normal" style={{ color: "var(--muted)" }}>{selectedBarva?.nazev || "---"}</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {produkt.barvy.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    title={b.nazev}
                    onClick={() => setSelectedBarvaId(b.id)}
                    className={`w-8 h-8 rounded-full border-2 transition-all cursor-pointer ${
                      selectedBarvaId === b.id
                        ? "border-primary ring-2 ring-primary/30 scale-110"
                        : "border-[var(--border)] hover:border-[var(--muted-light)]"
                    }`}
                    style={{ backgroundColor: b.hex_kod || "#ccc" }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Tabulka velikostí + sklad */}
          {skladItems.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Dostupné velikosti</h3>
              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "var(--surface-2)" }}>
                      <th className="text-left px-4 py-2 font-medium" style={{ color: "var(--foreground)" }}>Velikost</th>
                      <th className="text-right px-4 py-2 font-medium" style={{ color: "var(--foreground)" }}>Skladem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skladItems.map((s) => (
                      <tr
                        key={s.id}
                        style={{ borderTop: "1px solid var(--border)", color: s.skladem === 0 ? "var(--muted-light)" : undefined }}
                      >
                        <td className="px-4 py-2 font-medium">{s.velikost}</td>
                        <td className="px-4 py-2 text-right">
                          <span className="inline-flex items-center gap-1.5 justify-end">
                            <span className={`w-2 h-2 rounded-full ${s.skladem > 0 ? "bg-green-500" : "bg-red-400"}`} />
                            {s.skladem > 0 ? `${s.skladem} ks` : "Není skladem"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selectedBarva && skladItems.length === 0 && (
            <p className="text-sm" style={{ color: "var(--muted-light)" }}>Informace o dostupnosti nejsou k dispozici.</p>
          )}

          {/* CTA */}
          <div className="flex flex-wrap gap-3 pt-1">
            <a
              href={`/navrhnout/${encodeURIComponent(produkt.kod)}`}
              className="inline-flex items-center gap-2 px-6 py-3 font-semibold rounded-lg transition-colors text-white"
              style={{ background: "var(--primary)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" />
              </svg>
              Navrhnout potisk
            </a>
            <a
              href={`/konfigurator?produkt=${encodeURIComponent(produkt.kod)}&nazev=${encodeURIComponent(produkt.nazev)}&cena=${cenaOd ?? 0}${selectedBarva ? `&barva=${encodeURIComponent(selectedBarva.nazev)}` : ""}${produkt.kategorie ? `&kategorie=${encodeURIComponent(produkt.kategorie.nazev)}` : ""}`}
              className="inline-flex items-center gap-2 px-6 py-3 font-medium rounded-lg transition-colors"
              style={{ background: "var(--surface)", color: "var(--foreground)", border: "1.5px solid var(--border)" }}
            >
              Přidat do košíku
            </a>
          </div>
          <a
            href="/katalog"
            className="inline-flex items-center gap-2 text-sm font-medium mt-1"
            style={{ color: "var(--muted)" }}
          >
            ← Zpět do katalogu
          </a>
        </div>
      </div>
    </div>
  );
}
