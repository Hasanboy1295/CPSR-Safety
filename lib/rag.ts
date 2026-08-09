import { getSupabaseServerClient } from "./supabase";
import { embedQuery } from "./embeddings";
import { generateGroundedAnswer } from "./llm";
import { mockAnswerWithRag, mockRetrieveChunks } from "./mock";
import type { Lang } from "./i18n";

export type RetrievedChunk = {
  id: number;
  source_name: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
};

export type RagResult = {
  answer: string;
  sources: RetrievedChunk[];
  model: string;
  demo?: boolean;
};

/** .env'da 3 ta kalit ham to'ldirilganmi — bo'lmasa demo rejimga o'tamiz.
 * (Voyage endi kerak emas — embedding ham OpenAI orqali, bitta provayder.) */
export function hasRealCredentials(): boolean {
  return Boolean(
    process.env.OPENAI_API_KEY &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * Faqat qidiruv qismi (RAG'ning "R"i) — generatsiyasiz. lib/report.ts kabi
 * boshqa joylardan (LLM'ga context tayyorlash uchun) qayta ishlatiladi.
 */
export async function retrieveChunks(
  query: string,
  matchCount = 5
): Promise<{ chunks: RetrievedChunk[]; demo: boolean }> {
  if (!hasRealCredentials()) {
    return { chunks: mockRetrieveChunks(query, matchCount), demo: true };
  }

  const queryEmbedding = await embedQuery(query);
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("match_documents", {
    query_embedding: queryEmbedding,
    match_count: matchCount,
  });

  if (error) {
    throw new Error(`Supabase qidiruv xatosi: ${error.message}`);
  }

  return { chunks: (data ?? []) as RetrievedChunk[], demo: false };
}

/**
 * To'liq RAG quvuri: savol -> embedding -> Supabase'dan qidiruv -> grounded LLM javob.
 * Bu funksiya faqat server tarafida (API route yoki script) chaqiriladi.
 *
 * Agar .env'da haqiqiy API kalitlar bo'lmasa, avtomatik ravishda DEMO rejimga
 * o'tadi (lib/mock.ts) — shu bilan butun oqim (Client -> Server -> "AI") kalitlarsiz
 * ham sinaladi. Kalitlarni to'ldirgach, kodni o'zgartirmasdan real rejimga o'tadi.
 */
export async function answerWithRag(
  question: string,
  matchCount = 5,
  lang: Lang = "en"
): Promise<RagResult> {
  if (!hasRealCredentials()) {
    return { ...mockAnswerWithRag(question, matchCount, lang), demo: true };
  }

  const { chunks } = await retrieveChunks(question, matchCount);
  const { answer, model } = await generateGroundedAnswer(question, chunks, lang);

  return { answer, sources: chunks, model };
}
