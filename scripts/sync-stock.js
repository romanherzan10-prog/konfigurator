#!/usr/bin/env node

/**
 * Cotton Classics - Synchronizace stavu skladu z FTP
 *
 * Stahuje /csv_stocks/stock.csv a aktualizuje skladem v produkt_sklad podle SKU.
 *
 * Pouziti:
 *   node sync-stock.js          # ostry import
 *   DRY_RUN=1 node sync-stock.js # jen parsuje a loguje
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const { createClient } = require('@supabase/supabase-js');
const ftp = require('basic-ftp');
const { parse: csvParse } = require('csv-parse/sync');

const FTP_HOST = process.env.FTP_HOST;
const FTP_USER = process.env.FTP_USER;
const FTP_PASS = process.env.FTP_PASS;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const TMP_FILE = path.join(os.tmpdir(), 'cotton-stock.csv');
const BATCH_SIZE = 5000;

let supabase;
if (!DRY_RUN) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

async function downloadStock() {
  const client = new ftp.Client();
  client.ftp.verbose = false;
  try {
    console.log(`Pripojuji se na FTP ${FTP_HOST}...`);
    await client.access({ host: FTP_HOST, user: FTP_USER, password: FTP_PASS, secure: false });
    console.log('FTP pripojeno. Stahuji stock.csv...');
    await client.downloadTo(TMP_FILE, '/csv_stocks/stock.csv');
    console.log(`  Stazeno: ${TMP_FILE}`);
  } finally {
    client.close();
  }
}

async function main() {
  console.log('========================================');
  console.log('Cotton Classics Sync Skladu');
  console.log(`Datum: ${new Date().toISOString()}`);
  console.log(`Mod:   ${DRY_RUN ? 'DRY RUN' : 'PRODUKCNI'}`);
  console.log('========================================\n');

  await downloadStock();

  const content = fs.readFileSync(TMP_FILE, 'utf-8');
  const records = csvParse(content, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ';',
    trim: true,
    bom: true,
  });

  console.log(`Nacteno ${records.length} radku ze stock.csv`);

  const nonZero = records.filter(r => parseInt(r.STOCK) > 0).length;
  console.log(`Radku s STOCK > 0: ${nonZero}`);

  if (DRY_RUN) {
    console.log('\nUkazka prvnich 5:');
    records.slice(0, 5).forEach(r => console.log(' ', JSON.stringify(r)));
    return;
  }

  // Bulk update pres RPC funkci
  let totalUpdated = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE).map(r => ({
      sku: r.SKU,
      skladem: parseInt(r.STOCK, 10) || 0,
    }));

    const { data, error } = await supabase.rpc('bulk_update_stock', {
      updates: batch,
    });

    if (error) {
      console.error(`  CHYBA batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message);
    } else {
      totalUpdated += data;
      console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: aktualizovano ${data} zaznamu`);
    }
  }

  console.log(`\nCelkem aktualizovano: ${totalUpdated} zaznamu`);
  console.log(`Nenalezeno v DB (SKU bez produktu): ${records.length - totalUpdated}`);

  fs.rmSync(TMP_FILE, { force: true });
  console.log('\nSync dokoncen.');
}

main().catch(err => { console.error('FATALNI CHYBA:', err); process.exit(1); });
