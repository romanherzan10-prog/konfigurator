import { NextRequest, NextResponse } from "next/server";
import { Client as FtpClient } from "basic-ftp";
import { Writable } from "stream";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * Denní synchronizace skladových zásob z Cotton Classics FTP.
 * Spouští Vercel Cron (vercel.json). Auth přes CRON_SECRET —
 * Vercel posílá Authorization: Bearer <CRON_SECRET> automaticky.
 *
 * Tok: FTP /csv_stocks/stock.csv → parse (SKU;STOCK;TIMESTAMP)
 *      → RPC sync_stock_from_csv (jeden UPDATE v DB, žádné tisíce dotazů)
 */

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const RPC_CHUNK = 10_000;

async function downloadStockCsv(): Promise<string> {
  const host = process.env.FTP_HOST;
  const user = process.env.FTP_USER;
  const password = process.env.FTP_PASS;
  if (!host || !user || !password) {
    throw new Error("Chybí FTP_HOST / FTP_USER / FTP_PASS env proměnné");
  }

  const client = new FtpClient(30_000);
  const chunks: Buffer[] = [];
  const sink = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(chunk);
      cb();
    },
  });

  try {
    await client.access({ host, user, password, secure: false });
    await client.downloadTo(sink, "/csv_stocks/stock.csv");
  } finally {
    client.close();
  }
  return Buffer.concat(chunks).toString("utf8");
}

function parseCsv(data: string): Array<{ sku: string; stock: number }> {
  const lines = data.trim().split("\n");
  const rows: Array<{ sku: string; stock: number }> = [];
  // Header: SKU;STOCK;TIMESTAMP
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(";");
    if (parts.length < 2) continue;
    const sku = parts[0].trim();
    if (!sku) continue;
    rows.push({ sku, stock: parseInt(parts[1], 10) || 0 });
  }
  return rows;
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    const csv = await downloadStockCsv();
    const rows = parseCsv(csv);

    const supabase = getSupabaseAdmin();
    let totalUpdated = 0;
    let totalMatched = 0;

    for (let i = 0; i < rows.length; i += RPC_CHUNK) {
      const chunk = rows.slice(i, i + RPC_CHUNK);
      const { data, error } = await supabase.rpc("sync_stock_from_csv", {
        p_rows: chunk,
      });
      if (error) throw new Error(`sync_stock_from_csv: ${error.message}`);
      const result = Array.isArray(data) ? data[0] : data;
      totalUpdated += result?.updated_count ?? 0;
      totalMatched += result?.matched_skus ?? 0;
    }

    const stats = {
      csv_rows: rows.length,
      matched_skus: totalMatched,
      updated_rows: totalUpdated,
      duration_ms: Date.now() - startedAt,
    };
    console.log("[cron/sync-stock] OK", stats);
    return NextResponse.json({ success: true, ...stats });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Neznámá chyba";
    console.error("[cron/sync-stock] FAILED:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
