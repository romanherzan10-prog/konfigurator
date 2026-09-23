import { instrument } from "@/app/fonts";
import "@/components/apple/apple-base.css";
import "./produkt-apple.css";

/**
 * Detail produktu jede v Apple střihu. Písmo a styly dodává tenhle
 * serverový layout, aby samotná stránka (klientská, drží stav barvy,
 * galerie a načítání ceny) zůstala jen o logice.
 *
 * `.ap-root` scopuje všechny --ap-* tokeny, takže zbytek katalogu
 * běží dál na globálním violet design systemu.
 */
export default function ProduktLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${instrument.variable} ap-root`}>{children}</div>
  );
}
