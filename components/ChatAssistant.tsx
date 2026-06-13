"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, RotateCcw, Send, AlertCircle } from "lucide-react";

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
  "Dobrý den, jsem Jarda Kužel z LOOOKU. Popište mi, co potřebujete — během pár minut vám připravím orientační cenu a poradím s výběrem. Můžete začít třeba takhle:";

const TOOL_STATUS_MESSAGES: Record<string, string[]> = {
  search_products: [
    "Mrkám do katalogu…",
    "Procházím 3 606 produktů skladem…",
    "Vybírám pro vás nejvhodnější varianty…",
    "Porovnávám gramáže a ceny…",
    "Ještě moment, hledám to nejlepší…",
  ],
  get_product_detail: [
    "Načítám detail produktu…",
    "Kontroluji ceny pro vaše množství…",
    "Ověřuji skladové zásoby…",
  ],
  submit_inquiry: [
    "Odesílám poptávku našemu týmu…",
    "Ukládám vaše údaje…",
    "Dokončuji…",
  ],
  update_session: ["Zapisuji si poznámky…"],
  default: ["Pracuji na tom…", "Sekundu prosím…", "Ještě moment…"],
};

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
  const [activeTool, setActiveTool] = useState<{ name: string; startedAt: number } | null>(null);
  const [toolMessageIdx, setToolMessageIdx] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [currentStep, setCurrentStep] = useState<StepKey>("produkt");
  const [gdprAccepted, setGdprAccepted] = useState(false);
  const [showGdpr, setShowGdpr] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const startNewSession = useCallback(async () => {
    try {
      const res = await fetch("/api/chat-session", { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? "Nepodařilo se spustit chat.");
        return;
      }
      const { sessionId: newId } = await res.json();
      setSessionId(newId);
      if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, newId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba připojení.");
    }
  }, []);

  const resetChat = useCallback(async () => {
    const oldId = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (oldId) {
      try {
        await fetch("/api/chat-session", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: oldId, status: "abandoned" }),
        });
      } catch { /* best-effort */ }
      localStorage.removeItem(STORAGE_KEY);
    }
    setMessages([]);
    setInput("");
    setError(null);
    setActiveTool(null);
    setGdprAccepted(false);
    setShowGdpr(false);
    setCurrentStep("produkt");
    setSessionId(null);
    await startNewSession();
  }, [startNewSession]);

  useEffect(() => {
    (async () => {
      const existing = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (existing) {
        try {
          const res = await fetch(`/api/chat-session?id=${existing}`);
          if (res.ok) {
            const data = await res.json();
            if (data.session?.status === "active") {
              setSessionId(existing);
              setMessages((data.messages ?? []).map((m: Message) => ({ role: m.role, content: m.content })));
              if (data.session.gdpr_consent_at) setGdprAccepted(true);
              return;
            }
          }
        } catch { /* fall through */ }
        localStorage.removeItem(STORAGE_KEY);
      }
      await startNewSession();
    })();
  }, [startNewSession]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, activeTool]);

  useEffect(() => {
    if (!activeTool) { setToolMessageIdx(0); setElapsedSec(0); return; }
    const tick = setInterval(() => setElapsedSec(Math.floor((Date.now() - activeTool.startedAt) / 1000)), 500);
    const rotate = setInterval(() => {
      const list = TOOL_STATUS_MESSAGES[activeTool.name] ?? TOOL_STATUS_MESSAGES.default;
      setToolMessageIdx((i) => (i + 1) % list.length);
    }, 2500);
    return () => { clearInterval(tick); clearInterval(rotate); };
  }, [activeTool]);

  useEffect(() => {
    const userCount = messages.filter((m) => m.role === "user").length;
    const lastAssistant = messages.filter((m) => m.role === "assistant" && m.content.trim().length > 0).pop();
    const lastText = lastAssistant?.content.toLowerCase() ?? "";
    if (userCount === 0) setCurrentStep("produkt");
    else if (lastText.includes("jméno") && (lastText.includes("e-mail") || lastText.includes("telefon"))) setCurrentStep("kontakt");
    else if (lastText.includes("kč") || lastText.includes("odhad") || lastText.includes("kalkulac")) setCurrentStep("kalkulace");
    else if (userCount >= 1) setCurrentStep("detaily");
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string, opts?: { skipGdpr?: boolean }) => {
      if (!sessionId || !text.trim() || isLoading) return;
      setError(null);
      const looksLikeContact = /@[\w.-]+\.[a-z]{2,}/i.test(text) || /\+?\d[\d\s-]{7,}/.test(text);
      if (!opts?.skipGdpr && !gdprAccepted && (currentStep === "kontakt" || looksLikeContact)) {
        setShowGdpr(true);
        setInput(text);
        return;
      }
      setInput("");
      const userMsg: Message = { role: "user", content: text };
      setMessages((m) => [...m, userMsg, { role: "assistant", content: "", streaming: true }]);
      setIsLoading(true);
      setActiveTool(null);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, message: text }),
        });
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
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
            try {
              const event = JSON.parse(line.substring(6));
              if (event.type === "text") {
                assistantText += event.text;
                setMessages((prev) => {
                  const copy = [...prev];
                  copy[copy.length - 1] = { role: "assistant", content: assistantText, streaming: true };
                  return copy;
                });
              } else if (event.type === "tool_start") {
                setActiveTool({ name: event.name, startedAt: Date.now() });
                setToolMessageIdx(0); setElapsedSec(0);
              } else if (event.type === "tool_end") {
                setActiveTool(null);
              } else if (event.type === "done") {
                setMessages((prev) => {
                  const copy = [...prev];
                  if (assistantText.trim() === "") return copy.slice(0, -1);
                  copy[copy.length - 1] = { role: "assistant", content: assistantText, streaming: false };
                  return copy;
                });
                if (assistantText.trim() === "") setError("Něco se nepodařilo. Zkuste to prosím napsat jinak, nebo začněte nový chat.");
              } else if (event.type === "error") {
                throw new Error(event.error);
              }
            } catch (parseErr) {
              console.warn("SSE parse error:", parseErr);
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Chyba při odesílání.");
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setIsLoading(false);
        setActiveTool(null);
      }
    },
    [sessionId, isLoading, currentStep, gdprAccepted]
  );

  const acceptGdpr = async () => {
    if (!sessionId) return;
    const pendingText = input.trim();
    try {
      await fetch("/api/chat-session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, gdpr_consent: true }),
      });
    } catch { /* pokračuj */ }
    setGdprAccepted(true);
    setShowGdpr(false);
    if (pendingText) { setInput(""); sendMessage(pendingText, { skipGdpr: true }); }
  };

  const stepKeys = Object.keys(STEP_LABELS) as StepKey[];
  const currentStepIdx = stepKeys.indexOf(currentStep);

  return (
    <div
      className="relative flex flex-col w-full max-w-3xl mx-auto overflow-hidden"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-2xl)",
        boxShadow: "var(--shadow-xl)",
        height: "min(640px, 80vh)",
      }}
    >
      {/* ── Header ───────────────────────────────────────── */}
      <div
        className="shrink-0 px-5 pt-4 pb-3"
        style={{
          borderBottom: "1px solid var(--border)",
          background: "linear-gradient(180deg, var(--primary-50, #EFF6FF) 0%, var(--surface) 100%)",
        }}
      >
        {/* Agent info + new chat */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md"
                style={{ background: "linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)" }}
              >
                JK
              </div>
              <div
                className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white"
                style={{ background: "#10B981" }}
              />
            </div>
            <div>
              <div className="font-semibold text-sm" style={{ color: "var(--foreground)" }}>
                Jarda Kužel
              </div>
              <div className="text-xs" style={{ color: "var(--muted)" }}>
                Obchodník LOOOKU · pomůže s poptávkou
              </div>
            </div>
          </div>

          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (!isLoading || confirm("Opravdu chcete začít nový chat?")) resetChat();
              }}
              disabled={isLoading}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-all cursor-pointer disabled:opacity-40"
              style={{
                background: "var(--surface)",
                borderColor: "var(--border)",
                color: "var(--muted)",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.color = "var(--primary)";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--primary-100, #DBEAFE)";
                (e.currentTarget as HTMLElement).style.background = "var(--primary-50, #EFF6FF)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.color = "var(--muted)";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLElement).style.background = "var(--surface)";
              }}
            >
              <RotateCcw className="w-3 h-3" />
              Nový chat
            </button>
          )}
        </div>

        {/* Progress stepper */}
        <div className="flex items-center gap-0">
          {stepKeys.map((step, idx) => {
            const isActive = step === currentStep;
            const isPast = currentStepIdx > idx;
            return (
              <div key={step} className="flex items-center flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-all duration-300"
                    style={{
                      background: isActive
                        ? "var(--accent)"
                        : isPast
                        ? "var(--primary)"
                        : "var(--surface-2)",
                      color: isActive || isPast ? "#fff" : "var(--muted-light)",
                      boxShadow: isActive ? "0 2px 8px rgba(245,158,11,0.4)" : "none",
                    }}
                  >
                    {isPast ? "✓" : idx + 1}
                  </div>
                  <span
                    className="text-xs font-medium hidden sm:block whitespace-nowrap"
                    style={{
                      color: isActive ? "var(--accent)" : isPast ? "var(--primary)" : "var(--muted-light)",
                    }}
                  >
                    {STEP_LABELS[step]}
                  </span>
                </div>
                {idx < 3 && (
                  <div
                    className="flex-1 h-px mx-2 transition-all duration-300"
                    style={{ background: isPast ? "var(--primary-100, #DBEAFE)" : "var(--border)" }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Messages ─────────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 py-4 space-y-3"
        style={{ background: "var(--surface-2)" }}
      >
        {/* Welcome + examples */}
        {messages.length === 0 && (
          <div className="space-y-3">
            <div
              className="rounded-2xl rounded-tl-sm px-4 py-3 max-w-[86%]"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <p className="text-sm leading-relaxed" style={{ color: "var(--foreground)" }}>
                {WELCOME_MESSAGE}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 pl-1">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => sendMessage(ex)}
                  disabled={!sessionId || isLoading}
                  className="text-xs px-3 py-1.5 rounded-full border font-medium transition-all cursor-pointer disabled:opacity-50"
                  style={{
                    background: "var(--surface)",
                    borderColor: "var(--border)",
                    color: "var(--muted)",
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = "var(--primary-50, #EFF6FF)";
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--primary-100, #DBEAFE)";
                    (e.currentTarget as HTMLElement).style.color = "var(--primary)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = "var(--surface)";
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                    (e.currentTarget as HTMLElement).style.color = "var(--muted)";
                  }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className="max-w-[86%] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
              style={
                msg.role === "user"
                  ? {
                      background: "var(--primary)",
                      color: "#fff",
                      borderRadius: "var(--radius-xl) var(--radius-xl) var(--radius-sm) var(--radius-xl)",
                      boxShadow: "var(--shadow-sm)",
                    }
                  : {
                      background: "var(--surface)",
                      color: "var(--foreground)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-xl) var(--radius-xl) var(--radius-xl) var(--radius-sm)",
                      boxShadow: "var(--shadow-sm)",
                    }
              }
            >
              {msg.content}
              {msg.role === "assistant" && "streaming" in msg && msg.streaming && (
                <span
                  className="inline-block w-1.5 h-4 ml-1 rounded-sm animate-pulse"
                  style={{ background: "var(--primary-light)" }}
                />
              )}
            </div>
          </div>
        ))}

        {/* Tool indicator */}
        {activeTool && (() => {
          const list = TOOL_STATUS_MESSAGES[activeTool.name] ?? TOOL_STATUS_MESSAGES.default;
          return (
            <div className="flex justify-start">
              <div
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm rounded-2xl rounded-tl-sm"
                style={{
                  background: "var(--primary-50, #EFF6FF)",
                  border: "1px solid var(--primary-100, #DBEAFE)",
                  color: "var(--primary)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <div className="flex gap-1">
                  {[0, 150, 300].map((d) => (
                    <span
                      key={d}
                      className="w-1.5 h-1.5 rounded-full animate-bounce"
                      style={{ background: "var(--primary)", animationDelay: `${d}ms` }}
                    />
                  ))}
                </div>
                <span className="font-medium">{list[toolMessageIdx % list.length]}</span>
                {elapsedSec >= 3 && (
                  <span className="text-xs opacity-60 tabular-nums">{elapsedSec}s</span>
                )}
              </div>
            </div>
          );
        })()}

        {/* Typing without tool */}
        {isLoading && !activeTool && messages[messages.length - 1]?.role === "assistant" && !messages[messages.length - 1]?.content && (
          <div className="flex justify-start">
            <div
              className="flex items-center gap-2 px-4 py-2.5 text-sm rounded-2xl rounded-tl-sm"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--muted)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              {[0, 150, 300].map((d) => (
                <span
                  key={d}
                  className="w-1.5 h-1.5 rounded-full animate-bounce"
                  style={{ background: "var(--muted-light)", animationDelay: `${d}ms` }}
                />
              ))}
              <span>Jarda píše…</span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            className="flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm"
            style={{
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              color: "#DC2626",
            }}
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}
      </div>

      {/* ── Input ────────────────────────────────────────── */}
      <div
        className="shrink-0 px-4 py-3"
        style={{ borderTop: "1px solid var(--border)", background: "var(--surface)" }}
      >
        <form
          onSubmit={(e) => { e.preventDefault(); if (input.trim()) sendMessage(input); }}
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
            className="flex-1 resize-none text-sm outline-none transition-all"
            style={{
              background: "var(--surface-2)",
              border: "1.5px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "10px 14px",
              color: "var(--foreground)",
              maxHeight: "120px",
              fontFamily: "inherit",
            }}
            onFocus={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--primary)";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 0 0 3px rgba(30,64,175,0.08)";
              (e.currentTarget as HTMLElement).style.background = "var(--surface)";
            }}
            onBlur={e => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
              (e.currentTarget as HTMLElement).style.background = "var(--surface-2)";
            }}
          />
          <button
            type="submit"
            disabled={!sessionId || isLoading || !input.trim()}
            className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: "var(--primary)",
              color: "#fff",
              boxShadow: "var(--shadow-sm)",
            }}
            onMouseEnter={e => {
              if (!(e.currentTarget as HTMLButtonElement).disabled) {
                (e.currentTarget as HTMLElement).style.background = "var(--primary-hover)";
                (e.currentTarget as HTMLElement).style.transform = "scale(1.05)";
              }
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "var(--primary)";
              (e.currentTarget as HTMLElement).style.transform = "scale(1)";
            }}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>
        <p className="text-[11px] mt-2 text-center" style={{ color: "var(--muted-light)" }}>
          Enter pro odeslání · Shift+Enter pro nový řádek
        </p>
      </div>

      {/* ── GDPR Modal ───────────────────────────────────── */}
      {showGdpr && (
        <div
          className="absolute inset-0 flex items-center justify-center p-4 z-50"
          style={{ background: "rgba(15, 23, 42, 0.5)", backdropFilter: "blur(4px)" }}
        >
          <div
            className="w-full max-w-sm"
            style={{
              background: "var(--surface)",
              borderRadius: "var(--radius-2xl)",
              boxShadow: "var(--shadow-xl)",
              border: "1px solid var(--border)",
            }}
          >
            <div className="p-6">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "var(--primary-50, #EFF6FF)", color: "var(--primary)" }}
              >
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                Souhlas se zpracováním údajů
              </h3>
              <p className="text-sm mb-5 leading-relaxed" style={{ color: "var(--muted)" }}>
                Pro přípravu a zaslání nezávazné nabídky potřebujeme zpracovat váš kontakt
                (jméno, e-mail, telefon). Údaje použijeme výhradně pro odpověď na tuto poptávku.
                Více v{" "}
                <a href="/gdpr" className="underline" style={{ color: "var(--primary)" }} target="_blank">
                  zásadách ochrany osobních údajů
                </a>
                .
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowGdpr(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all cursor-pointer"
                  style={{
                    background: "var(--surface)",
                    borderColor: "var(--border)",
                    color: "var(--muted)",
                  }}
                >
                  Zpět
                </button>
                <button
                  onClick={acceptGdpr}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-all cursor-pointer"
                  style={{
                    background: "var(--primary)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  Souhlasím a pokračovat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
