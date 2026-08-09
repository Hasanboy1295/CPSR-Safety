import { NextResponse } from "next/server";

// Xatolik kodlari. Server tashqi xatolik matnini (ko'pincha ingliz/O'zbekcha
// OpenAI xabari) to'g'ridan-to'g'ri mijozga YO'NAMADI — o'rniga kod qaytaradi.
// Mijoz bu kodni saytning hozirgi tili (ko/en) bo'yicha tarjima qiladi
// (qarang: translateError lib/i18n.tsx).
export type ErrorCode =
  | "not_authenticated"
  | "assessor_only"
  | "not_found"
  | "invalid_json"
  | "invalid_request"
  | "file_too_large"
  | "doc_parse_empty"
  | "ai_missing_key"
  | "ai_invalid_key"
  | "ai_quota"
  | "ai_overloaded"
  | "ai_timeout"
  | "ai_unknown"
  | "supabase_env"
  | "supabase_query"
  | "generic";

export function classifyError(err: unknown): { code: ErrorCode; message?: string } {
  const message = err instanceof Error ? err.message : err ? String(err) : "";
  const name = err instanceof Error ? err.name : "";
  const status = (err as { status?: number } | null)?.status;

  if (message.includes("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY")) {
    return { code: "supabase_env" };
  }
  if (message.includes("Muhit o'zgaruvchisi topilmadi")) {
    return { code: "supabase_env" };
  }
  if (message.includes("OPENAI_API_KEY")) {
    return { code: "ai_missing_key" };
  }
  if (status === 401) return { code: "ai_invalid_key" };
  if (status === 429) return { code: "ai_quota" };
  if (status === 500 || status === 502 || status === 503) {
    return { code: "ai_overloaded" };
  }
  if (name === "AbortError" || name === "TimeoutError") return { code: "ai_timeout" };
  if (/supabase/i.test(message)) return { code: "supabase_query", message };
  return { code: "ai_unknown", message };
}

export function apiError(err: unknown, status = 500) {
  const { code, message } = classifyError(err);
  return NextResponse.json(
    { error_code: code, ...(message ? { message } : {}) },
    { status }
  );
}

export function clientError(code: ErrorCode, message?: string, status = 400) {
  return NextResponse.json(
    { error_code: code, ...(message ? { message } : {}) },
    { status }
  );
}
