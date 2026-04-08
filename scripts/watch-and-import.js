#!/usr/bin/env node

/**
 * Watch & Import — čeká na FTP přístupy z telefonu, pak automaticky spustí import.
 *
 * Spuštění: node watch-and-import.js
 * Nechej běžet na PC. Až z telefonu odešleš FTP údaje, import se spustí sám.
 */

const { createClient } = require("@supabase/supabase-js");
const { Client: FtpClient } = require("basic-ftp");
const { parse } = require("csv-parse/sync");
const { XMLParser } = require("fast-xml-parser");
const fs = require("fs");
const path = require("path");
const os = require("os");

// Supabase — anon key (stačí díky dočasné RLS policy)
const SUPABASE_URL = "https://ntzalajouwqqdiqpnehx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50emFsYWpvdXdxcWRpcXBuZWh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNDUzMzYsImV4cCI6MjA4OTYyMTMzNn0.FPn4AChnvbI7Nfy2wM5vq8Pb3UeUFZmqHoKCH-WzeKs";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const POLL_INTERVAL = 5000; // 5 sekund
const TMP_DIR = path.join(os.tmpdir(), "cotton-classics-import");

// ─── Logging ───────────────────────────────────────────────

function log(msg) {
  const time = new Date().toLocaleTimeString("cs-CZ");
  console.log(`[${time}] ${msg}`);
}

function logError(msg, err) {
  const time = new Date().toLocaleTimeString("cs-CZ");
  console.error(`[${time}] ❌ ${msg}`, err?.message || err || "");
}

// ─── FTP Download ──────────────────────────────────────────

async function downloadFromFtp(host, user, pass, ftpPath) {
  log(`Připojuji se na FTP: ${host}...`);

  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

  const client = new FtpClient();
  client.ftp.verbose = false;

  const downloadedFiles = [];

  try {
    await client.access({ host, user, password: pass, secure: false });
    log("FTP připojeno.");

    await client.cd(ftpPath || "/");
    const list = await client.list();

    log(`Nalezeno ${list.length} souborů/složek na FTP.`);

    const dataFiles = list.filter((f) => {
      const ext = path.extname(f.name).toLowerCase();
      return f.isFile && [".csv", ".txt", ".xml", ".xlsx"].includes(ext);
    });

    log(`Datové soubory ke stažení: ${dataFiles.length}`);

    for (const file of dataFiles) {
      const localPath = path.join(TMP_DIR, file.name);
      log(`  Stahuji: ${file.name} (${(file.size / 1024).toFixed(1)} KB)...`);
      await client.downloadTo(localPath, file.name);
      downloadedFiles.push(localPath);
      log(`  ✓ ${file.name} stažen.`);
    }

    // Pokud nejsou soubory v root, zkusit podadresáře
    if (dataFiles.length === 0) {
      const dirs = list.filter((f) => f.isDirectory && !f.name.startsWith("."));
      for (const dir of dirs) {
        log(`  Procházím složku: ${dir.name}/`);
        await client.cd(dir.name);
        const subList = await client.list();
        const subFiles = subList.filter((f) => {
          const ext = path.extname(f.name).toLowerCase();
          return f.isFile && [".csv", ".txt", ".xml", ".xlsx"].includes(ext);
        });
        for (const file of subFiles) {
          const localPath = path.join(TMP_DIR, `${dir.name}_${file.name}`);
          log(`    Stahuji: ${dir.name}/${file.name}...`);
          await client.downloadTo(localPath, file.name);
          downloadedFiles.push(localPath);
        }
        await client.cdup();
      }
    }
  } finally {
    client.close();
  }

  return downloadedFiles;
}

// ─── Parse CSV ─────────────────────────────────────────────

