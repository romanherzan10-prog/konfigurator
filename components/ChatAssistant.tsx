"use client";

/**
 * ChatAssistant — chat komponenta pro LOOOKU konfigurátor.
 *
 * Funkce:
 * - Inicializace session přes POST /api/chat-session
 * - Streaming SSE odpovědi z /api/chat
 * - GDPR souhlas (zobrazí se před odesláním první zprávy, která vede ke kontaktu)
 * - Progress stepper: Produkt → Detaily → Kalkulace → Kontakt
 * - Klikací příklady v uvítací zprávě
 * - Tool indikátor ("Hledám v katalogu...")
 * - Chat historie + localStorage pro resume
 */

import { useCallback, useEffect, useRef, useState } from "react";

type Message =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; streaming?: boolean };

type StepKey = "produkt" | "detaily" | "kalkulace" | "kontakt";

const STEP_LABELS: Record<StepKey, string> = {
  produkt: "Produkt",
  detaily: "Detaily",
  kalkulace: "Kalkulace",
  kontakt: "Kontakt",
};

const WELCOME_MESSAGE =
  "Ahoj 👋 Jsem asistent LOOOKU. Popište mi, co potřebujete, a během pár minut dostanete orientační cenu. Můžete začít třeba takhle:";

const EXAMPLES = [
  "Potřebuju 50 triček s logem pro náš tým",
  "Hledám firemní mikiny, máme cca 30 lidí",
  "Chci kšiltovky s vyšitým logem",
  "Prodejny, 100 ks polokošil s potiskem na hrudi",
];

const STORAGE_KEY = "loooku_chat_session_id";

