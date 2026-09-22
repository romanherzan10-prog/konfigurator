import { Instrument_Sans } from "next/font/google";

/**
 * Písmo Apple střihu — jedno pro celou stránku, v několika řezech.
 * Sdílené mezi landingem a detailem produktu, ať se nenačítá dvakrát
 * a nerozejde se konfigurace.
 */
export const instrument = Instrument_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-instrument",
  display: "swap",
});