function parseCsv(filePath) {
  log(`Parsování CSV: ${path.basename(filePath)}`);
  const content = fs.readFileSync(filePath, "utf-8");

  // Autodetekce oddělovače
  const firstLine = content.split("\n")[0] || "";
  let delimiter = ",";
  if (firstLine.split(";").length > firstLine.split(",").length) delimiter = ";";
  if (firstLine.split("\t").length > firstLine.split(delimiter).length) delimiter = "\t";

  const records = parse(content, {
    delimiter,
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    bom: true,
  });

  log(`  → ${records.length} řádků, oddělovač: "${delimiter === "\t" ? "TAB" : delimiter}"`);
  if (records.length > 0) {
    log(`  → Sloupce: ${Object.keys(records[0]).join(", ")}`);
  }
  return records;
}

// ─── Parse XML ─────────────────────────────────────────────

function parseXml(filePath) {
  log(`Parsování XML: ${path.basename(filePath)}`);
  const content = fs.readFileSync(filePath, "utf-8");
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const parsed = parser.parse(content);

  // Rekurzivní hledání prvního pole
  function findArray(obj) {
    if (Array.isArray(obj)) return obj;
    if (obj && typeof obj === "object") {
      for (const val of Object.values(obj)) {
        const found = findArray(val);
        if (found) return found;
      }
    }
    return null;
  }

  const items = findArray(parsed) || [];
  log(`  → ${items.length} položek nalezeno.`);
  return items;
}

// ─── Normalize ─────────────────────────────────────────────

function normalizeProduct(raw) {
  const get = (...keys) => {
    for (const k of keys) {
      const val = raw[k] || raw[k?.toLowerCase()] || raw[k?.toUpperCase()];
      if (val !== undefined && val !== null && String(val).trim() !== "") return String(val).trim();
    }
    return null;
  };

  return {
    kod: get("article_number", "sku", "artikelnummer", "art_nr", "item_number", "code", "product_code", "article_code"),
    nazev: get("name", "bezeichnung", "product_name", "article_name", "description_short", "title"),
    popis: get("description", "beschreibung", "long_description", "description_long", "text"),
    znacka: get("brand", "marke", "manufacturer", "hersteller", "brand_name"),
    kategorie: get("category", "kategorie", "product_group", "warengruppe", "group", "article_group"),
    material: get("material", "zusammensetzung", "composition", "fabric"),
    gramaz: get("weight", "gewicht", "gramm", "gsm", "fabric_weight"),
    barva_nazev: get("color", "farbe", "colour", "color_name", "farbname"),
    barva_kod: get("color_code", "farbnummer", "colour_code", "farbcode", "color_id"),
    barva_hex: get("color_hex", "hex", "farb_hex", "hex_code"),
    velikost: get("size", "groesse", "grosse", "size_name"),
    skladem: parseInt(get("stock", "bestand", "lagerbestand", "quantity", "available", "menge") || "0"),
    cena: parseFloat(get("price", "preis", "vk_preis", "net_price", "ek_preis", "netto") || "0"),
    obrazek_url: get("image", "bild", "image_url", "picture", "photo", "image_link", "picture_url"),
  };
}

// ─── Upsert do Supabase ────────────────────────────────────

