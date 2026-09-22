"use client";

import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from "framer-motion";

/**
 * LOOOKU — hlavní strana ve stylu Apple.
 *
 * Záměr: převzít Apple DISCIPLÍNU, ne jeho vzhled. Tedy jedno písmo v celé
 * stránce, monochromní plátno, obrovská typografie s těsným prokladem,
 * produkt osvětlený na černé a štědrý vertikální rytmus. Barva zůstává
 * LOOOKU fialová — ta drží identitu, o kterou by kopie Apple modré připravila.
 *
 * Vše je scopované do `--ap-*` proměnných na wrapperu, takže se globální
 * tokeny webu (violet design system) nemění a zbytek katalogu jede dál.
 * Předchozí landing „Ateliér" zůstává v LandingV2.tsx — přepnutí zpět je
 * jeden řádek v app/page.tsx.
 */

const IMG = {
  hoodie:
    "https://ntzalajouwqqdiqpnehx.supabase.co/storage/v1/object/public/uploads/katalog-mockupy/20.P396-mqh31ajbb489in.png",
  tee: "https://ntzalajouwqqdiqpnehx.supabase.co/storage/v1/object/public/uploads/katalog-mockupy/25.3981-mqh3i57tj7j639.png",
  cap: "https://ntzalajouwqqdiqpnehx.supabase.co/storage/v1/object/public/uploads/katalog-mockupy/33.0307-mqh2enok915jrl.png",
  merch:
    "https://images-api.printify.com/mockup/6a2e2343f5f63e260010069a/148112/111855/unisex-organic-oversized-sweatshirt-radder-20.jpg?camera_label=front",
  bag: "https://pub-1f19c6dc56e8412790975e8dc137e05a.r2.dev/products/9D628698-4843-4994-98D8-3768581F955F.jpg",
  umbrella:
    "https://pub-1f19c6dc56e8412790975e8dc137e05a.r2.dev/products/9104D391-CD9E-474F-987E-17130D9A4745.jpg",
};

/* ── Odhalení při scrollu ─────────────────────────────────
   Apple nepoužívá efekty, používá načasování: obsah nastoupí
   zespodu, jednou, klidně. Při `prefers-reduced-motion` se
   nehýbe nic — jen se zobrazí.                              */
function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12% 0px" }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ── Tlačítko ve tvaru pilulky ── */
function Pill({
  href,
  children,
  tone = "primary",
}: {
  href: string;
  children: React.ReactNode;
  tone?: "primary" | "ghost";
}) {
  const primary = tone === "primary";
  return (
    <a
      href={href}
      className="ap-pill"
      data-tone={tone}
      style={{
        background: primary ? "var(--ap-accent)" : "transparent",
        color: primary ? "#fff" : "inherit",
        border: primary ? "1px solid transparent" : "1px solid currentColor",
      }}
    >
      {children}
    </a>
  );
}

/** Textový odkaz se šipkou — Apple ho používá místo druhého tlačítka. */
function ArrowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="ap-arrow">
      {children}
      <svg viewBox="0 0 8 12" aria-hidden width="7" height="11">
        <path
          d="M1.5 1L6.5 6L1.5 11"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
}

