import { Fraunces, Archivo } from "next/font/google";
import { LandingV2 } from "@/components/landing/LandingV2";

/**
 * Hlavní strana = one-page „Ateliér“ (výšivka, potisk, reklamní textil, merch,
 * reklamní předměty) s proklikem do konfigurátoru/katalogu.
 * Fonty jsou scopované jen na landing (zbytek webu jede dál na Interu).
 */

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
});

const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  variable: "--font-archivo",
});

export default function Home() {
  return (
    <div className={`${fraunces.variable} ${archivo.variable}`}>
      <LandingV2 />
    </div>
  );
}
