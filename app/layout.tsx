import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "LOOOKU — výšivka, potisk, reklamní textil a merch",
  description:
    "Výšivka, potisk, reklamní textil, firemní merch i reklamní předměty na míru. Trička, mikiny, bundy, čepice, tašky. Návrh online, cena hned, rychlé dodání.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs" className={`${inter.variable} h-full antialiased`}>
      <body
        className="min-h-full"
        style={{ background: "var(--background)", color: "var(--foreground)" }}
      >
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
