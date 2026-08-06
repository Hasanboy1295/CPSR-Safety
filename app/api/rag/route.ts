import { NextRequest, NextResponse } from "next/server";
import { answerWithRag } from "@/lib/rag";

// Bu — arxitektura diagrammasidagi "Server / API" qatlami:
// OPENAI_API_KEY va SUPABASE_SERVICE_ROLE_KEY faqat shu yerda ishlatiladi,
// Client (brauzer) hech qachon ularni ko'rmaydi.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body noto'g'ri" }, { status: 400 });
  }

  const question = (body as { question?: unknown }).question;
  if (typeof question !== "string" || question.trim().length === 0) {
    return NextResponse.json(
      { error: "'question' maydoni (matn) shart" },
      { status: 400 }
    );
  }

  try {
    const result = await answerWithRag(question.trim());
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Noma'lum xato";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
