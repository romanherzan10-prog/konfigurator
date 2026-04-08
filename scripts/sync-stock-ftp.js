#!/usr/bin/env node
/**
 * Synchronizace skladových zásob z Cotton Classics FTP
 * Zdroj: /csv_stocks/stock.csv (SKU;STOCK;TIMESTAMP)
 *
 * Spáruje SKU z CSV s produkt_sklad přes ceniky.sku → produkt_sklad
 * Spouštět 1× denně (cron nebo n8n)
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { createClient } = require('@supabase/supabase-js');
const ftp = require('basic-ftp');

const FTP_HOST = process.env.FTP_HOST;
const FTP_USER = process.env.FTP_USER;
const FTP_PASS = process.env.FTP_PASS;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DRY_RUN = process.env.DRY_RUN === '1';

const supabase = DRY_RUN ? null : createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const BATCH_SIZE = 500;

// ─── 1. Download stock CSV ────────────────────────────────────────

async function downloadStockCsv() {
  const tmpFile = path.join(os.tmpdir(), 'cc-stock.csv');
  const client = new ftp.Client();
  try {
    console.log(`Připojuji se na FTP ${FTP_HOST}...`);
    await client.access({ host: FTP_HOST, user: FTP_USER, password: FTP_PASS, secure: false });
    await client.downloadTo(tmpFile, '/csv_stocks/stock.csv');
    console.log('Stock CSV stažen.');
  } finally {
    client.close();
  }
  return tmpFile;
}

// ─── 2. Parse CSV ─────────────────────────────────────────────────

function parseCsv(filePath) {
  const data = fs.readFileSync(filePath, 'utf8');
  const lines = data.trim().split('\n');
  // Header: SKU;STOCK;TIMESTAMP
  const records = new Map();

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(';');
    if (parts.length < 2) continue;
    const sku = parts[0].trim();
    const stock = parseInt(parts[1], 10) || 0;
    records.set(sku, stock);
  }

  console.log(`Načteno ${records.size} SKU ze stock CSV`);
  return records;
}

// ─── 3. Build SKU → produkt_sklad mapping ─────────────────────────

async function buildSkuMapping() {
  console.log('Načítám SKU mapování z ceniky...');

  // ceniky má: sku, katalogove_cislo (=Style), barva, velikost
  // produkt_sklad má: produkt_id, barva_id, velikost, skladem
  // produkty má: id, kod (=Style)
  // produkt_barvy má: id, produkt_id, nazev

  // Strategie: ceniky.sku → ceniky.katalogove_cislo+barva+velikost → produkty+produkt_barvy → produkt_sklad

  let allCeniky = [];
  let offset = 0;
  const PAGE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('ceniky')
      .select('sku, katalogove_cislo, barva, velikost')
      .range(offset, offset + PAGE - 1);

    if (error) { console.error('Chyba načítání ceniky:', error.message); break; }
    if (!data || data.length === 0) break;
    allCeniky = allCeniky.concat(data);
    offset += PAGE;
    if (data.length < PAGE) break;
  }

  console.log(`Načteno ${allCeniky.length} ceníkových záznamů`);
  return allCeniky;
}

// ─── 4. Update produkt_sklad ──────────────────────────────────────

async function updateStock(stockMap, ceniky) {
  // Načti všechny produkty s barvami
  let produkty = [];
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from('produkty')
      .select('id, kod')
      .eq('aktivni', true)
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;
    produkty = produkty.concat(data);
    offset += 1000;
    if (data.length < 1000) break;
  }

  const produktMap = new Map(produkty.map(p => [p.kod, p.id]));

  let barvy = [];
  offset = 0;
  while (true) {
    const { data } = await supabase
      .from('produkt_barvy')
      .select('id, produkt_id, nazev')
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;
    barvy = barvy.concat(data);
    offset += 1000;
    if (data.length < 1000) break;
  }

  // Map: produkt_id + barva_nazev_lower → barva_id
  const barvaMap = new Map();
  for (const b of barvy) {
    barvaMap.set(`${b.produkt_id}|${(b.nazev || '').toLowerCase()}`, b.id);
  }

  // Build updates: for each cenik row, find matching produkt_sklad
  const updates = []; // { produkt_id, barva_id, velikost, skladem }
  let matched = 0;
  let unmatched = 0;

  for (const c of ceniky) {
    const stock = stockMap.get(c.sku);
    if (stock === undefined) continue;

    const produktId = produktMap.get(c.katalogove_cislo);
    if (!produktId) { unmatched++; continue; }

    const barvaId = barvaMap.get(`${produktId}|${(c.barva || '').toLowerCase()}`);
    if (!barvaId) { unmatched++; continue; }

    updates.push({
      produkt_id: produktId,
      barva_id: barvaId,
      velikost: c.velikost || 'onesize',
      skladem: stock,
    });
    matched++;
  }

  console.log(`Matched: ${matched}, Unmatched: ${unmatched}`);

  if (DRY_RUN) {
    console.log('DRY RUN — ukázka prvních 5:');
    updates.slice(0, 5).forEach(u => console.log(u));
    return;
  }

  // Batch update
  let updated = 0;
  let errors = 0;

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (u) => {
      const { error } = await supabase
        .from('produkt_sklad')
        .update({ skladem: u.skladem, updated_at: new Date().toISOString() })
        .eq('produkt_id', u.produkt_id)
        .eq('barva_id', u.barva_id)
        .eq('velikost', u.velikost);

      if (error) errors++;
      else updated++;
    });
    await Promise.all(promises);

    if ((i + BATCH_SIZE) % 5000 === 0 || i + BATCH_SIZE >= updates.length) {
      console.log(`Progress: ${Math.min(i + BATCH_SIZE, updates.length)}/${updates.length}`);
    }
  }

  console.log(`\nHotovo! Updated: ${updated}, Errors: ${errors}`);
}

// ─── Main ──────────────────────────────────────────────────────────

async function main() {
  const csvPath = await downloadStockCsv();
  const stockMap = parseCsv(csvPath);
  const ceniky = await buildSkuMapping();
  await updateStock(stockMap, ceniky);
}

main().catch(err => { console.error(err); process.exit(1); });
