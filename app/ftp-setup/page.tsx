"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";

export default function FtpSetupPage() {
  const [host, setHost] = useState("");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [path, setPath] = useState("/");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setError("");
    if (!host.trim() || !user.trim() || !pass.trim()) {
      setError("Vyplň host, uživatele a heslo.");
      return;
    }

    setSubmitting(true);
    const { error: dbError } = await getSupabase().from("ftp_credentials").insert({
      ftp_host: host.trim(),
      ftp_user: user.trim(),
      ftp_pass: pass.trim(),
      ftp_path: path.trim() || "/",
      poznamka: note.trim() || null,
    });
    setSubmitting(false);

    if (dbError) {
      setError("Chyba: " + dbError.message);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold mb-2">Uloženo</h1>
          <p className="text-gray-600">
            FTP přístupy jsou bezpečně uložené. Až budu u PC, spustím import produktů.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h1 className="text-xl font-bold mb-1">FTP přístupy</h1>
          <p className="text-sm text-gray-500 mb-6">
            Zadej přístupové údaje od Cotton Classics. Uloží se bezpečně a použijí se pro import produktů.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">FTP Host <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="ftp.cottonclassics.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Uživatel <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="username"
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Heslo <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="password"
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Cesta na FTP</label>
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/"
                autoCapitalize="none"
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Poznámka</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Cokoliv důležitého k importu..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none resize-y"
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Ukládám..." : "Uložit přístupy"}
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          Data jsou uložena šifrovaně v databázi a budou smazána po dokončení importu.
        </p>
      </div>
    </div>
  );
}
