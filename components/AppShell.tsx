"use client";

import { useState, useEffect } from "react";
import {
  Menu,
  X,
  ShoppingBag,
  User,
  MessageCircle,
  LayoutGrid,
  Package,
  Sparkles,
  Phone,
  Mail,
} from "lucide-react";
import { loadCart } from "@/lib/cart";
import ChatAssistant from "@/components/ChatAssistant";

/**
 * App shell — mobile-first prostředí LOOOKU.
 *  - TopBar: ☰ menu vlevo, logo, košík + účet vpravo
 *  - MenuDrawer: úzké výsuvné menu zleva
 *  - ChatFab: plovoucí chatbot (Jarda) vpravo dole
 * Obaluje veškerý obsah (z layout.tsx).
 */

const MENU = [
  { href: "/", label: "Katalog", icon: LayoutGrid },
  { href: "/konfigurator", label: "Košík / poptávka", icon: ShoppingBag },
  { href: "/ucet", label: "Moje zakázky", icon: Package },
  { href: "/ucet", label: "Přihlásit se", icon: User },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const refresh = () => {
      try {
        setCartCount(loadCart().reduce((s, i) => s + (i.quantity || 1), 0));
      } catch {
        setCartCount(0);
      }
    };
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    window.addEventListener("cart-changed", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("cart-changed", refresh);
    };
  }, []);

  // zamknout scroll pod otevřeným menu/chatem
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <>
      {/* ── TOP BAR ───────────────────────────────────── */}
      <header
        className="sticky top-0 z-40"
        style={{
          height: 56,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="h-full flex items-center justify-between px-3 sm:px-5">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Otevřít menu"
              className="w-10 h-10 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: "var(--foreground)" }}
            >
              <Menu className="w-5 h-5" />
            </button>
            <a href="/" className="flex items-center gap-2">
              <span className="logo-mark" style={{ width: 30, height: 30, fontSize: 13 }}>L</span>
              <span className="font-bold tracking-tight" style={{ color: "var(--foreground)", letterSpacing: "0.5px" }}>
                LOOOKU
              </span>
            </a>
          </div>

          <div className="flex items-center gap-1">
            <a
              href="/konfigurator"
              aria-label="Košík"
              className="relative w-10 h-10 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: "var(--foreground)" }}
            >
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && (
                <span
                  className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center"
                  style={{ background: "var(--primary)" }}
                >
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </a>
            <a
              href="/ucet"
              aria-label="Účet"
              className="w-10 h-10 flex items-center justify-center rounded-lg transition-colors"
              style={{ color: "var(--foreground)" }}
            >
              <User className="w-5 h-5" />
            </a>
          </div>
        </div>
      </header>

      {/* ── MENU DRAWER ───────────────────────────────── */}
      {menuOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(15,17,40,0.45)" }}
            onClick={() => setMenuOpen(false)}
          />
          <div
            className="absolute left-0 top-0 bottom-0 flex flex-col"
            style={{
              width: 272,
              maxWidth: "82vw",
              background: "var(--surface)",
              boxShadow: "var(--shadow-xl)",
              animation: "slideInLeft 0.2s ease",
            }}
          >
            <div
              className="flex items-center justify-between px-5"
              style={{ height: 56, borderBottom: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2">
                <span className="logo-mark" style={{ width: 28, height: 28, fontSize: 12 }}>L</span>
                <span className="font-bold tracking-tight" style={{ letterSpacing: "0.5px" }}>LOOOKU</span>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Zavřít menu"
                className="w-9 h-9 flex items-center justify-center rounded-lg"
                style={{ color: "var(--muted)" }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 py-2">
              {MENU.map((item, i) => (
                <a
                  key={`${item.href}-${i}`}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 px-5 py-3 text-[15px] font-medium transition-colors"
                  style={{ color: "var(--foreground)" }}
                >
                  <item.icon className="w-[18px] h-[18px]" style={{ color: "var(--primary)" }} />
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="px-5 py-4 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setChatOpen(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium"
                style={{ background: "var(--primary-50)", color: "var(--primary)" }}
              >
                <Sparkles className="w-4 h-4" />
                Poradit s výběrem
              </button>
              <a href="tel:+420123456789" className="flex items-center gap-2 px-3 py-2 text-sm" style={{ color: "var(--muted)" }}>
                <Phone className="w-4 h-4" /> +420 123 456 789
              </a>
              <a href="mailto:info@loooku.cz" className="flex items-center gap-2 px-3 py-2 text-sm" style={{ color: "var(--muted)" }}>
                <Mail className="w-4 h-4" /> info@loooku.cz
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── OBSAH ─────────────────────────────────────── */}
      <main className="min-h-[calc(100vh-56px)]">{children}</main>

      {/* ── CHAT FAB ──────────────────────────────────── */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          aria-label="Otevřít poradce"
          className="fixed z-40 flex items-center gap-2 rounded-full text-white font-medium transition-transform"
          style={{
            right: 16,
            bottom: 16,
            padding: "12px 18px 12px 14px",
            background: "var(--primary)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <MessageCircle className="w-5 h-5" />
          <span className="hidden sm:inline text-sm">Poradím s výběrem</span>
        </button>
      )}

      {/* ── CHAT PANEL ────────────────────────────────── */}
      {chatOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0"
            style={{ background: "rgba(15,17,40,0.45)" }}
            onClick={() => setChatOpen(false)}
          />
          <div
            className="absolute flex flex-col inset-x-0 bottom-0 h-[88vh] rounded-t-[20px] sm:inset-x-auto sm:right-4 sm:top-4 sm:bottom-4 sm:h-auto sm:w-[420px] sm:rounded-[20px]"
            style={{
              background: "var(--surface)",
              maxHeight: "94vh",
              boxShadow: "var(--shadow-xl)",
            }}
          >
            <div
              className="flex items-center justify-between px-4 shrink-0"
              style={{ height: 52, borderBottom: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white"
                  style={{ background: "var(--primary)" }}
                >
                  <MessageCircle className="w-4 h-4" />
                </span>
                <span className="font-semibold text-sm">Poradce Jarda</span>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                aria-label="Zavřít chat"
                className="w-9 h-9 flex items-center justify-center rounded-lg"
                style={{ color: "var(--muted)" }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <ChatAssistant />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        @media (min-width: 640px) {
          .sm\\:right-4 { right: 1rem; }
        }
      `}</style>
    </>
  );
}
