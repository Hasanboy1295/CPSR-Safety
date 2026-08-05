import { getSupabaseServerClient } from "./supabase";
import { embedQuery } from "./embeddings";
import { generateGroundedAnswer } from "./claude";
import { mockAnswerWithRag } from "./mock";

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

/** .env'da 4 ta kalit ham to'ldirilganmi — bo'lmasa demo rejimga o'tamiz. */
function hasRealCredentials(): boolean {
  return Boolean(
    process.env.ANTHROPIC_API_KEY &&
      process.env.VOYAGE_API_KEY &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
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
  matchCount = 5
): Promise<RagResult> {
  if (!hasRealCredentials()) {
    return { ...mockAnswerWithRag(question, matchCount), demo: true };
  }

  const queryEmbedding = await embedQuery(question);

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.rpc("match_documents", {
    query_embedding: queryEmbedding,
    match_count: matchCount,
  });

  if (error) {
    throw new Error(`Supabase qidiruv xatosi: ${error.message}`);
  }

  const chunks = (data ?? []) as RetrievedChunk[];
  const { answer, model } = await generateGroundedAnswer(question, chunks);

  return { answer, sources: chunks, model };
}
