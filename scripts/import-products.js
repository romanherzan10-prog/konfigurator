#!/usr/bin/env node

/**
 * Cotton Classics - Import produktovych dat z FTP
 *
 * Pouziti:
 *   node import-products.js          # plny import
 *   DRY_RUN=1 node import-products.js # jen parsuje a loguje, nevklada do DB
 *
 * Ocekava .env soubor ve stejnem adresari (viz .env.example)
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

// Nacist .env z adresare skriptu
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { createClient } = require('@supabase/supabase-js');
const ftp = require('basic-ftp');
const { parse: csvParse } = require('csv-parse/sync');
const { XMLParser } = require('fast-xml-parser');
const XLSX = require('xlsx');

// ============================================================
// 1. Konfigurace
// ============================================================

const FTP_HOST = process.env.FTP_HOST;
const FTP_USER = process.env.FTP_USER;
const FTP_PASS = process.env.FTP_PASS;
const FTP_PATH = process.env.FTP_PATH || '/';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const TMP_DIR = path.join(os.tmpdir(), 'cotton-classics-import');

// Supabase klient (service role pro bypass RLS)
let supabase;
if (!DRY_RUN) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('CHYBA: SUPABASE_URL a SUPABASE_SERVICE_KEY musi byt nastaveny v .env');
    process.exit(1);
  }
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// ============================================================
// 2. FTP stahovani
// ============================================================

async function downloadFromFtp() {
  if (!FTP_HOST || !FTP_USER || !FTP_PASS) {
    console.error('CHYBA: FTP_HOST, FTP_USER a FTP_PASS musi byt nastaveny v .env');
    process.exit(1);
  }

  // Vytvorit tmp adresar
  if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  }

  const client = new ftp.Client();
  client.ftp.verbose = false;

  const downloadedFiles = [];

  try {
    console.log(`Pripojuji se na FTP ${FTP_HOST}...`);
    await client.access({
      host: FTP_HOST,
      user: FTP_USER,
      password: FTP_PASS,
      secure: false,
    });
    console.log('FTP pripojeno.');

    console.log(`Prochazim adresar ${FTP_PATH}...`);
    const listing = await client.list(FTP_PATH);

    const dataFiles = listing.filter((item) => {
      const ext = path.extname(item.name).toLowerCase();
      if (!item.isFile || !['.csv', '.txt', '.xml', '.xlsx'].includes(ext)) return false;
      // Pro XLSX: stahnout jen CZK verzi
      if (ext === '.xlsx' && !item.name.includes('(CZK)')) return false;
      return true;
    });

    if (dataFiles.length === 0) {
      console.warn('VAROVANI: Na FTP nebyly nalezeny zadne datove soubory (.csv, .txt, .xml)');
      return [];
    }

    console.log(`Nalezeno ${dataFiles.length} datovych souboru:`);
    for (const file of dataFiles) {
      console.log(`  - ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    }

    for (const file of dataFiles) {
      const remotePath = path.posix.join(FTP_PATH, file.name);
      const localPath = path.join(TMP_DIR, file.name);
      console.log(`Stahuji ${file.name}...`);
      await client.downloadTo(localPath, remotePath);
      downloadedFiles.push(localPath);
      console.log(`  Stazeno: ${localPath}`);
    }
  } catch (err) {
    console.error('CHYBA pri FTP stahovani:', err.message);
    throw err;
  } finally {
    client.close();
  }

  return downloadedFiles;
}

// ============================================================
// 3. Parsovani CSV
// ============================================================

async function parseCsv(filePath) {
  console.log(`Parsuji CSV: ${path.basename(filePath)}`);
  const content = fs.readFileSync(filePath, 'utf-8');

  // Detekce oddelovace — zkusime strednik, carka, tab
  const firstLine = content.split('\n')[0] || '';
  let delimiter = ',';
  if (firstLine.includes(';') && !firstLine.includes(',')) {
    delimiter = ';';
  } else if (firstLine.includes('\t') && !firstLine.includes(',') && !firstLine.includes(';')) {
    delimiter = '\t';
  }
  console.log(`  Oddelovac: "${delimiter === '\t' ? 'TAB' : delimiter}"`);

  const records = csvParse(content, {
    columns: true,
    skip_empty_lines: true,
    delimiter,
    trim: true,
    bom: true,
    relax_column_count: true,
  });

  console.log(`  Nacteno ${records.length} radku`);
  if (records.length > 0) {
    console.log(`  Sloupce: ${Object.keys(records[0]).join(', ')}`);
  }
  return records;
}

// ============================================================
// 4. Parsovani XML
// ============================================================

async function parseXml(filePath) {
  console.log(`Parsuji XML: ${path.basename(filePath)}`);
  const content = fs.readFileSync(filePath, 'utf-8');

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    isArray: (name) => {
      // Typicke nazvy pro kolekce produktu
      return ['product', 'item', 'artikel', 'Product', 'Item', 'Artikel'].includes(name);
    },
  });

  const parsed = parser.parse(content);

  // Hledame pole produktu — muze byt vnorene ruzne
  const products = findProductArray(parsed);
  console.log(`  Nacteno ${products.length} produktu`);
  if (products.length > 0) {
    console.log(`  Klice: ${Object.keys(products[0]).join(', ')}`);
  }
  return products;
}

/**
 * Rekurzivne hleda v XML strukture pole produktu
 */
