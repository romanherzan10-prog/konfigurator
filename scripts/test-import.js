#!/usr/bin/env node

/**
 * Test import — vlozi 3 testovaci produkty primo do Supabase (bez FTP)
 * pro overeni ze web spravne zobrazuje produkty.
 *
 * Pouziti:
 *   node test-import.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('CHYBA: SUPABASE_URL a SUPABASE_SERVICE_KEY musi byt nastaveny v .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================================
// Testovaci data
// ============================================================

const TEST_BRANDS = [
  { nazev: 'Fruit of the Loom' },
  { nazev: 'B&C' },
  { nazev: 'Stanley/Stella' },
];

const TEST_PRODUCTS = [
  {
    kod: '61-036',
    nazev: 'Valueweight T-Shirt',
    popis: 'Klasicke bavlnene tricko Fruit of the Loom. Rovny strih, zpevneny vysih, bocni svy.',
    znacka: 'Fruit of the Loom',
    kategorie: 'Tricka',
    material: '100% bavlna',
    gramaz: '165 g/m2',
    barvy: [
      { nazev: 'Cerna', hex_kod: '#000000', kod_barvy: 'BLK' },
      { nazev: 'Bila', hex_kod: '#FFFFFF', kod_barvy: 'WHT' },
      { nazev: 'Navy', hex_kod: '#1e3a5f', kod_barvy: 'NAV' },
    ],
    velikosti: ['S', 'M', 'L', 'XL'],
    skladem_range: [200, 500],
    cena: 42.5,
  },
  {
    kod: 'TU03T',
    nazev: 'E190 T-Shirt',
    popis: 'Premia bavlnene tricko B&C s predepranym omakem. Tubularni konstrukce.',
    znacka: 'B&C',
    kategorie: 'Tricka',
    material: '100% bavlna, ring-spun',
    gramaz: '190 g/m2',
    barvy: [
      { nazev: 'Cerna', hex_kod: '#000000', kod_barvy: 'BLK' },
      { nazev: 'Bila', hex_kod: '#FFFFFF', kod_barvy: 'WHT' },
      { nazev: 'Cervena', hex_kod: '#dc2626', kod_barvy: 'RED' },
    ],
    velikosti: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
    skladem_range: [150, 400],
    cena: 55.0,
  },
  {
    kod: 'STTU169',
    nazev: 'Creator 2.0',
    popis: 'Ikonicky unisex organicky t-shirt Stanley/Stella. Stredni gramaz, moderni strih.',
    znacka: 'Stanley/Stella',
    kategorie: 'Tricka',
    material: '100% organicka bavlna',
    gramaz: '180 g/m2',
    barvy: [
      { nazev: 'Cerna', hex_kod: '#000000', kod_barvy: 'BLK' },
      { nazev: 'Bila', hex_kod: '#FFFFFF', kod_barvy: 'WHT' },
      { nazev: 'French Navy', hex_kod: '#1e2a3a', kod_barvy: 'FNV' },
      { nazev: 'Khaki', hex_kod: '#6b7264', kod_barvy: 'KHK' },
    ],
    velikosti: ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'],
    skladem_range: [100, 350],
    cena: 78.0,
  },
];

// ============================================================
// Import logika
// ============================================================

async function run() {
  console.log('========================================');
  console.log('Test Import — 3 testovaci produkty');
  console.log('========================================\n');

  // 1. Znacky
  console.log('1) Upsertuji znacky...');
  const brandMap = {};
  for (const brand of TEST_BRANDS) {
    const { data, error } = await supabase
      .from('znacky')
      .upsert(brand, { onConflict: 'nazev' })
      .select('id, nazev')
      .single();

    if (error) {
      console.error(`   CHYBA znacka "${brand.nazev}":`, error.message);
      continue;
    }
    brandMap[data.nazev] = data.id;
    console.log(`   [OK] ${data.nazev} -> ${data.id}`);
  }

  // 2. Kategorie — pouzijeme existujici "Tricka" kategorii
  console.log('\n2) Nacitam kategorii "Tricka"...');
  const { data: katData, error: katError } = await supabase
    .from('kategorie')
    .select('id, nazev')
    .eq('nazev', 'Tricka')
    .maybeSingle();

  let kategorieId;
  if (katData) {
    kategorieId = katData.id;
    console.log(`   [OK] Nalezena: ${kategorieId}`);
  } else {
    // Zkusime "Trička" (s hackem)
    const { data: katData2 } = await supabase
      .from('kategorie')
      .select('id, nazev')
      .ilike('nazev', '%ri%k%')
      .limit(1)
      .maybeSingle();

    if (katData2) {
      kategorieId = katData2.id;
      console.log(`   [OK] Nalezena jako "${katData2.nazev}": ${kategorieId}`);
    } else {
      // Vytvorime novou
      const { data: newKat, error: newKatErr } = await supabase
        .from('kategorie')
        .upsert({ nazev: 'Tricka', poradi: 1 }, { onConflict: 'nazev' })
        .select('id')
        .single();

      if (newKatErr) {
        console.error('   CHYBA pri vytvareni kategorie:', newKatErr.message);
        process.exit(1);
      }
      kategorieId = newKat.id;
      console.log(`   [OK] Vytvorena nova: ${kategorieId}`);
    }
  }

  // 3. Produkty + barvy + sklad
  console.log('\n3) Upsertuji produkty, barvy a sklad...');
  for (const prod of TEST_PRODUCTS) {
    console.log(`\n   --- ${prod.nazev} (${prod.kod}) ---`);

    // Produkt
    const productRow = {
      kod: prod.kod,
      nazev: prod.nazev,
      popis: prod.popis,
      znacka_id: brandMap[prod.znacka] || null,
      kategorie_id: kategorieId,
      material: prod.material,
      gramaz: prod.gramaz,
      aktivni: true,
    };

    const { data: prodData, error: prodErr } = await supabase
      .from('produkty')
      .upsert(productRow, { onConflict: 'kod' })
      .select('id, kod')
      .single();

    if (prodErr) {
      console.error(`   CHYBA produkt "${prod.kod}":`, prodErr.message);
      continue;
    }
    const produktId = prodData.id;
    console.log(`   [OK] Produkt: ${produktId}`);

    // Barvy
    for (const barva of prod.barvy) {
      const colorRow = {
        produkt_id: produktId,
        nazev: barva.nazev,
        hex_kod: barva.hex_kod,
        kod_barvy: barva.kod_barvy,
      };

      const { data: colorData, error: colorErr } = await supabase
        .from('produkt_barvy')
        .upsert(colorRow, { onConflict: 'produkt_id,kod_barvy' })
        .select('id')
        .single();

      if (colorErr) {
        console.error(`   CHYBA barva "${barva.nazev}":`, colorErr.message);
        continue;
      }
      const barvaId = colorData.id;
      console.log(`   [OK] Barva: ${barva.nazev} (${barva.hex_kod}) -> ${barvaId}`);

      // Sklad — vsechny velikosti pro tuto barvu
      for (const vel of prod.velikosti) {
        const skladem = Math.floor(
          Math.random() * (prod.skladem_range[1] - prod.skladem_range[0]) + prod.skladem_range[0]
        );

        const stockRow = {
          produkt_id: produktId,
          barva_id: barvaId,
          velikost: vel,
          skladem: skladem,
          cena_nakupni: prod.cena,
        };

        const { error: stockErr } = await supabase
          .from('produkt_sklad')
          .upsert(stockRow, { onConflict: 'barva_id,velikost' });

        if (stockErr) {
          console.error(`   CHYBA sklad (${barva.nazev}/${vel}):`, stockErr.message);
          continue;
        }
      }
      console.log(`   [OK] Sklad: ${prod.velikosti.length} velikosti`);
    }
  }

  // 4. Souhrn
  console.log('\n========================================');
  console.log('Test import dokoncen!');
  console.log('========================================');

  // Overeni
  const { count: prodCount } = await supabase.from('produkty').select('*', { count: 'exact', head: true });
  const { count: colorCount } = await supabase.from('produkt_barvy').select('*', { count: 'exact', head: true });
  const { count: stockCount } = await supabase.from('produkt_sklad').select('*', { count: 'exact', head: true });
  const { count: brandCount } = await supabase.from('znacky').select('*', { count: 'exact', head: true });

  console.log(`\nStav DB:`);
  console.log(`  Znacky:      ${brandCount}`);
  console.log(`  Produkty:    ${prodCount}`);
  console.log(`  Barvy:       ${colorCount}`);
  console.log(`  Sklad:       ${stockCount}`);
}

run().catch((err) => {
  console.error('FATALNI CHYBA:', err);
  process.exit(1);
});
