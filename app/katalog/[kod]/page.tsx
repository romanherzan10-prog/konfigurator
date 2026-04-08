"use client";

import { useState, useEffect } from "react";
import { use } from "react";
import { getSupabase } from "@/lib/supabase";

interface SkladItem {
  id: string;
  velikost: string;
  skladem: number;
  cena_nakupni: number | null;
}

interface Cenik {
  cena_1: number | null;
  cena_10: number | null;
  cena_100: number | null;
  cena_500: number | null;
  cena_1000: number | null;
  barva: string | null;
  velikost: string | null;
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
  gramaz: number | null;
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
      <div className="h-4 bg-gray-100 rounded w-48 mb-8" />
      <div className="flex flex-col lg:flex-row gap-10">
        <div className="lg:w-1/2">
          <div className="aspect-square bg-gray-100 rounded-xl" />
        </div>
        <div className="lg:w-1/2 space-y-4">
          <div className="h-8 bg-gray-100 rounded w-3/4" />
          <div className="h-4 bg-gray-100 rounded w-1/3" />
          <div className="h-4 bg-gray-100 rounded w-1/2" />
          <div className="h-20 bg-gray-100 rounded" />
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="w-8 h-8 rounded-full bg-gray-100" />
            ))}
          </div>
          <div className="h-40 bg-gray-100 rounded" />
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
  const [ceniky, setCeniky] = useState<Cenik[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedBarvaId, setSelectedBarvaId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const sb = getSupabase();
        const [{ data, error }, cenikRes] = await Promise.all([
          sb
            .from("produkty")
            .select(
              "*, znacka:znacky(*), kategorie:kategorie(*), barvy:produkt_barvy(*, sklad:produkt_sklad(*))"
            )
            .eq("kod", kod)
            .eq("aktivni", true)
            .single(),
          sb
            .from("ceniky")
            .select("cena_1, cena_10, cena_100, cena_500, cena_1000, barva, velikost")
            .eq("katalogove_cislo", kod),
        ]);

        if (error || !data) {
          setNotFound(true);
        } else {
          const p = data as ProduktDetail;
          setProdukt(p);
          setCeniky((cenikRes.data as Cenik[]) || []);
          if (p.barvy && p.barvy.length > 0) {
            setSelectedBarvaId(p.barvy[0].id);
          }
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [kod]);

  if (loading) return <DetailSkeleton />;

  if (notFound || !produkt) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <div className="text-5xl mb-4">🔍</div>
        <h1 className="text-2xl font-bold mb-2">Produkt nenalezen</h1>
        <p className="text-gray-500 mb-6">
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
  const skladItems = selectedBarva?.sklad ? [...selectedBarva.sklad].sort(sortVelikosti) : [];

  // Doporučená cena pro zákazníky — pouze cena_1 (VKEinzel)
  // Ostatní ceny (VK10–VK1000) jsou nákupní a nejsou zobrazeny
  const selectedBarvaNazev = selectedBarva?.nazev?.toLowerCase() || null;
  const relevantniCeniky = ceniky.filter(c =>
    !c.barva || !selectedBarvaNazev || c.barva.toLowerCase() === selectedBarvaNazev
  );

  const doporuceneCeny = relevantniCeniky
    .map(c => c.cena_1)
    .filter((v): v is number => v != null && v > 0);

  const cenaOd = doporuceneCeny.length > 0 ? Math.min(...doporuceneCeny) : null;
  const cenaDo = doporuceneCeny.length > 1 ? Math.max(...doporuceneCeny) : null;
  const hasCeny = cenaOd != null;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-6">
        <a href="/katalog" className="hover:text-primary transition-colors">
          Katalog
        </a>
        <span className="mx-2">/</span>
        <span className="text-gray-900">{produkt.nazev}</span>
      </nav>

      <div className="flex flex-col lg:flex-row gap-10">
        {/* Obrázek vlevo */}
        <div className="lg:w-1/2">
          <div className="aspect-square bg-gray-50 rounded-xl flex items-center justify-center overflow-hidden border border-gray-100">
            {displayImage ? (
              <img
                src={displayImage}
                alt={selectedBarva ? `${produkt.nazev} - ${selectedBarva.nazev}` : produkt.nazev}
                className="w-full h-full object-contain p-4"
              />
            ) : (
              <span className="text-8xl opacity-20">👕</span>
            )}
          </div>
        </div>

        {/* Info vpravo */}
        <div className="lg:w-1/2 space-y-5">
          <div>
            <h1 className="text-2xl font-bold mb-1">{produkt.nazev}</h1>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              {produkt.znacka && <span>{produkt.znacka.nazev}</span>}
              <span className="text-gray-300">·</span>
              <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{produkt.kod}</span>
            </div>
          </div>

          {/* Doporučená cena */}
          {hasCeny && (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 bg-primary/5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Doporučená cena
                </p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-primary tabular-nums">
                    {cenaOd === cenaDo || cenaDo == null
                      ? formatKc(cenaOd)
                      : `od ${formatKc(cenaOd)}`}
                  </span>
                  <span className="text-sm text-gray-400">bez DPH / ks</span>
                </div>
              </div>
              <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100">
                <p className="text-xs text-gray-500">
                  Cena závisí na barvě a velikosti. Při větším množství nabízíme slevu — kontaktujte nás pro individuální nabídku.
                </p>
              </div>
            </div>
          )}

          {/* Parametry */}
          <div className="text-sm text-gray-500 space-y-1">
            {produkt.material && (
              <p>
                <span className="font-medium text-gray-700">Materiál:</span>{" "}
                {produkt.material}
              </p>
            )}
            {produkt.gramaz && (
              <p>
                <span className="font-medium text-gray-700">Gramáž:</span>{" "}
                {produkt.gramaz} g/m²
              </p>
            )}
            {produkt.kategorie && (
              <p>
                <span className="font-medium text-gray-700">Kategorie:</span>{" "}
                {produkt.kategorie.nazev}
              </p>
            )}
          </div>

          {produkt.popis && (
            <p className="text-sm text-gray-600 leading-relaxed">{produkt.popis}</p>
          )}

          {/* Výběr barvy */}
          {produkt.barvy && produkt.barvy.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">
                Barva:{" "}
                <span className="font-normal text-gray-500">{selectedBarva?.nazev || "---"}</span>
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
                        : "border-gray-300 hover:border-gray-400"
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
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-4 py-2 font-medium text-gray-700">Velikost</th>
                      <th className="text-right px-4 py-2 font-medium text-gray-700">Skladem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skladItems.map((s) => (
                      <tr
                        key={s.id}
                        className={`border-t border-gray-100 ${s.skladem === 0 ? "text-gray-400" : ""}`}
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
            <p className="text-sm text-gray-400">Informace o dostupnosti nejsou k dispozici.</p>
          )}

          {/* CTA */}
          <a
            href={`/?produkt=${encodeURIComponent(produkt.kod)}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary-hover transition-colors"
          >
            Poptat tento produkt
          </a>
        </div>
      </div>
    </div>
  );
}
