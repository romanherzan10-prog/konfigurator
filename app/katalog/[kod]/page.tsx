"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { use } from "react";
import { getSupabase } from "@/lib/supabase";
import { sDph } from "@/lib/pricing";

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
    <div className="ap-pd">
      <div className="ap-pd-grid">
        <div className="ap-pd-media">
          <div className="ap-pd-stage ap-pd-price-skeleton" style={{ width: "100%", height: "auto" }} />
        </div>
        <div>
          <div className="ap-pd-price-skeleton" style={{ width: "70%", height: "2.6rem" }} />
          <div className="ap-pd-price-skeleton" style={{ width: "40%", height: "1rem", marginTop: "1rem" }} />
          <div className="ap-pd-price-skeleton" style={{ width: "55%", height: "2.2rem", marginTop: "2rem" }} />
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
      <div className="ap-pd-empty">
        <h1 className="ap-h2 ap-center">Produkt nenalezen.</h1>
        <p className="ap-lead ap-center">
          Kód „{kod}“ v katalogu nemáme. Možná se přejmenoval, nebo ho
          dodavatel stáhl z nabídky.
        </p>
        <div className="ap-cta-row ap-center-row">
          <Link href="/katalog" className="ap-pill" data-tone="primary"
             style={{ background: "var(--ap-accent)", color: "#fff" }}>
            Zpět do katalogu
          </Link>
        </div>
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
    <div className="ap-pd">
      <nav className="ap-crumbs" aria-label="Drobečková navigace">
        <Link href="/katalog">Katalog</Link>
        <span aria-hidden>/</span>
        <strong>{produkt.nazev}</strong>
      </nav>

      <div className="ap-pd-grid">
        {/* ── Obrázek (na desktopu lepivý) ── */}
        <div className="ap-pd-media">
          <div className="ap-pd-stage">
            {bigImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={bigImage}
                alt={
                  selectedBarva
                    ? `${produkt.nazev} — ${selectedBarva.nazev}`
                    : produkt.nazev
                }
              />
            ) : (
              <span className="ap-pd-stage-empty" aria-hidden>
                👕
              </span>
            )}
          </div>

          {galerie.length > 1 && (
            <div className="ap-pd-thumbs">
              {galerie.map((src, i) => {
                const aktivni = src === bigImage;
                const jeMockup = mockupy.includes(src);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveImg(src)}
                    className="ap-pd-thumb"
                    data-active={aktivni ? "1" : undefined}
                    aria-label={
                      jeMockup
                        ? "Ukázka s logem"
                        : `Náhled ${i + 1}`
                    }
                    aria-pressed={aktivni}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" />
                    {jeMockup && <span className="ap-pd-thumb-tag">UKÁZKA</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Údaje ── */}
        <div>
          <h1 className="ap-pd-title">{produkt.nazev}</h1>
          <p className="ap-pd-meta">
            {produkt.znacka && <span>{produkt.znacka.nazev}</span>}
            <span className="ap-pd-code">{produkt.kod}</span>
          </p>

          {/* ── Cena ── */}
          <div className="ap-pd-price">
            <p className="ap-pd-price-label">Doporučená cena</p>
            {hasCeny ? (
              <>
                <div className="ap-pd-price-row">
                  <span className="ap-pd-price-big">
                    {cenaOd === cenaDo || cenaDo == null
                      ? formatKc(cenaOd)
                      : `od ${formatKc(cenaOd)}`}
                  </span>
                  <span className="ap-pd-price-unit">bez DPH / ks</span>
                </div>
                <p className="ap-pd-price-vat">
                  {cenaOd === cenaDo || cenaDo == null ? "" : "od "}
                  {sDph(cenaOd!).toLocaleString("cs-CZ")} Kč s DPH
                </p>
                <p className="ap-pd-price-note">
                  Cena za samotný produkt bez potisku a výšivky. Finální cenu
                  včetně zdobení a množstevní slevy potvrdíme v nezávazné nabídce.
                </p>
              </>
            ) : cenaLoading ? (
              <div className="ap-pd-price-skeleton" />
            ) : (
              <>
                <div className="ap-pd-price-row">
                  <span className="ap-pd-price-big">Cena na dotaz</span>
                </div>
                <p className="ap-pd-price-note">
                  Cenu se teď nepodařilo načíst. Přidejte produkt do poptávky
                  nebo se zeptejte v chatu — rádi ji spočítáme.
                </p>
              </>
            )}
          </div>

          {/* ── Barva ── */}
          {produkt.barvy && produkt.barvy.length > 0 && (
            <div className="ap-pd-block">
              <h2 className="ap-pd-block-h">
                Barva: <em>{selectedBarva?.nazev || "—"}</em>
              </h2>
              <div className="ap-pd-swatches">
                {produkt.barvy.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    title={b.nazev}
                    aria-label={b.nazev}
                    aria-pressed={selectedBarvaId === b.id}
                    onClick={() => setSelectedBarvaId(b.id)}
                    className="ap-pd-swatch"
                    data-active={selectedBarvaId === b.id ? "1" : undefined}
                    style={{ backgroundColor: b.hex_kod || "#ccc" }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Dostupnost ── */}
          {skladItems.length > 0 && (
            <div className="ap-pd-block">
              <h2 className="ap-pd-block-h">Dostupné velikosti</h2>
              <dl className="ap-pd-specs">
                {skladItems.map((sk) => (
                  <div
                    key={sk.id}
                    className="ap-pd-spec"
                    data-out={sk.skladem === 0 ? "1" : undefined}
                  >
                    <dt>{sk.velikost}</dt>
                    <dd>
                      <span
                        className="ap-pd-dot"
                        data-in={sk.skladem > 0 ? "1" : "0"}
                        aria-hidden
                      />
                      {sk.skladem > 0 ? `${sk.skladem} ks` : "Není skladem"}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {selectedBarva && skladItems.length === 0 && (
            <p className="ap-pd-desc">
              Informace o dostupnosti u téhle barvy nemáme.
            </p>
          )}

          {/* ── Parametry ── */}
          {(produkt.material ||
            produkt.gramaz ||
            produkt.hmotnost_g ||
            produkt.kategorie) && (
            <div className="ap-pd-block">
              <h2 className="ap-pd-block-h">Parametry</h2>
              <dl className="ap-pd-specs">
                {produkt.material && (
                  <div className="ap-pd-spec">
                    <dt>Materiál</dt>
                    <dd>{produkt.material}</dd>
                  </div>
                )}
                {produkt.gramaz && (
                  <div className="ap-pd-spec">
                    <dt>Gramáž</dt>
                    <dd>{produkt.gramaz} g/m²</dd>
                  </div>
                )}
                {produkt.hmotnost_g && (
                  <div className="ap-pd-spec">
                    <dt>Hmotnost</dt>
                    <dd>{produkt.hmotnost_g} g</dd>
                  </div>
                )}
                {produkt.kategorie && (
                  <div className="ap-pd-spec">
                    <dt>Kategorie</dt>
                    <dd>{produkt.kategorie.nazev}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {produkt.popis && <p className="ap-pd-desc">{produkt.popis}</p>}

          {/* ── Akce ── */}
          <div className="ap-cta-row">
            <Link
              href={`/navrhnout/${encodeURIComponent(produkt.kod)}`}
              className="ap-pill"
              data-tone="primary"
              style={{ background: "var(--ap-accent)", color: "#fff" }}
            >
              Navrhnout potisk
            </Link>
            <Link
              href={`/konfigurator?produkt=${encodeURIComponent(produkt.kod)}&nazev=${encodeURIComponent(produkt.nazev)}&cena=${cenaOd ?? 0}${selectedBarva ? `&barva=${encodeURIComponent(selectedBarva.nazev)}` : ""}${produkt.kategorie ? `&kategorie=${encodeURIComponent(produkt.kategorie.nazev)}` : ""}`}
              className="ap-pill"
              data-tone="ghost"
              style={{ border: "1px solid currentColor" }}
            >
              Přidat do košíku
            </Link>
          </div>

          <Link href="/katalog" className="ap-pd-back">
            ← Zpět do katalogu
          </Link>
        </div>
      </div>
    </div>
  );
}
