import Link from "next/link";
import ChatAssistant from "@/components/ChatAssistant";

function IconShirt() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.85H6v10c0 1.1.9 2 2 2h8a2 2 0 002-2V10h2.15a1 1 0 00.99-.85l.58-3.57a2 2 0 00-1.34-2.23z"/>
    </svg>
  );
}

function IconZap() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  );
}

function IconLayers() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
      <polyline points="2 17 12 22 22 17"/>
      <polyline points="2 12 12 17 22 12"/>
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

const features = [
  {
    icon: <IconShirt />,
    title: "3 600+ produktů",
    desc: "Trička, mikiny, bundy, čepice, tašky od prémiových značek. Vše skladem, rychlé dodání.",
    color: "var(--primary)",
    bg: "var(--primary-50, #EFF6FF)",
  },
  {
    icon: <IconZap />,
    title: "Kalkulace okamžitě",
    desc: "Orientační cena s potiskem nebo výšivkou v reálném čase. Bez čekání na nabídku.",
    color: "var(--accent)",
    bg: "var(--accent-50, #FFFBEB)",
  },
  {
    icon: <IconLayers />,
    title: "Na míru vaší značce",
    desc: "Váš logo, vaše barvy. Poradíme s technikou zdobení i výběrem správného produktu.",
    color: "#10B981",
    bg: "#F0FDF4",
  },
];

const steps = [
  { n: "1", title: "Popište potřebu", desc: "Řekněte Jardovi, co hledáte — Účel, počet kusů, rozpočet." },
  { n: "2", title: "Jarda doporučí", desc: "AI asistent prohledá katalog a navrhne nejlepší produkty pro vás." },
  { n: "3", title: "Potvrďte a odešlete", desc: "Schvalte výběr, zadejte kontakt — dostanete konkrétní nabídku." },
];

const proofs = [
  { value: "3 600+", label: "produktů v katalogu" },
  { value: "15+", label: "prémiových značek" },
  { value: "2", label: "techniky zdobení" },
];

export default function HomePage() {
  return (
    <div>
      {/* ── Hero ─────────────────────────────────────────── */}
      <section
        className="section relative overflow-hidden"
        style={{
          background: "linear-gradient(160deg, #EEF2FF 0%, #F8FAFF 45%, #FFFBEB 100%)",
        }}
      >
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, #C7D2FE 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="container relative text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 badge badge-primary mb-6 px-4 py-2">
            <span>✦</span>
            <span>Reklamní textil s AI asistentem</span>
          </div>

          <h1 className="max-w-3xl mx-auto">
            Firemní textil
            <br />
            <span style={{ color: "var(--primary)" }}>za pár minut</span>
          </h1>

          <p className="mt-6 text-lg max-w-xl mx-auto" style={{ color: "var(--muted)", lineHeight: 1.7 }}>
            Popište Jardovi, co potřebujete — prohledá&nbsp;3&nbsp;600+ produktů, spočítá
            orientační cenu a připraví poptávku. Bez formulářů.
          </p>

          {/* CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href="#chat" className="btn btn-accent px-6 py-3 text-base">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
              Spustit asistenta
            </a>
            <Link href="/katalog" className="btn btn-ghost px-6 py-3 text-base">
              Prohlédnout katalog
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </Link>
          </div>

          {/* Social proof numbers */}
          <div className="mt-12 flex flex-wrap justify-center gap-8">
            {proofs.map((p) => (
              <div key={p.label} className="text-center">
                <div className="text-2xl font-bold" style={{ color: "var(--primary)" }}>{p.value}</div>
                <div className="text-sm mt-0.5" style={{ color: "var(--muted)" }}>{p.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Chat ─────────────────────────────────────────── */}
      <section id="chat" className="section" style={{ background: "var(--surface-2, #F1F5F9)" }}>
        <div className="container">
          <div className="text-center mb-10">
            <h2 style={{ color: "var(--foreground)" }}>Řekněte Jardovi, co potřebujete</h2>
            <p className="mt-3 text-base max-w-lg mx-auto" style={{ color: "var(--muted)" }}>
              AI asistent poradí s výběrem, spočítá cenu a připraví podklady pro poptávku.
            </p>
          </div>
          <ChatAssistant />
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────── */}
      <section className="section" style={{ background: "var(--surface)" }}>
        <div className="container">
          <div className="text-center mb-12">
            <h2>Proč LOOOKU?</h2>
            <p className="mt-3 text-base max-w-md mx-auto" style={{ color: "var(--muted)" }}>
              Vše, co potřebujete pro firemní textil na jednom místě.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="card p-8">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                  style={{ background: f.bg, color: f.color }}
                >
                  {f.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────── */}
      <section className="section" style={{ background: "var(--surface-2, #F1F5F9)" }}>
        <div className="container">
          <div className="text-center mb-12">
            <h2>Jak to funguje</h2>
            <p className="mt-3 text-base max-w-md mx-auto" style={{ color: "var(--muted)" }}>
              Od nápadu k poptávce za 3 minuty.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {steps.map((s, i) => (
              <div key={s.n} className="relative">
                {i < steps.length - 1 && (
                  <div
                    className="hidden md:block absolute top-7 left-full w-full h-px -translate-x-1/2"
                    style={{ background: "var(--border)" }}
                  />
                )}
                <div className="flex flex-col items-center text-center p-6">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold mb-4 shadow-md"
                    style={{ background: "var(--primary)" }}
                  >
                    {s.n}
                  </div>
                  <h3 className="text-base font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                    {s.title}
                  </h3>
                  <p className="text-sm" style={{ color: "var(--muted)" }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ───────────────────────────────────── */}
      <section className="section">
        <div className="container">
          <div
            className="rounded-3xl p-10 md:p-14 text-center text-white relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, var(--primary) 0%, #1D4ED8 50%, #1E3A8A 100%)",
            }}
          >
            <div className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
                backgroundSize: "24px 24px",
              }}
            />
            <div className="relative">
              <h2 className="text-white mb-4">Začněte ještě dnes</h2>
              <p className="text-base mb-8 opacity-80 max-w-md mx-auto">
                Žádná registrace, žádné formuláře. Jednoduše popište, co potřebujete.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4 mb-6">
                {["Bez závazků", "Rychlá odpověď", "Zkušený poradce"].map((item) => (
                  <span key={item} className="flex items-center gap-1.5 text-sm opacity-90">
                    <IconCheck />
                    {item}
                  </span>
                ))}
              </div>
              <a href="#chat" className="btn btn-accent px-8 py-3 text-base inline-flex">
                Spustit asistenta zdarma
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
