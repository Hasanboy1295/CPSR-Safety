// Voyage AI embedding — Anthropic'ning rasman tavsiya qiladigan embedding provayderi.
// LLM'larning ko'pchiligida (jumladan OpenAI chat modellari) alohida
// embedding endpoint yo'q, shuning uchun matnni vektorga aylantirish uchun
// mustaqil (lekin yaxshi ishlaydigan) servis — Voyage AI — tanlandi.
// https://docs.voyageai.com/reference/embeddings-api

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const MODEL = "voyage-3";

type VoyageResponse = {
  data: { embedding: number[]; index: number }[];
};

async function callVoyage(
  texts: string[],
  inputType: "document" | "query"
): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error("VOYAGE_API_KEY topilmadi (.env faylni tekshiring)");
  }

  const res = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: texts,
      model: MODEL,
      input_type: inputType,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Voyage embedding so'rovi xato: ${res.status} ${body}`);
  }

  const json = (await res.json()) as VoyageResponse;
  return json.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

/** Bilim bazasiga yoziladigan hujjat bo'laklari uchun embedding. */
export async function embedDocuments(chunks: string[]): Promise<number[][]> {
  return callVoyage(chunks, "document");
}

/** Foydalanuvchi savoli uchun embedding (qidiruv vaqtida). */
export async function embedQuery(question: string): Promise<number[]> {
  const [vector] = await callVoyage([question], "query");
  return vector;
}
