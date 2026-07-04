"use client";

import { motion } from "framer-motion";
import { ArrowRight, Scissors, Printer, Shirt, Package } from "lucide-react";

interface Service {
  icon: React.ElementType;
  title: string;
  desc: string;
  img: string;
  imgAlt: string;
  href: string;
}

const SERVICES: Service[] = [
  {
    icon: Scissors,
    title: "Výšivka",
    desc: "Prošité logo, které vydrží roky mytí i nošení. Ideální na čepice, polokošile a firemní oblečení.",
    img: "https://ntzalajouwqqdiqpnehx.supabase.co/storage/v1/object/public/uploads/katalog-mockupy/33.0307-mqh2enok915jrl.png",
    imgAlt: "Kšiltovka s vyšitým logem",
    href: "/konfigurator",
  },
  {
    icon: Printer,
    title: "Potisk",
    desc: "DTF i sítotisk podle počtu kusů a barevnosti návrhu. Ostré barvy, rychlé dodání.",
    img: "https://ntzalajouwqqdiqpnehx.supabase.co/storage/v1/object/public/uploads/katalog-mockupy/25.3981-mqh3i57tj7j639.png",
    imgAlt: "Tričko s barevným potiskem",
    href: "/konfigurator",
  },
  {
    icon: Shirt,
    title: "Reklamní textil",
    desc: "Trička, mikiny, bundy, čepice i tašky — stovky produktů, které si vyzkoušíte přímo online.",
    img: "https://pub-1f19c6dc56e8412790975e8dc137e05a.r2.dev/products/9D628698-4843-4994-98D8-3768581F955F.jpg",
    imgAlt: "Reklamní taška BagBase",
    href: "/katalog",
  },
  {
    icon: Package,
    title: "Merch",
    desc: "Vlastní kolekce s originálním designem — trička, mikiny i doplňky pod vaší značkou.",
    img: "https://images-api.printify.com/mockup/6a2e2343f5f63e260010069a/148112/111855/unisex-organic-oversized-sweatshirt-radder-20.jpg?camera_label=front",
    imgAlt: "Merch mikina s vlastním designem",
    href: "/katalog?zdroj=merch",
  },
];

export function ServicesGrid() {
  return (
    <section className="section">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2>Co pro vás uděláme</h2>
          <p className="mt-3 text-lg" style={{ color: "var(--muted)" }}>
            Čtyři cesty, jak dostat vaše logo na věci, které lidé skutečně nosí.
          </p>
        </motion.div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((s, i) => (
            <motion.a
              key={s.title}
              href={s.href}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              whileHover={{ y: -4 }}
              className="card group flex flex-col overflow-hidden"
            >
              <div
                className="relative h-40 flex items-center justify-center overflow-hidden"
                style={{ background: "var(--surface-2)" }}
              >
                <motion.img
                  src={s.img}
                  alt={s.imgAlt}
                  loading="lazy"
                  className="h-full w-full object-contain p-4 drop-shadow-lg"
                  animate={{ y: [0, -6, 0] }}
                  transition={{
                    duration: 4 + i * 0.4,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: i * 0.3,
                  }}
                />
              </div>
              <div className="p-5 flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "var(--primary-50)", color: "var(--primary)" }}
                  >
                    <s.icon className="w-4 h-4" />
                  </span>
                  <h3>{s.title}</h3>
                </div>
                <p className="text-sm flex-1" style={{ color: "var(--muted)" }}>
                  {s.desc}
                </p>
                <span
                  className="mt-4 inline-flex items-center gap-1 text-sm font-semibold transition-transform group-hover:translate-x-1"
                  style={{ color: "var(--primary)" }}
                >
                  Prozkoumat <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}
