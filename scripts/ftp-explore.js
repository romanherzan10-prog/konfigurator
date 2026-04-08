#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const ftp = require('basic-ftp');

async function main() {
  const client = new ftp.Client();
  client.ftp.verbose = false;
  try {
    await client.access({
      host: process.env.FTP_HOST,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASS,
      secure: false,
    });
    // Projdi vsechny podadresare picture_db do hloubky 2
    const top = await client.list('/picture_db');
    for (const item of top) {
      const p1 = `/picture_db/${item.name}`;
      const l1 = await client.list(p1);
      const files1 = l1.filter(i => i.isFile);
      const dirs1 = l1.filter(i => i.isDirectory);
      const mb1 = (files1.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1);
      console.log(`${p1}: ${files1.length} souboru (${mb1} MB), ${dirs1.length} podadresaru`);
      if (files1.length > 0) console.log(`  Ukazka souboru: ${files1[0].name}`);
      for (const d of dirs1.slice(0, 5)) {
        const p2 = `${p1}/${d.name}`;
        const l2 = await client.list(p2);
        const files2 = l2.filter(i => i.isFile);
        const mb2 = (files2.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1);
        console.log(`  ${p2}: ${files2.length} souboru (${mb2} MB)`);
        if (files2.length > 0) console.log(`    Ukazka: ${files2[0].name}`);
      }
      if (dirs1.length > 5) console.log(`  ... a ${dirs1.length - 5} dalsich podadresaru`);
    }
  } finally {
    client.close();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
