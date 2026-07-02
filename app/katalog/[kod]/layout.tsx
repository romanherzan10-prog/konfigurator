import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getSupabase } from "@/lib/supabase";

/**
 * Server layout kvůli generateMetadata — detail produktu je client component.
 * Dynamický title/description/OG obrázek pro sdílení odkazů a SEO.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ kod: string }>;
}): Promise<Metadata> {
  const { kod } = await params;
  try {
    const { data } = await getSupabase()
      .from("produkty")
      .select("nazev, popis, obrazek_url")
      .eq("kod", decodeURIComponent(kod))
      .maybeSingle();
    if (!data) return { title: "Produkt | LOOOKU" };
    const description =
      (data.popis ?? "").slice(0, 155) ||
      `${data.nazev} s vlastním potiskem nebo výšivkou. Orientační cena online, nezávazná poptávka.`;
    return {
      title: `${data.nazev} — potisk a výšivka | LOOOKU`,
      description,
      openGraph: {
        title: `${data.nazev} | LOOOKU`,
        description,
        images: data.obrazek_url ? [data.obrazek_url] : undefined,
      },
    };
  } catch {
    return { title: "Produkt | LOOOKU" };
  }
}

export default function KatalogDetailLayout({ children }: { children: ReactNode }) {
  return children;
}
