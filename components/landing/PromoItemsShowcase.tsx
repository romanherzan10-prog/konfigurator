"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";

interface PromoItem {
  src: string;
  alt: string;
  label: string;
  /** relativní rychlost paralaxy — vyšší číslo = větší posun při scrollu */
  speed: number;
}

const ITEMS: PromoItem[] = [
  {
    src: "https://pub-1f19c6dc56e8412790975e8dc137e05a.r2.dev/products/9104D391-CD9E-474F-987E-17130D9A4745.jpg",
    alt: "Deštník s potiskem loga",
    label: "Deštníky",
    speed: 70,
  },
  {
    src: "https://pub-1f19c6dc56e8412790975e8dc137e05a.r2.dev/products/7E2BAFDC-E7B1-4B75-BE06-DEC57C4BFE88.jpg",
    alt: "Reklamní batoh",
    label: "Batohy",
    speed: -50,
  },
  {
    src: "https://pub-1f19c6dc56e8412790975e8dc137e05a.r2.dev/products/BB383C98-A760-49FC-A71A-05714C1F1D9C.jpg",
    alt: "Reklamní taška",
    label: "Tašky",
    speed: 60,
  },
];

function ParallaxItem({ item, index }: { item: PromoItem; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const rawY = useTransform(scrollYProgress, [0, 1], [item.speed, -item.speed]);
  const rawRotate = useTransform(scrollYProgress, [0, 1], [-6, 6]);
  const y = useSpring(rawY, { stiffness: 50, damping: 20 });
  const rotate = useSpring(rawRotate, { stiffness: 50, damping: 20 });

  return (
    <motion.div
      ref={ref}
      style={{ y, rotate }}
      initial={{ opacity: 0, scale: 0.85 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="relative flex flex-col items-center"
    >
      <div
        className="relative rounded-2xl overflow-hidden w-full aspect-square"
        style={{ background: "var(--surface)", boxShadow: "var(--shadow-lg)" }}
      >
        <img
          src={item.src}
          alt={item.alt}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      </div>
      <span className="mt-3 text-sm font-semibold" style={{ color: "var(--muted)" }}>
        {item.label}
      </span>
    </motion.div>
  );
}

/**
 * Řada reklamních předmětů mimo textil — každá karta se hýbe jinou
 * rychlostí podle scrollu, takže při průjezdu stránkou vzniká paralaxa.
 */
export function PromoItemsShowcase() {
  return (
    <section className="section" style={{ background: "var(--surface-2)" }}>
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2>A to není zdaleka všechno</h2>
          <p className="mt-3 text-lg" style={{ color: "var(--muted)" }}>
            Deštníky, batohy, tašky a další reklamní předměty s vaším logem.
          </p>
        </motion.div>

        <div className="grid grid-cols-3 gap-5 sm:gap-8 max-w-2xl mx-auto">
          {ITEMS.map((item, i) => (
            <ParallaxItem key={item.label} item={item} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
