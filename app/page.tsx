import { Hero } from "@/components/landing/Hero";
import { ServicesGrid } from "@/components/landing/ServicesGrid";
import { PromoItemsShowcase } from "@/components/landing/PromoItemsShowcase";
import { FinalCta } from "@/components/landing/FinalCta";

/**
 * Hlavní strana = úvodní "výkladní skříň" (výšivka, potisk, reklamní textil,
 * merch, reklamní předměty), proklik do katalogu/konfigurátoru.
 * Katalog samotný žije na /katalog.
 */
export default function Home() {
  return (
    <>
      <Hero />
      <ServicesGrid />
      <PromoItemsShowcase />
      <FinalCta />
    </>
  );
}
