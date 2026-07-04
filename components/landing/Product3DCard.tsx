"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";

interface Product3DCardProps {
  src: string;
  alt: string;
  /** Rozsah náklonu ve stupních při průjezdu kolem karty (výchozí ±10°) */
  tiltRange?: number;
  /** Směr posunu při scrollu — "up" karta stoupá, "down" klesá (paralaxa mezi vrstvami) */
  drift?: "up" | "down";
  /** Zpoždění idle houpání, aby karty vedle sebe nekmitaly synchronně */
  floatDelay?: number;
  className?: string;
}

/**
 * Produktová karta s dojmem 3D — fotka se naklápí (rotateX/rotateY) a jemně
 * posouvá podle pozice scrollu (paralaxa), plus nekonečné pomalé "vznášení".
 * Bez reálného 3D modelu — perspektiva + stín vrstev dělá dojem hloubky.
 */
export function Product3DCard({
  src,
  alt,
  tiltRange = 10,
  drift = "up",
  floatDelay = 0,
  className = "",
}: Product3DCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const rawRotateY = useTransform(scrollYProgress, [0, 0.5, 1], [-tiltRange, 0, tiltRange]);
  const rawRotateX = useTransform(scrollYProgress, [0, 0.5, 1], [tiltRange * 0.6, 0, -tiltRange * 0.6]);
  const driftAmount = drift === "up" ? [60, -60] : [-60, 60];
  const rawY = useTransform(scrollYProgress, [0, 1], driftAmount);

  // useSpring vyhladí pohyb, ať scroll netrhá kartou
  const rotateY = useSpring(rawRotateY, { stiffness: 60, damping: 20, mass: 0.6 });
  const rotateX = useSpring(rawRotateX, { stiffness: 60, damping: 20, mass: 0.6 });
  const y = useSpring(rawY, { stiffness: 50, damping: 22, mass: 0.8 });

  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      style={{ perspective: 1200 }}
    >
      <motion.div
        style={{ rotateX, rotateY, y, transformStyle: "preserve-3d" }}
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: floatDelay }}
        className="relative"
      >
        {/* Barevná zář v pozadí — dodává dojem hloubky pod produktem */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 rounded-full blur-3xl opacity-40"
          style={{
            background:
              "radial-gradient(circle, var(--primary-light) 0%, transparent 70%)",
            transform: "translateZ(-40px) scale(0.85)",
          }}
        />
        <img
          src={src}
          alt={alt}
          className="relative w-full h-full object-contain drop-shadow-2xl select-none"
          style={{ transform: "translateZ(20px)" }}
          draggable={false}
          loading="lazy"
        />
      </motion.div>
    </div>
  );
}
