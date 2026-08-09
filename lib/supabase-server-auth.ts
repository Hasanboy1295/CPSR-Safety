import "./server-websocket";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Bu — Server Component / Route Handler'da "hozir kim login qilgan"ni
// cookie orqali bilish uchun (anon key + foydalanuvchi sessiyasi, RLS ostida).
// lib/supabase.ts (service role, RLS'ni chetlab o'tadi) BILAN ARALASHTIRMANG —
// u faqat RAG bilim bazasi kabi "egasiz" ma'lumotlar uchun.
export async function getSupabaseServerAuthClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY topilmadi (.env)"
    );
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component ichida chaqirilsa cookie yozib bo'lmaydi —
          // middleware.ts sessiyani baribir yangilab turadi, xavfsiz.
        }
      },
    },
  });
}
