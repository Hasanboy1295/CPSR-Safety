"use client";

import { createBrowserClient } from "@supabase/ssr";

// Bu — brauzerda ishlaydigan klient (anon key, xavfsiz — RLS himoya qiladi).
// Service role kalit BU YERDA HECH QACHON ishlatilmaydi.
export function getSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY topilmadi (.env)"
    );
  }
  return createBrowserClient(url, anonKey);
}
