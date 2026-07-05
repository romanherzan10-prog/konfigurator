"use client";

import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useMotionValue,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";

/**
 * LOOOKU one-page „Ateliér“ — temné dílenské plátno, krémový papír, jantarová nit.
 * Ústřední motiv: stránka se při scrollu sešívá (prošívaná nit vede okem).
 * Vše scopované na landing (--lp-* proměnné na wrapperu) — globální tokeny webu se nemění.
 */

const IMG = {
  cap: "https://ntzalajouwqqdiqpnehx.supabase.co/storage/v1/object/public/uploads/katalog-mockupy/33.0307-mqh2enok915jrl.png",
  hoodie: "https://ntzalajouwqqdiqpnehx.supabase.co/storage/v1/object/public/uploads/katalog-mockupy/20.P396-mqh31ajbb489in.png",
  tee: "https://ntzalajouwqqdiqpnehx.supabase.co/storage/v1/object/public/uploads/katalog-mockupy/25.3981-mqh3i57tj7j639.png",
  bag: "https://pub-1f19c6dc56e8412790975e8dc137e05a.r2.dev/products/9D628698-4843-4994-98D8-3768581F955F.jpg",
  umbrella: "https://pub-1f19c6dc56e8412790975e8dc137e05a.r2.dev/products/9104D391-CD9E-474F-987E-17130D9A4745.jpg",
  backpack: "https://pub-1f19c6dc56e8412790975e8dc137e05a.r2.dev/products/7E2BAFDC-E7B1-4B75-BE06-DEC57C4BFE88.jpg",
  merch: "https://images-api.printify.com/mockup/6a2e2343f5f63e260010069a/148112/111855/unisex-organic-oversized-sweatshirt-radder-20.jpg?camera_label=front",
};

/* ── Prošívaný steh (SVG dashed underline, kreslí se) ── */
function Stitch({ delay = 0.4 }: { delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <svg
      viewBox="0 0 300 14"
      className="lp-stitch"
      aria-hidden
      preserveAspectRatio="none"
    >
      <motion.path
        d="M4 9 C 60 3, 120 13, 180 7 S 280 5, 296 8"
        fill="none"
        stroke="var(--lp-thread)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="10 8"
        initial={reduce ? undefined : { pathLength: 0 }}
        whileInView={reduce ? undefined : { pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.1, delay, ease: "easeInOut" }}
      />
    </svg>
  );
}

