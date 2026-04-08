#!/usr/bin/env node
/**
 * Cotton Classics — import cen a SKU dat z XLSX
 *
 * Co dělá:
 *   1. Stáhne aktuální XLSX (CZK) z FTP
 *   2. Naplní tabulku `ceniky` — jedna řada = jeden SKU (barva+velikost)
 *      s 5 cenovými hladinami (1ks, 10ks, 100ks, 500ks, 1000ks)
 *   3. Doplní cena_nakupni + sku + ean do tabulky produkt_sklad
 *
 * Použití:
 *   node import-prices.js
 *   DRY_RUN=1 node import-prices.js   # jen parsuje, nevkládá do DB
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { createClient } = require('@supabase/supabase-js');
const ftp = require('basic-ftp');
const XLSX = require('xlsx');

const FTP_HOST = process.env.FTP_HOST;
const FTP_USER = process.env.FTP_USER;
const FTP_PASS = process.env.FTP_PASS;
const FTP_PATH = process.env.FTP_PATH || '/xlsx-data/2026-04';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DRY_RUN = process.env.DRY_RUN === '1';

const BATCH_SIZE = 500;

if (!DRY_RUN && (!SUPABASE_URL || !SUPABASE_SERVICE_KEY)) {
  console.error('CHYBA: SUPABASE_URL a SUPABASE_SERVICE_KEY musi byt v .env');
  process.exit(1);
}

const supabase = DRY_RUN ? null : createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── 1. FTP download ────────────────────────────────────────────────────────

async function downloadXlsx() {
  const tmpFile = path.join(os.tmpdir(), 'cc-prices.xlsx');

  // Pokud existuje cached verze mladší než 1 hodinu, použij ji
  if (fs.existsSync(tmpFile)) {
    const age = Date.now() - fs.statSync(tmpFile).mtimeMs;
    if (age < 3600_000) {
      console.log(`Pouzivam cached XLSX (${(age / 60000).toFixed(0)} min stary)`);
      return tmpFile;
    }
  }

  const client = new ftp.Client();
  try {
    console.log(`Pripojuji se na FTP ${FTP_HOST}...`);
    await client.access({ host: FTP_HOST, user: FTP_USER, password: FTP_PASS, secure: false });

    const listing = await client.list(FTP_PATH);
    const xlsxFile = listing.find(f => f.name.includes('(CZK)') && f.name.endsWith('.xlsx'));
    if (!xlsxFile) throw new Error('CZK XLSX soubor nenalezen na FTP v ' + FTP_PATH);

    const remotePath = `${FTP_PATH}/${xlsxFile.name}`;
    console.log(`Stahuji ${xlsxFile.name} (${(xlsxFile.size / 1024 / 1024).toFixed(1)} MB)...`);
    await client.downloadTo(tmpFile, remotePath);
    console.log('Stazeno.');
  } finally {
    client.close();
  }
  return tmpFile;
}

// ─── 2. Parsování XLSX ──────────────────────────────────────────────────────

function parseXlsx(filePath) {
  console.log('Parsuji XLSX...');
  const wb = XLSX.readFile(filePath, { cellDates: false });
  const ws = wb.Sheets['SKU-List'];
  if (!ws) throw new Error('List "SKU-List" nenalezen v XLSX');

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const header = rows[0];

  // Mapování sloupců
  const col = (name) => header.indexOf(name);
  const COL = {
    sku:       col('SKU'),
    style:     col('Style'),
    name:      col('Name'),
    colour:    col('Colour'),
    size:      col('Size'),
    vk1:       col('VKEinzel'),
    vk10:      col('VK10'),
    vk100:     col('VK100'),
    vk500:     col('VK500'),
    vk1000:    col('VK1000'),
    status:    col('Status'),
    packshot:  col('Packshot'),
    ean:       col('EAN'),
    manufacturer: col('Manufacturer'),
  };

  // Ověření
  const missing = Object.entries(COL).filter(([, v]) => v === -1).map(([k]) => k);
  if (missing.length > 0) {
    throw new Error('Chybejici sloupce v XLSX: ' + missing.join(', '));
  }

  const records = [];
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[COL.style] || !r[COL.sku]) { skipped++; continue; }
    if (r[COL.status] !== 'ACTUAL') { skipped++; continue; }

    records.push({
      sku:    String(r[COL.sku]),
      style:  String(r[COL.style]),
      name:   r[COL.name]   ? String(r[COL.name])   : '',
      colour: r[COL.colour] ? String(r[COL.colour]) : null,
      size:   r[COL.size]   ? String(r[COL.size])   : null,
      vk1:    r[COL.vk1]    ? Number(r[COL.vk1])    : null,
      vk10:   r[COL.vk10]   ? Number(r[COL.vk10])   : null,
      vk100:  r[COL.vk100]  ? Number(r[COL.vk100])  : null,
      vk500:  r[COL.vk500]  ? Number(r[COL.vk500])  : null,
      vk1000: r[COL.vk1000] ? Number(r[COL.vk1000]) : null,
      ean:    r[COL.ean]    ? String(r[COL.ean])     : null,
    });
  }

  console.log(`Nacteno ${records.length} SKU zaznamu (preskoceno: ${skipped})`);
  return records;
}

// ─── 3. Import do ceniky ────────────────────────────────────────────────────

async function importCeniky(records) {
  console.log('\n[1/2] Import cen do tabulky ceniky...');

  const rows = records.map(r => ({
    katalogove_cislo: r.style,
    nazev_produktu:   r.name,
    cena:      r.vk1,
    cena_1:    r.vk1,
    cena_10:   r.vk10,
    cena_100:  r.vk100,
    cena_500:  r.vk500,
    cena_1000: r.vk1000,
    mena:      'CZK',
    barva:     r.colour,
    velikost:  r.size,
    sku:       r.sku,
    ean:       r.ean,
    platnost_od: new Date().toISOString().split('T')[0],
  }));

  if (DRY_RUN) {
    console.log('DRY RUN — ukazka prvnich 3 zaznamu:');
    rows.slice(0, 3).forEach(r => console.log(' ', JSON.stringify(r)));
    return;
  }

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('ceniky').insert(batch);
    if (error) {
      console.error(`Chyba pri insertu batch ${i}-${i + BATCH_SIZE}:`, error.message);
    } else {
      inserted += batch.length;
    }
    process.stdout.write(`\r  ${inserted}/${rows.length} vlozeno...`);
  }
  console.log(`\n  Hotovo: ${inserted} zaznamu vlozeno do ceniky`);
}

// ─── 4. Update produkt_sklad ─────────────────────────────────────────────────

async function updateSklad(records) {
  console.log('\n[2/2] Aktualizace produkt_sklad (cena_nakupni, sku, ean)...');

  if (DRY_RUN) {
    console.log('DRY RUN — preskakuji update skladu');
    return;
  }

  let updated = 0;
  let notFound = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    // Aktualizace přes SKU — jeden dotaz na batch
    for (const r of batch) {
      const { error } = await supabase
        .from('produkt_sklad')
        .update({
          cena_nakupni: r.vk1,
          sku: r.sku,
          ean: r.ean,
        })
        .eq('sku', r.sku);

      if (error) {
        notFound++;
      } else {
        updated++;
      }
    }

    process.stdout.write(`\r  ${i + batch.length}/${records.length} zpracovano...`);
  }
  console.log(`\n  Hotovo: ${updated} skladu aktualizovano, ${notFound} nenalezeno`);
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Cotton Classics Import Cen ===');
  console.log('FTP path:', FTP_PATH);
  if (DRY_RUN) console.log('*** DRY RUN — zadna data nebudou vlozena ***\n');

  const xlsxFile = await downloadXlsx();
  const records = parseXlsx(xlsxFile);

  if (records.length === 0) {
    console.error('CHYBA: Zadne zaznamy k importu!');
    process.exit(1);
  }

  // Ukázka
  console.log('\nUkazka prvniho zaznamu:', records[0]);

  await importCeniky(records);
  await updateSklad(records);

  console.log('\n=== Hotovo ===');
}

main().catch(err => {
  console.error('FATALNI CHYBA:', err.message);
  process.exit(1);
});
