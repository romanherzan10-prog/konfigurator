"use client";

import { useState, useEffect, useMemo } from "react";
import { getSupabase } from "@/lib/supabase";

interface Barva {
  id: string;
  nazev: string;
  hex_kod: string | null;
  obrazek_url: string | null;
}

interface Produkt {
  id: string;
  kod: string;
  nazev: string;
  popis: string | null;
  gramaz: string | null;
  obrazek_url: string | null;
  aktivni: boolean;
  znacka: { nazev: string } | null;
  kategorie: { nazev: string } | null;
  barvy: Barva[];
}

interface Kategorie {
  id: string;
  nazev: string;
  poradi: number | null;
}

interface Znacka {
  id: string;
  nazev: string;
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden animate-pulse">
      <div className="aspect-square bg-gray-100" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-gray-100 rounded w-3/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
        <div className="h-3 bg-gray-100 rounded w-2/3" />
        <div className="flex gap-1.5 mt-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-5 h-5 rounded-full bg-gray-100" />
          ))}
        </div>
        <div className="h-9 bg-gray-100 rounded-lg mt-3" />
      </div>
    </div>
  );
}

export default function KatalogPage() {
  const [produkty, setProdukty] = useState<Produkt[]>([]);
  const [kategorie, setKategorie] = useState<Kategorie[]>([]);
  const [znacky, setZnacky] = useState<Znacka[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtry
  const [selectedKategorie, setSelectedKategorie] = useState<string[]>([]);
  const [selectedZnacky, setSelectedZnacky] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cenyMap, setCenyMap] = useState<Record<string, number>>({});

  useEffect(() => {
    async function load() {
      try {
        const sb = getSupabase();
        const [prodRes, katRes, znRes, cenikRes] = await Promise.all([
          sb
            .from("produkty")
            .select(
              "*, znacka:znacky(nazev), kategorie:kategorie(nazev), barvy:produkt_barvy(id, nazev, hex_kod, obrazek_url)"
            )
            .eq("aktivni", true)
            .range(0, 9999),
          sb.from("kategorie").select("*").order("poradi"),
          sb.from("znacky").select("*").order("nazev"),
          sb.rpc("min_ceny_katalog"),
        ]);
        setProdukty((prodRes.data as Produkt[]) || []);
        setKategorie((katRes.data as Kategorie[]) || []);
        setZnacky((znRes.data as Znacka[]) || []);

        // Build min cena_1 map per katalogove_cislo
        const map: Record<string, number> = {};
        if (cenikRes.data) {
          for (const row of cenikRes.data as { katalogove_cislo: string; min_cena: string | number }[]) {
            map[row.katalogove_cislo] = Number(row.min_cena);
          }
        }
        setCenyMap(map);
      } catch {
        // empty state
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    let result = produkty;

    if (selectedKategorie.length > 0) {
      result = result.filter(
        (p) => p.kategorie && selectedKategorie.includes(p.kategorie.nazev)
      );
    }

    if (selectedZnacky.length > 0) {
      result = result.filter(
        (p) => p.znacka && selectedZnacky.includes(p.znacka.nazev)
      );
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (p) =>
          p.nazev.toLowerCase().includes(q) ||
          p.kod.toLowerCase().includes(q)
      );
    }

    return result;
  }, [produkty, selectedKategorie, selectedZnacky, search]);

  function toggleFilter(
    value: string,
    selected: string[],
    setSelected: (v: string[]) => void
  ) {
    setSelected(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    );
  }

  const hasFilters =
    selectedKategorie.length > 0 || selectedZnacky.length > 0 || search.trim() !== "";

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-2">Katalog produktů</h1>
      <p className="text-gray-500 mb-8">
        Prohlédněte si naši nabídku reklamního textilu.
      </p>

      {/* Mobilní tlačítko pro filtry */}
      <button
        type="button"
        onClick={() => setFiltersOpen(!filtersOpen)}
        className="lg:hidden mb-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium hover:border-gray-400 transition-colors cursor-pointer"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
          />
        </svg>
        Filtry
        {hasFilters && (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-xs">
            {selectedKategorie.length + selectedZnacky.length + (search.trim() ? 1 : 0)}
          </span>
        )}
      </button>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar filtry */}
        <aside
          className={`lg:w-64 shrink-0 space-y-6 ${
            filtersOpen ? "block" : "hidden lg:block"
          }`}
        >
          {/* Vyhledávání */}
          <div>
            <label className="block text-sm font-semibold mb-2">
              Vyhledávání
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Název nebo kód..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>

          {/* Kategorie */}
          {kategorie.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Kategorie</h3>
              <div className="space-y-1.5">
                {kategorie.map((k) => (
                  <label
                    key={k.id}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedKategorie.includes(k.nazev)}
                      onChange={() =>
                        toggleFilter(
                          k.nazev,
                          selectedKategorie,
                          setSelectedKategorie
                        )
                      }
                      className="rounded border-gray-300 text-primary focus:ring-primary/20 accent-[#2563eb]"
                    />
                    {k.nazev}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Značky */}
          {znacky.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Značka</h3>
              <div className="space-y-1.5">
                {znacky.map((z) => (
                  <label
                    key={z.id}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedZnacky.includes(z.nazev)}
                      onChange={() =>
                        toggleFilter(
                          z.nazev,
                          selectedZnacky,
                          setSelectedZnacky
                        )
                      }
                      className="rounded border-gray-300 text-primary focus:ring-primary/20 accent-[#2563eb]"
                    />
                    {z.nazev}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Reset filtrů */}
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setSelectedKategorie([]);
                setSelectedZnacky([]);
                setSearch("");
              }}
              className="text-sm text-primary hover:text-primary-hover transition-colors cursor-pointer"
            >
              Zrušit všechny filtry
            </button>
          )}
        </aside>

        {/* Grid produktů */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">📦</div>
              {produkty.length === 0 ? (
                <>
                  <h2 className="text-xl font-semibold mb-2">
                    Katalog se připravuje
                  </h2>
                  <p className="text-gray-500">
                    Brzy zde najdete kompletní nabídku produktů.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-semibold mb-2">
                    Žádné produkty nenalezeny
                  </h2>
                  <p className="text-gray-500">
                    Zkuste změnit filtry nebo vyhledávání.
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-4">
                {filtered.length}{" "}
                {filtered.length === 1
                  ? "produkt"
                  : filtered.length < 5
                    ? "produkty"
                    : "produktů"}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filtered.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-sm transition-shadow flex flex-col"
                  >
                    {/* Obrázek — object-contain aby byl vidět celý produkt */}
                    <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden p-3">
                      {p.obrazek_url ? (
                        <img
                          src={p.obrazek_url}
                          alt={p.nazev}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="text-5xl opacity-40">👕</span>
                      )}
                    </div>

                    {/* Info — flex-1 + flex-col pro zarovnání tlačítka dolů */}
                    <div className="p-4 flex flex-col flex-1">
                      <h3 className="font-semibold text-sm leading-tight mb-1 line-clamp-2">
                        {p.nazev}
                      </h3>
                      {p.znacka && (
                        <p className="text-xs text-gray-500 mb-1">
                          {p.znacka.nazev}
                        </p>
                      )}
                      {/* Krátký popis produktu místo materiálu */}
                      {p.popis && (
                        <p className="text-xs text-gray-400 mb-1 line-clamp-2">
                          {p.popis}
                        </p>
                      )}
                      {p.gramaz && (
                        <p className="text-xs text-gray-400 mb-1">
                          {p.gramaz} g/m²
                        </p>
                      )}

                      {/* Cena — VK1000 × 2 = doporučená */}
                      {cenyMap[p.kod] && (
                        <div className="mb-2">
                          <p className="text-sm font-semibold text-primary">
                            od {cenyMap[p.kod].toLocaleString("cs-CZ")} Kč
                            <span className="text-xs font-normal text-gray-400 ml-1">bez DPH</span>
                          </p>
                          <p className="text-xs text-gray-400">
                            od {Math.round(cenyMap[p.kod] * 1.21).toLocaleString("cs-CZ")} Kč s DPH
                          </p>
                        </div>
                      )}

                      {/* Barevné tečky */}
                      {p.barvy && p.barvy.length > 0 && (
                        <div className="flex items-center gap-1.5 mb-3">
                          {p.barvy.slice(0, 8).map((b) => (
                            <span
                              key={b.id}
                              title={b.nazev}
                              className="w-5 h-5 rounded-full border border-gray-300 shrink-0"
                              style={{
                                backgroundColor: b.hex_kod || "#ccc",
                              }}
                            />
                          ))}
                          {p.barvy.length > 8 && (
                            <span className="text-xs text-gray-400 ml-0.5">
                              +{p.barvy.length - 8}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Tlačítko vždy dole */}
                      <a
                        href={`/katalog/${p.kod}`}
                        className="block w-full text-center px-3 py-2 text-sm font-medium rounded-lg border border-primary text-primary hover:bg-primary hover:text-white transition-colors mt-auto"
                      >
                        Detail
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
