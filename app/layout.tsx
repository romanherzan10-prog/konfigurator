import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
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
    <html lang="cs" className={`${inter.className} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              <a href="/" className="text-2xl font-bold tracking-tight text-primary">
                LOOOKU
              </a>
              <nav className="flex items-center gap-4">
                <a
                  href="/katalog"
                  className="text-sm font-medium text-gray-600 hover:text-primary transition-colors"
                >
                  Katalog
                </a>
              </nav>
            </div>
            <a
              href="tel:+420123456789"
              className="text-sm text-gray-600 hover:text-primary transition-colors"
            >
              +420 123 456 789
            </a>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-gray-200 bg-white mt-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 text-center text-sm text-gray-500">
            &copy; {new Date().getFullYear()} LOOOKU. Všechna práva vyhrazena.
          </div>
        </footer>
      </body>
    </html>
  );
}
