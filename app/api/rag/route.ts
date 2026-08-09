import { NextRequest, NextResponse } from "next/server";
import { answerWithRag } from "@/lib/rag";
import { apiError, clientError } from "@/lib/errors";

// Bu — arxitektura diagrammasidagi "Server / API" qatlami:
// OPENAI_API_KEY va SUPABASE_SERVICE_ROLE_KEY faqat shu yerda ishlatiladi,
// Client (brauzer) hech qachon ularni ko'rmaydi.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return clientError("invalid_json");
  }

  const question = (body as { question?: unknown }).question;
  if (typeof question !== "string" || question.trim().length === 0) {
    return clientError("invalid_request");
  }

  try {
    const result = await answerWithRag(question.trim());
    return NextResponse.json(result);
  } catch (err) {
    return apiError(err, 500);
  }
}