/* ── Plovoucí produkt s parallaxou + mouse-tilt ── */
function FloatingProduct({
  src,
  alt,
  mx,
  my,
  depth,
  className,
  floatDelay = 0,
}: {
  src: string;
  alt: string;
  mx: MotionValue<number>;
  my: MotionValue<number>;
  depth: number;
  className: string;
  floatDelay?: number;
}) {
  const reduce = useReducedMotion();
  const x = useTransform(mx, (v) => v * depth);
  const y = useTransform(my, (v) => v * depth);
  return (
    <motion.div style={reduce ? undefined : { x, y }} className={className}>
      <motion.img
        src={src}
        alt={alt}
        draggable={false}
        className="w-full h-auto select-none"
        style={{ filter: "drop-shadow(0 30px 40px rgba(0,0,0,0.55))" }}
        animate={reduce ? undefined : { y: [0, -12, 0], rotate: [0, -1.2, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: floatDelay }}
      />
    </motion.div>
  );
}

/* ── HERO ── */
function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const rawMx = useMotionValue(0);
  const rawMy = useMotionValue(0);
  const mx = useSpring(rawMx, { stiffness: 40, damping: 15 });
  const my = useSpring(rawMy, { stiffness: 40, damping: 15 });

  function onMove(e: React.MouseEvent) {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    rawMx.set(((e.clientX - r.left) / r.width - 0.5) * 2);
    rawMy.set(((e.clientY - r.top) / r.height - 0.5) * 2);
  }

  return (
    <section ref={ref} onMouseMove={onMove} className="relative overflow-hidden lp-hero">
      {/* atmosféra: jantarová zář + vlákna */}
      <div aria-hidden className="lp-hero-glow" />
      <div aria-hidden className="lp-weave" />

      <div className="lp-wrap relative grid gap-10 lg:grid-cols-[1.05fr_0.95fr] items-center pt-16 pb-24 sm:pt-24 sm:pb-32">
        <div className="relative z-10">
          <motion.p
            className="lp-eyebrow"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Výšivka · potisk · merch — Praha, Česko
          </motion.p>

          <motion.h1
            className="lp-display"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08 }}
          >
            Oblečeme
            <br />
            vaši{" "}
            <span className="lp-accent-word">
              značku
              <Stitch />
            </span>
            .
          </motion.h1>

          <motion.p
            className="lp-lead"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.22 }}
          >
            Vyšijeme a potiskneme trička, mikiny, čepice i tašky — od 10 kusů
            po celé kolekce. Logo nahrajete online a cenu vidíte hned.
          </motion.p>

          <motion.div
            className="flex flex-wrap gap-3 mt-9"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.34 }}
          >
            <a href="/konfigurator" className="lp-btn lp-btn-thread">
              Navrhnout a spočítat cenu
              <ArrowIcon />
            </a>
            <a href="/katalog" className="lp-btn lp-btn-ghost">
              Katalog produktů
            </a>
          </motion.div>

          <motion.dl
            className="lp-stats"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.55 }}
          >
            <div><dt>4 000+</dt><dd>produktů v katalogu</dd></div>
            <div><dt>od 10 ks</dt><dd>minimální odběr</dd></div>
            <div><dt>ihned</dt><dd>orientační cena online</dd></div>
          </motion.dl>
        </div>

        {/* jeviště s produkty */}
        <div className="relative h-[380px] sm:h-[460px] lg:h-[540px]" aria-hidden>
          <FloatingProduct
            src={IMG.hoodie}
            alt=""
            mx={mx}
            my={my}
            depth={-14}
            className="absolute left-0 top-[4%] w-[62%]"
          />
          <FloatingProduct
            src={IMG.cap}
            alt=""
            mx={mx}
            my={my}
            depth={22}
            className="absolute right-0 bottom-[6%] w-[48%]"
            floatDelay={0.8}
          />
          {/* nit spojující produkty */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 500" fill="none" preserveAspectRatio="none">
            <motion.path
              d="M70 90 C 180 140, 140 320, 300 400"
              stroke="var(--lp-thread)"
              strokeWidth="2"
              strokeDasharray="8 10"
              opacity="0.5"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.6, delay: 0.6, ease: "easeInOut" }}
            />
            <circle cx="70" cy="90" r="4" fill="var(--lp-thread)" />
            <circle cx="300" cy="400" r="4" fill="var(--lp-thread)" />
          </svg>
        </div>
      </div>
    </section>
  );
}

