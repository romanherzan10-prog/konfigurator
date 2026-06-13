import { NextRequest, NextResponse } from "next/server";

/**
 * Same-origin proxy pro fotky produktů z R2.
 * Customizer (fabric.js) potřebuje pozadí ze stejného originu, jinak by
 * cross-origin obrázek "otrávil" canvas a export PNG (toDataURL) by selhal.
 * SSRF guard: povolen jen R2 host.
 */

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Chybí parametr url." }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Neplatná url." }, { status: 400 });
  }

  if (
    parsed.protocol !== "https:" ||
    !(
      parsed.hostname.endsWith(".r2.dev") ||
      parsed.hostname.endsWith(".r2.cloudflarestorage.com")
    )
  ) {
    return NextResponse.json({ error: "Nepovolený zdroj." }, { status: 403 });
  }

  try {
    const res = await fetch(parsed.toString());
    if (!res.ok) {
      return NextResponse.json({ error: "Obrázek nenačten." }, { status: 502 });
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return new NextResponse(buf, {
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Chyba načítání obrázku." }, { status: 502 });
  }
}
