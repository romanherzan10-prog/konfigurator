#!/usr/bin/env node

/**
 * Generátor embeddingů pro produkty v Supabase.
 *
 * Pro každý aktivní produkt sestaví textovou reprezentaci (nazev + popis + kategorie + material + gsm)
 * a uloží do produkty.embedding přes OpenAI text-embedding-3-small (1536 dim).
 *
 * Vlastnosti:
 * - Inkrementální: přeskakuje produkty, kde se embedding_source nezměnil
 * - Batched: posílá 100 textů na jeden API call (OpenAI limit je 2048 na batch)
 * - Retry: 3× při chybě s exponenciálním backoff
 * - Resume-safe: commituje po každém batchi
 *
 * Použití:
 *   OPENAI_API_KEY=sk-... node generate-embeddings.js
 *   FORCE=1 node generate-embeddings.js        # re-embed všech produktů
 *   LIMIT=50 node generate-embeddings.js       # jen prvních 50 (pro test)
 *   DRY_RUN=1 node generate-embeddings.js      # jen ukáže, co by dělal
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { createClient } = require('@supabase/supabase-js');

// ============================================================
// Konfigurace
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const MODEL = 'text-embedding-3-small';
const DIMENSIONS = 1536;
const BATCH_SIZE = 100;
const MAX_RETRIES = 3;

const FORCE = process.env.FORCE === '1';
const DRY_RUN = process.env.DRY_RUN === '1';
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : null;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_URL a SUPABASE_SERVICE_KEY musí být v .env');
  process.exit(1);
}

if (!OPENAI_API_KEY && !DRY_RUN) {
  console.error('❌ OPENAI_API_KEY není nastavený. Přidej ho do scripts/.env nebo spusť s DRY_RUN=1.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// ============================================================
// Pomocné funkce
// ============================================================

/**
 * Sestav textovou reprezentaci produktu pro embedding.
 * Klíčové: obsahuje českou i "mezinárodní" terminologii
 * a zachycuje klíčové vlastnosti pro sémantický match.
 */
function buildEmbeddingText(p) {
  const parts = [];

  // Značka a název jsou nejdůležitější — dej je na začátek
  if (p.znacka_nazev) parts.push(p.znacka_nazev);
  if (p.nazev) parts.push(p.nazev);

  // Kategorie — dej tam i anglický ekvivalent pro lepší cross-lingual match
  if (p.kategorie_nazev) {
    parts.push(`Kategorie: ${p.kategorie_nazev}`);
    // přidej anglické synonymum pro lepší zachycení dotazů typu "t-shirt"
    const map = {
      'Trička': 'T-shirt tricko',
      'Polokošile': 'Polo shirt polokosile',
      'Mikiny': 'Sweatshirt hoodie mikina',
      'Bundy & Vesty': 'Jacket vest bunda',
      'Košile & Halenky': 'Shirt blouse kosile halenka',
      'Kalhoty': 'Pants trousers kalhoty',
      'Doplňky': 'Accessories cepice taska',
      'Dětské': 'Kids children detske',
      'Pracovní': 'Workwear pracovni',
      'Sport': 'Sportswear sport',
    };
    if (map[p.kategorie_nazev]) parts.push(map[p.kategorie_nazev]);
  }

  if (p.material) parts.push(`Materiál: ${p.material}`);
  if (p.gramaz) parts.push(`Gramáž: ${p.gramaz}`);
  if (p.hmotnost_g) parts.push(`${p.hmotnost_g} g/m²`);

  // Popis — zkrať na ~300 znaků, ať embedding není zahlcený irrelevant detaily
  if (p.popis) {
    const popisTrim = p.popis.substring(0, 300).replace(/\s+/g, ' ').trim();
    parts.push(popisTrim);
  }

  return parts.join('. ');
}

/**
 * Zavolej OpenAI embeddings API s retry logikou.
 */