/* ── Produktový panel (střídá se tmavý a světlý) ── */
function Panel({
  eyebrow,
  title,
  body,
  img,
  alt,
  href,
  cta,
  dark,
  flip,
}: {
  eyebrow: string;
  title: string;
  body: string;
  img: string;
  alt: string;
  href: string;
  cta: string;
  dark?: boolean;
  flip?: boolean;
}) {
  return (
    <section
      className="ap-panel"
      style={{
        background: dark ? "var(--ap-black)" : "var(--ap-paper)",
        color: dark ? "var(--ap-paper)" : "var(--ap-ink)",
      }}
    >
      <div className="ap-panel-grid" data-flip={flip ? "1" : undefined}>
        <Reveal className="ap-panel-copy">
          <p className="ap-eyebrow" style={{ color: "var(--ap-accent)" }}>
            {eyebrow}
          </p>
          <h2 className="ap-h2">{title}</h2>
          <p
            className="ap-body"
            style={{ color: dark ? "var(--ap-grey-dark)" : "var(--ap-grey)" }}
          >
            {body}
          </p>
          <ArrowLink href={href}>{cta}</ArrowLink>
        </Reveal>

        {/* V tmavé sekci jde produkt na světlou dlaždici — mockupy mají bílé
            pozadí a na černé by působily jako nalepený obdélník. */}
        <Reveal delay={0.12} className="ap-panel-img" >
          <div className="ap-tile" data-dark={dark ? "1" : undefined}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt={alt} loading="lazy" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function LandingApple() {
  const heroRef = useRef<HTMLElement | null>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  // Jemný parallax — produkt se při odjezdu hero sekce zvedne a odejde dřív
  // než text. Bez toho působí černá plocha staticky.
  const imgY = useTransform(scrollYProgress, [0, 1], [0, -90]);
  const imgOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0]);

  return (
    <div className="ap-root">
      {/* ── HERO ───────────────────────────────────────── */}
      <section className="ap-hero" ref={heroRef}>
        <div className="ap-hero-grid">
        <div className="ap-hero-inner">
          <Reveal>
            <p className="ap-eyebrow" style={{ color: "var(--ap-accent)" }}>
              Výšivka a potisk
            </p>
          </Reveal>

          <Reveal delay={0.08}>
            <h1 className="ap-h1">
              Vaše značka.
              <br />
              <span className="ap-h1-dim">Na čemkoliv.</span>
            </h1>
          </Reveal>

          <Reveal delay={0.16}>
            <p className="ap-lead">
              Trička, mikiny, čepice i tašky s vaším logem. Od deseti kusů.
              Cenu vidíte hned, ne za tři dny.
            </p>
          </Reveal>

          <Reveal delay={0.24}>
            <div className="ap-cta-row">
              <Pill href="/konfigurator">Navrhnout online</Pill>
              <Pill href="/katalog" tone="ghost">
                Prohlédnout katalog
              </Pill>
            </div>
          </Reveal>
        </div>

        <motion.div
          className="ap-hero-img"
          style={reduce ? undefined : { y: imgY, opacity: imgOpacity }}
        >
          {/* Čepice s vyšitým logem — ukazuje řemeslo (výšivku) na první dobrou.
              Mockupy z katalogu jsou na bílém pozadí, proto je hero světlé. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={IMG.cap}
            alt="Kšiltovka s vyšitým firemním logem"
            fetchPriority="high"
          />
        </motion.div>
        </div>
      </section>

      {/* ── ČÍSLA ──────────────────────────────────────── */}
      <section className="ap-stats">
        {[
          { n: "4 000+", l: "produktů v katalogu" },
          { n: "od 10", l: "kusů minimální odběr" },
          { n: "do 24 h", l: "potvrzená nabídka" },
        ].map((s, i) => (
          <Reveal key={s.l} delay={i * 0.08} className="ap-stat">
            <p className="ap-stat-n">{s.n}</p>
            <p className="ap-stat-l">{s.l}</p>
          </Reveal>
        ))}
      </section>

      {/* ── PRODUKTOVÉ PANELY ──────────────────────────── */}
      <Panel
        eyebrow="Reklamní textil"
        title="Kvalitní kusy, ne propagační hadry."
        body="Kariban, SOL'S, Tee Jays, Fruit of the Loom. Přes čtyři tisíce kusů, u kterých víme, jak drží tvar a barvu po pětadvacátém praní. Vyšijeme i potiskneme."
        img={IMG.tee}
        alt="Tričko s barevným potiskem"
        href="/katalog"
        cta="Otevřít katalog"
      />

      <Panel
        flip
        dark
        eyebrow="Firemní merch"
        title="Merch, který si lidé nechají."
        body="Oversize mikiny, čepice a kousky, které projdou i mimo firemní akci. Vyrábíme na zakázku, takže neskladujete nic, co se neprodá."
        img={IMG.merch}
        alt="Merch mikina s vlastním designem"
        href="/merch"
        cta="Prohlédnout merch"
      />

      <Panel
        eyebrow="Reklamní předměty"
        title="Dárky, které neskončí v šuplíku."
        body="Deštníky, batohy a tašky s logem. Věci, které klient použije v úterý ráno cestou do práce — a vaše značka jede s ním."
        img={IMG.umbrella}
        alt="Deštník s potiskem loga"
        href="/katalog?kategorie=Reklamn%C3%AD%20p%C5%99edm%C4%9Bty"
        cta="Vybrat předměty"
      />

      {/* ── TŘI KROKY ──────────────────────────────────── */}
      <section className="ap-steps">
        <Reveal>
          <h2 className="ap-h2 ap-center">Tři kroky k ceně.</h2>
        </Reveal>
        <div className="ap-steps-grid">
          {[
            {
              n: "01",
              t: "Vyberte produkt",
              d: "Z katalogu přes čtyři tisíce kusů. Nebo rovnou napište do chatu, co hledáte — najdeme to za vás.",
            },
            {
              n: "02",
              t: "Nahrajte logo",
              d: "Umístíte ho přímo na fotce produktu. Bez grafika, bez e-mailování sem a tam.",
            },
            {
              n: "03",
              t: "Vidíte cenu",
              d: "Orientační cena naskočí okamžitě. Finální nabídku potvrdíme do 24 hodin.",
            },
          ].map((s, i) => (
            <Reveal key={s.n} delay={i * 0.1} className="ap-step">
              <p className="ap-step-n">{s.n}</p>
              <h3 className="ap-step-t">{s.t}</h3>
              <p className="ap-body ap-step-d">{s.d}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── ZÁVĚR ──────────────────────────────────────── */}
      <section className="ap-final">
        <Reveal>
          <h2 className="ap-h2 ap-center">Začněte jedním logem.</h2>
          <p className="ap-lead ap-center">
            Nahrajte ho, položte na produkt a podívejte se, co to stojí.
            Nezávazně a bez registrace.
          </p>
          <div className="ap-cta-row ap-center-row">
            <Pill href="/konfigurator">Spustit konfigurátor</Pill>
          </div>
          <p className="ap-contact">
            Radši si promluvit?{" "}
            <a href="mailto:loookucz@gmail.com">loookucz@gmail.com</a>
            <span className="ap-dot">·</span>
            <a href="tel:+420739165191">+420 739 165 191</a>
          </p>
        </Reveal>
      </section>
    </div>
  );
}
