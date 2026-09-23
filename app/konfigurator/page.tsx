"use client";

import { useState, useMemo, useRef, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  LOCATION_OPTIONS,
  DEFAULT_CONFIG,
  getProductTypes,
  getLogoSizes,
  calculateEstimate,
  formatPrice,
  type ProductType,
  type ServiceType,
  type LogoPlacement,
  type KonfiguratorNastaveni,
  type Estimate,
} from "@/lib/pricing";
import { getSupabase } from "@/lib/supabase";
import {
  type CartItem,
  loadCart,
  saveCart,
  clearCart,
  createCartItemFromCatalog,
  createMerchCartItem,
  createEmptyCartItem,
  isMerch,
  merchLineTotal,
  maVelikosti,
  rozpisPolozky,
  efektivniMnozstvi,
  srovnejMnozstvi,
  velikostDoPoptavky,
  MIN_KS_TEXTIL,
  MAX_KS_TEXTIL,
} from "@/lib/cart";
import {
  VELIKOSTI,
  VELIKOST_LABEL,
  parseRozpis,
  formatRozpis,
  rozpisDoTextu,
  prazdnyRozpis,
  soucetRozpisu,
  type VelikostKlic,
} from "@/lib/velikosti";

/** Odhad ceny textilní položky (katalogová cena přepíše cenu typu produktu). */
function odhadTextilu(item: CartItem, config: KonfiguratorNastaveni): Estimate {
  const eff = item.catalogCena
    ? { ...config, [`cena_${item.productType}`]: item.catalogCena }
    : config;
  return calculateEstimate(
    item.productType,
    item.serviceType,
    efektivniMnozstvi(item),
    item.serviceType === "clean" ? [] : item.placements,
    eff as KonfiguratorNastaveni
  );
}

/* ─── Kontakt zapamatovaný na tomto zařízení (jen localStorage) ─── */

const KONTAKT_KEY = "loooku_kontakt";

interface UlozenyKontakt {
  jmeno: string;
  prijmeni: string;
  email: string;
  telefon: string;
  firma: string;
  ico: string;
}

function nactiKontakt(): UlozenyKontakt | null {
  try {
    const raw = localStorage.getItem(KONTAKT_KEY);
    if (!raw) return null;
    const d: unknown = JSON.parse(raw);
    if (!d || typeof d !== "object") return null;
    const o = d as Record<string, unknown>;
    const s = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
    return {
      jmeno: s(o.jmeno, 100),
      prijmeni: s(o.prijmeni, 100),
      email: s(o.email, 200),
      telefon: s(o.telefon, 50),
      firma: s(o.firma, 200),
      ico: s(o.ico, 20),
    };
  } catch {
    return null; // nedostupné úložiště (soukromý režim) nebo poškozený záznam
  }
}

function ulozKontakt(k: UlozenyKontakt) {
  try {
    localStorage.setItem(KONTAKT_KEY, JSON.stringify(k));
  } catch {
    /* úložiště nedostupné — nevadí, jen si údaje nezapamatujeme */
  }
}

function zapomenKontakt() {
  try {
    localStorage.removeItem(KONTAKT_KEY);
  } catch {
    /* úložiště nedostupné — není co mazat */
  }
}

/* ─── Počet kusů: volné psaní, potvrzení Enterem nebo opuštěním pole ── */

function QtyInput({
  id,
  ariaLabel,
  value,
  min,
  max,
  onCommit,
  readOnly = false,
  className,
}: {
  id?: string;
  ariaLabel?: string;
  value: number;
  min: number;
  max: number;
  onCommit: (quantity: number) => void;
  readOnly?: boolean;
  className: string;
}) {
  // Rozepsaný text (jen číslice); null = needituje se, pole ukazuje `value`.
  // Rozmezí min–max se hlídá až při potvrzení — při psaní by z „30" bylo „50".
  const [draft, setDraft] = useState<string | null>(null);

  function commit() {
    if (draft === null) return;
    setDraft(null);
    const n = Number.parseInt(draft, 10);
    if (readOnly || Number.isNaN(n)) return; // prázdné pole → zůstane původní počet
    const q = Math.min(max, Math.max(min, n));
    if (q !== value) onCommit(q);
  }

  return (
    <input
      id={id}
      aria-label={ariaLabel}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      readOnly={readOnly}
      value={readOnly || draft === null ? String(value) : draft}
      onChange={(e) => {
        const cislice = e.target.value.replace(/\D/g, "");
        if (cislice.length <= 5) setDraft(cislice);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          setDraft(null);
        }
      }}
      className={className}
    />
  );
}

