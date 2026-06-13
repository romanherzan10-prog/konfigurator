import crypto from "crypto";
import type { NextRequest } from "next/server";

/**
 * Vrátí SHA-256 hash IP + salt (prvních 32 znaků hex).
 * Salt MUSÍ být nastavený v env, jinak fail-fast — nechceme používat
 * slabý fallback, protože ip_hash se používá jako session ownership proof.
 */
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT;
  if (!salt || salt.length < 16) {
    throw new Error(
      "IP_HASH_SALT není nastavený nebo je kratší než 16 znaků. " +
        "Vygeneruj náhodný salt (např. `openssl rand -hex 32`) a ulož do env."
    );
  }
  return crypto
    .createHash("sha256")
    .update(ip + salt)
    .digest("hex")
    .substring(0, 32);
}

export function extractIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}
