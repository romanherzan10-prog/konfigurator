"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  LOCATION_OPTIONS,
  DEFAULT_CONFIG,
  getProductTypes,
  getLogoSizes,
  calculateEstimate,
  formatPrice,
  type ProductType,
  type ServiceType,
  type LogoSize,
  type LogoPlacement,
  type KonfiguratorNastaveni,
} from "@/lib/pricing";
import { getSupabase } from "@/lib/supabase";

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

export default function Home() {
  const [config, setConfig] = useState<KonfiguratorNastaveni | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

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

  const activeConfig = config ?? DEFAULT_CONFIG;
  const productTypes = useMemo(() => getProductTypes(activeConfig), [activeConfig]);

  // Form state
  const [productType, setProductType] = useState<ProductType>("tricko");
  const [serviceType, setServiceType] = useState<ServiceType>("print");
  const [quantity, setQuantity] = useState(25);
  const [neededBy, setNeededBy] = useState(defaultDeadline);
  const [placements, setPlacements] = useState<LogoPlacement[]>([
    { location: "leve-prso", size: "male" },
  ]);
  const [fileName, setFileName] = useState("");
  const [placementNotes, setPlacementNotes] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const logoSizes = useMemo(() => getLogoSizes(activeConfig, serviceType), [activeConfig, serviceType]);

  const estimate = useMemo(
    () => calculateEstimate(productType, serviceType, quantity, serviceType === "clean" ? [] : placements, activeConfig),
    [productType, serviceType, quantity, placements, activeConfig]
  );

  function updatePlacement(idx: number, field: keyof LogoPlacement, value: string) {
    setPlacements((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  }

  function removePlacement(idx: number) {
    setPlacements((prev) => prev.filter((_, i) => i !== idx));
  }

  function addPlacement() {
    setPlacements((prev) => [...prev, { location: "leve-prso", size: "male" }]);
  }

  async function handleSubmit() {
    setError("");
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError("Vyplňte prosím jméno, příjmení a e-mail.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Zadejte platnou e-mailovou adresu.");
      return;
    }
    if (quantity < 5) {
      setError("Minimální množství je 5 ks.");
      return;
    }

    setSubmitting(true);
    const { error: dbError } = await getSupabase().from("poptavky").insert({
      jmeno: firstName.trim(),
      prijmeni: lastName.trim(),
      email: email.trim(),
      telefon: phone.trim() || null,
      typ_produktu: productType,
      typ_zpracovani: serviceType,
      mnozstvi: quantity,
      termin: neededBy || null,
      logo_umisteni: serviceType === "clean" ? null : placements,
      poznamka_umisteni: placementNotes.trim() || null,
      dalsi_info: additionalInfo.trim() || null,
      odhadovana_cena_ks: estimate.unitPriceWithDph,
      odhadovana_cena_celkem: estimate.totalPriceWithDph,
      zakladni_cena_produkt: estimate.baseProductPrice,
      zakladni_cena_sluzba: estimate.zpracovaniPrice,
      cena_logo_prace: 0,
      mnozstevni_sleva: estimate.quantityDiscountPercent,
      priplatek_termin: 0,
      stav: "nova",
    });
    setSubmitting(false);

    if (dbError) {
      setError(`Chyba při odesílání: ${dbError.message}`);
      return;
    }
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
          Děkujeme, {firstName}! Vaši poptávku na{" "}
          <strong>{quantity}× {productTypes[productType].label}</strong> jsme přijali.
        </p>
        <p className="text-gray-600 mb-8">
          Odhadovaná cena: <strong>{formatPrice(estimate.totalPriceWithDph)}</strong> vč. DPH.
          Ozveme se vám na <strong>{email}</strong>.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center px-6 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary-hover transition-colors"
        >
          Nová poptávka
        </button>
      </div>
    );
  }

  // Form
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-2">{activeConfig.nadpis}</h1>
      <p className="text-gray-500 mb-8">{activeConfig.podnadpis}</p>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 min-w-0 space-y-10">

          {/* 1. Produkt */}
          <section>
            <h2 className="text-lg font-semibold mb-1">1. Vyberte produkt</h2>
            <p className="text-sm text-gray-500 mb-4">Zvolte typ textilu.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(Object.keys(productTypes) as ProductType[]).map((key) => {
                const p = productTypes[key];
                const selected = productType === key;
                return (
                  <button key={key} type="button" onClick={() => setProductType(key)}
                    className={`relative flex flex-col items-center gap-1 rounded-xl border-2 p-4 text-center transition-all cursor-pointer ${
                      selected ? "border-primary bg-blue-50 shadow-sm" : "border-gray-200 bg-white hover:border-gray-300"
                    }`}>
                    <span className="text-3xl">{PRODUCT_ICONS[key]}</span>
                    <span className="font-medium text-sm">{p.label}</span>
                    <span className="text-xs text-gray-500">{p.hint}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 2. Zpracování */}
          <section>
            <h2 className="text-lg font-semibold mb-1">2. Typ zpracování</h2>
            <p className="text-sm text-gray-500 mb-4">Jak má být textil upraven?</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(["print", "embroidery", "clean"] as ServiceType[]).map((key) => {
                const labels: Record<ServiceType, { label: string; hint: string }> = {
                  print: { label: "Potisk", hint: "Vhodné pro výraznou grafiku" },
                  embroidery: { label: "Výšivka", hint: "Prémiový a odolný vzhled" },
                  clean: { label: "Čistý textil", hint: "Bez potisku a výšivky" },
                };
                const s = labels[key];
                const selected = serviceType === key;
                return (
                  <button key={key} type="button" onClick={() => { setServiceType(key); if (key === "clean") setPlacements([]); else if (placements.length === 0) setPlacements([{ location: "leve-prso", size: "male" }]); }}
                    className={`rounded-xl border-2 p-4 text-left transition-all cursor-pointer ${
                      selected ? "border-primary bg-blue-50 shadow-sm" : "border-gray-200 bg-white hover:border-gray-300"
                    }`}>
                    <span className="font-medium">{s.label}</span>
                    <span className="block text-xs text-gray-500 mt-1">{s.hint}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 3. Množství a termín */}
          <section>
            <h2 className="text-lg font-semibold mb-1">3. Množství a termín</h2>
            <p className="text-sm text-gray-500 mb-4">Zadejte počet kusů a požadovaný termín.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-1">Počet kusů</label>
                <input type="number" min={5} max={500} value={quantity}
                  onChange={(e) => setQuantity(Math.max(5, Math.min(500, Number(e.target.value) || 5)))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
                <input type="range" min={5} max={500} value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full mt-2 accent-[#2563eb]" />
                <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                  <span>5 ks</span><span>500 ks</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Požadovaný termín</label>
                <input type="date" min={todayISO()} value={neededBy}
                  onChange={(e) => setNeededBy(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
              </div>
            </div>
          </section>

          {/* 4. Umístění loga — 3 velikosti */}
          {serviceType !== "clean" && (
            <section>
              <h2 className="text-lg font-semibold mb-1">4. Umístění a velikost loga</h2>
              <p className="text-sm text-gray-500 mb-4">Přidejte jedno nebo více umístění loga.</p>
              <div className="space-y-3">
                {placements.map((p, idx) => (
                  <div key={idx} className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
                    <div className="flex-1 min-w-[140px]">
                      <label className="block text-xs font-medium mb-1">Umístění</label>
                      <select value={p.location}
                        onChange={(e) => updatePlacement(idx, "location", e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none bg-white">
                        {LOCATION_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-xs font-medium mb-1">Velikost loga</label>
                      <div className="flex gap-2">
                        {logoSizes.map((ls) => (
                          <button key={ls.key} type="button"
                            onClick={() => updatePlacement(idx, "size", ls.key)}
                            className={`flex-1 rounded-lg border-2 px-2 py-2 text-center transition-all cursor-pointer ${
                              p.size === ls.key
                                ? "border-primary bg-blue-50"
                                : "border-gray-200 bg-white hover:border-gray-300"
                            }`}>
                            <span className="block text-xs font-medium">{ls.label}</span>
                            <span className="block text-xs text-primary font-semibold mt-0.5">
                              +{formatPrice(ls.price)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    {placements.length > 1 && (
                      <button type="button" onClick={() => removePlacement(idx)}
                        className="text-sm text-red-500 hover:text-red-700 transition-colors pb-2 cursor-pointer">
                        Odebrat
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={addPlacement}
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-hover transition-colors cursor-pointer">
                <span className="text-lg leading-none">+</span> Přidat další umístění
              </button>
            </section>
          )}

          {/* 5. Podklady */}
          <section>
            <h2 className="text-lg font-semibold mb-1">
              {serviceType === "clean" ? "4" : "5"}. Podklady
            </h2>
            <p className="text-sm text-gray-500 mb-4">Nahrajte logo a uveďte případné poznámky.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Logo / grafika</label>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm hover:border-gray-400 transition-colors cursor-pointer">
                    Vybrat soubor
                  </button>
                  <span className="text-sm text-gray-500 truncate">{fileName || "Žádný soubor nevybrán"}</span>
                  <input ref={fileRef} type="file" accept="image/*,.pdf,.ai,.eps,.svg" className="hidden"
                    onChange={(e) => setFileName(e.target.files?.[0]?.name || "")} />
                </div>
                <p className="text-xs text-gray-400 mt-1">PNG, JPG, SVG, PDF, AI, EPS</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Poznámka k umístění</label>
                <textarea rows={2} value={placementNotes}
                  onChange={(e) => setPlacementNotes(e.target.value)}
                  placeholder="Např. logo zarovnat na střed, pod límec..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-y" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Další informace</label>
                <textarea rows={2} value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  placeholder="Barva textilu, speciální požadavky..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-y" />
              </div>
            </div>
          </section>

          {/* 6. Kontakt */}
          <section>
            <h2 className="text-lg font-semibold mb-1">
              {serviceType === "clean" ? "5" : "6"}. Kontaktní údaje
            </h2>
            <p className="text-sm text-gray-500 mb-4">Kam vám máme poslat nabídku?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Jméno <span className="text-red-500">*</span></label>
                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Příjmení <span className="text-red-500">*</span></label>
                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">E-mail <span className="text-red-500">*</span></label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Telefon</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none" />
              </div>
            </div>
          </section>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>
          )}

          <button type="button" disabled={submitting} onClick={handleSubmit}
            className="w-full sm:w-auto px-8 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary-hover disabled:opacity-50 transition-colors cursor-pointer">
            {submitting ? "Odesílám..." : "Odeslat poptávku"}
          </button>
        </div>

        {/* Kalkulace */}
        <aside className="lg:w-80 shrink-0">
          <div className="lg:sticky lg:top-8 rounded-2xl border border-gray-200 bg-white shadow-sm p-6 space-y-4">
            <h3 className="text-lg font-semibold">Orientační kalkulace</h3>

            <div className="text-sm text-gray-500 space-y-2">
              <div className="flex justify-between">
                <span>{productTypes[productType].label}</span>
                <span className="font-medium text-gray-900">{formatPrice(Math.round(estimate.baseProductPrice * 1.21))}</span>
              </div>
              {estimate.zpracovaniPrice > 0 && (
                <div className="flex justify-between">
                  <span>{serviceType === "print" ? "Potisk" : "Výšivka"}</span>
                  <span className="font-medium text-gray-900">+{formatPrice(Math.round(estimate.zpracovaniPrice * 1.21))}</span>
                </div>
              )}
              {estimate.quantityDiscount > 0 && (
                <div className="flex justify-between text-green-600 font-medium">
                  <span>Sleva {Math.round(estimate.quantityDiscountPercent * 100)} % ({quantity} ks)</span>
                  <span>-{formatPrice(Math.round(estimate.quantityDiscount * 1.21))}</span>
                </div>
              )}
            </div>

            <hr className="border-gray-100" />

            <div className="flex justify-between items-baseline">
              <span className="text-sm text-gray-500">Cena za kus vč. DPH</span>
              <span className="text-lg font-bold">{formatPrice(estimate.unitPriceWithDph)}</span>
            </div>

            <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 -mx-1">
              <div className="flex justify-between items-baseline">
                <span className="text-sm font-medium text-gray-700">Celkem vč. DPH</span>
                <span className="text-2xl font-bold text-primary">{formatPrice(estimate.totalPriceWithDph)}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1 text-right">{formatPrice(estimate.totalPrice)} bez DPH</p>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">{activeConfig.disclaimer}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
