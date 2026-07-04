"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export function FinalCta() {
  return (
    <section className="section">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl px-8 py-14 sm:px-16 sm:py-20 text-center"
          style={{
            background:
              "linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)",
          }}
        >
          <div
            aria-hidden
            className="absolute -right-16 -top-16 w-64 h-64 rounded-full opacity-20"
            style={{ background: "var(--accent)" }}
          />
          <div
            aria-hidden
            className="absolute -left-20 -bottom-20 w-72 h-72 rounded-full opacity-10"
            style={{ background: "#fff" }}
          />
          <h2 className="relative text-white">Máte nápad? My ho oblečeme.</h2>
          <p className="relative mt-4 text-lg max-w-xl mx-auto" style={{ color: "rgba(255,255,255,0.85)" }}>
            Vyberte produkt, nahrajte logo a cenu vidíte hned v konfigurátoru —
            bez čekání na nabídku.
          </p>
          <a
            href="/konfigurator"
            className="btn relative mt-8 inline-flex"
            style={{
              fontSize: 16,
              padding: "14px 28px",
              background: "#fff",
              color: "var(--primary-hover)",
            }}
          >
            Spočítat cenu hned teď
            <ArrowRight className="w-4 h-4" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
