import { NextRequest, NextResponse } from "next/server";
import { generateCPSRReport } from "@/lib/report";
import type { ProductInfo, IngredientRow, ExposureParams } from "@/lib/wizard-types";

// Bu — diagrammadagi to'liq "real yo'l" endpoint'i: Hisob-kitob + RAG + LLM +
// Data Integrity. API kalitlar shu yerda ishlatiladi, Client ularni ko'rmaydi.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body noto'g'ri" }, { status: 400 });
  }

  const { productInfo, ingredients, exposure } = body as {
    productInfo?: ProductInfo;
    ingredients?: IngredientRow[];
    exposure?: ExposureParams;
  };

  if (!productInfo || !ingredients || !exposure) {
    return NextResponse.json(
      { error: "'productInfo', 'ingredients', 'exposure' maydonlari shart" },
      { status: 400 }
    );
  }

  try {
    const report = await generateCPSRReport({ productInfo, ingredients, exposure });
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Noma'lum xato";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