function defaultDeadline(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().split("T")[0];
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

const PRODUCT_ICONS: Record<ProductType, string> = {
  tricko: "👕",
  polokosile: "👔",
  mikina: "🧥",
  bunda: "🧥",
  cepice: "🧢",
  taska: "👜",
};

const SERVICE_LABELS: Record<ServiceType, { label: string; short: string }> = {
  print: { label: "Potisk", short: "Potisk" },
  embroidery: { label: "Výšivka", short: "Výšivka" },
  clean: { label: "Čistý textil", short: "Čistý" },
};

/* ─── Karta merch produktu (Printify, fixní cena) ───────────────── */

function MerchCartItemCard({
  item,
  onChange,
  onRemove,
  itemCount,
}: {
  item: CartItem;
  onChange: (updated: CartItem) => void;
  onRemove: () => void;
  itemCount: number;
}) {
  const lineTotal = merchLineTotal(item);
  function setQty(q: number) {
    onChange({ ...item, quantity: Math.max(1, Math.min(500, q || 1)) });
  }
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4">
        {item.nahledUrl ? (
          <img
            src={item.nahledUrl}
            alt="Náhled návrhu"
            className="w-14 h-14 rounded-lg object-contain shrink-0"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
          />
        ) : (
          <span className="text-2xl">✨</span>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate">{item.catalogNazev}</span>
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
              style={{ background: "var(--primary-50)", color: "var(--primary)" }}
            >
              Merch
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {item.catalogBarva && `${item.catalogBarva}`}
            {item.merchVelikost && ` · vel. ${item.merchVelikost}`}
            {item.nahledUrl && " · s vlastním potiskem"}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {formatPrice(item.merchUnitCena ?? 0)} / ks
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setQty(item.quantity - 1)}
            className="w-7 h-7 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer"
          >
            −
          </button>
          <QtyInput
            ariaLabel="Počet kusů"
            value={item.quantity}
            min={1}
            max={500}
            onCommit={setQty}
            className="w-12 text-center rounded-lg border border-gray-300 px-1 py-1 text-sm outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={() => setQty(item.quantity + 1)}
            className="w-7 h-7 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer"
          >
            +
          </button>
        </div>
        <span className="font-semibold text-primary whitespace-nowrap w-24 text-right">
          {formatPrice(lineTotal)}
        </span>
      </div>
      {(itemCount > 1 || item.nahledUrl) && (
        <div className="border-t border-gray-100 px-5 py-2 flex items-center justify-between">
          {item.nahledUrl ? (
            <span className="text-xs text-gray-400">Potisk doceníme v nabídce</span>
          ) : (
            <span />
          )}
          {itemCount > 1 && (
            <button
              type="button"
              onClick={onRemove}
              className="text-xs text-red-500 hover:text-red-700 transition-colors cursor-pointer"
            >
              Odebrat
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Komponenta jednoho produktu v košíku ──────────────────────── */

function CartItemCard({
  item,
  config,
  expanded,
  onToggle,
  onChange,
  onRemove,
  itemCount,
}: {
  item: CartItem;
  config: KonfiguratorNastaveni;
  expanded: boolean;
  onToggle: () => void;
  onChange: (updated: CartItem) => void;
  onRemove: () => void;
  itemCount: number;
}) {
  // Efektivní config — přepiš cenu pokud je z katalogu
  const effectiveConfig = useMemo(() => {
    if (!item.catalogCena) return config;
    const override = { ...config };
    const key = `cena_${item.productType}` as keyof KonfiguratorNastaveni;
    (override as Record<string, unknown>)[key] = item.catalogCena;
    return override;
  }, [config, item.catalogCena, item.productType]);

  const productTypes = useMemo(() => getProductTypes(effectiveConfig), [effectiveConfig]);
  const logoSizes = useMemo(() => getLogoSizes(effectiveConfig, item.serviceType), [effectiveConfig, item.serviceType]);

  const estimate = useMemo(
    () =>
      calculateEstimate(
        item.productType,
        item.serviceType,
        efektivniMnozstvi(item),
        item.serviceType === "clean" ? [] : item.placements,
        effectiveConfig
      ),
    [item, effectiveConfig]
  );

  // Rozpis velikostí (mřížka + „Další velikosti"). Když je vyplněný, počet kusů = jeho součet.
  const velikostiPovoleny = maVelikosti(item);
  const rozpisInfo = rozpisPolozky(item);
  const soucetVelikosti = rozpisInfo.celkem;
  const mnozstvi = soucetVelikosti > 0 ? soucetVelikosti : item.quantity;
  const rozpisText = formatRozpis(rozpisInfo.rozpis, rozpisInfo.jine);
  const dalsiText = (item.dalsiVelikosti ?? "").trim();
  const dalsi = dalsiText ? parseRozpis(dalsiText) : null;
  const [vlozeno, setVlozeno] = useState<{ ok: boolean; text: string } | null>(null);

  function update(patch: Partial<CartItem>) {
    // srovnejMnozstvi: s rozpisem velikostí je počet kusů jejich součet
    onChange(srovnejMnozstvi({ ...item, ...patch }));
  }

  function nastavVelikost(k: VelikostKlic, hodnota: string) {
    const cislice = hodnota.replace(/\D/g, "");
    if (cislice.length > 4) return; // víc než 9 999 ks jedné velikosti nebereme
    update({ rozpis: { ...prazdnyRozpis(), ...(item.rozpis ?? {}), [k]: Number(cislice) || 0 } });
    setVlozeno(null);
  }

  function nastavDalsiVelikosti(text: string) {
    update({ dalsiVelikosti: text || null });
    setVlozeno(null);
  }

  // Ctrl+V rozpisu z e-mailu / Excelu do kteréhokoliv políčka velikostí
  function vlozRozpis(e: React.ClipboardEvent<HTMLInputElement>, doMrizky: boolean) {
    const text = e.clipboardData.getData("text/plain");
    if (!text.trim() || /^\s*\d+\s*$/.test(text)) return; // obyčejné číslo → běžné vložení
    const p = parseRozpis(text);
    if (!p.rozpoznano) {
      // Do čísla nepouštět zbytky textu („S-XL, 2x" → „2"); do „Další velikosti" ano.
      if (doMrizky) {
        e.preventDefault();
        setVlozeno({ ok: false, text: "V textu jsme rozpis velikostí nenašli." });
      }
      return;
    }
    e.preventDefault();
    const patch: Partial<CartItem> = {
      dalsiVelikosti: rozpisDoTextu(prazdnyRozpis(), p.jine) || null,
    };
    // Mřížku přepíše jen text se standardními velikostmi — samotné „4XL 2" ji nesmaže.
    if (soucetRozpisu(p.rozpis) > 0) patch.rozpis = p.rozpis;
    update(patch);
    // Text navíc (jména, poznámky) do rozpisu nepatří — ukážeme ho, ať ho
    // zákazník případně napíše do „Další velikosti" nebo do poznámky.
    const navic = p.zbytek ? ` Nepoužito: „${p.zbytek.slice(0, 80)}${p.zbytek.length > 80 ? "…" : ""}“.` : "";
    setVlozeno({ ok: true, text: `Vloženo: ${formatRozpis(p.rozpis, p.jine)} (${p.celkem} ks).${navic}` });
  }

  function updatePlacement(idx: number, field: keyof LogoPlacement, value: string) {
    const newPlacements = item.placements.map((p, i) =>
      i === idx ? { ...p, [field]: value } : p
    );
    update({ placements: newPlacements });
  }

  function removePlacement(idx: number) {
    update({ placements: item.placements.filter((_, i) => i !== idx) });
  }

  function addPlacement() {
    update({ placements: [...item.placements, { location: "leve-prso", size: "male" }] });
  }

  // Collapsed view
  const productLabel = item.catalogNazev || productTypes[item.productType].label;
  const serviceLabel = SERVICE_LABELS[item.serviceType].short;

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Header — vždy viditelný */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 transition-colors cursor-pointer"
      >
        {item.nahledUrl ? (
          <img
            src={item.nahledUrl}
            alt="Náhled návrhu"
            className="w-12 h-12 rounded-lg object-contain shrink-0"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
          />
        ) : (
          <span className="text-2xl">{PRODUCT_ICONS[item.productType]}</span>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate">{productLabel}</span>
            {item.catalogKod && (
              <span
                className="text-xs px-1.5 py-0.5 rounded font-mono"
                style={{ background: "var(--primary-50)", color: "var(--primary)" }}
              >
                {item.catalogKod}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {mnozstvi} ks{rozpisText && ` (${rozpisText})`} · {serviceLabel}
            {item.catalogBarva && ` · ${item.catalogBarva}`}
            {" · "}
            <span className="font-medium text-gray-700">{formatPrice(estimate.totalPriceWithDph)}</span>
          </p>
        </div>
        <span className={`text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}>
          ▼
        </span>
      </button>

      {/* Expanded — editace */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-5 space-y-6">
          {/* Typ produktu */}
          {!item.catalogKod && (
            <div>
              <label className="block text-sm font-medium mb-2">Typ produktu</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {(Object.keys(productTypes) as ProductType[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => update({ productType: key })}
                    className={`flex flex-col items-center gap-0.5 rounded-lg border-2 p-2 text-center transition-all cursor-pointer text-xs ${
                      item.productType === key
                        ? "border-primary bg-[var(--primary-50)]"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span className="text-lg">{PRODUCT_ICONS[key]}</span>
                    <span className="font-medium">{productTypes[key].label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Zpracování */}
          <div>
            <label className="block text-sm font-medium mb-2">Zpracování</label>
            <div className="grid grid-cols-3 gap-2">
              {(["print", "embroidery", "clean"] as ServiceType[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (key === "clean") update({ serviceType: key, placements: [] });
                    else if (item.placements.length === 0)
                      update({ serviceType: key, placements: [{ location: "leve-prso", size: "male" }] });
                    else update({ serviceType: key });
                  }}
                  className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all cursor-pointer ${
                    item.serviceType === key
                      ? "border-primary bg-[var(--primary-50)]"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {SERVICE_LABELS[key].label}
                </button>
              ))}
            </div>
          </div>

          {/* Množství */}
          <div>
            <label htmlFor={`mnozstvi-${item.id}`} className="block text-sm font-medium mb-2">
              Počet kusů
            </label>
            <div className="flex items-center gap-3">
              <QtyInput
                id={`mnozstvi-${item.id}`}
                value={mnozstvi}
                min={MIN_KS_TEXTIL}
                max={MAX_KS_TEXTIL}
                readOnly={soucetVelikosti > 0}
                onCommit={(q) => update({ quantity: q })}
                className={`w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none ${
                  soucetVelikosti > 0
                    ? "bg-gray-50 text-gray-600"
                    : "focus:border-primary focus:ring-2 focus:ring-primary/20"
                }`}
              />
              {soucetVelikosti > 0 ? (
                <span className="text-xs text-gray-500">součet velikostí</span>
              ) : (
                <input
                  type="range"
                  min={MIN_KS_TEXTIL}
                  max={500}
                  value={Math.min(500, item.quantity)}
                  onChange={(e) => update({ quantity: Number(e.target.value) })}
                  aria-label="Počet kusů"
                  className="flex-1 min-w-0 accent-[var(--primary)]"
                />
              )}
            </div>
          </div>

          {/* Rozpis velikostí — nepovinný; vyplněný určuje počet kusů */}
          {velikostiPovoleny && (
            <div role="group" aria-labelledby={`rozpis-${item.id}`}>
              <p id={`rozpis-${item.id}`} className="text-sm font-medium mb-2">
                Rozpis velikostí{" "}
                <span className="font-normal text-gray-500">(nepovinné — můžete doplnit později)</span>
              </p>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {VELIKOSTI.map((k) => {
                  const pocet = Number(item.rozpis?.[k]) || 0;
                  return (
                    <label key={k} className="min-w-0">
                      <span className="block text-center text-xs font-medium text-gray-500 mb-1">
                        {VELIKOST_LABEL[k]}
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="0"
                        aria-label={`Velikost ${VELIKOST_LABEL[k]}, počet kusů`}
                        value={pocet > 0 ? String(pocet) : ""}
                        onChange={(e) => nastavVelikost(k, e.target.value)}
                        onPaste={(e) => vlozRozpis(e, true)}
                        className="w-full min-w-0 rounded-lg border border-gray-300 px-1 py-1.5 text-center text-sm tabular-nums placeholder:text-gray-300 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                      />
                    </label>
                  );
                })}
              </div>
              <label className="block mt-3">
                <span className="block text-xs font-medium text-gray-500 mb-1">Další velikosti</span>
                <input
                  type="text"
                  autoComplete="off"
                  maxLength={200}
                  placeholder="4XL 2, dětské 128: 5"
                  value={item.dalsiVelikosti ?? ""}
                  onChange={(e) => nastavDalsiVelikosti(e.target.value)}
                  onPaste={(e) => vlozRozpis(e, false)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </label>
              {dalsi && (
                <p className="mt-1 text-xs text-gray-500">
                  {dalsi.rozpoznano
                    ? `Rozpoznáno: ${formatRozpis(dalsi.rozpis, dalsi.jine)}` +
                      (dalsi.zbytek ? ` · „${dalsi.zbytek}“ předáme jako poznámku` : "")
                    : "Nerozpoznáno — předáme jako poznámku."}
                </p>
              )}
              {vlozeno && (
                <p className={`mt-2 text-xs font-medium ${vlozeno.ok ? "text-green-700" : "text-amber-700"}`}>
                  {vlozeno.text}
                </p>
              )}
              {soucetVelikosti > 0 && soucetVelikosti < MIN_KS_TEXTIL && (
                <p className="mt-2 text-xs font-medium text-amber-700">Minimální odběr je 5 ks.</p>
              )}
              <p className="mt-2 text-xs text-gray-400">
                Tip: rozpis můžete vložit z e-mailu nebo Excelu (Ctrl+V do libovolného políčka).
              </p>
            </div>
          )}

          {/* Logo umístění */}
          {item.serviceType !== "clean" && (
            <div>
              <label className="block text-sm font-medium mb-2">Umístění loga</label>
              <div className="space-y-2">
                {item.placements.map((p, idx) => (
                  <div key={idx} className="flex flex-wrap items-end gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <div className="flex-1 min-w-[120px]">
                      <select
                        value={p.location}
                        onChange={(e) => updatePlacement(idx, "location", e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm bg-white"
                      >
                        {LOCATION_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-1">
                      {logoSizes.map((ls) => (
                        <button
                          key={ls.key}
                          type="button"
                          onClick={() => updatePlacement(idx, "size", ls.key)}
                          className={`rounded-lg border-2 px-2 py-1 text-xs transition-all cursor-pointer ${
                            p.size === ls.key
                              ? "border-primary bg-[var(--primary-50)]"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          {ls.label.split("(")[0].trim()}
                        </button>
                      ))}
                    </div>
                    {item.placements.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePlacement(idx)}
                        className="text-xs text-red-500 hover:text-red-700 cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addPlacement}
                className="mt-2 text-xs font-medium text-primary hover:text-primary-hover cursor-pointer"
              >
                + Další umístění
              </button>
            </div>
          )}

          {/* Cenový souhrn produktu */}
          <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Produkt</span>
              <span>{formatPrice(Math.round(estimate.baseProductPrice * 1.21))}</span>
            </div>
            {estimate.zpracovaniPrice > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>{SERVICE_LABELS[item.serviceType].label}</span>
                <span>+{formatPrice(Math.round(estimate.zpracovaniPrice * 1.21))}</span>
              </div>
            )}
            {estimate.quantityDiscount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Sleva {Math.round(estimate.quantityDiscountPercent * 100)}%</span>
                <span>-{formatPrice(Math.round(estimate.quantityDiscount * 1.21))}</span>
              </div>
            )}
            <hr className="my-2 border-gray-200" />
            <div className="flex justify-between font-semibold">
              <span>{mnozstvi} ks × {formatPrice(estimate.unitPriceWithDph)}</span>
              <span className="text-primary">{formatPrice(estimate.totalPriceWithDph)}</span>
            </div>
          </div>

          {/* Odebrat */}
          {itemCount > 1 && (
            <button
              type="button"
              onClick={onRemove}
              className="text-sm text-red-500 hover:text-red-700 transition-colors cursor-pointer"
            >
              Odebrat produkt z poptávky
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Hlavní komponenta ────────────────────────────────────────── */

function HomeInner() {
  const searchParams = useSearchParams();
  const [config, setConfig] = useState<KonfiguratorNastaveni | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

  const [items, setItems] = useState<CartItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Shared form state
  const [neededBy, setNeededBy] = useState(defaultDeadline);
  const [fileName, setFileName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [placementNotes] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [ico, setIco] = useState("");
  // Výchozí vypnuto: uložení údajů do prohlížeče má být volba zákazníka,
  // ne předzaškrtnuté políčko.
  const [rememberContact, setRememberContact] = useState(false);
  const [contactPrefilled, setContactPrefilled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  // Načti config z DB
  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await getSupabase()
          .from("konfigurator_nastaveni")
          .select("*")
          .limit(1)
          .single();
        setConfig(error || !data ? DEFAULT_CONFIG : (data as KonfiguratorNastaveni));
      } catch {
        setConfig(DEFAULT_CONFIG);
      } finally {
        setConfigLoading(false);
      }
    }
    load();
  }, []);

  // Načti košík z localStorage
  useEffect(() => {
    const saved = loadCart();
    if (saved.length > 0) {
      setItems(saved);
      setExpandedId(saved[saved.length - 1].id);
    }
  }, []);

  // Kontakt zapamatovaný z minulé poptávky — doplní jen prázdná pole
  useEffect(() => {
    const k = nactiKontakt();
    if (!k) return;
    const dopln = (set: React.Dispatch<React.SetStateAction<string>>, hodnota: string) => {
      if (hodnota) set((prev) => prev || hodnota);
    };
    dopln(setFirstName, k.jmeno);
    dopln(setLastName, k.prijmeni);
    dopln(setEmail, k.email);
    dopln(setPhone, k.telefon);
    dopln(setCompany, k.firma);
    dopln(setIco, k.ico);
    if (Object.values(k).some(Boolean)) {
      setContactPrefilled(true);
      // Zákazník si údaje uložit už jednou nechal → volbu držíme zapnutou.
      setRememberContact(true);
    }
  }, []);

  function forgetContact() {
    zapomenKontakt();
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setCompany("");
    setIco("");
    setContactPrefilled(false);
  }

  // Detekce katalogového produktu z URL
  useEffect(() => {
    const produktKod = searchParams.get("produkt");
    const cena = searchParams.get("cena");
    const nazev = searchParams.get("nazev");

    if (produktKod && cena && nazev) {
      const typParam = searchParams.get("typ"); // potisk | vysivka (z customizeru)
      const navrh = searchParams.get("navrh"); // R2 URL náhledu návrhu
      const serviceType =
        typParam === "vysivka" ? "embroidery" : typParam === "potisk" ? "print" : undefined;
      const barva = searchParams.get("barva") ? decodeURIComponent(searchParams.get("barva")!) : null;
      const nahledUrl = navrh ? decodeURIComponent(navrh) : null;

      const newItem = produktKod.startsWith("PF-")
        ? createMerchCartItem({
            kod: produktKod,
            nazev: decodeURIComponent(nazev),
            cena: Number(cena),
            barva,
            velikost: searchParams.get("velikost") ? decodeURIComponent(searchParams.get("velikost")!) : null,
            nahledUrl,
          })
        : createCartItemFromCatalog({
            kod: produktKod,
            nazev: decodeURIComponent(nazev),
            cena: Number(cena),
            barva,
            kategorie: searchParams.get("kategorie") ? decodeURIComponent(searchParams.get("kategorie")!) : null,
            serviceType,
            nahledUrl,
          });

      setItems((prev) => {
        const next = [...prev, newItem];
        saveCart(next);
        return next;
      });
      setExpandedId(newItem.id);
      setToast(
        navrh
          ? `Návrh „${decodeURIComponent(nazev)}" přidán do košíku`
          : `„${decodeURIComponent(nazev)}" přidán do košíku`
      );
      setTimeout(() => setToast(null), 4000);
      window.history.replaceState({}, "", "/konfigurator");
    }
  }, [searchParams]);

  // Persist na každou změnu
  useEffect(() => {
    if (items.length > 0) saveCart(items);
  }, [items]);

  const activeConfig = config ?? DEFAULT_CONFIG;

  // Spočítej celkové ceny
  const totals = useMemo(() => {
    let totalWithDph = 0;
    let totalWithoutDph = 0;
    let totalItems = 0;

    for (const item of items) {
      if (isMerch(item)) {
        const line = merchLineTotal(item); // vč. DPH
        totalWithDph += line;
        totalWithoutDph += Math.round(line / 1.21);
        totalItems += item.quantity;
        continue;
      }
      const est = odhadTextilu(item, activeConfig);
      totalWithDph += est.totalPriceWithDph;
      totalWithoutDph += est.totalPrice;
      totalItems += efektivniMnozstvi(item);
    }

    return { totalWithDph, totalWithoutDph, totalItems };
  }, [items, activeConfig]);

  function updateItem(id: string, updated: CartItem) {
    setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      if (next.length === 0) clearCart();
      else saveCart(next);
      return next;
    });
    if (expandedId === id) setExpandedId(null);
  }

  function addGenericProduct() {
    const newItem = createEmptyCartItem();
    setItems((prev) => [...prev, newItem]);
    setExpandedId(newItem.id);
  }

  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setLogoUrl(null);
    setLogoUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const res = await fetch("/api/upload-logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nazev: file.name, typ: file.type, data_base64: dataUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Nahrání selhalo.");
      setLogoUrl(json.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nahrání loga selhalo.");
      setFileName("");
    } finally {
      setLogoUploading(false);
    }
  }

  async function handleSubmit() {
    setError("");
    if (items.length === 0) {
      setError("Přidejte alespoň jeden produkt do poptávky.");
      return;
    }
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError("Vyplňte prosím jméno, příjmení a e-mail.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Zadejte platnou e-mailovou adresu.");
      return;
    }
    // IČO nepovinné; vyplněné = 6–8 číslic (starší kratší IČO doplníme nulami zleva)
    const icoBezMezer = ico.replace(/\s+/g, "");
    if (icoBezMezer && !/^\d{6,8}$/.test(icoBezMezer)) {
      setError("IČO má 8 číslic.");
      return;
    }
    const icoNorm = icoBezMezer ? icoBezMezer.padStart(8, "0") : null;
    const firma = company.trim().slice(0, 200) || null;

    // Databáze bere poptávku do 5 000 ks celkem (poptavky_mnozstvi_check) —
    // větší zakázku řešíme osobně, ne chybou „violates check constraint".
    const prilisMnoho = items.find(
      (item) => !isMerch(item) && efektivniMnozstvi(item) > MAX_KS_TEXTIL
    );
    if (prilisMnoho || totals.totalItems > MAX_KS_TEXTIL) {
      setError(
        `Poptávka přes ${MAX_KS_TEXTIL.toLocaleString("cs-CZ")} ks se přes web nedá odeslat — ozvěte se nám prosím e-mailem nebo telefonem, nabídku připravíme individuálně.`
      );
      return;
    }

    setSubmitting(true);

    // Sestavení detailu produktů pro DB
    const produktyDetail = items.map((item) => {
      if (isMerch(item)) {
        const unit = Math.round(item.merchUnitCena ?? item.catalogCena ?? 0);
        return {
          katalog_kod: item.catalogKod,
          katalog_nazev: item.catalogNazev,
          katalog_barva: item.catalogBarva,
          typ_produktu: "merch",
          velikost: item.merchVelikost ?? null,
          typ_zpracovani: item.nahledUrl ? "potisk" : "hotovy",
          mnozstvi: item.quantity,
          logo_umisteni: null,
          nahled_url: item.nahledUrl ?? null,
          cena_ks_s_dph: unit,
          cena_celkem_s_dph: merchLineTotal(item),
        };
      }
      const est = odhadTextilu(item, activeConfig);
      return {
        katalog_kod: item.catalogKod,
        katalog_nazev: item.catalogNazev,
        katalog_barva: item.catalogBarva,
        typ_produktu: item.productType,
        typ_zpracovani: item.serviceType,
        mnozstvi: efektivniMnozstvi(item),
        logo_umisteni: item.serviceType === "clean" ? null : item.placements,
        nahled_url: item.nahledUrl ?? null,
        cena_ks_s_dph: est.unitPriceWithDph,
        cena_celkem_s_dph: est.totalPriceWithDph,
      };
    });

    // Náhledy návrhů z customizeru (R2) — první jako hlavní, všechny jako odkazy
    const nahledy = items.map((i) => i.nahledUrl).filter(Boolean) as string[];

    // Anon má na poptavky jen INSERT (ne SELECT) → nepoužívat .select() (returning
    // by RLS zablokoval). Vygenerujeme id na klientovi a předáme ho i položkám.
    const poptavkaId = crypto.randomUUID();
    const { error: dbError } = await getSupabase().from("poptavky").insert({
      id: poptavkaId,
      jmeno: firstName.trim(),
      prijmeni: lastName.trim(),
      email: email.trim(),
      telefon: phone.trim() || null,
      firma,
      ico: icoNorm,
      typ_produktu: items[0].productType,
      typ_zpracovani: items[0].serviceType,
      mnozstvi: totals.totalItems,
      termin: neededBy || null,
      logo_umisteni: items[0].serviceType === "clean" ? null : items[0].placements,
      poznamka_umisteni: placementNotes.trim() || null,
      logo_soubor_url: logoUrl ?? nahledy[0] ?? null,
      logo_soubor_nazev: logoUrl ? fileName : nahledy[0] ? "Náhled návrhu" : null,
      // dalsi_info = jen čistá poznámka zákazníka; položky + náhledy jsou strukturované v poptavka_polozky
      dalsi_info: additionalInfo.trim() || null,
      odhadovana_cena_ks: Math.round(totals.totalWithDph / totals.totalItems),
      odhadovana_cena_celkem: totals.totalWithDph,
      zakladni_cena_produkt: 0,
      zakladni_cena_sluzba: 0,
      cena_logo_prace: 0,
      mnozstevni_sleva: 0,
      priplatek_termin: 0,
      stav: "nova",
    });

    if (dbError) {
      setSubmitting(false);
      setError(`Chyba při odesílání: ${dbError.message}`);
      return;
    }

    // Strukturované řádky poptávky (co za kolik) — zdroj pro převod na zakázku
    const polozkyRows = items.map((item, idx) => {
      const d = produktyDetail[idx];
      return {
        poptavka_id: poptavkaId,
        poradi: idx,
        kind: isMerch(item) ? "merch" : "textil",
        katalogove_cislo: item.catalogKod,
        nazev: item.catalogNazev || getProductTypes(activeConfig)[item.productType].label,
        kategorie: item.catalogKategorie,
        typ_zpracovani: d.typ_zpracovani,
        barva: item.catalogBarva,
        // textil: rozpis „S:2, M:5, 4XL:1" (+ nerozpoznaný text za „; "), merch: varianta
        velikost: velikostDoPoptavky(item),
        mnozstvi: efektivniMnozstvi(item),
        cena_ks_s_dph: d.cena_ks_s_dph,
        cena_celkem_s_dph: d.cena_celkem_s_dph,
        logo_umisteni: isMerch(item) || item.serviceType === "clean" ? null : item.placements,
        nahled_url: item.nahledUrl ?? null,
      };
    });
    const { error: polozkyError } = await getSupabase().from("poptavka_polozky").insert(polozkyRows);
    setSubmitting(false);
    if (polozkyError) {
      // poptávka už vznikla — položky se nepovedly; nehážeme hard error, jen logujeme
      console.error("[poptavka_polozky]", polozkyError.message);
    }

    // Notifikace (Telegram staff + potvrzovací e-mail) — fire-and-forget, neblokuje úspěch
    fetch("/api/poptavka-notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poptavka_id: poptavkaId }),
    }).catch(() => {});

    // Kontakt si pamatuje jen tento prohlížeč; bez souhlasu uložený záznam smažeme
    if (rememberContact) {
      ulozKontakt({
        jmeno: firstName.trim(),
        prijmeni: lastName.trim(),
        email: email.trim(),
        telefon: phone.trim(),
        firma: firma ?? "",
        ico: icoNorm ?? "",
      });
    } else {
      zapomenKontakt();
    }

    clearCart();
    setSubmitted(true);
  }

  // Loading
  if (configLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-primary" />
        <p className="mt-4 text-gray-500">Načítám konfigurátor...</p>
      </div>
    );
  }

  // Success
  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <div className="mb-6 text-6xl">✅</div>
        <h1 className="text-3xl font-bold mb-4">Poptávka odeslána</h1>
        <p className="text-gray-600 mb-2">
          Děkujeme, {firstName}! Vaši poptávku jsme přijali.
        </p>
        <p className="text-gray-600 mb-8">
          Odhadovaná cena: <strong>{formatPrice(totals.totalWithDph)}</strong> vč. DPH.
          Ozveme se vám na <strong>{email}</strong>.
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary-hover transition-colors"
          >
            Nová poptávka
          </button>
          <Link
            href="/katalog"
            className="inline-flex items-center px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:border-gray-400 transition-colors"
          >
            Katalog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-[fadeIn_0.3s]">
          <span className="text-lg">✅</span>
          <span className="text-sm font-medium">{toast}</span>
          <button type="button" onClick={() => setToast(null)} className="ml-2 text-white/70 hover:text-white cursor-pointer">
            ✕
          </button>
        </div>
      )}

      <h1 className="text-3xl font-bold mb-2">{activeConfig.nadpis}</h1>
      <p className="text-gray-500 mb-8">{activeConfig.podnadpis}</p>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 min-w-0 space-y-8">
          {/* ── Produkty v poptávce ── */}
          <section>
            <h2 className="text-lg font-semibold mb-1">1. Produkty v poptávce</h2>
            <p className="text-sm text-gray-500 mb-4">
              {items.length === 0
                ? "Přidejte produkt z katalogu nebo zvolte obecný typ."
                : `${items.length} ${items.length === 1 ? "produkt" : items.length < 5 ? "produkty" : "produktů"} · kliknutím rozbalíte detail`}
            </p>

            <div className="space-y-3">
              {items.map((item) =>
                isMerch(item) ? (
                  <MerchCartItemCard
                    key={item.id}
                    item={item}
                    onChange={(updated) => updateItem(item.id, updated)}
                    onRemove={() => removeItem(item.id)}
                    itemCount={items.length}
                  />
                ) : (
                  <CartItemCard
                    key={item.id}
                    item={item}
                    config={activeConfig}
                    expanded={expandedId === item.id}
                    onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    onChange={(updated) => updateItem(item.id, updated)}
                    onRemove={() => removeItem(item.id)}
                    itemCount={items.length}
                  />
                )
              )}
            </div>

            {/* Přidat produkt */}
            <div className="flex flex-wrap gap-3 mt-4">
              <Link
                href="/katalog"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-primary/40 text-primary text-sm font-medium hover:border-primary hover:bg-[var(--primary-50)] transition-all"
              >
                📦 Přidat z katalogu
              </Link>
              <button
                type="button"
                onClick={addGenericProduct}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-gray-300 text-gray-500 text-sm font-medium hover:border-gray-400 hover:text-gray-700 transition-all cursor-pointer"
              >
                + Obecný produkt
              </button>
            </div>
          </section>

          {/* ── Termín ── */}
          <section>
            <h2 className="text-lg font-semibold mb-1">2. Termín</h2>
            <p className="text-sm text-gray-500 mb-4">Požadovaný termín dodání.</p>
            <input
              type="date"
              min={todayISO()}
              value={neededBy}
              onChange={(e) => setNeededBy(e.target.value)}
              className="w-full sm:w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </section>

          {/* ── Podklady ── */}
          <section>
            <h2 className="text-lg font-semibold mb-1">3. Podklady</h2>
            <p className="text-sm text-gray-500 mb-4">Nahrajte logo a uveďte poznámky.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Logo / grafika</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={logoUploading}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm hover:border-gray-400 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {logoUploading ? "Nahrávám…" : "Vybrat soubor"}
                  </button>
                  <span className="text-sm text-gray-500 truncate">
                    {logoUrl ? `✓ ${fileName}` : fileName || "Žádný soubor nevybrán"}
                  </span>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,.pdf,.ai,.eps,.svg"
                    className="hidden"
                    onChange={handleLogoFile}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Poznámky</label>
                <textarea
                  rows={3}
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  placeholder="Speciální požadavky, preference barev, poznámky k umístění loga..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-y"
                />
              </div>
            </div>
          </section>

          {/* ── Kontakt ── */}
          <section>
            <h2 className="text-lg font-semibold mb-1">4. Kontaktní údaje</h2>
            <p className="text-sm text-gray-500 mb-4">Kam vám máme poslat nabídku?</p>
            {contactPrefilled && (
              <p className="text-xs text-gray-500 -mt-2 mb-4">
                Údaje jsme předvyplnili z minula ·{" "}
                <button
                  type="button"
                  onClick={forgetContact}
                  className="underline hover:text-gray-700 cursor-pointer"
                >
                  Zapomenout
                </button>
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Jméno <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Příjmení <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  E-mail <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Telefon</label>
                <input
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Firma / klub</label>
                <input
                  type="text"
                  autoComplete="organization"
                  maxLength={200}
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">IČO</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={12}
                  value={ico}
                  onChange={(e) => setIco(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberContact}
                onChange={(e) => setRememberContact(e.target.checked)}
                className="h-4 w-4 shrink-0 accent-[var(--primary)] cursor-pointer"
              />
              Zapamatovat mé údaje na tomto zařízení
            </label>
          </section>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>
          )}

          <button
            type="button"
            disabled={submitting || items.length === 0}
            onClick={handleSubmit}
            className="w-full sm:w-auto px-8 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary-hover disabled:opacity-50 transition-colors cursor-pointer"
          >
            {submitting ? "Odesílám..." : "Odeslat poptávku"}
          </button>
        </div>

        {/* ── Sidebar — celkový souhrn ── */}
        <aside className="lg:w-80 shrink-0">
          <div className="lg:sticky lg:top-8 rounded-2xl border border-gray-200 bg-white shadow-sm p-6 space-y-4">
            <h3 className="text-lg font-semibold">Souhrn poptávky</h3>

            {items.length === 0 ? (
              <p className="text-sm text-gray-400">Zatím žádné produkty.</p>
            ) : (
              <>
                <div className="text-sm space-y-2">
                  {items.map((item) => {
                    const lineTotal = isMerch(item)
                      ? merchLineTotal(item)
                      : odhadTextilu(item, activeConfig).totalPriceWithDph;
                    return (
                      <div key={item.id} className="flex justify-between text-gray-500">
                        <span className="truncate mr-2">
                          {item.catalogNazev
                            ? item.catalogNazev.length > 20
                              ? item.catalogNazev.slice(0, 20) + "…"
                              : item.catalogNazev
                            : getProductTypes(activeConfig)[item.productType].label}
                          <span className="text-gray-400"> ×{efektivniMnozstvi(item)}</span>
                        </span>
                        <span className="font-medium text-gray-700 whitespace-nowrap">
                          {formatPrice(lineTotal)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <hr className="border-gray-100" />

                <div className="flex justify-between items-baseline text-sm text-gray-500">
                  <span>Celkem kusů</span>
                  <span className="font-medium text-gray-700">{totals.totalItems} ks</span>
                </div>

                <div className="rounded-xl p-4 -mx-1" style={{ background: "var(--primary-50)", border: "1px solid var(--primary-100)" }}>
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm font-medium text-gray-700">Celkem vč. DPH</span>
                    <span className="text-2xl font-bold text-primary">{formatPrice(totals.totalWithDph)}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1 text-right">{formatPrice(totals.totalWithoutDph)} bez DPH</p>
                </div>
              </>
            )}

            <p className="text-xs text-gray-400 leading-relaxed">{activeConfig.disclaimer}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl px-4 py-24 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-primary" />
          <p className="mt-4 text-gray-500">Načítám konfigurátor...</p>
        </div>
      }
    >
      <HomeInner />
    </Suspense>
  );
}
