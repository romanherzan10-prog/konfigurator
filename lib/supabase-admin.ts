import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client se service role klíčem.
 * POUŽÍVEJ POUZE V API ROUTES A EDGE FUNCTIONS — nikdy v client-side kódu.
 *
 * Service role key obchází RLS → používat opatrně. Je navržený pro chat API,
 * které potřebuje zapisovat do chat_sessions/messages/events (tyto tabulky
 * mají RLS enabled bez policies, takže anon klíč nikdy neprojde).
 */

let _admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY a NEXT_PUBLIC_SUPABASE_URL musí být v env. " +
        "Service role key najdeš v Supabase dashboard → Settings → API → service_role."
    );
  }

  _admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Explicitně header aby PostgREST max-rows limit platil jako vyšší
    global: {
      headers: {
        "x-client-info": "konfigurator-chat",
      },
    },
  });

  return _admin;
}
