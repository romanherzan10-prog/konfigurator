import Link from "next/link";
import ChatAssistant from "@/components/ChatAssistant";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="max-w-6xl mx-auto px-4 pt-8 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
            L
          </div>
          <span className="font-semibold text-slate-900 text-lg">LOOOKU</span>
        </div>
        <nav className="flex items-center gap-4 text-sm text-slate-600">
          <Link href="/katalog" className="hover:text-blue-700 transition">
            Katalog
          </Link>
          <Link
            href="/konfigurator"
            className="hover:text-blue-700 transition"
          >
            Klasický konfigurátor
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 pt-6 pb-10 text-center">
        <h1 className="text-3xl md:text-5xl font-bold text-slate-900 tracking-tight">
          Firemní textil za pár minut
        </h1>
        <p className="mt-4 text-slate-600 text-base md:text-lg max-w-2xl mx-auto">
          Popište asistentovi, co potřebujete — on prohledá 3 600+ produktů,
          spočítá orientační cenu a připraví poptávku. Bez formulářů.
        </p>
      </section>

      {/* Chat */}
      <section className="max-w-6xl mx-auto px-4 pb-12">
        <ChatAssistant />
      </section>

      {/* Alternatives */}
      <section className="max-w-6xl mx-auto px-4 pb-16 text-center text-sm text-slate-500">
        <p>
          Raději si prohlédnete vše sami?{" "}
          <Link href="/katalog" className="text-blue-600 hover:underline">
            Otevřít katalog
          </Link>{" "}
          nebo{" "}
          <Link href="/konfigurator" className="text-blue-600 hover:underline">
            použít klasický konfigurátor
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
