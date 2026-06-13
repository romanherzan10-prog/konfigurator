"use client";

import { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { loadCart } from "@/lib/cart";

/**
 * Ikona košíku v hlavičce s počtem položek.
 * Odkazuje na /konfigurator (košík + odeslání poptávky).
 */
export function CartButton() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const refresh = () => {
      try {
        setCount(loadCart().reduce((s, i) => s + (i.quantity || 1), 0));
      } catch {
        setCount(0);
      }
    };
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("pageshow", refresh);
    window.addEventListener("cart-changed", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("cart-changed", refresh);
    };
  }, []);

  return (
    <a
      href="/konfigurator"
      className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
      style={{ color: "var(--muted)" }}
      title="Košík / poptávka"
      aria-label="Košík"
    >
      <ShoppingBag className="w-5 h-5" />
      {count > 0 && (
        <span
          className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold text-white flex items-center justify-center"
          style={{ background: "var(--primary)" }}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </a>
  );
}