async function upsertProducts(products) {
  log(`Zpracovávám ${products.length} záznamů...`);

  // Deduplicate značky
  const brandNames = [...new Set(products.map((p) => p.znacka).filter(Boolean))];
  log(`  Značky: ${brandNames.length} (${brandNames.slice(0, 5).join(", ")}${brandNames.length > 5 ? "..." : ""})`);

  const brandMap = {};
  for (const name of brandNames) {
    const { data } = await supabase
      .from("znacky")
      .upsert({ nazev: name }, { onConflict: "nazev" })
      .select("id, nazev")
      .single();
    if (data) brandMap[name] = data.id;
  }

  // Kategorie lookup
  const { data: existingKat } = await supabase.from("kategorie").select("id, nazev");
  const katMap = {};
  for (const k of existingKat || []) katMap[k.nazev.toLowerCase()] = k.id;

  // Seskupit podle kódu produktu
  const grouped = {};
  for (const p of products) {
    if (!p.kod) continue;
    if (!grouped[p.kod]) {
      grouped[p.kod] = {
        kod: p.kod,
        nazev: p.nazev || p.kod,
        popis: p.popis,
        znacka: p.znacka,
        kategorie: p.kategorie,
        material: p.material,
        gramaz: p.gramaz,
        obrazek_url: p.obrazek_url,
        barvy: {},
      };
    }
    const g = grouped[p.kod];
    if (!g.popis && p.popis) g.popis = p.popis;
    if (!g.obrazek_url && p.obrazek_url) g.obrazek_url = p.obrazek_url;

    const barvyKey = p.barva_kod || p.barva_nazev || "default";
    if (!g.barvy[barvyKey]) {
      g.barvy[barvyKey] = {
        nazev: p.barva_nazev || barvyKey,
        kod_barvy: p.barva_kod || barvyKey,
        hex_kod: p.barva_hex,
        obrazek_url: p.obrazek_url,
        velikosti: [],
      };
    }
    if (p.velikost) {
      g.barvy[barvyKey].velikosti.push({
        velikost: p.velikost,
        skladem: p.skladem || 0,
        cena: p.cena || 0,
      });
    }
  }

  const productCodes = Object.keys(grouped);
  log(`  Unikátních produktů: ${productCodes.length}`);

  let imported = 0;
  let errors = 0;

  for (const kod of productCodes) {
    const g = grouped[kod];
    try {
      // Najít kategorii
      let kategorie_id = null;
      if (g.kategorie) {
        const katLower = g.kategorie.toLowerCase();
        kategorie_id = katMap[katLower] || null;
        if (!kategorie_id) {
          // Fuzzy match
          for (const [k, id] of Object.entries(katMap)) {
            if (k.includes(katLower) || katLower.includes(k)) {
              kategorie_id = id;
              break;
            }
          }
        }
      }

      // Upsert produkt
      const { data: prod, error: prodErr } = await supabase
        .from("produkty")
        .upsert({
          kod: g.kod,
          nazev: g.nazev,
          popis: g.popis,
          znacka_id: g.znacka ? brandMap[g.znacka] || null : null,
          kategorie_id,
          material: g.material,
          gramaz: g.gramaz,
          obrazek_url: g.obrazek_url,
          aktivni: true,
        }, { onConflict: "kod" })
        .select("id")
        .single();

      if (prodErr || !prod) {
        logError(`  Produkt ${kod}:`, prodErr);
        errors++;
        continue;
      }

      // Upsert barvy
      for (const barva of Object.values(g.barvy)) {
        const { data: bData, error: bErr } = await supabase
          .from("produkt_barvy")
          .upsert({
            produkt_id: prod.id,
            nazev: barva.nazev,
            kod_barvy: barva.kod_barvy,
            hex_kod: barva.hex_kod,
            obrazek_url: barva.obrazek_url,
          }, { onConflict: "produkt_id,kod_barvy" })
          .select("id")
          .single();

        if (bErr || !bData) {
          logError(`  Barva ${barva.nazev} (${kod}):`, bErr);
          continue;
        }

        // Upsert sklad
        for (const vel of barva.velikosti) {
          await supabase
            .from("produkt_sklad")
            .upsert({
              produkt_id: prod.id,
              barva_id: bData.id,
              velikost: vel.velikost,
              skladem: vel.skladem,
              cena_nakupni: vel.cena || null,
            }, { onConflict: "barva_id,velikost" });
        }
      }

      imported++;
    } catch (err) {
      logError(`  Produkt ${kod}:`, err);
      errors++;
    }
  }

  log(`  ✓ Importováno: ${imported} produktů, chyby: ${errors}`);
  return { imported, errors };
}

// ─── Main: Polling loop ────────────────────────────────────

