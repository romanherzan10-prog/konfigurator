import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Reklamní textil na míru | LOOOKU",
  description:
    "Konfigurátor reklamního textilu — trička, mikiny, bundy s potiskem nebo výšivkou. Rychlá kalkulace a objednávka online.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col" style={{ background: "var(--background)", color: "var(--foreground)" }}>

        <header className="header-sticky">
          <div className="container flex items-center justify-between h-16">
            {/* Logo + nav */}
            <div className="flex items-center gap-6">
              <a href="/" className="flex items-center gap-2.5 group">
                <div className="logo-mark">L</div>
                <span className="font-bold text-lg tracking-tight" style={{ color: "var(--foreground)" }}>
                  LOOOKU
                </span>
              </a>

              <nav className="hidden sm:flex items-center gap-1">
                <a href="/katalog" className="nav-link">Katalog</a>
                <a href="/konfigurator" className="nav-link">Konfigurátor</a>
              </nav>
            </div>

            {/* CTA */}
            <div className="flex items-center gap-3">
              <a href="tel:+420123456789" className="hidden sm:flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--muted)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.82 19.79 19.79 0 01.07 2.19 2 2 0 012.06 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14.92v2z"/>
                </svg>
                +420 123 456 789
              </a>
              <a href="/" className="btn btn-accent text-sm px-4 py-2">
                Spustit asistenta
              </a>
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t mt-16" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="container py-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ background: "var(--primary)" }}>L</div>
                  <span className="font-bold" style={{ color: "var(--foreground)" }}>LOOOKU</span>
                </div>
                <p className="text-sm" style={{ color: "var(--muted)" }}>Reklamní textil na míru pro firmy.</p>
              </div>
              <div className="flex items-center gap-6 text-sm" style={{ color: "var(--muted)" }}>
                <a href="/katalog" className="footer-link">Katalog</a>
                <a href="/konfigurator" className="footer-link">Konfigurátor</a>
                <a href="mailto:info@loooku.cz" className="footer-link">Kontakt</a>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t text-sm" style={{ borderColor: "var(--border)", color: "var(--muted-light)" }}>
              &copy; {new Date().getFullYear()} LOOOKU. Všechna práva vyhrazena.
            </div>
          </div>
        </footer>

      </body>
    </html>
  );
}
