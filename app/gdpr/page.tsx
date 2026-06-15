export const metadata = {
  title: "Ochrana osobních údajů — LOOOKU",
};

export default function GdprPage() {
  return (
    <div className="container" style={{ maxWidth: 760, paddingTop: 40, paddingBottom: 64 }}>
      <h1 className="text-2xl font-bold mb-2">Zásady ochrany osobních údajů</h1>
      <p className="text-sm mb-8" style={{ color: "var(--muted)" }}>
        Jak nakládáme s vašimi údaji při poptávce a komunikaci.
      </p>

      <div className="space-y-6 text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>
        <section>
          <h2 className="text-base font-semibold mb-2">1. Správce údajů</h2>
          <p style={{ color: "var(--muted)" }}>
            Správcem osobních údajů je <strong>CAROLINE STAR, spol. s r.o.</strong>, IČO 65408152,
            DIČ CZ65408152, se sídlem Bartoškova 1411/20, Nusle, 140 00 Praha 4 (provozovatel značky LOOOKU).
            Kontakt pro otázky k ochraně údajů:{" "}
            <a href="mailto:loookucz@gmail.com" className="underline" style={{ color: "var(--primary)" }}>loookucz@gmail.com</a>,
            {" "}
            <a href="tel:+420739165191" className="underline" style={{ color: "var(--primary)" }}>+420 739 165 191</a>.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">2. Jaké údaje zpracováváme</h2>
          <ul className="list-disc pl-5 space-y-1" style={{ color: "var(--muted)" }}>
            <li>Identifikační a kontaktní údaje, které vyplníte v poptávce (jméno, e-mail, telefon).</li>
            <li>Obsah poptávky — vybrané produkty, varianty, množství, nahraná grafika a poznámky.</li>
            <li>Komunikaci, kterou s námi vedete (e-mail, chat).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">3. Účel a právní základ</h2>
          <p style={{ color: "var(--muted)" }}>
            Údaje zpracováváme za účelem vyřízení vaší poptávky, přípravy cenové nabídky
            a případné realizace zakázky (plnění smlouvy, resp. opatření před jejím uzavřením).
            Po vašem souhlasu vás můžeme informovat o stavu poptávky e-mailem.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">4. Doba uchování</h2>
          <p style={{ color: "var(--muted)" }}>
            Údaje uchováváme po dobu nezbytnou k vyřízení poptávky a následně po dobu
            vyžadovanou právními předpisy (zejména účetní a daňové).
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">5. Příjemci a zpracovatelé</h2>
          <p style={{ color: "var(--muted)" }}>
            Údaje mohou být zpřístupněny našim zpracovatelům — poskytovatelům hostingu
            a databáze, e-mailových služeb a výrobním partnerům — výhradně za účelem
            vyřízení vaší poptávky. Údaje nepředáváme třetím stranám pro marketing.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold mb-2">6. Vaše práva</h2>
          <p style={{ color: "var(--muted)" }}>
            Máte právo na přístup k údajům, jejich opravu či výmaz, omezení zpracování,
            přenositelnost a právo vznést námitku. Žádost nám zašlete na{" "}
            <a href="mailto:info@loooku.cz" className="underline" style={{ color: "var(--primary)" }}>info@loooku.cz</a>.
            Máte rovněž právo podat stížnost u Úřadu pro ochranu osobních údajů.
          </p>
        </section>

        <p className="text-xs pt-4" style={{ color: "var(--muted-light)", borderTop: "1px solid var(--border)" }}>
          Doporučujeme nechat dokument před ostrým provozem zkontrolovat. Naposledy upraveno:{" "}
          {new Date().toLocaleDateString("cs-CZ")}.
        </p>

        <a href="/" className="inline-block text-sm" style={{ color: "var(--primary)" }}>
          ← Zpět do katalogu
        </a>
      </div>
    </div>
  );
}
