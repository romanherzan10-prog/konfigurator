"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getSupabase } from "@/lib/supabase";
import { MerchGrid } from "@/components/MerchGrid";
import {
  Search,
  SlidersHorizontal,
  X,
  ChevronDown,
  Package,
} from "lucide-react";

interface BarvaJson {
  nazev: string;
  hex: string;
}

interface Produkt {
  id: string;
  kod: string;
  nazev: string;
  popis: string | null;
  gramaz: string | null;
  obrazek_url: string | null;
  znacka_nazev: string | null;
  kategorie_nazev: string | null;
  min_cena: number | null;
  barvy_count: number;
  barvy_json: BarvaJson[] | null;
  total_count: number;
}

interface Kategorie {
  id: string;
  nazev: string;
  poradi: number | null;
}

interface Kurace {
  kod: string;
  top: boolean;
  poradi: number;
  barva_override: string | null;
  mockup_fotky: string[] | null;
  nazev: string | null;
  obrazek_url: string | null;
  min_cena: number | null;
}

interface Znacka {
  id: string;
  nazev: string;
}

const PAGE_SIZE = 48;

function colorFallback(nazev: string): string {
  const n = nazev.toLowerCase();
  if (n.includes("white") || n.includes("transparent")) return "#F5F5F5";
  if (n.includes("black")) return "#111111";
  if (n.includes("grey") || n.includes("gray")) return "#888888";
  if (n.includes("red")) return "#DC2626";
  if (n.includes("blue") || n.includes("navy")) return "#1E40AF";
  if (n.includes("green")) return "#16A34A";
  if (n.includes("yellow")) return "#EAB308";
  if (n.includes("orange")) return "#F97316";
  if (n.includes("pink")) return "#EC4899";
  if (n.includes("purple") || n.includes("violet")) return "#7C3AED";
  if (n.includes("brown")) return "#8B4513";
  return "#CBD5E1";
}

