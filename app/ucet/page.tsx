import { Package, Mail, Sparkles } from "lucide-react";

export const metadata = {
  title: "Můj účet | LOOOKU",
};

/**
 * Stub účtu — plné přihlášení (magic link) + historie zakázek přijde ve Fázi 2.
 */
export default function UcetPage() {
  return (
    <div className="container" style={{ maxWidth: 560, paddingTop: 48, paddingBottom: 64 }}>
      <div
        className="rounded-2xl p-8 text-center"
        style={{ background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: "var(--primary-50)", color: "var(--primary)" }}
        >
          <Package className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold mb-2">Moje zakázky</h1>
        <p className="text-sm mb-6" style={{ color: "var(--muted)", lineHeight: 1.6 }}>
          Po přihlášení tu uvidíte svoje poptávky a zakázky se stavem, uložené návrhy
          a knihovnu grafiky. Přihlášení e-mailem (bez hesla) připravujeme.
        </p>

        <div
          className="rounded-xl p-4 text-left flex items-start gap-3"
          style={{ background: "var(--primary-50)" }}
        >
          <Sparkles className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--primary)" }} />
          <p className="text-sm" style={{ color: "var(--foreground)" }}>
            Mezitím můžete procházet katalog, navrhnout potisk a odeslat poptávku —
            ozveme se vám na e-mail.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          <a href="/" className="btn btn-primary px-5 py-2.5 text-sm">
            Procházet katalog
          </a>
          <a href="mailto:info@loooku.cz" className="btn btn-ghost px-5 py-2.5 text-sm">
            <Mail className="w-4 h-4" /> Napsat nám
          </a>
        </div>
      </div>
    </div>
  );
}
