import Anthropic from "@anthropic-ai/sdk";
import type { RetrievedChunk } from "./rag";

const MODEL = "claude-sonnet-4-5";

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY topilmadi (.env faylni tekshiring)");
  }
  return new Anthropic({ apiKey });
}

const SYSTEM_PROMPT = `Sen kosmetika xavfsizligi (CPSR) bo'yicha yordamchisan.
Qat'iy qoidalar:
1. FAQAT quyida berilgan "Kontekst" bo'limidagi ma'lumotdan foydalan.
2. Agar kontekstda javob uchun yetarli ma'lumot bo'lmasa, aniq shuni yoz:
   "Berilgan hujjatlarda bu savolga javob topilmadi." — hech narsani o'ylab topma.
3. Har bir da'voning yonida qaysi manbadan olinganini [manba: <source_name>]
   formatida ko'rsat — bu foydalanuvchiga xulosani tekshirish imkonini beradi.
4. O'zbek tilida, aniq va qisqa javob ber.`;

export type GroundedAnswer = {
  answer: string;
  model: string;
};

export async function generateGroundedAnswer(
  question: string,
  chunks: RetrievedChunk[]
): Promise<GroundedAnswer> {
  const client = getClient();

  const context = chunks
    .map(
      (c, i) =>
        `[${i + 1}] manba: ${c.source_name} (o'xshashlik: ${c.similarity.toFixed(2)})\n${c.content}`
    )
    .join("\n\n---\n\n");

  const userMessage = `Kontekst:\n${context || "(hech narsa topilmadi)"}\n\nSavol: ${question}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return {
    answer: textBlock && textBlock.type === "text" ? textBlock.text : "",
    model: MODEL,
  };
}