function SkeletonCard() {
  return (
    <div
      className="rounded-2xl overflow-hidden animate-pulse"
      style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
    >
      <div className="aspect-square" style={{ background: "var(--surface-2)" }} />
      <div className="p-4 space-y-3">
        <div className="h-4 rounded-lg w-3/4" style={{ background: "var(--surface-3)" }} />
        <div className="h-3 rounded-lg w-1/2" style={{ background: "var(--surface-3)" }} />
        <div className="flex gap-1.5 mt-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-5 h-5 rounded-full" style={{ background: "var(--surface-3)" }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ColorSwatch({ barva }: { barva: BarvaJson }) {
  const hex = barva.hex || colorFallback(barva.nazev);
  const isLight = ["#F5F5F5", "#FFFFFF", "#FEFEFE", "#fff"].includes(hex.toLowerCase());
  return (
    <span
      title={barva.nazev}
      className={`w-5 h-5 rounded-full shrink-0 ${isLight ? "ring-1 ring-slate-300 ring-offset-1" : ""}`}
      style={{ backgroundColor: hex }}
    />
  );
}

export default function KatalogPage() {
  const [produkty, setProdukty] = useState<Produkt[]>([]);
  const [kategorie, setKategorie] = useState<Kategorie[]>([]);
  const [znacky, setZnacky] = useState<Znacka[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const [selectedKategorie, setSelectedKategorie] = useState("");
  const [selectedZnacka, setSelectedZnacka] = useState("");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [gsmMin, setGsmMin] = useState("");
  const [gsmMax, setGsmMax] = useState("");
  const [cenaMin, setCenaMin] = useState("");
  const [cenaMax, setCenaMax] = useState("");
  const [sortBy, setSortBy] = useState("nazev");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [zdroj, setZdroj] = useState<"textil" | "merch">("textil");
  const [topProdukty, setTopProdukty] = useState<Kurace[]>([]);
  const [kuraceMap, setKuraceMap] = useState<Record<string, Kurace>>({});

  const offsetRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const sb = getSupabase();
    Promise.all([
      sb.from("kategorie").select("*").order("poradi"),
      sb.from("znacky").select("*").order("nazev"),
    ]).then(([katRes, znRes]) => {
      setKategorie((katRes.data as Kategorie[]) || []);
      setZnacky((znRes.data as Znacka[]) || []);
    });
    // Kurace katalogu (top produkty, mockupy, override barvy)
    sb.from("katalog_kurace")
      .select("kod, top, poradi, barva_override, mockup_fotky, nazev, obrazek_url, min_cena")
      .order("poradi", { ascending: true })
      .then(({ data }) => {
        const rows = (data as Kurace[]) || [];
        setTopProdukty(rows.filter((r) => r.top));
        setKuraceMap(Object.fromEntries(rows.map((r) => [r.kod, r])));
      });
  }, []);

  const fetchProducts = useCallback(
    async (offset: number, append: boolean) => {
      if (offset === 0) setLoading(true);
      else setLoadingMore(true);
      try {
        const sb = getSupabase();
        const { data, error } = await sb.rpc("katalog_search", {
          q: searchDebounced || null,
          kat: selectedKategorie || null,
          znacka_filter: selectedZnacka || null,
          min_gsm: gsmMin ? parseInt(gsmMin) : null,
          max_gsm: gsmMax ? parseInt(gsmMax) : null,
          p_min_cena: cenaMin ? parseInt(cenaMin) : null,
          p_max_cena: cenaMax ? parseInt(cenaMax) : null,
          page_offset: offset,
          page_limit: PAGE_SIZE,
          sort_by: sortBy,
        });
        if (error) { console.error("katalog_search error:", error); return; }
        const rows = (data ?? []) as Produkt[];
        if (rows.length > 0) setTotalCount(rows[0].total_count);
        else if (offset === 0) setTotalCount(0);
        if (append) setProdukty((prev) => [...prev, ...rows]);
        else setProdukty(rows);
        offsetRef.current = offset + rows.length;
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [searchDebounced, selectedKategorie, selectedZnacka, gsmMin, gsmMax, cenaMin, cenaMax, sortBy]
  );

  useEffect(() => {
    offsetRef.current = 0;
    fetchProducts(0, false);
  }, [fetchProducts]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !loadingMore && offsetRef.current < totalCount) {
          fetchProducts(offsetRef.current, true);
        }
      },
      { rootMargin: "400px" }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [fetchProducts, loading, loadingMore, totalCount]);

  const activeFiltersCount =
    (selectedKategorie ? 1 : 0) +
    (selectedZnacka ? 1 : 0) +
    (search.trim() ? 1 : 0) +
    (gsmMin || gsmMax ? 1 : 0) +
    (cenaMin || cenaMax ? 1 : 0);

  const hasFilters = activeFiltersCount > 0;

  function resetFilters() {
    setSelectedKategorie("");
    setSelectedZnacka("");
    setSearch("");
    setGsmMin(""); setGsmMax("");
    setCenaMin(""); setCenaMax("");
    setSortBy("nazev");
  }

  const filterLabel = (label: string) => (
    <span
      className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
      style={{ color: "var(--muted)" }}
    >
      {label}
    </span>
  );

  return (
    <div className="container py-10">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
            Katalog produktů
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            {totalCount > 0
              ? `${totalCount.toLocaleString("cs-CZ")} produktů v nabídce`
              : "Reklamní textil a doplňky na míru"}
          </p>
        </div>

        {/* Sort + mobile filter toggle */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-sm font-medium rounded-xl border cursor-pointer"
              style={{
                background: "var(--surface)",
                borderColor: "var(--border)",
                color: "var(--foreground)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <option value="nazev">Řadit: A–Z</option>
              <option value="cena_asc">Nejlevnější</option>
              <option value="cena_desc">Nejdražší</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--muted)" }} />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="lg:hidden flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium cursor-pointer transition-colors"
            style={{
              background: filtersOpen ? "var(--primary-50)" : "var(--surface)",
              borderColor: filtersOpen ? "var(--primary)" : "var(--border)",
              color: filtersOpen ? "var(--primary)" : "var(--foreground)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filtry
            {activeFiltersCount > 0 && (
              <span
                className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-xs font-bold"
                style={{ background: "var(--accent)" }}
              >
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Přepínač: Textil na potisk / Merch */}
      <div
        className="inline-flex p-1 rounded-xl mb-6"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        {([
          { key: "textil", label: "Textil na potisk" },
          { key: "merch", label: "Merch / Doplňky" },
        ] as const).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setZdroj(t.key)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: zdroj === t.key ? "var(--surface)" : "transparent",
              color: zdroj === t.key ? "var(--primary)" : "var(--muted)",
              boxShadow: zdroj === t.key ? "var(--shadow-sm)" : "none",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {zdroj === "merch" ? (
        <MerchGrid />
      ) : (
      <div className="flex flex-col lg:flex-row gap-8">
        {/* ── Sidebar ──────────────────────────────────── */}
        <aside
          className={`lg:w-64 shrink-0 ${filtersOpen ? "block" : "hidden lg:block"}`}
        >
          <div
            className="rounded-2xl p-5 space-y-5 sticky top-24"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-md)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>
                Filtry
              </span>
              {hasFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="flex items-center gap-1 text-xs font-medium cursor-pointer transition-colors"
                  style={{ color: "var(--accent-hover, #D97706)" }}
                >
                  <X className="w-3 h-3" />
                  Zrušit vše
                </button>
              )}
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: "var(--border)" }} />

            {/* Search */}
            <div>
              {filterLabel("Vyhledávání")}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--muted)" }} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Název, kód nebo značka…"
                  className="input text-sm"
                  style={{ paddingLeft: "2.5rem" }}
                />
              </div>
            </div>

            {/* Kategorie */}
            <div>
              {filterLabel("Kategorie")}
              <div className="relative">
                <select
                  value={selectedKategorie}
                  onChange={(e) => setSelectedKategorie(e.target.value)}
                  className="input appearance-none pr-8 text-sm cursor-pointer"
                >
                  <option value="">Všechny kategorie</option>
                  {kategorie.map((k) => (
                    <option key={k.id} value={k.nazev}>{k.nazev}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--muted-light)" }} />
              </div>
            </div>

            {/* Značka */}
            <div>
              {filterLabel("Značka")}
              <div className="relative">
                <select
                  value={selectedZnacka}
                  onChange={(e) => setSelectedZnacka(e.target.value)}
                  className="input appearance-none pr-8 text-sm cursor-pointer"
                >
                  <option value="">Všechny značky</option>
                  {znacky.map((z) => (
                    <option key={z.id} value={z.nazev}>{z.nazev}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--muted-light)" }} />
              </div>
            </div>

            {/* Gramáž */}
            <div>
              {filterLabel("Gramáž (g/m²)")}
              <div className="flex gap-2">
                <input type="number" value={gsmMin} onChange={(e) => setGsmMin(e.target.value)} placeholder="od" className="input text-sm" />
                <input type="number" value={gsmMax} onChange={(e) => setGsmMax(e.target.value)} placeholder="do" className="input text-sm" />
              </div>
            </div>

            {/* Cena */}
            <div>
              {filterLabel("Cena bez DPH (Kč/ks)")}
              <div className="flex gap-2">
                <input type="number" value={cenaMin} onChange={(e) => setCenaMin(e.target.value)} placeholder="od" className="input text-sm" />
                <input type="number" value={cenaMax} onChange={(e) => setCenaMax(e.target.value)} placeholder="do" className="input text-sm" />
              </div>
            </div>
          </div>
        </aside>

        {/* ── Grid ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          {/* Doporučujeme (top produkty) — stejná šířka i karty jako katalog */}
          {!hasFilters && topProdukty.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">⭐</span>
                <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                  Doporučujeme
                </h2>
                <span className="text-sm" style={{ color: "var(--muted)" }}>
                  · naše tipy s ukázkou potisku
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {topProdukty.map((t) => {
                  const img = (t.mockup_fotky && t.mockup_fotky[0]) || t.obrazek_url;
                  return (
                    <a
                      key={t.kod}
                      href={`/katalog/${t.kod}`}
                      className="group rounded-2xl overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5 relative"
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--primary)",
                        boxShadow: "var(--shadow-sm)",
                        textDecoration: "none",
                      }}
                    >
                      <span
                        className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
                        style={{ background: "var(--primary)", color: "#fff" }}
                      >
                        ⭐ Tip
                      </span>
                      <div className="aspect-square flex items-center justify-center overflow-hidden p-3" style={{ background: "var(--surface-2)" }}>
                        {img ? (
                          <img src={img} alt={t.nazev ?? t.kod} loading="lazy" className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <Package className="w-10 h-10" style={{ color: "var(--muted-light)" }} />
                        )}
                      </div>
                      <div className="p-4 flex flex-col flex-1">
                        <h3 className="font-semibold text-sm leading-tight mb-1 line-clamp-2 group-hover:text-primary transition-colors" style={{ color: "var(--foreground)" }}>
                          {t.nazev ?? t.kod}
                        </h3>
                        {t.barva_override && (
                          <p className="text-xs mb-1" style={{ color: "var(--muted-light)" }}>Barva: {t.barva_override}</p>
                        )}
                        {t.min_cena != null && (
                          <div className="mt-auto pt-2">
                            <span className="text-sm font-bold" style={{ color: "var(--primary)" }}>
                              od {Number(t.min_cena).toLocaleString("cs-CZ")} Kč
                            </span>
                            <span className="text-xs ml-1" style={{ color: "var(--muted-light)" }}>bez DPH</span>
                          </div>
                        )}
                      </div>
                    </a>
                  );
                })}
              </div>
              <div className="mt-8 mb-2" style={{ height: 1, background: "var(--border)" }} />
            </section>
          )}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : produkty.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "var(--surface-2)", color: "var(--muted-light)" }}
              >
                <Package className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                {hasFilters ? "Žádné produkty nenalezeny" : "Katalog se připravuje"}
              </h2>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                {hasFilters ? "Zkuste změnit filtry nebo vyhledávání." : "Brzy zde najdete kompletní nabídku produktů."}
              </p>
              {hasFilters && (
                <button onClick={resetFilters} className="btn btn-ghost mt-4 text-sm">
                  Zrušit filtry
                </button>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
                Zobrazeno {produkty.length} z {totalCount.toLocaleString("cs-CZ")} produktů
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {produkty.map((p) => {
                  const ku = kuraceMap[p.kod];
                  const cardImg = (ku?.mockup_fotky && ku.mockup_fotky[0]) || p.obrazek_url;
                  return (
                  <a
                    key={p.id}
                    href={`/katalog/${p.kod}`}
                    className="group rounded-2xl overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5 relative"
                    style={{
                      background: "var(--surface)",
                      border: `1px solid ${ku?.top ? "var(--primary)" : "var(--border)"}`,
                      boxShadow: "var(--shadow-sm)",
                      textDecoration: "none",
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-lg)"}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-sm)"}
                  >
                    {ku?.top && (
                      <span
                        className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
                        style={{ background: "var(--primary)", color: "#fff" }}
                      >
                        ⭐ Tip
                      </span>
                    )}
                    {/* Image */}
                    <div
                      className="aspect-square flex items-center justify-center overflow-hidden p-3"
                      style={{ background: "var(--surface-2)" }}
                    >
                      {cardImg ? (
                        <img
                          src={cardImg}
                          alt={p.nazev}
                          loading="lazy"
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <Package className="w-10 h-10" style={{ color: "var(--muted-light)" }} />
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-4 flex flex-col flex-1">
                      {/* Brand badge */}
                      {p.znacka_nazev && (
                        <span className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--primary-light)" }}>
                          {p.znacka_nazev}
                        </span>
                      )}
                      <h3 className="font-semibold text-sm leading-tight mb-1 line-clamp-2 group-hover:text-primary transition-colors" style={{ color: "var(--foreground)" }}>
                        {p.nazev}
                      </h3>
                      {p.gramaz && (
                        <p className="text-xs mb-1" style={{ color: "var(--muted-light)" }}>{p.gramaz} g/m²</p>
                      )}

                      {/* Cena */}
                      {p.min_cena && (
                        <div className="mt-auto pt-2">
                          <span className="text-sm font-bold" style={{ color: "var(--primary)" }}>
                            od {Number(p.min_cena).toLocaleString("cs-CZ")} Kč
                          </span>
                          <span className="text-xs ml-1" style={{ color: "var(--muted-light)" }}>bez DPH</span>
                        </div>
                      )}

                      {/* Swatche */}
                      {p.barvy_json && p.barvy_json.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                          {p.barvy_json.slice(0, 10).map((b, i) => (
                            <ColorSwatch key={i} barva={b} />
                          ))}
                          {p.barvy_count > 10 && (
                            <span className="text-[10px] ml-0.5" style={{ color: "var(--muted-light)" }}>
                              +{p.barvy_count - 10}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </a>
                  );
                })}
              </div>

              <div ref={sentinelRef} className="h-4" />

              {loadingMore && (
                <div className="flex justify-center py-10">
                  <div className="flex items-center gap-3 text-sm" style={{ color: "var(--muted)" }}>
                    <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
                    Načítám další produkty…
                  </div>
                </div>
              )}

              {offsetRef.current >= totalCount && totalCount > PAGE_SIZE && (
                <p className="text-center text-sm py-6" style={{ color: "var(--muted-light)" }}>
                  Zobrazeny všechny produkty
                </p>
              )}
            </>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
