#!/usr/bin/env node
/**
 * Aktualizace gramáže (GSM), materiálu a popisu z Cotton Classics XLSX "Style List"
 *
 * Style List obsahuje:
 *   - Material-Description (czech) → "145g/m², 100% předepraná prstencová bavlna..."
 *   - Product-Description (czech) → český popis
 *   - Categories (czech) → česká kategorie
 *   - Name2 (czech) → český podnázev
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

const supabase = DRY_RUN ? null : createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── 1. Download XLSX (use cache) ─────────────────────────────────

async function downloadXlsx() {
  const tmpFile = path.join(os.tmpdir(), 'cc-prices.xlsx');
  if (fs.existsSync(tmpFile)) {
    const age = Date.now() - fs.statSync(tmpFile).mtimeMs;
    if (age < 3600_000) {
      console.log(`Používám cached XLSX (${(age / 60000).toFixed(0)} min starý)`);
      return tmpFile;
    }
  }
  const client = new ftp.Client();
  try {
    await client.access({ host: FTP_HOST, user: FTP_USER, password: FTP_PASS, secure: false });
    const listing = await client.list(FTP_PATH);
    const xlsxFile = listing.find(f => f.name.includes('(CZK)') && f.name.endsWith('.xlsx'));
    if (!xlsxFile) throw new Error('CZK XLSX nenalezen na FTP');
    await client.downloadTo(tmpFile, `${FTP_PATH}/${xlsxFile.name}`);
    console.log('Staženo.');
  } finally { client.close(); }
  return tmpFile;
}

// ─── 2. Parse Style List ───────────────────────────────────────────

function parseStyleList(filePath) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets['Style List'];
  if (!ws) throw new Error('Sheet "Style List" nenalezen');

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const header = rows[0];
  const col = (name) => header.indexOf(name);

  const COL = {
    style: col('Style'),
    materialCz: col('Material-Description (czech)'),
    popisCz: col('Product-Description (czech)'),
    kategorieCz: col('Categories (czech)'),
    nazev2Cz: col('Name2 (czech)'),
    materialEn: col('Material-Description (english)'),
  };

  console.log('Sloupce:', COL);

  const styles = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[COL.style]) continue;

    const materialText = r[COL.materialCz] || r[COL.materialEn] || '';

    // Extrahuj GSM z materiálu: "145g/m²,..." nebo "210 g/m²,..."
    const gsmMatch = materialText.match(/(\d{2,4})\s*g\/m/i);
    const gsm = gsmMatch ? parseInt(gsmMatch[1]) : null;

    // Materiál = text za gramáží, nebo celý text
    let material = materialText;
    if (gsmMatch) {
      // Odstraň GSM prefix, vezmi zbytek jako popis materiálu
      material = materialText.replace(/^\d{2,4}\s*g\/m²?\s*,?\s*/i, '').trim();
    }
    // Zkrať na rozumnou délku, ořež na první tečku/čárku pokud je moc dlouhý
    if (material.length > 150) {
      const cutIdx = material.indexOf(',', 80);
      if (cutIdx > 0) material = material.substring(0, cutIdx);
    }

    styles.push({
      kod: String(r[COL.style]),
      gsm,
      material: material || null,
      popis: r[COL.popisCz] ? String(r[COL.popisCz]) : null,
      kategorie: r[COL.kategorieCz] ? String(r[COL.kategorieCz]) : null,
    });
  }

  console.log(`Načteno ${styles.length} stylů, ${styles.filter(s => s.gsm).length} s GSM`);
  return styles;
}

// ─── 3. Update DB ──────────────────────────────────────────────────

async function updateDb(styles) {
  if (DRY_RUN) {
    console.log('DRY RUN — ukázka prvních 5:');
    styles.slice(0, 5).forEach(s => console.log(s));
    return;
  }

  let updated = 0;
  let errors = 0;
  const BATCH = 50;

  for (let i = 0; i < styles.length; i += BATCH) {
    const batch = styles.slice(i, i + BATCH);
    const promises = batch.map(async (s) => {
      const updateData = {};
      if (s.gsm) updateData.gramaz = String(s.gsm);
      if (s.material) updateData.material = s.material;
      if (s.popis) updateData.popis = s.popis;

      if (Object.keys(updateData).length === 0) return;

      const { error } = await supabase
        .from('produkty')
        .update(updateData)
        .eq('kod', s.kod);

      if (error) {
        errors++;
        if (errors <= 3) console.error(`Chyba u ${s.kod}:`, error.message);
      } else {
        updated++;
      }
    });
    await Promise.all(promises);

    if ((i + BATCH) % 500 === 0 || i + BATCH >= styles.length) {
      console.log(`Progress: ${Math.min(i + BATCH, styles.length)}/${styles.length} (updated: ${updated})`);
    }
  }

  console.log(`\nHotovo! Updated: ${updated}, Errors: ${errors}`);
}

// ─── Main ──────────────────────────────────────────────────────────

async function main() {
  const xlsxPath = await downloadXlsx();
  const styles = parseStyleList(xlsxPath);
  await updateDb(styles);
}

main().catch(err => { console.error(err); process.exit(1); });