function findProductArray(obj, depth = 0) {
  if (depth > 10) return [];
  if (Array.isArray(obj)) return obj;

  if (obj && typeof obj === 'object') {
    // Zkusime typicke nazvy
    const productKeys = ['products', 'product', 'items', 'item', 'artikel', 'Products', 'Product', 'Items'];
    for (const key of productKeys) {
      if (obj[key]) {
        if (Array.isArray(obj[key])) return obj[key];
        // Mozna je vnoreny dalsi level
        const result = findProductArray(obj[key], depth + 1);
        if (result.length > 0) return result;
      }
    }
    // Zkusime vsechny klice
    for (const key of Object.keys(obj)) {
      const result = findProductArray(obj[key], depth + 1);
      if (result.length > 0) return result;
    }
  }

  return [];
}

// ============================================================
// 4b. Parsovani XLSX
// ============================================================

async function parseXlsx(filePath) {
  console.log(`Parsuji XLSX: ${path.basename(filePath)}`);
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  console.log(`  List: ${sheetName}`);
  const sheet = workbook.Sheets[sheetName];
  const records = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  console.log(`  Nacteno ${records.length} radku`);
  if (records.length > 0) {
    console.log(`  Sloupce: ${Object.keys(records[0]).join(', ')}`);
  }
  return records;
}

// ============================================================
// 5. Normalizace dat
// ============================================================

/**
 * Mapovani Cotton Classics poli na nase schema.
 * TUTO FUNKCI UPRAVIME PO OBDRZENI REALNYCH DAT.
 *
 * Podporuje nemecke, anglicke i ceske nazvy sloupcu,
 * protoze Cotton Classics je nemecky distributor.
 */
function normalizeProduct(raw) {
  // Cena: VKEinzel muze byt cislo nebo retezec s carkou ("3,15")
  const parseCena = (val) => {
    if (!val && val !== 0) return 0;
    if (typeof val === 'number') return val;
    return parseFloat(String(val).replace(',', '.')) || 0;
  };

  return {
    // Style je zakladni kod produktu (bez barvy/velikosti), SKU je plny kod varianty
    kod: raw.Style || raw.SKU || raw.sku || raw.kod || '',
    sku: raw.SKU || raw.sku || '',
    ean: raw.EAN || raw.ean || '',
    nazev: raw.Name || raw.name || raw.nazev || '',
    popis: '',
    znacka: raw.Manufacturer || raw.manufacturer || raw.brand || raw.znacka || '',
    kategorie: raw.category || raw.kategorie || '',
    material: raw.material || '',
    gramaz: raw.Weight_KG ? String(raw.Weight_KG) : '',
    barva_nazev: raw.Colour || raw.Color || raw.colour || raw.color || raw.barva || '',
    barva_kod: raw.Colour || raw.Color || raw.colour || raw.color || '',
    barva_hex: '',
    velikost: raw.Size || raw.size || raw.velikost || '',
    skladem: parseInt(raw.STOCK || raw.stock || '0', 10) || 0,
    cena: parseCena(raw.VKEinzel),
    status: raw.Status || '',
    obrazek_url: raw.Packshot ? raw.Packshot : (raw.image || raw.obrazek_url || ''),
    manufacturer_sku: raw.ManufacturerSKU || '',
  };
}

// ============================================================
// 6. Upsert do Supabase
// ============================================================