export default function ChatAssistant() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<StepKey>("produkt");
  const [gdprAccepted, setGdprAccepted] = useState(false);
  const [showGdpr, setShowGdpr] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ----------------------------------------------------------
  // Session init
  // ----------------------------------------------------------
  useEffect(() => {
    (async () => {
      const existing = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;

      if (existing) {
        // Zkus resume
        try {
          const res = await fetch(`/api/chat-session?id=${existing}`);
          if (res.ok) {
            const data = await res.json();
            if (data.session?.status === "active") {
              setSessionId(existing);
              setMessages(
                (data.messages ?? []).map((m: Message) => ({
                  role: m.role,
                  content: m.content,
                }))
              );
              if (data.session.gdpr_consent_at) setGdprAccepted(true);
              return;
            }
          }
        } catch {
          // fall through to new session
        }
        localStorage.removeItem(STORAGE_KEY);
      }

      // Nová session
      try {
        const res = await fetch("/api/chat-session", { method: "POST" });
        if (!res.ok) {
          const err = await res.json();
          setError(err.error ?? "Nepodařilo se spustit chat.");
          return;
        }
        const { sessionId: newId } = await res.json();
        setSessionId(newId);
        localStorage.setItem(STORAGE_KEY, newId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Chyba připojení.");
      }
    })();
  }, []);

  // ----------------------------------------------------------
  // Auto-scroll na konec
  // ----------------------------------------------------------
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, toolStatus]);

  // ----------------------------------------------------------
  // Progress stepper — jednoduchá heuristika podle počtu zpráv + obsahu
  // ----------------------------------------------------------
  useEffect(() => {
    const userCount = messages.filter((m) => m.role === "user").length;
    const lastAssistant = messages.filter((m) => m.role === "assistant").pop();
    const lastText = lastAssistant?.content.toLowerCase() ?? "";

    if (userCount === 0) setCurrentStep("produkt");
    else if (lastText.includes("e-mail") || lastText.includes("kontakt"))
      setCurrentStep("kontakt");
    else if (lastText.includes("kč") || lastText.includes("odhad"))
      setCurrentStep("kalkulace");
    else if (userCount >= 1) setCurrentStep("detaily");
  }, [messages]);

  // ----------------------------------------------------------
  // Odesílání zprávy
  // ----------------------------------------------------------
  const sendMessage = useCallback(
    async (text: string) => {
      if (!sessionId || !text.trim() || isLoading) return;

      setError(null);
      setInput("");

      // Pokud jsme ve fázi kontakt a zákazník ještě nedal GDPR, zobraz modal
      if (currentStep === "kontakt" && !gdprAccepted) {
        setShowGdpr(true);
        setInput(text); // vrať zpět, ať se neztratí
        return;
      }

      const userMsg: Message = { role: "user", content: text };
      setMessages((m) => [...m, userMsg, { role: "assistant", content: "", streaming: true }]);
      setIsLoading(true);
      setToolStatus(null);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, message: text }),
        });

        if (!res.ok || !res.body) {
          const errText = await res.text();
          throw new Error(`HTTP ${res.status}: ${errText}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let assistantText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.substring(6);
            try {
              const event = JSON.parse(payload);
              if (event.type === "text") {
                assistantText += event.text;
                setMessages((prev) => {
                  const copy = [...prev];
                  copy[copy.length - 1] = {
                    role: "assistant",
                    content: assistantText,
                    streaming: true,
                  };
                  return copy;
                });
              } else if (event.type === "tool_start") {
                if (event.name === "search_products") setToolStatus("Hledám v katalogu…");
                else if (event.name === "get_product_detail")
                  setToolStatus("Načítám detail produktu…");
                else if (event.name === "submit_inquiry")
                  setToolStatus("Odesílám poptávku…");
                else setToolStatus(`Zpracovávám ${event.name}…`);
              } else if (event.type === "tool_end") {
                setToolStatus(null);
              } else if (event.type === "done") {
                setMessages((prev) => {
                  const copy = [...prev];
                  copy[copy.length - 1] = {
                    role: "assistant",
                    content: assistantText,
                    streaming: false,
                  };
                  return copy;
                });
              } else if (event.type === "error") {
                throw new Error(event.error);
              }
            } catch (parseErr) {
              console.warn("SSE parse error:", parseErr, payload);
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Chyba při odesílání.";
        setError(msg);
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setIsLoading(false);
        setToolStatus(null);
      }
    },
    [sessionId, isLoading, currentStep, gdprAccepted]
  );

  // ----------------------------------------------------------
  // GDPR accept
  // ----------------------------------------------------------
  const acceptGdpr = async () => {
    if (!sessionId) return;
    await fetch("/api/chat-session", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, gdpr_consent: true }),
    });
    setGdprAccepted(true);
    setShowGdpr(false);
    // Pokračuj v odeslání zprávy, kterou jsme zachytili
    if (input.trim()) {
      setTimeout(() => sendMessage(input), 100);
    }
  };

  // ----------------------------------------------------------
  // UI render
  // ----------------------------------------------------------
  return (
    <div className="flex flex-col h-full max-h-[80vh] w-full max-w-3xl mx-auto bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
      {/* Header s progress stepperem */}
      <div className="border-b border-slate-200 bg-slate-50/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
              L
            </div>
            <div>
              <div className="font-semibold text-slate-900">LOOOKU asistent</div>
              <div className="text-xs text-slate-500">Obvykle odpoví do pár sekund</div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          {(Object.keys(STEP_LABELS) as StepKey[]).map((step, idx) => {
            const isActive = step === currentStep;
            const isPast =
              Object.keys(STEP_LABELS).indexOf(currentStep) > idx;
            return (
              <div key={step} className="flex items-center flex-1">
                <div
                  className={`flex items-center gap-2 ${
                    isActive ? "text-blue-700" : isPast ? "text-slate-600" : "text-slate-400"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold border ${
                      isActive
                        ? "bg-blue-600 text-white border-blue-600"
                        : isPast
                        ? "bg-slate-200 text-slate-700 border-slate-300"
                        : "bg-white border-slate-300"
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <span className="text-xs font-medium whitespace-nowrap">{STEP_LABELS[step]}</span>
                </div>
                {idx < 3 && (
                  <div className={`flex-1 h-px mx-2 ${isPast ? "bg-slate-300" : "bg-slate-200"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-slate-50/30"
      >
        {/* Welcome + examples */}
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl px-4 py-3 shadow-sm border border-slate-200 max-w-[85%]">
              <p className="text-slate-800 text-sm whitespace-pre-wrap">{WELCOME_MESSAGE}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => sendMessage(ex)}
                  disabled={!sessionId || isLoading}
                  className="text-xs px-3 py-1.5 bg-white border border-slate-300 rounded-full text-slate-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50 transition"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-4 py-3 shadow-sm whitespace-pre-wrap text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-800 border border-slate-200"
              }`}
            >
              {msg.content}
              {msg.role === "assistant" && "streaming" in msg && msg.streaming && (
                <span className="inline-block w-2 h-4 ml-1 bg-slate-400 animate-pulse" />
              )}
            </div>
          </div>
        ))}

        {/* Tool status indicator */}
        {toolStatus && (
          <div className="flex justify-start">
            <div className="bg-blue-50 text-blue-700 text-xs px-3 py-1.5 rounded-full border border-blue-200 flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              {toolStatus}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 bg-white px-4 py-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) sendMessage(input);
          }}
          className="flex gap-2 items-end"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (input.trim()) sendMessage(input);
              }
            }}
            disabled={!sessionId || isLoading}
            placeholder={sessionId ? "Napište zprávu…" : "Načítám chat…"}
            rows={1}
            className="flex-1 resize-none border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
            style={{ maxHeight: "120px" }}
          />
          <button
            type="submit"
            disabled={!sessionId || isLoading || !input.trim()}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {isLoading ? "…" : "Odeslat"}
          </button>
        </form>
      </div>

      {/* GDPR modal */}
      {showGdpr && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900 mb-3">
              Souhlas se zpracováním údajů
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              Pro přípravu a zaslání nezávazné nabídky potřebujeme zpracovat váš kontakt
              (jméno, e-mail, telefon). Údaje použijeme výhradně pro odpověď na tuto poptávku.
              Více v{" "}
              <a href="/gdpr" className="text-blue-600 underline" target="_blank">
                zásadách ochrany osobních údajů
              </a>
              .
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowGdpr(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-sm hover:bg-slate-50"
              >
                Zpět
              </button>
              <button
                onClick={acceptGdpr}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium"
              >
                Souhlasím a pokračovat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