/* ── MARQUEE pás kategorií ── */
const MARQUEE = ["TRIČKA", "MIKINY", "ČEPICE", "POLOKOŠILE", "TAŠKY", "BUNDY", "BATOHY", "MERCH", "DEŠTNÍKY"];
function Marquee() {
  const row = [...MARQUEE, ...MARQUEE];
  return (
    <div className="lp-marquee" aria-hidden>
      <div className="lp-marquee-track">
        {[0, 1].map((i) => (
          <div key={i} className="lp-marquee-row">
            {row.map((t, j) => (
              <span key={j}>
                {t}
                <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 0 L8.6 5.4 L14 7 L8.6 8.6 L7 14 L5.4 8.6 L0 7 L5.4 5.4 Z" fill="currentColor" /></svg>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── KAPITOLY ŘEMESLA 01–05 ── */
interface Chapter {
  n: string;
  title: string;
  text: string;
  img: string;
  imgAlt: string;
  href: string;
  cta: string;
  paper?: boolean; // fotka s bílým pozadím → papírový rámeček
}

const CHAPTERS: Chapter[] = [
  {
    n: "01",
    title: "Výšivka",
    text: "Logo prošité nití vydrží roky praní i nošení a působí o třídu dráž než potisk. Nejlépe sedí čepicím, polokošilím a firemním uniformám.",
    img: IMG.cap,
    imgAlt: "Kšiltovka s vyšitým logem",
    href: "/konfigurator",
    cta: "Chci výšivku",
  },
  {
    n: "02",
    title: "Potisk",
    text: "DTF na malé série a fotorealistické motivy, sítotisk na stovky kusů. Ostré barvy, přesné pozice, rychlé dodání.",
    img: IMG.tee,
    imgAlt: "Tričko s barevným potiskem",
    href: "/konfigurator",
    cta: "Chci potisk",
  },
  {
    n: "03",
    title: "Reklamní textil",
    text: "Přes čtyři tisíce produktů od ověřených značek — trička, mikiny, bundy, čepice, tašky. Skladem, ve všech barvách a velikostech.",
    img: IMG.hoodie,
    imgAlt: "Mikina s logem",
    href: "/katalog",
    cta: "Otevřít katalog",
  },
  {
    n: "04",
    title: "Merch",
    text: "Vlastní kolekce pod vaší značkou — od návrhu po hotový kus. Trička, mikiny a doplňky, které lidé nosí dobrovolně.",
    img: IMG.merch,
    imgAlt: "Merch mikina s vlastním designem",
    href: "/katalog?zdroj=merch",
    cta: "Prohlédnout merch",
    paper: true,
  },
  {
    n: "05",
    title: "Reklamní předměty",
    text: "Deštníky, batohy a tašky s logem — praktické dárky pro klienty a týmy, které neskončí v šuplíku.",
    img: IMG.umbrella,
    imgAlt: "Deštník s potiskem",
    href: "/katalog",
    cta: "Vybrat předměty",
    paper: true,
  },
];

function ChapterRow({ ch, i }: { ch: Chapter; i: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const imgY = useSpring(useTransform(scrollYProgress, [0, 1], [50, -50]), { stiffness: 50, damping: 20 });
  const even = i % 2 === 0;

  return (
    <div ref={ref} className={`lp-chapter ${even ? "" : "lp-chapter-flip"}`}>
      <motion.div
        className="lp-chapter-media"
        style={reduce ? undefined : { y: imgY }}
        initial={{ opacity: 0, scale: 0.92 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
      >
        <div className={ch.paper ? "lp-swatch lp-swatch-paper" : "lp-swatch"}>
          <img src={ch.img} alt={ch.imgAlt} loading="lazy" />
        </div>
      </motion.div>

      <motion.div
        className="lp-chapter-body"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        <span className="lp-chapter-n" aria-hidden>{ch.n}</span>
        <h3 className="lp-h3">{ch.title}</h3>
        <p className="lp-body">{ch.text}</p>
        <a href={ch.href} className="lp-link">
          {ch.cta}
          <ArrowIcon />
        </a>
      </motion.div>
    </div>
  );
}

function Chapters() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.7", "end 0.9"] });
  const spine = useSpring(scrollYProgress, { stiffness: 60, damping: 25 });

  return (
    <section className="relative lp-section" id="remeslo">
      <div className="lp-wrap">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
        >
          <p className="lp-eyebrow">Řemeslo</p>
          <h2 className="lp-h2">
            Pět způsobů, jak nosit{" "}
            <span className="lp-accent-word">
              logo
              <Stitch delay={0.2} />
            </span>
          </h2>
        </motion.div>

        <div ref={ref} className="relative mt-16 sm:mt-20">
          {/* prošívaná páteř — šije se se scrollem */}
          {!reduce && (
            <svg className="lp-spine" viewBox="0 0 4 1000" preserveAspectRatio="none" aria-hidden>
              <motion.line
                x1="2" y1="0" x2="2" y2="1000"
                stroke="var(--lp-thread)"
                strokeWidth="2.5"
                strokeDasharray="8 10"
                style={{ pathLength: spine }}
                opacity={0.55}
              />
            </svg>
          )}
          <div className="space-y-20 sm:space-y-28">
            {CHAPTERS.map((ch, i) => (
              <ChapterRow key={ch.n} ch={ch} i={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── 3 KROKY ── */
const STEPS = [
  { n: "1", t: "Vyberte produkt", d: "Z katalogu 4 000+ kusů — nebo nám řekněte v chatu, co hledáte." },
  { n: "2", t: "Nahrajte logo", d: "Umístíte ho přímo na fotce produktu. Bez grafika, bez e-mailování." },
  { n: "3", t: "Cena hned", d: "Orientační cenu vidíte okamžitě. Finální nabídku potvrdíme do 24 h." },
];

function Steps() {
  return (
    <section className="lp-section lp-steps-bg">
      <div className="lp-wrap">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
        >
          <p className="lp-eyebrow">Jak to funguje</p>
          <h2 className="lp-h2">Tři kroky k ceně</h2>
        </motion.div>

        <div className="lp-steps">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              className="lp-step"
              initial={{ opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.55, delay: i * 0.12 }}
            >
              <span className="lp-step-n">{s.n}</span>
              <h3 className="lp-h4">{s.t}</h3>
              <p className="lp-body">{s.d}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="text-center mt-12"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.35 }}
        >
          <a href="/konfigurator" className="lp-btn lp-btn-thread">
            Začít s návrhem
            <ArrowIcon />
          </a>
        </motion.div>
      </div>
    </section>
  );
}

/* ── ZÁVĚREČNÉ CTA ── */
function Outro() {
  return (
    <section className="lp-section lp-outro">
      <div className="lp-wrap text-center relative">
        <motion.h2
          className="lp-display lp-outro-title"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
        >
          Máte logo?
          <br />
          <span className="lp-accent-word">
            My máme jehly
            <Stitch delay={0.5} />
          </span>
          .
        </motion.h2>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.25 }}
        >
          <a href="/konfigurator" className="lp-btn lp-btn-thread lp-btn-big mt-10">
            Spočítat cenu online
            <ArrowIcon />
          </a>
          <p className="lp-body mt-8 opacity-70">
            Nebo napište: <a className="lp-link-inline" href="mailto:loookucz@gmail.com">loookucz@gmail.com</a>
            {" · "}
            <a className="lp-link-inline" href="tel:+420739165191">+420 739 165 191</a>
          </p>
        </motion.div>
      </div>
    </section>
  );
}

function ArrowIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
    </svg>
  );
}

/* ── STRÁNKA ── */
export function LandingV2() {
  return (
    <div className="lp-root">
      <Hero />
      <Marquee />
      <Chapters />
      <Steps />
      <Outro />
      {/* zrno přes celou stránku */}
      <div aria-hidden className="lp-grain" />
      <LandingStyles />
    </div>
  );
}

/* ── SCOPED STYLY (jen landing; globální tokeny webu nedotčené) ── */
function LandingStyles() {
  return (
    <style>{`
      .lp-root {
        --lp-ink: #171310;
        --lp-ink-2: #201b16;
        --lp-ink-3: #2a241d;
        --lp-paper: #f3ede1;
        --lp-paper-dim: #d8d0bf;
        --lp-thread: #f5a623;
        --lp-thread-hot: #ffb84d;
        --lp-line: rgba(243, 237, 225, 0.14);
        background:
          radial-gradient(1100px 500px at 85% -5%, rgba(245,166,35,0.09), transparent 60%),
          var(--lp-ink);
        color: var(--lp-paper);
        font-family: var(--font-archivo), system-ui, sans-serif;
        overflow-x: clip;
        position: relative;
      }
      .lp-root ::selection { background: var(--lp-thread); color: var(--lp-ink); }

      .lp-wrap { max-width: 1200px; margin: 0 auto; padding: 0 22px; }
      .lp-section { padding: 96px 0; position: relative; }
      @media (max-width: 640px) { .lp-section { padding: 68px 0; } }

      /* typografie */
      .lp-display {
        font-family: var(--font-fraunces), Georgia, serif;
        font-weight: 620;
        font-size: clamp(46px, 8vw, 96px);
        line-height: 0.98;
        letter-spacing: -0.015em;
        color: var(--lp-paper);
      }
      .lp-h2 {
        font-family: var(--font-fraunces), Georgia, serif;
        font-weight: 600;
        font-size: clamp(32px, 4.6vw, 54px);
        line-height: 1.05;
        color: var(--lp-paper);
      }
      .lp-h3 {
        font-family: var(--font-fraunces), Georgia, serif;
        font-weight: 600;
        font-size: clamp(26px, 3vw, 38px);
        color: var(--lp-paper);
        margin-bottom: 12px;
      }
      .lp-h4 { font-weight: 700; font-size: 19px; margin: 14px 0 6px; color: var(--lp-paper); }
      .lp-eyebrow {
        font-size: 12.5px; font-weight: 600; letter-spacing: 0.22em;
        text-transform: uppercase; color: var(--lp-thread); margin-bottom: 18px;
      }
      .lp-lead { font-size: clamp(17px, 1.6vw, 20px); line-height: 1.65; color: var(--lp-paper-dim); max-width: 34em; margin-top: 22px; }
      .lp-body { font-size: 16px; line-height: 1.7; color: var(--lp-paper-dim); }

      .lp-accent-word { position: relative; display: inline-block; font-style: italic; color: var(--lp-thread-hot); }
      .lp-stitch { position: absolute; left: -2%; right: -2%; bottom: -0.12em; width: 104%; height: 0.22em; overflow: visible; }

      /* hero */
      .lp-hero { min-height: calc(100svh - 56px); display: flex; align-items: center; }
      .lp-hero-glow {
        position: absolute; inset: 0; pointer-events: none;
        background: radial-gradient(700px 420px at 72% 62%, rgba(245,166,35,0.13), transparent 65%);
      }
      .lp-weave {
        position: absolute; inset: 0; pointer-events: none; opacity: 0.5;
        background-image:
          repeating-linear-gradient(0deg, transparent 0 31px, var(--lp-line) 31px 32px),
          repeating-linear-gradient(90deg, transparent 0 31px, var(--lp-line) 31px 32px);
        mask-image: radial-gradient(80% 70% at 50% 40%, black, transparent);
        -webkit-mask-image: radial-gradient(80% 70% at 50% 40%, black, transparent);
      }
      .lp-stats { display: flex; gap: 34px; margin-top: 46px; flex-wrap: wrap; }
      .lp-stats dt { font-family: var(--font-fraunces), serif; font-size: 26px; font-weight: 600; color: var(--lp-paper); }
      .lp-stats dd { font-size: 13px; color: var(--lp-paper-dim); margin-top: 2px; }

      /* tlačítka */
      .lp-btn {
        display: inline-flex; align-items: center; gap: 10px;
        font-weight: 650; font-size: 15.5px; text-decoration: none;
        padding: 15px 26px; border-radius: 999px;
        transition: transform .18s ease, box-shadow .18s ease, background .18s ease, color .18s ease;
      }
      .lp-btn-big { font-size: 17px; padding: 18px 34px; }
      .lp-btn-thread {
        background: var(--lp-thread); color: var(--lp-ink);
        box-shadow: 0 10px 30px rgba(245,166,35,0.25);
      }
      .lp-btn-thread:hover { background: var(--lp-thread-hot); transform: translateY(-2px); box-shadow: 0 14px 36px rgba(245,166,35,0.35); }
      .lp-btn-ghost { color: var(--lp-paper); border: 1.5px dashed rgba(243,237,225,0.35); }
      .lp-btn-ghost:hover { border-color: var(--lp-thread); color: var(--lp-thread-hot); }

      /* marquee */
      .lp-marquee { background: var(--lp-thread); color: var(--lp-ink); overflow: hidden; transform: rotate(-1.2deg) scale(1.02); }
      .lp-marquee-track { display: flex; width: max-content; animation: lp-scroll 38s linear infinite; }
      .lp-marquee-row { display: flex; align-items: center; }
      .lp-marquee-row span {
        display: inline-flex; align-items: center; gap: 22px;
        padding: 14px 22px 14px 0; margin-left: 22px;
        font-family: var(--font-fraunces), serif; font-weight: 640; font-size: 21px; letter-spacing: 0.04em;
        white-space: nowrap;
      }
      @keyframes lp-scroll { to { transform: translateX(-50%); } }
      @media (prefers-reduced-motion: reduce) { .lp-marquee-track { animation: none; } }

      /* kapitoly */
      .lp-spine { position: absolute; left: 50%; top: 0; bottom: 0; width: 4px; height: 100%; transform: translateX(-50%); }
      @media (max-width: 1023px) { .lp-spine { left: 8px; transform: none; } }
      .lp-chapter {
        display: grid; gap: 34px; align-items: center; position: relative;
        grid-template-columns: 1fr;
      }
      @media (min-width: 1024px) {
        .lp-chapter { grid-template-columns: 1fr 1fr; gap: 90px; }
        .lp-chapter-flip .lp-chapter-media { order: 2; }
        .lp-chapter-flip .lp-chapter-body { order: 1; text-align: right; }
        .lp-chapter-flip .lp-chapter-body .lp-link { justify-content: flex-end; }
      }
      .lp-chapter-n {
        font-family: var(--font-fraunces), serif; font-weight: 600;
        font-size: clamp(64px, 8vw, 110px); line-height: 1;
        color: transparent; -webkit-text-stroke: 1.5px rgba(245,166,35,0.5);
        display: block; margin-bottom: -0.28em;
      }
      .lp-swatch {
        border-radius: 22px; overflow: hidden; padding: 8%;
        background: radial-gradient(120% 120% at 30% 20%, var(--lp-ink-3), var(--lp-ink-2));
        border: 1px solid var(--lp-line);
        box-shadow: 0 30px 60px rgba(0,0,0,0.45);
      }
      .lp-swatch img { width: 100%; height: auto; display: block; }
      .lp-swatch-paper { background: var(--lp-paper); padding: 0; }
      .lp-swatch-paper img { aspect-ratio: 4/3; object-fit: cover; }
      .lp-link {
        display: inline-flex; align-items: center; gap: 8px; margin-top: 20px;
        color: var(--lp-thread-hot); font-weight: 650; font-size: 15.5px; text-decoration: none;
        border-bottom: 1.5px dashed rgba(245,166,35,0.45); padding-bottom: 3px;
        transition: gap .18s ease, border-color .18s ease;
      }
      .lp-link:hover { gap: 14px; border-color: var(--lp-thread-hot); }
      .lp-link-inline { color: var(--lp-thread-hot); text-decoration: none; border-bottom: 1px dashed rgba(245,166,35,0.45); }

      /* kroky */
      .lp-steps-bg { background: linear-gradient(180deg, transparent, rgba(245,166,35,0.05) 30%, transparent); }
      .lp-steps { display: grid; gap: 22px; margin-top: 56px; grid-template-columns: 1fr; }
      @media (min-width: 768px) { .lp-steps { grid-template-columns: repeat(3, 1fr); gap: 34px; } }
      .lp-step {
        position: relative; padding: 30px 26px;
        border: 1.5px dashed rgba(243,237,225,0.22); border-radius: 20px;
        background: rgba(243,237,225,0.03);
        transition: border-color .2s ease, transform .2s ease;
      }
      .lp-step:hover { border-color: rgba(245,166,35,0.6); transform: translateY(-4px); }
      .lp-step-n {
        display: inline-flex; align-items: center; justify-content: center;
        width: 42px; height: 42px; border-radius: 999px;
        background: var(--lp-thread); color: var(--lp-ink);
        font-family: var(--font-fraunces), serif; font-weight: 700; font-size: 20px;
      }

      /* outro */
      .lp-outro { padding-bottom: 130px; }
      .lp-outro-title { font-size: clamp(42px, 7vw, 84px); }

      /* zrno */
      .lp-grain {
        position: absolute; inset: 0; pointer-events: none; opacity: 0.5; mix-blend-mode: overlay;
        background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.16'/%3E%3C/svg%3E");
      }
    `}</style>
  );
}
