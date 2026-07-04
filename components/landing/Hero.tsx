"use client";

import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { Product3DCard } from "./Product3DCard";

const KSILTOVKA_MOCKUP =
  "https://ntzalajouwqqdiqpnehx.supabase.co/storage/v1/object/public/uploads/katalog-mockupy/33.0307-mqh2enok915jrl.png";
const MIKINA_MOCKUP =
  "https://ntzalajouwqqdiqpnehx.supabase.co/storage/v1/object/public/uploads/katalog-mockupy/20.P396-mqh31ajbb489in.png";

export function Hero() {
  return (
    <section
      className="relative overflow-hidden pt-14 pb-20 sm:pt-20 sm:pb-28"
      style={{
        background:
          "radial-gradient(1200px 600px at 50% -10%, var(--primary-100), transparent), var(--background)",
      }}
    >
      <div className="container relative grid gap-12 lg:grid-cols-2 lg:items-center">
        {/* Text */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <span className="badge badge-primary mb-5">
            <Sparkles className="w-3.5 h-3.5" />
            Výšivka &amp; potisk na míru
          </span>
          <h1 className="mb-5">
            Vaše logo na tričku,{" "}
            <span style={{ color: "var(--primary)" }}>mikině i hrnku</span>.
          </h1>
          <p
            className="text-lg sm:text-xl mb-8 max-w-xl"
            style={{ color: "var(--muted)" }}
          >
            Výšivka, potisk, reklamní textil, firemní merch i drobné reklamní
            předměty — všechno pod jednou střechou. Vyberte si produkt,
            nahrajte logo a cenu uvidíte hned.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="/konfigurator" className="btn btn-accent" style={{ fontSize: 16, padding: "14px 26px" }}>
              Spustit konfigurátor
              <ArrowRight className="w-4 h-4" />
            </a>
            <a href="/katalog" className="btn btn-ghost" style={{ fontSize: 16, padding: "14px 26px" }}>
              Prohlédnout katalog
            </a>
          </div>
        </motion.div>

        {/* 3D showcase */}
        <div className="relative h-[340px] sm:h-[420px] lg:h-[480px]">
          <div className="absolute left-[6%] top-[6%] w-[58%] sm:w-[52%]">
            <Product3DCard
              src={MIKINA_MOCKUP}
              alt="Mikina s potiskem a výšivkou LOOOKU"
              drift="down"
              tiltRange={9}
              floatDelay={0.3}
            />
          </div>
          <div className="absolute right-[2%] bottom-[4%] w-[46%] sm:w-[40%]">
            <Product3DCard
              src={KSILTOVKA_MOCKUP}
              alt="Kšiltovka s vyšitým logem"
              drift="up"
              tiltRange={12}
              floatDelay={0.9}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