async function checkForCredentials() {
  const { data, error } = await supabase
    .from("ftp_credentials")
    .select("*")
    .eq("zpracovano", false)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return data[0];
}

async function markProcessed(id) {
  await supabase.from("ftp_credentials").update({ zpracovano: true }).eq("id", id);
}

async function runImport(creds) {
  log("═══════════════════════════════════════════");
  log("🚀 IMPORT SPUŠTĚN");
  log(`   Host: ${creds.ftp_host}`);
  log(`   User: ${creds.ftp_user}`);
  log(`   Path: ${creds.ftp_path || "/"}`);
  if (creds.poznamka) log(`   Poznámka: ${creds.poznamka}`);
  log("═══════════════════════════════════════════");

  try {
    // 1. FTP download
    const files = await downloadFromFtp(creds.ftp_host, creds.ftp_user, creds.ftp_pass, creds.ftp_path);

    if (files.length === 0) {
      log("⚠️  Žádné datové soubory nalezeny na FTP.");
      log("   Zkontroluj cestu a obsah FTP serveru.");
      await markProcessed(creds.id);
      return;
    }

    log(`Staženo ${files.length} souborů.`);

    // 2. Parse all files
    let allProducts = [];
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      let data = [];
      try {
        if (ext === ".csv" || ext === ".txt") data = parseCsv(file);
        else if (ext === ".xml") data = parseXml(file);
        else { log(`  Přeskakuji: ${path.basename(file)}`); continue; }

        const normalized = data.map(normalizeProduct).filter((p) => p.kod);
        log(`  → ${normalized.length} platných produktů z ${path.basename(file)}`);
        allProducts = allProducts.concat(normalized);
      } catch (err) {
        logError(`  Chyba při parsování ${path.basename(file)}:`, err);
      }
    }

    if (allProducts.length === 0) {
      log("⚠️  Žádné produkty nebyly rozpoznány.");
      log("   Pravděpodobně je potřeba upravit mapování sloupců.");
      log("   Prvních 5 řádků z prvního souboru:");
      try {
        const firstFile = files[0];
        const content = fs.readFileSync(firstFile, "utf-8");
        const lines = content.split("\n").slice(0, 5);
        lines.forEach((l, i) => log(`   [${i}] ${l.substring(0, 200)}`));
      } catch {}
      await markProcessed(creds.id);
      return;
    }

    log(`Celkem ${allProducts.length} produktových záznamů ke zpracování.`);

    // 3. Upsert
    const result = await upsertProducts(allProducts);

    log("═══════════════════════════════════════════");
    log(`✅ IMPORT DOKONČEN`);
    log(`   Produktů: ${result.imported}`);
    log(`   Chyb: ${result.errors}`);
    log("═══════════════════════════════════════════");

    // 4. Cleanup
    await markProcessed(creds.id);

    // Smazat stažené soubory
    for (const f of files) {
      try { fs.unlinkSync(f); } catch {}
    }

  } catch (err) {
    logError("Import selhal:", err);
    await markProcessed(creds.id);
  }
}

async function main() {
  console.log("");
  console.log("╔═══════════════════════════════════════════════╗");
  console.log("║  Cotton Classics — Watch & Import             ║");
  console.log("║  Čekám na FTP přístupy z telefonu...          ║");
  console.log("║  Odešli údaje na:                             ║");
  console.log("║  konfigurator-nine.vercel.app/ftp-setup        ║");
  console.log("║                                               ║");
  console.log("║  Ctrl+C pro ukončení                          ║");
  console.log("╚═══════════════════════════════════════════════╝");
  console.log("");

  while (true) {
    try {
      const creds = await checkForCredentials();
      if (creds) {
        await runImport(creds);
        log("");
        log("Čekám na další FTP přístupy...");
      }
    } catch (err) {
      // Tiché selhání poll cyklu
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }
}

main().catch((err) => {
  logError("Fatální chyba:", err);
  process.exit(1);
});