async function callOpenAIEmbeddings(texts) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          input: texts,
          dimensions: DIMENSIONS,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenAI API ${response.status}: ${err}`);
      }

      const data = await response.json();
      return {
        embeddings: data.data.map(d => d.embedding),
        usage: data.usage,
      };
    } catch (err) {
      lastError = err;
      console.warn(`  ⚠️  Pokus ${attempt}/${MAX_RETRIES} selhal: ${err.message}`);
      if (attempt < MAX_RETRIES) {
        const waitMs = 1000 * Math.pow(2, attempt);
        console.warn(`     Zkouším znovu za ${waitMs}ms...`);
        await new Promise(r => setTimeout(r, waitMs));
      }
    }
  }

  throw lastError;
}

/**
 * Převede JS array čísel na pgvector literál string.
 * pgvector přes REST API přijímá string '[0.1, 0.2, ...]'.
 */
function toPgVector(arr) {
  return '[' + arr.join(',') + ']';
}

// ============================================================
// Hlavní logika
// ============================================================

async function main() {
  console.log('🚀 Generátor embeddingů');
  console.log(`   Model: ${MODEL} (${DIMENSIONS} dim)`);
  console.log(`   Batch: ${BATCH_SIZE}`);
  if (FORCE) console.log('   Režim: FORCE (re-embed všech)');
  if (DRY_RUN) console.log('   Režim: DRY_RUN (nic se neuloží)');
  if (LIMIT) console.log(`   Limit: ${LIMIT}`);
  console.log();

  // 1) Načti produkty po stránkách (PostgREST má default max-rows ~1000)
  console.log('📥 Načítám produkty ze Supabase (paginovaně)...');

  const PAGE = 1000;
  const produkty = [];
  let page = 0;
  while (true) {
    const { data, error } = await supabase
      .from('produkty')
      .select(`
        id,
        kod,
        nazev,
        popis,
        material,
        gramaz,
        hmotnost_g,
        embedding_source,
        znacky ( nazev ),
        kategorie ( nazev )
      `)
      .eq('aktivni', true)
      .order('kod', { ascending: true })
      .range(page * PAGE, (page + 1) * PAGE - 1);

    if (error) {
      console.error('❌ Chyba načítání produktů:', error);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    produkty.push(...data);
    if (data.length < PAGE) break;
    page++;
  }

  console.log(`   Načteno ${produkty.length} aktivních produktů\n`);

  // 2) Připrav texty a vyfiltruj ty, co už mají aktuální embedding
  const toEmbed = [];
  let skipped = 0;

  for (const p of produkty) {
    const flat = {
      id: p.id,
      kod: p.kod,
      nazev: p.nazev,
      popis: p.popis,
      material: p.material,
      gramaz: p.gramaz,
      hmotnost_g: p.hmotnost_g,
      znacka_nazev: p.znacky?.nazev,
      kategorie_nazev: p.kategorie?.nazev,
    };
    const text = buildEmbeddingText(flat);

    // Přeskoč, pokud se text nezměnil
    if (!FORCE && p.embedding_source === text) {
      skipped++;
      continue;
    }

    toEmbed.push({ id: p.id, kod: p.kod, text });
    if (LIMIT && toEmbed.length >= LIMIT) break;
  }

  console.log(`📊 Statistika:`);
  console.log(`   Přeskočeno (aktuální): ${skipped}`);
  console.log(`   K zpracování: ${toEmbed.length}`);

  if (toEmbed.length === 0) {
    console.log('\n✅ Všechny embeddingy jsou aktuální. Nic k dělání.');
    return;
  }

  // Odhad nákladů: text-embedding-3-small = $0.02 / 1M tokens
  // 1 token ≈ 4 znaky, typický text ~200 znaků = ~50 tokens
  const avgChars = toEmbed.reduce((s, t) => s + t.text.length, 0) / toEmbed.length;
  const estTokens = (avgChars / 4) * toEmbed.length;
  const estCost = (estTokens / 1_000_000) * 0.02;
  console.log(`   Odhad: ~${Math.round(estTokens).toLocaleString()} tokenů, ~$${estCost.toFixed(4)}`);

  if (DRY_RUN) {
    console.log('\n🟡 DRY_RUN — ukázka prvních 3 textů:\n');
    for (const item of toEmbed.slice(0, 3)) {
      console.log(`--- ${item.kod} ---`);
      console.log(item.text);
      console.log();
    }
    return;
  }

  // 3) Zpracuj v batch
  console.log(`\n🔄 Spouštím zpracování v batchích po ${BATCH_SIZE}...\n`);
  const startTime = Date.now();
  let totalTokens = 0;
  let processed = 0;
  let failed = 0;

  for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
    const batch = toEmbed.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(toEmbed.length / BATCH_SIZE);

    process.stdout.write(`   Batch ${batchNum}/${totalBatches} (${batch.length} produktů)... `);

    try {
      const { embeddings, usage } = await callOpenAIEmbeddings(batch.map(b => b.text));
      totalTokens += usage.total_tokens;

      // Ulož embeddingy do Supabase
      const updates = batch.map((item, idx) => ({
        id: item.id,
        embedding: toPgVector(embeddings[idx]),
        embedding_source: item.text,
        embedding_updated_at: new Date().toISOString(),
      }));

      // Supabase upsert po jednom — update je rychlejší než bulk
      // Alternativně: použít RPC, ale pro 3600 řádků to stačí
      for (const upd of updates) {
        const { error: upErr } = await supabase
          .from('produkty')
          .update({
            embedding: upd.embedding,
            embedding_source: upd.embedding_source,
            embedding_updated_at: upd.embedding_updated_at,
          })
          .eq('id', upd.id);

        if (upErr) {
          console.error(`\n   ❌ Update ${upd.id} selhal:`, upErr.message);
          failed++;
        }
      }

      processed += batch.length;
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = processed / elapsed;
      const eta = (toEmbed.length - processed) / rate;
      console.log(`✓ (${usage.total_tokens} tok, ${rate.toFixed(1)}/s, ETA ${Math.round(eta)}s)`);
    } catch (err) {
      console.error(`\n   ❌ Batch ${batchNum} selhal definitivně:`, err.message);
      failed += batch.length;
    }
  }

  const elapsed = (Date.now() - startTime) / 1000;
  const finalCost = (totalTokens / 1_000_000) * 0.02;

  console.log(`\n✅ Hotovo!`);
  console.log(`   Zpracováno: ${processed}`);
  console.log(`   Selhalo: ${failed}`);
  console.log(`   Celkem tokenů: ${totalTokens.toLocaleString()}`);
  console.log(`   Reálná cena: ~$${finalCost.toFixed(4)}`);
  console.log(`   Čas: ${elapsed.toFixed(1)}s`);
}

main().catch(err => {
  console.error('💥 Fatální chyba:', err);
  process.exit(1);
});
