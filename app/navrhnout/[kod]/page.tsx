"use client";

import { useState, useEffect, useRef, use, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import {
  Upload,
  Trash2,
  Loader2,
  ArrowLeft,
  ImageIcon,
  Check,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Typy
// ---------------------------------------------------------------------------

interface Barva {
  id: string;
  nazev: string;
  hex_kod: string | null;
  obrazek_url: string | null;
}

interface ProduktDetail {
  id: string;
  kod: string;
  nazev: string;
  obrazek_url: string | null;
  kategorie: { nazev: string } | null;
  barvy: Barva[];
}

type TypZpracovani = "potisk" | "vysivka";

// fabric instance typy držíme jako any — knihovna se načítá dynamicky (browser-only)
/* eslint-disable @typescript-eslint/no-explicit-any */

function proxied(url: string): string {
  return `/api/produkt-image?url=${encodeURIComponent(url)}`;
}

// ---------------------------------------------------------------------------
// Stránka
// ---------------------------------------------------------------------------

export default function NavrhnoutPage({
  params,
}: {
  params: Promise<{ kod: string }>;
}) {
  const { kod } = use(params);

  const [produkt, setProdukt] = useState<ProduktDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedBarvaId, setSelectedBarvaId] = useState<string | null>(null);
  const [typZpracovani, setTypZpracovani] = useState<TypZpracovani>("potisk");
  const [hasLogo, setHasLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cenaOd, setCenaOd] = useState<number | null>(null);

  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const canvasRef = useRef<any>(null);
  const fabricRef = useRef<any>(null);
  const bgRef = useRef<any>(null);
  const logoDataUrlRef = useRef<string | null>(null);
  const logoTypRef = useRef<string>("image/png");

  // ---- Načtení produktu ----
  useEffect(() => {
    async function load() {
      try {
        const sb = getSupabase();
        const { data, error: err } = await sb
          .from("produkty")
          .select(
            "id, kod, nazev, obrazek_url, kategorie:kategorie(nazev), barvy:produkt_barvy(id, nazev, hex_kod, obrazek_url)"
          )
          .eq("kod", kod)
          .eq("aktivni", true)
          .single();
        if (err || !data) {
          setNotFound(true);
        } else {
          const p = data as unknown as ProduktDetail;
          setProdukt(p);
          if (p.barvy && p.barvy.length > 0) setSelectedBarvaId(p.barvy[0].id);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [kod]);

  // ---- Cena pro předání do poptávky ----
  useEffect(() => {
    if (!produkt) return;
    const barva = produkt.barvy?.find((b) => b.id === selectedBarvaId)?.nazev;
    fetch(
      `/api/produkt-price/${encodeURIComponent(kod)}${barva ? `?barva=${encodeURIComponent(barva)}` : ""}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { cenaOd: number | null } | null) => setCenaOd(j?.cenaOd ?? null))
      .catch(() => setCenaOd(null));
  }, [kod, selectedBarvaId, produkt]);

  // ---- Inicializace fabric canvasu ----
  useEffect(() => {
    if (loading || notFound || !produkt) return;
    let disposed = false;

    (async () => {
      const fabric = await import("fabric");
      fabricRef.current = fabric;
      if (disposed || !canvasElRef.current) return;

      const size = Math.min(480, (typeof window !== "undefined" ? window.innerWidth : 480) - 48);
      const canvas = new fabric.Canvas(canvasElRef.current, {
        width: size,
        height: size,
        backgroundColor: "#ffffff",
        preserveObjectStacking: true,
      });
      canvasRef.current = canvas;
      await setBackground();
    })();

    return () => {
      disposed = true;
      if (canvasRef.current) {
        canvasRef.current.dispose();
        canvasRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, notFound, produkt]);

  // ---- Pozadí (fotka produktu dle barvy) ----
  const setBackground = useCallback(async () => {
    const canvas = canvasRef.current;
    const fabric = fabricRef.current;
    if (!canvas || !fabric || !produkt) return;

    const barva = produkt.barvy?.find((b) => b.id === selectedBarvaId);
    const imgUrl = barva?.obrazek_url || produkt.obrazek_url;
    if (!imgUrl) return;

    try {
      const img = await fabric.FabricImage.fromURL(proxied(imgUrl), {
        crossOrigin: "anonymous",
      });
      const cw = canvas.getWidth();
      const ch = canvas.getHeight();
      const scale = Math.min((cw * 0.92) / img.width, (ch * 0.92) / img.height);
      img.set({
        left: cw / 2,
        top: ch / 2,
        originX: "center",
        originY: "center",
        scaleX: scale,
        scaleY: scale,
        selectable: false,
        evented: false,
      });
      if (bgRef.current) canvas.remove(bgRef.current);
      canvas.add(img);
      canvas.sendObjectToBack(img);
      bgRef.current = img;
      canvas.requestRenderAll();
    } catch {
      /* fotka nešla načíst — necháme bílé plátno */
    }
  }, [produkt, selectedBarvaId]);

  // Změna barvy → překreslit pozadí
  useEffect(() => {
    if (canvasRef.current) setBackground();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBarvaId]);

  // ---- Upload loga ----
  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setError("Logo je příliš velké (max 8 MB).");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      logoDataUrlRef.current = dataUrl;
      logoTypRef.current = file.type || "image/png";
      const canvas = canvasRef.current;
      const fabric = fabricRef.current;
      if (!canvas || !fabric) return;
      const img = await fabric.FabricImage.fromURL(dataUrl);
      const target = canvas.getWidth() * 0.32;
      img.scaleToWidth(target);
      img.set({
        left: canvas.getWidth() / 2,
        top: canvas.getHeight() / 2,
        originX: "center",
        originY: "center",
        cornerColor: "#8B5CF6",
        cornerStyle: "circle",
        transparentCorners: false,
        borderColor: "#8B5CF6",
      });
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.requestRenderAll();
      setHasLogo(true);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function deleteSelected() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const obj = canvas.getActiveObject();
    if (obj && obj !== bgRef.current) {
      canvas.remove(obj);
      canvas.requestRenderAll();
      // zbyly ještě nějaké logo objekty?
      const others = canvas.getObjects().filter((o: any) => o !== bgRef.current);
      if (others.length === 0) {
        setHasLogo(false);
        logoDataUrlRef.current = null;
      }
    }
  }

  // ---- Uložení návrhu ----
  async function ulozit() {
    const canvas = canvasRef.current;
    if (!canvas || !produkt) return;
    if (!hasLogo) {
      setError("Nahrajte nejdřív logo nebo grafiku.");
      return;
    }
    setSaving(true);
    setError(null);

    // deselect ať se nevykreslí ovládací rámeček
    canvas.discardActiveObject();
    canvas.requestRenderAll();

    try {
      const nahled = canvas.toDataURL({ format: "png", multiplier: 2 });
      const barva = produkt.barvy?.find((b) => b.id === selectedBarvaId)?.nazev ?? null;

      const res = await fetch("/api/upload-design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          produkt_kod: produkt.kod,
          produkt_nazev: produkt.nazev,
          barva,
          typ_zpracovani: typZpracovani,
          nahled_base64: nahled,
          logo_base64: logoDataUrlRef.current,
          logo_typ: logoTypRef.current,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Uložení selhalo.");

      // Přejít do poptávky s návrhem
      const qp = new URLSearchParams({
        produkt: produkt.kod,
        nazev: produkt.nazev,
        cena: String(cenaOd ?? 0),
        typ: typZpracovani,
        navrh: json.nahled_url,
      });
      if (barva) qp.set("barva", barva);
      if (produkt.kategorie) qp.set("kategorie", produkt.kategorie.nazev);
      window.location.href = `/?${qp.toString()}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Neznámá chyba.");
      setSaving(false);
    }
  }

  // ---- Render ----
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: "var(--primary)" }} />
      </div>
    );
  }

  if (notFound || !produkt) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold mb-2">Produkt nenalezen</h1>
        <a href="/katalog" className="btn btn-primary mt-4 inline-flex">Zpět na katalog</a>
      </div>
    );
  }

  const selectedBarva = produkt.barvy?.find((b) => b.id === selectedBarvaId) || null;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm mb-6 flex items-center gap-2" style={{ color: "var(--muted)" }}>
        <a href="/katalog" className="hover:underline">Katalog</a>
        <span>/</span>
        <a href={`/katalog/${encodeURIComponent(produkt.kod)}`} className="hover:underline">
          {produkt.nazev}
        </a>
        <span>/</span>
        <span style={{ color: "var(--foreground)" }}>Navrhnout potisk</span>
      </nav>

      <h1 className="text-2xl font-bold mb-1">Navrhněte si potisk</h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        Nahrajte logo, umístěte ho na produkt a pošlete nám návrh do poptávky.
      </p>

      <div className="flex flex-col lg:flex-row gap-8 lg:items-start">
        {/* Plátno */}
        <div className="lg:flex-1">
          <div
            className="rounded-2xl p-4 flex items-center justify-center"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
          >
            <canvas ref={canvasElRef} className="rounded-lg shadow-sm" />
          </div>
          <p className="text-xs mt-2 text-center" style={{ color: "var(--muted-light)" }}>
            Logo lze táhnout, zvětšit za rohy a otáčet. Náhled je orientační.
          </p>
        </div>

        {/* Ovládání */}
        <div className="lg:w-80 space-y-6">
          {/* Barva */}
          {produkt.barvy && produkt.barvy.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">
                Barva: <span className="font-normal" style={{ color: "var(--muted)" }}>{selectedBarva?.nazev || "—"}</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {produkt.barvy.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    title={b.nazev}
                    onClick={() => setSelectedBarvaId(b.id)}
                    className="w-8 h-8 rounded-full border-2 transition-all cursor-pointer"
                    style={{
                      backgroundColor: b.hex_kod || "#ccc",
                      borderColor: selectedBarvaId === b.id ? "var(--primary)" : "var(--border)",
                      transform: selectedBarvaId === b.id ? "scale(1.12)" : "none",
                      boxShadow: selectedBarvaId === b.id ? "0 0 0 3px var(--primary-100)" : "none",
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Typ zpracování */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Zpracování</h3>
            <div className="grid grid-cols-2 gap-2">
              {(["potisk", "vysivka"] as TypZpracovani[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypZpracovani(t)}
                  className="px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5"
                  style={{
                    background: typZpracovani === t ? "var(--primary)" : "var(--surface)",
                    color: typZpracovani === t ? "#fff" : "var(--foreground)",
                    border: `1.5px solid ${typZpracovani === t ? "var(--primary)" : "var(--border)"}`,
                  }}
                >
                  {typZpracovani === t && <Check className="w-3.5 h-3.5" />}
                  {t === "potisk" ? "Potisk" : "Výšivka"}
                </button>
              ))}
            </div>
          </div>

          {/* Upload + akce */}
          <div className="space-y-2">
            <label
              className="w-full px-4 py-3 rounded-lg text-sm font-medium cursor-pointer flex items-center justify-center gap-2 transition-all"
              style={{ background: "var(--primary-50)", color: "var(--primary)", border: "1.5px dashed var(--primary-light)" }}
            >
              <Upload className="w-4 h-4" />
              {hasLogo ? "Nahrát jiné logo" : "Nahrát logo / grafiku"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={handleLogoUpload}
                className="hidden"
              />
            </label>

            {hasLogo && (
              <button
                type="button"
                onClick={deleteSelected}
                className="w-full px-4 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all"
                style={{ background: "var(--surface)", color: "var(--muted)", border: "1.5px solid var(--border)" }}
              >
                <Trash2 className="w-4 h-4" />
                Smazat vybraný prvek
              </button>
            )}
          </div>

          {error && (
            <p className="text-sm px-3 py-2 rounded-lg" style={{ background: "#FEF2F2", color: "#DC2626" }}>
              {error}
            </p>
          )}

          {/* Uložit */}
          <button
            type="button"
            onClick={ulozit}
            disabled={saving}
            className="btn btn-primary w-full py-3 disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Ukládám návrh…
              </>
            ) : (
              <>
                <ImageIcon className="w-4 h-4" /> Uložit a do poptávky
              </>
            )}
          </button>

          <a
            href={`/katalog/${encodeURIComponent(produkt.kod)}`}
            className="btn btn-ghost w-full py-2.5 text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Zpět na detail
          </a>
        </div>
      </div>
    </div>
  );
}
