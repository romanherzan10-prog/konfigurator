import { instrument } from "@/app/fonts";
import { LandingApple } from "@/components/landing/LandingApple";
import "@/components/apple/apple-base.css";
import "@/components/landing/landing-apple.css";

/**
 * Hlavní strana — Apple střih: jedno písmo, monochromní plátno,
 * produkt v hlavní roli, LOOOKU fialová jako jediný barevný akcent.
 *
 * Předchozí verze „Ateliér" zůstává v components/landing/LandingV2.tsx —
 * návrat je záměna importu a komponenty níž.
 */
export default function Home() {
  return (
    <div className={instrument.variable}>
      <LandingApple />
    </div>
  );
}
