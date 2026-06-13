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
} from "@anthropic-ai/sdk/resources/messages";
import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { CHAT_TOOLS, executeTool } from "@/lib/chat/tools";
import { buildSystemPrompt } from "@/lib/chat/system-prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

// Model configuration
const MODEL = "claude-sonnet-4-5";
const MAX_TOKENS = 2048;
const MAX_TOOL_ITERATIONS = 6; // safeguard proti infinite loopu
const FALLBACK_EMPTY_TEXT =
  "Pardon, něco se mi tady zaseklo a nemám pro vás odpověď. Zkuste to prosím napsat trochu jinak — nebo začněte nový chat tlačítkem nahoře.";

// Rate limit per session: max 40 zpráv za sessionu
const MAX_MESSAGES_PER_SESSION = 40;

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

  // 1) Ověř session — musí existovat a být aktivní
  const { data: session, error: sessErr } = await supabase
    .from("chat_sessions")
    .select("id, status, message_count, total_input_tokens, total_output_tokens")
    .eq("id", sessionId)
    .single();

  if (sessErr || !session) {
    return sseError("Session neexistuje nebo vypršela.", 404);
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

  const messages: MessageParam[] = [];
  for (const row of historyRows ?? []) {
    if (row.role === "user") {
      messages.push({ role: "user", content: row.content ?? "" });
    } else if (row.role === "assistant") {
      // Pokud obsahuje tool_calls, musíme rekonstruovat content blocks
      if (row.tool_calls) {
        const blocks: ContentBlock[] = [];
        if (row.content) {
          blocks.push({ type: "text", text: row.content, citations: [] });
        }
        for (const tc of row.tool_calls as ToolUseBlock[]) {
          blocks.push(tc);
        }
        messages.push({ role: "assistant", content: blocks });
        // Přidej tool_result zprávu
        if (row.tool_results) {
          messages.push({
            role: "user",
            content: row.tool_results as unknown as string,
          });
        }
      } else {
        messages.push({ role: "assistant", content: row.content ?? "" });
      }
    }
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
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let fullText = "";
      let iterationCount = 0;
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      const toolCallLog: ToolUseBlock[] = [];
      const toolResultLog: Array<{ tool_use_id: string; content: unknown }> =
        [];

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
          const response = await anthropic.messages.stream({
            model: MODEL,
            max_tokens: MAX_TOKENS,
            system: buildSystemPrompt(),
            tools: CHAT_TOOLS,
            tool_choice: isLastIteration ? { type: "none" } : { type: "auto" },
            messages,
          });

          // Poslouchej text delty a posílej je jako SSE
          for await (const event of response) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const chunk = event.delta.text;
              fullText += chunk;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "text", text: chunk })}\n\n`)
              );
            }
          }

          const finalMessage = await response.finalMessage();
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

          // Oznámíme UI, že probíhá tool call (pro "hledám v katalogu..." indikátor)
          for (const toolUse of toolUses) {
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
              }).then((result) => ({
                type: "tool_result" as const,
                tool_use_id: tu.id,
                content: JSON.stringify(result.result ?? { error: result.error }),
                is_error: !!result.error,
              }))
            )
          );

          toolResultLog.push(
            ...toolResults.map((tr) => ({
              tool_use_id: tr.tool_use_id,
              content: tr.content,
            }))
          );

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
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", error: msg })}\n\n`
          )
        );

        // Zapiš event
        await supabase.from("chat_events").insert({
          session_id: sessionId,
          event_type: "error",
          payload: { error: msg },
        });
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
