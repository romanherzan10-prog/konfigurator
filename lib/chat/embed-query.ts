/**
 * Embedding uživatelských dotazů přes OpenAI text-embedding-3-small.
 *
 * - Používá fetch (funguje na Edge runtime)
 * - In-memory LRU cache (pro Edge je per-instance, ale stále výrazně pomáhá)
 * - Timeout 2000ms — pokud OpenAI nestíhá, fallback na null (search bez embedding)
 */

const OPENAI_URL = "https://api.openai.com/v1/embeddings";
const MODEL = "text-embedding-3-small";
const DIMENSIONS = 1536;
const TIMEOUT_MS = 2000;

// Jednoduchá LRU cache — max 100 queries per instance
const cache = new Map<string, number[]>();
const CACHE_MAX = 100;

function cacheGet(key: string): number[] | undefined {
  const val = cache.get(key);
  if (val) {
    // LRU: přesunout na konec
    cache.delete(key);
    cache.set(key, val);
  }
  return val;
}

function cacheSet(key: string, val: number[]) {
  if (cache.size >= CACHE_MAX) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(key, val);
}

/**
 * Vrátí embedding pro dotaz, nebo vyhodí chybu.
 */
export async function embedQuery(text: string): Promise<number[]> {
  const key = text.trim().toLowerCase();
  if (!key) throw new Error("Prázdný dotaz pro embedding.");

  const cached = cacheGet(key);
  if (cached) return cached;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY není v env.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        input: text,
        dimensions: DIMENSIONS,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const embedding: number[] = data.data?.[0]?.embedding;
    if (!embedding || embedding.length !== DIMENSIONS) {
      throw new Error(`Neplatný embedding response.`);
    }

    cacheSet(key, embedding);
    return embedding;
  } finally {
    clearTimeout(timer);
  }
}