async function upsertProducts(products) {
  if (products.length === 0) {
    console.log('Zadne produkty k importu.');
    return;
  }

  if (DRY_RUN) {
    console.log('\n=== DRY RUN — data se nevkladaji do DB ===');
    console.log(`Celkem normalizovanych radku: ${products.length}`);

    // Statistiky
    const brands = [...new Set(products.map((p) => p.znacka).filter(Boolean))];
    const categories = [...new Set(products.map((p) => p.kategorie).filter(Boolean))];
    const codes = [...new Set(products.map((p) => p.kod).filter(Boolean))];

    console.log(`Unikatni znacky (${brands.length}): ${brands.slice(0, 20).join(', ')}`);
    console.log(`Unikatni kategorie (${categories.length}): ${categories.slice(0, 20).join(', ')}`);
    console.log(`Unikatni kody produktu: ${codes.length}`);
    console.log('\nUkazka prvnich 3 radku:');
    products.slice(0, 3).forEach((p, i) => {
      console.log(`  [${i + 1}]`, JSON.stringify(p, null, 2));
    });
    return;
  }

  console.log(`\nImportuji ${products.length} radku do Supabase...`);

  // --- a) Znacky ---
  const uniqueBrands = [...new Set(products.map((p) => p.znacka).filter(Boolean))];
  console.log(`Upsertuji ${uniqueBrands.length} znacek...`);
  const brandMap = {}; // nazev -> id

  for (const brandName of uniqueBrands) {
    const { data, error } = await supabase
      .from('znacky')
      .upsert({ nazev: brandName }, { onConflict: 'nazev' })
      .select('id, nazev')
      .single();

    if (error) {
      console.error(`  CHYBA pri upsert znacky "${brandName}":`, error.message);
      continue;
    }
    brandMap[brandName] = data.id;
  }
  console.log(`  Znacky hotovo: ${Object.keys(brandMap).length} ulozenych`);

  // --- b) Kategorie ---
  const uniqueCategories = [...new Set(products.map((p) => p.kategorie).filter(Boolean))];
  console.log(`Upsertuji ${uniqueCategories.length} kategorii...`);
  const categoryMap = {}; // nazev -> id

  for (const catName of uniqueCategories) {
    const { data, error } = await supabase
      .from('kategorie')
      .upsert({ nazev: catName }, { onConflict: 'nazev' })
      .select('id, nazev')
      .single();

    if (error) {
      console.error(`  CHYBA pri upsert kategorie "${catName}":`, error.message);
      continue;
    }
    categoryMap[catName] = data.id;
  }
  console.log(`  Kategorie hotovo: ${Object.keys(categoryMap).length} ulozenych`);

  // --- c) Produkty (seskupene podle kodu) ---
  const productsByCode = {};
  for (const p of products) {
    if (!p.kod) {
      console.warn('  VAROVANI: Radek bez kodu produktu, preskakuji:', JSON.stringify(p).slice(0, 100));
      continue;
    }
    if (!productsByCode[p.kod]) {
      productsByCode[p.kod] = {
        product: p,
        variants: [],
      };
    }
    productsByCode[p.kod].variants.push(p);
  }

  const productCodes = Object.keys(productsByCode);
  console.log(`Upsertuji ${productCodes.length} unikatnich produktu...`);
  const productMap = {}; // kod -> id
  let productCount = 0;

  // Batch upsert produkty — po 50
  const BATCH_SIZE = 50;
  for (let i = 0; i < productCodes.length; i += BATCH_SIZE) {
    const batch = productCodes.slice(i, i + BATCH_SIZE);
    const productRows = batch.map((kod) => {
      const p = productsByCode[kod].product;
      return {
        kod: p.kod,
        nazev: p.nazev || p.kod,
        popis: p.popis || null,
        znacka_id: brandMap[p.znacka] || null,
        kategorie_id: categoryMap[p.kategorie] || null,
        material: p.material || null,
        gramaz: p.gramaz || null,
        obrazek_url: p.obrazek_url || null,
        aktivni: true,
      };
    });

    const { data, error } = await supabase
      .from('produkty')
      .upsert(productRows, { onConflict: 'kod' })
      .select('id, kod');

    if (error) {
      console.error(`  CHYBA pri upsert produktu (batch ${i / BATCH_SIZE + 1}):`, error.message);
      continue;
    }

    for (const row of data) {
      productMap[row.kod] = row.id;
      productCount++;
    }
  }
  console.log(`  Produkty hotovo: ${productCount} ulozenych`);

  // --- d) Barvy ---
  console.log('Upsertuji barvy...');
  let colorCount = 0;
  const colorMap = {}; // "produktId_kodBarvy" -> id

  for (const kod of productCodes) {
    const produktId = productMap[kod];
    if (!produktId) continue;

    // Unikatni barvy pro tento produkt
    const uniqueColors = {};
    for (const v of productsByCode[kod].variants) {
      const colorKey = v.barva_kod || v.barva_nazev;
      if (!colorKey) continue;
      if (!uniqueColors[colorKey]) {
        uniqueColors[colorKey] = v;
      }
    }

    for (const [, v] of Object.entries(uniqueColors)) {
      const kodBarvy = v.barva_kod || v.barva_nazev;
      if (!kodBarvy) continue;

      const colorRow = {
        produkt_id: produktId,
        nazev: v.barva_nazev || kodBarvy,
        hex_kod: v.barva_hex || null,
        kod_barvy: kodBarvy,
        obrazek_url: v.obrazek_url || null,
      };

      const { data, error } = await supabase
        .from('produkt_barvy')
        .upsert(colorRow, { onConflict: 'produkt_id,kod_barvy' })
        .select('id')
        .single();

      if (error) {
        console.error(`  CHYBA pri upsert barvy (${kod} / ${kodBarvy}):`, error.message);
        continue;
      }
      colorMap[`${produktId}_${kodBarvy}`] = data.id;
      colorCount++;
    }
  }
  console.log(`  Barvy hotovo: ${colorCount} ulozenych`);

  // --- e) Sklad ---
  console.log('Upsertuji skladove zasoby...');
  let stockCount = 0;
  const stockBatch = [];

  for (const kod of productCodes) {
    const produktId = productMap[kod];
    if (!produktId) continue;

    for (const v of productsByCode[kod].variants) {
      const kodBarvy = v.barva_kod || v.barva_nazev;
      if (!kodBarvy || !v.velikost) continue;

      const barvaId = colorMap[`${produktId}_${kodBarvy}`];
      if (!barvaId) continue;

      stockBatch.push({
        produkt_id: produktId,
        barva_id: barvaId,
        velikost: v.velikost,
        skladem: v.skladem,
        cena_nakupni: v.cena || null,
        sku: v.sku || null,
        ean: v.ean || null,
      });
    }
  }

  // Batch upsert sklad — po 100
  for (let i = 0; i < stockBatch.length; i += 100) {
    const batch = stockBatch.slice(i, i + 100);
    const { data, error } = await supabase
      .from('produkt_sklad')
      .upsert(batch, { onConflict: 'sku', ignoreDuplicates: false })
      .select('id');

    if (error) {
      console.error(`  CHYBA pri upsert skladu (batch ${Math.floor(i / 100) + 1}):`, error.message);
      continue;
    }
    stockCount += data.length;
  }
  console.log(`  Sklad hotovo: ${stockCount} zaznamu`);

  // --- Souhrn ---
  console.log('\n--- Souhrn importu ---');
  console.log(`Znacky:     ${Object.keys(brandMap).length}`);
  console.log(`Kategorie:  ${Object.keys(categoryMap).length}`);
  console.log(`Produkty:   ${productCount}`);
  console.log(`Barvy:      ${colorCount}`);
  console.log(`Sklad:      ${stockCount}`);
}

