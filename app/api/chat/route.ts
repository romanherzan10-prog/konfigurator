/**
 * POST /api/chat
 *
 * Hlavní chat endpoint. Přijímá { sessionId, message } a streamuje odpověď Claude asistenta.
 * Zpracovává tool_use loop:
 *   1) Pošle user zprávu + historii do Claude API
 *   2) Pokud Claude chce tool, zavolá ho, přidá výsledek, pokračuje
 *   3) Streamuje text zpět uživateli pomocí Server-Sent Events (SSE)
 *
 * Runtime: Node.js (ne Edge) — kvůli Anthropic SDK a Supabase service role clientovi.
 * Latence je stále <1s k prvnímu tokenu díky Vercel Fluid Compute / Node warm starts.
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  MessageParam,
  ContentBlock,
  ToolUseBlock,
  Message,
} from "@anthropic-ai/sdk/resources/messages";
import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { CHAT_TOOLS, executeTool } from "@/lib/chat/tools";
import { buildSystemPrompt } from "@/lib/chat/system-prompt";
import { hashIp, extractIp } from "@/lib/chat/ip-hash";

export const runtime = "nodejs";
export const maxDuration = 60;

// Model configuration
const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 2048;
const MAX_TOOL_ITERATIONS = 6; // safeguard proti infinite loopu
const MAX_API_RETRIES = 4; // retry na transient chyby (Overloaded/429/5xx) — hlavní příčina "seká se"
const FALLBACK_EMPTY_TEXT =
  "Pardon, něco se mi tady zaseklo a nemám pro vás odpověď. Zkuste to prosím napsat trochu jinak — nebo začněte nový chat tlačítkem nahoře.";
const FALLBACK_OVERLOADED_TEXT =
  "Omlouvám se, náš asistent má teď hodně dotazů najednou a chvíli mu to nejede. Zkuste prosím zprávu poslat ještě jednou za pár vteřin — nebo nám rovnou napište na loookucz@gmail.com / +420 739 165 191 a hned se vám ozveme.";

// Rate limit per session: max 40 zpráv za sessionu
const MAX_MESSAGES_PER_SESSION = 40;

// Rozpozná dočasné chyby, které má smysl zopakovat (přetížení API, rate limit,
// 5xx, výpadek sítě). Trvalé chyby (400 bad request, 401) neopakujeme.
function isRetryableApiError(err: unknown): boolean {
  const e = err as {
    status?: number;
    name?: string;
    error?: { type?: string };
    type?: string;
  };
  const status = e?.status;
  const type = e?.error?.type ?? e?.type;
  if (status === 429 || status === 408 || (status !== undefined && status >= 500)) return true;
  if (
    type === "overloaded_error" ||
    type === "rate_limit_error" ||
    type === "api_error" ||
    type === "timeout_error"
  )
    return true;
  if (e?.name === "APIConnectionError" || e?.name === "APIConnectionTimeoutError") return true;
  return false;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ============================================================
// POST /api/chat
// ============================================================

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  let body: { sessionId?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return sseError("Neplatný JSON v requestu.", 400);
  }

  const sessionId = body.sessionId;
  const userMessage = (body.message ?? "").trim();

  if (!sessionId || !userMessage) {
    return sseError("Chybí sessionId nebo message.", 400);
  }

  if (userMessage.length > 2000) {
    return sseError("Zpráva je příliš dlouhá (max 2000 znaků).", 400);
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return sseError("ANTHROPIC_API_KEY není nakonfigurovaný.", 500);
  }

  const supabase = getSupabaseAdmin();

  // 1) Ověř session — musí existovat, být aktivní A patřit requestorovi
  const requesterIpHash = hashIp(extractIp(req));
  const { data: session, error: sessErr } = await supabase
    .from("chat_sessions")
    .select(
      "id, status, message_count, total_input_tokens, total_output_tokens, ip_hash"
    )
    .eq("id", sessionId)
    .single();

  if (sessErr || !session) {
    return sseError("Session neexistuje nebo vypršela.", 404);
  }
  if (session.ip_hash && session.ip_hash !== requesterIpHash) {
    // Někdo jiný se pokouší psát do cizí session.
    return sseError("Přístup zamítnut.", 403);
  }
  if (session.status !== "active") {
    return sseError("Session není aktivní.", 403);
  }
  if ((session.message_count ?? 0) >= MAX_MESSAGES_PER_SESSION) {
    return sseError(
      `Dosažen limit ${MAX_MESSAGES_PER_SESSION} zpráv v rámci jedné konverzace.`,
      429
    );
  }

  // 2) Načti historii zpráv
  const { data: historyRows } = await supabase
    .from("chat_messages")
    .select("role, content, tool_calls, tool_results")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  // Sanitizace při přehrávání historie: starší řádky mohly uložit tool_calls /
  // tool_results bez pole "type" (nebo prázdné bloky) — Anthropic API pak celý
  // request odmítne chybou `content.0.type: Field required` a konverzace umře
  // přesně ve chvíli finalizace poptávky. Každý blok proto normalizujeme a
  // nevalidní/prázdné zprávy raději vynecháme, než abychom shodili celý chat.
  const messages: MessageParam[] = [];
  for (const row of historyRows ?? []) {
    if (row.role === "user") {
      if (typeof row.content === "string" && row.content.trim()) {
        messages.push({ role: "user", content: row.content });
      }
    } else if (row.role === "assistant") {
      if (row.tool_calls) {
        const blocks: ContentBlock[] = [];
        if (row.content) {
          blocks.push({ type: "text", text: row.content, citations: [] });
        }
        for (const tc of (row.tool_calls as Partial<ToolUseBlock>[]) ?? []) {
          if (!tc || typeof tc !== "object" || !tc.id || !tc.name) continue;
          blocks.push({
            type: "tool_use",
            id: tc.id,
            name: tc.name,
            input: tc.input ?? {},
          } as ToolUseBlock);
        }
        const toolUseIds = new Set(
          blocks.filter((b) => b.type === "tool_use").map((b) => (b as ToolUseBlock).id)
        );
        if (blocks.length === 0) continue;
        messages.push({ role: "assistant", content: blocks });

        // tool_result bloky: doplň chybějící "type", zahoď bloky bez tool_use_id
        // nebo bez odpovídajícího tool_use v předchozí zprávě.
        if (toolUseIds.size > 0 && Array.isArray(row.tool_results)) {
          const results = (row.tool_results as Array<Record<string, unknown>>)
            .filter((tr) => tr && typeof tr === "object" && typeof tr.tool_use_id === "string")
            .filter((tr) => toolUseIds.has(tr.tool_use_id as string))
            .map((tr) => ({
              type: "tool_result" as const,
              tool_use_id: tr.tool_use_id as string,
              content:
                typeof tr.content === "string" ? tr.content : JSON.stringify(tr.content ?? ""),
              is_error: !!tr.is_error,
            }));
          if (results.length === toolUseIds.size) {
            messages.push({ role: "user", content: results });
          } else {
            // Neúplné výsledky = API by request odmítlo („missing tool_result“).
            // Radši odstraň i tool_use bloky a nech jen případný text.
            messages.pop();
            const textOnly = blocks.filter((b) => b.type === "text");
            if (textOnly.length > 0) {
              messages.push({ role: "assistant", content: textOnly });
            }
          }
        } else if (toolUseIds.size > 0) {
          // tool_use bez uložených výsledků → stejný problém, drž jen text
          messages.pop();
          const textOnly = blocks.filter((b) => b.type === "text");
          if (textOnly.length > 0) {
            messages.push({ role: "assistant", content: textOnly });
          }
        }
      } else if (typeof row.content === "string" && row.content.trim()) {
        messages.push({ role: "assistant", content: row.content });
      }
    }
  }
  // API vyžaduje, aby konverzace začínala user zprávou
  while (messages.length > 0 && messages[0].role !== "user") {
    messages.shift();
  }

  // 3) Přidej novou user zprávu
  messages.push({ role: "user", content: userMessage });

  // 4) Ulož user zprávu do DB hned (ať ji máme i kdyby stream spadl)
  await supabase.from("chat_messages").insert({
    session_id: sessionId,
    role: "user",
    content: userMessage,
  });

  // 5) Stream odpověď zpět uživateli
  // maxRetries: SDK samo zopakuje transient chyby i na úrovni requestu.
  const anthropic = new Anthropic({
    apiKey: anthropicKey,
    maxRetries: MAX_API_RETRIES,
    timeout: 45000,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let fullText = "";
      let iterationCount = 0;
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      const toolCallLog: ToolUseBlock[] = [];
      // Ukládáme PLNÉ tool_result bloky (type + tool_use_id + content + is_error),
      // aby přehrání historie v dalším tahu bylo validní pro Anthropic API.
      const toolResultLog: Array<{
        type: "tool_result";
        tool_use_id: string;
        content: string;
        is_error: boolean;
      }> = [];

      // Heartbeat — drží SSE spojení živé i během dlouhých tool callů
      // (Vercel/Nginx někdy zařízne idle TCP > 30s)
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          // controller mohl být uzavřen
        }
      }, 10000);

      try {
        // Tool use loop — Claude může chtít volat nástroje opakovaně
        while (iterationCount < MAX_TOOL_ITERATIONS) {
          iterationCount++;
          const isLastIteration = iterationCount === MAX_TOOL_ITERATIONS;

          // V poslední iteraci VYNUTÍME text odpověď (žádné další tooly),
          // jinak by Claude mohl skončit jen s tool_use a klient by viděl prázdnou bublinu.
          //
          // Aplikační retry: pokud API vrátí dočasnou chybu (Overloaded/429/5xx)
          // DŘÍV, než jsme cokoli streamovali, počkáme s exponenciálním backoffem
          // a zkusíme znovu. Jakmile už tekl text ven, retry neděláme (nešlo by
          // čistě navázat) a chybu vyhodíme do vnějšího catch s přátelskou hláškou.
          let finalMessage: Message | null = null;

          for (let attempt = 0; attempt <= MAX_API_RETRIES; attempt++) {
            let streamedThisAttempt = false;
            try {
              const response = anthropic.messages.stream({
                model: MODEL,
                max_tokens: MAX_TOKENS,
                system: buildSystemPrompt(),
                tools: CHAT_TOOLS,
                tool_choice: isLastIteration ? { type: "none" } : { type: "auto" },
                messages,
              });

              for await (const event of response) {
                if (
                  event.type === "content_block_delta" &&
                  event.delta.type === "text_delta"
                ) {
                  const chunk = event.delta.text;
                  streamedThisAttempt = true;
                  fullText += chunk;
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: "text", text: chunk })}\n\n`)
                  );
                }
              }

              finalMessage = await response.finalMessage();
              break; // úspěch
            } catch (streamErr) {
              const canRetry =
                !streamedThisAttempt &&
                attempt < MAX_API_RETRIES &&
                isRetryableApiError(streamErr);
              if (!canRetry) throw streamErr;
              // exponenciální backoff s jitterem (0.6s, 1.2s, 2.4s, 4.8s ± jitter)
              const backoff = 600 * 2 ** attempt + Math.floor(Math.random() * 400);
              console.warn(
                `[/api/chat] transient API error, retry ${attempt + 1}/${MAX_API_RETRIES} za ${backoff}ms`
              );
              await sleep(backoff);
            }
          }

          if (!finalMessage) {
            throw new Error("Nepodařilo se získat odpověď z API ani po opakování.");
          }
          totalInputTokens += finalMessage.usage.input_tokens;
          totalOutputTokens += finalMessage.usage.output_tokens;

          // Najdi tool_use bloky v odpovědi
          const toolUses = finalMessage.content.filter(
            (b): b is ToolUseBlock => b.type === "tool_use"
          );

          // Pokud nejsou žádné tool calls → konec loopu
          if (toolUses.length === 0) {
            messages.push({ role: "assistant", content: finalMessage.content });
            break;
          }

          // Přidej assistant message s tool_use do historie
          messages.push({ role: "assistant", content: finalMessage.content });
          toolCallLog.push(...toolUses);

          // Oznámíme UI, že probíhá tool call (pro "hledám v katalogu..." indikátor).
          // navrhni_moznosti není "práce" — pošleme rovnou klikací možnosti (chips), bez spinneru.
          for (const toolUse of toolUses) {
            if (toolUse.name === "navrhni_moznosti") {
              const moznosti = (toolUse.input as { moznosti?: unknown })?.moznosti;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: "options",
                    moznosti: Array.isArray(moznosti) ? moznosti : [],
                  })}\n\n`
                )
              );
              continue;
            }
            // zobraz_produkty není "práce" se spinnerem — karty pošleme z výsledku níže.
            if (toolUse.name === "zobraz_produkty") continue;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "tool_start",
                  name: toolUse.name,
                })}\n\n`
              )
            );
          }

          // Spust tools paralelně
          const toolResults = await Promise.all(
            toolUses.map((tu) =>
              executeTool(tu.name, tu.input as Record<string, unknown>, {
                sessionId,
              }).then((result) => {
                // zobraz_produkty → pošli klientovi kolotoč karet
                if (tu.name === "zobraz_produkty") {
                  const produkty = (result.result as { produkty?: unknown })?.produkty;
                  if (Array.isArray(produkty) && produkty.length > 0) {
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({ type: "products", produkty })}\n\n`
                      )
                    );
                  }
                }
                return {
                  type: "tool_result" as const,
                  tool_use_id: tu.id,
                  content: JSON.stringify(result.result ?? { error: result.error }),
                  is_error: !!result.error,
                };
              })
            )
          );

          toolResultLog.push(...toolResults);

          // Přidej tool_result zprávu do historie → Claude na to zareaguje v další iteraci
          messages.push({
            role: "user",
            content: toolResults,
          });

          // Oznámíme UI, že tool skončil
          for (const toolUse of toolUses) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "tool_end",
                  name: toolUse.name,
                })}\n\n`
              )
            );
          }
        }

        const latencyMs = Date.now() - startTime;

        // Pojistka: pokud Claude navzdory všemu nevyprodukoval žádný text
        // (např. pure tool_use loop), pošli klientovi fallback hlášku,
        // aby nezůstala viset prázdná bublina.
        if (fullText.trim().length === 0) {
          fullText = FALLBACK_EMPTY_TEXT;
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "text", text: fullText })}\n\n`
            )
          );
          await supabase.from("chat_events").insert({
            session_id: sessionId,
            event_type: "empty_response_fallback",
            payload: {
              iteration_count: iterationCount,
              tool_calls: toolCallLog.length,
            },
          });
        }

        // Ulož assistant odpověď + aktualizuj session
        await supabase.from("chat_messages").insert({
          session_id: sessionId,
          role: "assistant",
          content: fullText,
          tool_calls: toolCallLog.length > 0 ? toolCallLog : null,
          tool_results: toolResultLog.length > 0 ? toolResultLog : null,
          latency_ms: latencyMs,
          model: MODEL,
          input_tokens: totalInputTokens,
          output_tokens: totalOutputTokens,
        });

        await supabase
          .from("chat_sessions")
          .update({
            last_message_at: new Date().toISOString(),
            message_count: (session.message_count ?? 0) + 1,
            total_input_tokens:
              (session.total_input_tokens ?? 0) + totalInputTokens,
            total_output_tokens:
              (session.total_output_tokens ?? 0) + totalOutputTokens,
          })
          .eq("id", sessionId);

        // Signalizuj konec streamu
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "done",
              latency_ms: latencyMs,
              tokens: {
                input: totalInputTokens,
                output: totalOutputTokens,
              },
            })}\n\n`
          )
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[/api/chat] stream error:", msg);

        // Přátelská hláška místo syrové chyby. Když už nějaký text tekl ven,
        // připojíme jen krátký dovětek, ať nevznikne rozporuplná bublina.
        const overloaded = isRetryableApiError(err);
        const friendly = overloaded ? FALLBACK_OVERLOADED_TEXT : FALLBACK_EMPTY_TEXT;
        const alreadyHasText = fullText.trim().length > 0;
        const toSend = alreadyHasText ? `\n\n${friendly}` : friendly;
        fullText += toSend;

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "text", text: toSend })}\n\n`)
        );
        // Konec streamu ať UI ukončí "přemýšlí" stav (ne error → žádná děsivá hláška).
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "done", recovered: true })}\n\n`)
        );

        // Ulož odpověď (i tu nouzovou), aby historie nebyla rozbitá a bublina prázdná.
        try {
          await supabase.from("chat_messages").insert({
            session_id: sessionId,
            role: "assistant",
            content: fullText,
            model: MODEL,
          });
          await supabase.from("chat_events").insert({
            session_id: sessionId,
            event_type: "error",
            payload: { error: msg, overloaded },
          });
        } catch {
          // DB zápis nesmí shodit odpověď uživateli
        }
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // vypne buffering na Nginx
    },
  });
}

// ============================================================
// Pomocné
// ============================================================

function sseError(message: string, status = 500) {
  return new Response(
    `data: ${JSON.stringify({ type: "error", error: message })}\n\n`,
    {
      status,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    }
  );
}
