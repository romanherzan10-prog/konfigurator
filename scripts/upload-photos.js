#!/usr/bin/env node

/**
 * Cotton Classics - Upload fotek z FTP do Cloudflare R2
 *
 * Pouziti:
 *   node upload-photos.js           # plny upload
 *   DRY_RUN=1 node upload-photos.js # jen zjisti co by se uploadovalo
 *   LIMIT=100 node upload-photos.js  # uploaduj jen prvnich N fotek
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { createClient } = require('@supabase/supabase-js');
const ftp = require('basic-ftp');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { PassThrough } = require('stream');

const DRY_RUN = process.env.DRY_RUN === '1';
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT) : null;
const FTP_PHOTO_DIR = '/picture_db/GUID/Lizenzfrei_72dpi';
const CONCURRENCY = 5; // paralelni uploady

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID.trim(),
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY.trim(),
  },
});

const BUCKET = process.env.R2_BUCKET;
const PUBLIC_URL = `https://${BUCKET}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

async function getPackshots() {
  const seen = new Set();
  const PAGE = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('produkt_barvy')
      .select('obrazek_url')
      .not('obrazek_url', 'is', null)
      .neq('obrazek_url', '')
      .not('obrazek_url', 'like', 'http%')
      .range(from, from + PAGE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const row of data) {
      if (row.obrazek_url) seen.add(row.obrazek_url);
    }

    if (data.length < PAGE) break;
    from += PAGE;
  }

  return [...seen];
}

async function existsInR2(key) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function uploadFromFtp(ftpClient, guid) {
  const remotePath = `${FTP_PHOTO_DIR}/${guid}`;
  const key = `products/${guid}`;

  // Stream primo z FTP do R2
  const pass = new PassThrough();
  const chunks = [];

  pass.on('data', chunk => chunks.push(chunk));

  const downloadPromise = ftpClient.downloadTo(pass, remotePath);
  await downloadPromise;

  const buffer = Buffer.concat(chunks);

  await r2.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: 'image/jpeg',
    CacheControl: 'public, max-age=31536000',
  }));

  return `${PUBLIC_URL}/${key}`;
}

async function processBatch(ftpClient, guids, stats) {
  for (const guid of guids) {
    try {
      const key = `products/${guid}`;
      const already = await existsInR2(key);
      if (already) {
        stats.skipped++;
        continue;
      }

      await uploadFromFtp(ftpClient, guid);
      stats.uploaded++;

      if ((stats.uploaded + stats.skipped + stats.failed) % 50 === 0) {
        console.log(`  Hotovo: ${stats.uploaded} uploadnuto, ${stats.skipped} preskoceno, ${stats.failed} chyb`);
      }
    } catch (err) {
      stats.failed++;
      if (stats.failed <= 10) {
        console.error(`  CHYBA (${guid}): ${err.message}`);
      }
    }
  }
}

async function updateDbUrls() {
  console.log('\nAktualizuji obrazek_url v produkt_barvy pres SQL...');
  const { error } = await supabase.rpc('update_barvy_obrazek_urls', {
    base_url: `${PUBLIC_URL}/products/`,
  });
  if (error) throw error;
  console.log('  Hotovo.');
}

async function main() {
  console.log('========================================');
  console.log('Cotton Classics - Upload fotek do R2');
  console.log(`Datum: ${new Date().toISOString()}`);
  console.log(`Mod:   ${DRY_RUN ? 'DRY RUN' : 'PRODUKCNI'}`);
  console.log('========================================\n');

  console.log('Nacitam packshot GUIDy z Supabase...');
  const guids = await getPackshots();
  const toProcess = LIMIT ? guids.slice(0, LIMIT) : guids;
  console.log(`Celkem unikatnich packshotu: ${guids.length}`);
  if (LIMIT) console.log(`Omezeno na: ${LIMIT}`);

  if (DRY_RUN) {
    console.log('\nUkazka prvnich 10 GUIDu:');
    guids.slice(0, 10).forEach(g => console.log(' ', g));
    return;
  }

  const stats = { uploaded: 0, skipped: 0, failed: 0 };

  const ftpClient = new ftp.Client();
  ftpClient.ftp.verbose = false;

  try {
    console.log(`Pripojuji se na FTP...`);
    await ftpClient.access({
      host: process.env.FTP_HOST,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASS,
      secure: false,
    });
    console.log('FTP pripojeno.\n');

    console.log(`Uploading ${toProcess.length} fotek do R2 bucket "${BUCKET}"...`);
    await processBatch(ftpClient, toProcess, stats);

  } finally {
    ftpClient.close();
  }

  console.log('\n--- Souhrn ---');
  console.log(`Uploadnuto:  ${stats.uploaded}`);
  console.log(`Preskoceno:  ${stats.skipped} (uz existuje)`);
  console.log(`Chyby:       ${stats.failed}`);

  if (stats.uploaded > 0) {
    await updateDbUrls();
  }

  console.log('\nHotovo.');
}

main().catch(err => { console.error('FATALNI CHYBA:', err); process.exit(1); });
