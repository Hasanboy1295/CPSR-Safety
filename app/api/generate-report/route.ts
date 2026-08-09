import { NextRequest, NextResponse } from "next/server";
import { generateCPSRReport } from "@/lib/report";
import { getAuthedUser } from "@/lib/auth-guard";
import { getSupabaseServerAuthClient } from "@/lib/supabase-server-auth";
import { buildEvidencePack } from "@/lib/evidence-pack";
import { buildCPSRPdf } from "@/lib/pdf-report";
import { uploadArtifact } from "@/lib/storage";
import { apiError, clientError } from "@/lib/errors";
import type { ProductInfo, IngredientRow, ExposureParams, ProductQuality, WizardData } from "@/lib/wizard-types";
import { emptyProductQuality } from "@/lib/wizard-types";

// Bu — diagrammadagi to'liq "real yo'l" endpoint'i: Hisob-kitob + RAG + LLM +
// Data Integrity. API kalitlar shu yerda ishlatiladi, Client ularni ko'rmaydi.
// XAVFSIZLIK: report_result + status='draft_generated' FAQAT shu yerda (server
// tomonida) yoziladi. Mijoz /api/projects/[id] PUT orqali o'z status'ini yoki
// "AI natijasi"ni yozib bo'lmaydi — soxta qoralama yuborish oldi olinadi.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return clientError("invalid_json");
  }

  const { projectId, productInfo, ingredients, productQuality, exposure } = body as {
    projectId?: string;
    productInfo?: ProductInfo;
    ingredients?: IngredientRow[];
    productQuality?: ProductQuality;
    exposure?: ExposureParams;
  };

  if (!productInfo || !ingredients || !exposure) {
    return clientError("invalid_request");
  }

  let supabase: Awaited<ReturnType<typeof getSupabaseServerAuthClient>> | null = null;
  if (projectId) {
    const user = await getAuthedUser();
    if (!user) return clientError("not_authenticated", undefined, 401);
    supabase = await getSupabaseServerAuthClient();
    const { data: owner } = await supabase
      .from("cpsr_projects")
      .select("id")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!owner) return clientError("not_found", undefined, 404);
  }

  try {
    const report = await generateCPSRReport({
      productInfo,
      ingredients,
      productQuality: productQuality ?? emptyProductQuality(),
      exposure,
    });

    let saved = false;
    if (projectId && supabase) {
      const { error } = await supabase
        .from("cpsr_projects")
        .update({
          report_result: report,
          status: "draft_generated",
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId);
      if (error) throw error;
      saved = true;

      // Qoralama birinchi marta yaratilganda — ZIP va PDF'ni BIR MARTA yasab,
      // doimiy saqlaymiz (ALCOA+ "Enduring"). Keyin hech qachon qayta yozilmaydi.
      try {
        const { data: full } = await supabase
          .from("cpsr_projects")
          .select("product_info, ingredients, product_quality, exposure, certification")
          .eq("id", projectId)
          .single();

        if (full) {
          const projectData: Pick<WizardData, "productInfo" | "ingredients" | "productQuality" | "exposure" | "certification"> = {
            productInfo: full.product_info,
            ingredients: full.ingredients,
            productQuality: full.product_quality,
            exposure: full.exposure,
            certification: full.certification,
          };

          const [zipBytes, pdfBytes] = await Promise.all([
            buildEvidencePack(projectData, report),
            buildCPSRPdf(projectData, report),
          ]);

          const runId = report.integrity.runId;
          const [evidencePath, pdfPath] = await Promise.all([
            uploadArtifact(supabase, projectId, runId, "evidence_pack.zip", zipBytes, "application/zip"),
            uploadArtifact(supabase, projectId, runId, "report.pdf", pdfBytes, "application/pdf"),
          ]);

          await supabase
            .from("cpsr_projects")
            .update({ evidence_pack_path: evidencePath, pdf_path: pdfPath })
            .eq("id", projectId);
        }
      } catch (artifactErr) {
        console.error("Artifact saqlashda xato:", artifactErr);
      }
    }

    return NextResponse.json({ ...report, saved, projectId });
  } catch (err) {
    return apiError(err, 500);
  }
}