// ============================================================
// 7. Main
// ============================================================

async function main() {
  console.log('========================================');
  console.log('Cotton Classics Import');
  console.log(`Datum: ${new Date().toISOString()}`);
  console.log(`Mod:   ${DRY_RUN ? 'DRY RUN (bez zapisu do DB)' : 'PRODUKCNI'}`);
  console.log('========================================\n');

  // Stahnout soubory z FTP
  let files;
  try {
    files = await downloadFromFtp();
  } catch (err) {
    console.error('Import prerusen kvuli chybe FTP.');
    process.exit(1);
  }

  if (files.length === 0) {
    console.log('Zadne soubory ke zpracovani. Konec.');
    return;
  }

  // Zpracovat kazdy soubor
  let allProducts = [];
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    let data;

    try {
      if (ext === '.csv' || ext === '.txt') {
        data = await parseCsv(file);
      } else if (ext === '.xml') {
        data = await parseXml(file);
      } else if (ext === '.xlsx') {
        data = await parseXlsx(file);
      } else {
        console.log(`Preskakuji neznamy format: ${path.basename(file)}`);
        continue;
      }
    } catch (err) {
      console.error(`CHYBA pri parsovani ${path.basename(file)}:`, err.message);
      continue;
    }

    if (DRY_RUN && data.length > 0) {
      console.log('\nUkazka surových dat (prvnich 5 radku):');
      data.slice(0, 5).forEach((r, i) => console.log(`  [${i + 1}]`, JSON.stringify(r)));
    }

    const normalized = data.map(normalizeProduct);
    console.log(`  Normalizovano ${normalized.length} radku z ${path.basename(file)}`);
    allProducts = allProducts.concat(normalized);
  }

  console.log(`\nCelkem: ${allProducts.length} radku ze vsech souboru`);

  // Upsert do DB
  await upsertProducts(allProducts);

  // Uklidit tmp
  try {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
    console.log(`\nTmp adresar smazan: ${TMP_DIR}`);
  } catch {
    // Nevadi pokud se nepodari smazat
  }

  console.log('\nImport dokoncen.');
}

main().catch((err) => {
  console.error('FATALNI CHYBA:', err);
  process.exit(1);
});
