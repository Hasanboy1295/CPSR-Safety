import "./server-websocket";
import { createClient } from "@supabase/supabase-js";

// Bu klient faqat server-side kodda (API route, script) import qilinadi.
// SUPABASE_SERVICE_ROLE_KEY hech qachon "use client" komponentiga yoki
// NEXT_PUBLIC_ o'zgaruvchisiga chiqmasligi kerak.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Muhit o'zgaruvchisi topilmadi: ${name} (.env faylni tekshiring)`);
  }
  return value;
}

export function getSupabaseServerClient() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}
