import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/auth-guard";
import { parseDocumentToText } from "@/lib/document-parse";
import { extractIngredientsFromText } from "@/lib/extract-llm";
import { apiError, clientError } from "@/lib/errors";

const MAX_BYTES = 4 * 1024 * 1024; // 4MB — Vercel serverless funksiyalarining qattiq chegarasi (4.5MB) dan past

export async function POST(req: NextRequest) {
  const user = await getAuthedUser();
  if (!user) return clientError("not_authenticated", undefined, 401);

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return clientError("invalid_request");
  }
  if (file.size > MAX_BYTES) {
    return clientError("file_too_large");
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await parseDocumentToText(buffer, file.name);
    if (!text.trim()) {
      return clientError("doc_parse_empty");
    }
    const rows = await extractIngredientsFromText(text);
    return NextResponse.json({ rows });
  } catch (err) {
    return apiError(err, 500);
  }
}
