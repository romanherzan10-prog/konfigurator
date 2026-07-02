import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getSupabase } from "@/lib/supabase";

/**
 * Server layout kvůli generateMetadata — merch detail je client component.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ kod: string }>;
}): Promise<Metadata> {
  const { kod } = await params;
  try {
    const { data } = await getSupabase()
      .from("printify_produkty")
      .select("nazev, popis, obrazek_url")
      .eq("kod", decodeURIComponent(kod))
      .maybeSingle();
    if (!data) return { title: "Merch | LOOOKU" };
    const description =
      (data.popis ?? "").replace(/<[^>]+>/g, "").slice(0, 155) ||
      `${data.nazev} — originální LOOOKU merch. Ceny vč. DPH, doprava po celé ČR.`;
    return {
      title: `${data.nazev} | LOOOKU Merch`,
      description,
      openGraph: {
        title: `${data.nazev} | LOOOKU Merch`,
        description,
        images: data.obrazek_url ? [data.obrazek_url] : undefined,
      },
    };
  } catch {
    return { title: "Merch | LOOOKU" };
  }
}

export default function MerchDetailLayout({ children }: { children: ReactNode }) {
  return children;
}
