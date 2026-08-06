import { NextResponse } from "next/server";

// VAQTINCHALIK diagnostika endpoint — Voyage/Supabase muammosini topish uchun.
// Faqat mavjudlik/format tekshiriladi, maxfiy qiymatlarning o'zi qaytarilmaydi.
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const voyage = process.env.VOYAGE_API_KEY || "";
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const openai = process.env.OPENAI_API_KEY || "";

  return NextResponse.json({
    supabaseUrl: {
      value: url, // public bo'lgani uchun xavfsiz
      length: url.length,
      looksValid: /^https:\/\/.+\.supabase\.co$/.test(url),
    },
    voyageKey: {
      length: voyage.length,
      startsWithPa: voyage.startsWith("pa-"),
      first4: voyage.slice(0, 4),
      last4: voyage.slice(-4),
      hasWhitespace: /\s/.test(voyage),
    },
    anonKey: { length: anon.length, first6: anon.slice(0, 6) },
    serviceKey: { length: service.length, first6: service.slice(0, 6) },
    openaiKey: { length: openai.length, startsWithSk: openai.startsWith("sk-") },
  });
}
