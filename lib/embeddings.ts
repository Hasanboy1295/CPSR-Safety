// OpenAI embedding — LLM (GPT-4o) bilan bitta provayderda, alohida Voyage
// kaliti boshqarishga hojat qoldirmaydi. `dimensions: 1024` — Supabase
// jadvalimizdagi `vector(1024)` ustuniga mos kelishi uchun aniq belgilangan
// (text-embedding-3-small'ning tabiiy o'lchami 1536, lekin OpenAI'ning
// Matryoshka qisqartirish parametri orqali 1024'ga tushirib olamiz).
// https://platform.openai.com/docs/guides/embeddings

import OpenAI from "openai";

const MODEL = "text-embedding-3-small";
const DIMENSIONS = 1024;

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY topilmadi (.env faylni tekshiring)");
  }
  return new OpenAI({ apiKey });
}

async function callOpenAIEmbeddings(texts: string[]): Promise<number[][]> {
  const client = getClient();

  const res = await client.embeddings.create({
    model: MODEL,
    input: texts,
    dimensions: DIMENSIONS,
  });

  return res.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

/** Bilim bazasiga yoziladigan hujjat bo'laklari uchun embedding. */
export async function embedDocuments(chunks: string[]): Promise<number[][]> {
  return callOpenAIEmbeddings(chunks);
}

/** Foydalanuvchi savoli uchun embedding (qidiruv vaqtida). */
export async function embedQuery(question: string): Promise<number[]> {
  const [vector] = await callOpenAIEmbeddings([question]);
  return vector;
}
