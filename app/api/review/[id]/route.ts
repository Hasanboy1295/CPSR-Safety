import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { getSupabaseServerAuthClient } from "@/lib/supabase-server-auth";
import { buildEvidencePack } from "@/lib/evidence-pack";
import { buildCPSRPdf } from "@/lib/pdf-report";
import { uploadArtifact } from "@/lib/storage";
import { apiError, clientError } from "@/lib/errors";
import type { CPSRReportDraft } from "@/lib/report";

/**
 * Assessor tasdiqi (imzo). MUHIM xavfsizlik qoidasi: assessorName Client'dan
 * OLINMAYDI — server o'zi, hozir login qilgan foydalanuvchining haqiqiy
 * ismidan oladi (profiles.full_name). Shuning uchun hech kim "men X assessorman"
 * deb boshqa birovning nomidan imzo qo'ya olmaydi.
 *
 * assessorPosition/assessorQualification esa assessor'ning O'Z malaka
 * ma'lumotlari (PDF'da ko'rsatiladi) — assessor-o'zi kiritadi, qoida bo'yicha
 * CPSR'da baholovchining lavozimi va malakasi yozilishi shart.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const assessor = await requireRole("assessor");
  if (!assessor) return clientError("assessor_only", undefined, 403);

  const { id } = await params;
  const body = (await req.json()) as {
    finalConclusion?: string;
    assessorPosition?: string;
    assessorQualification?: string;
  };
  if (!body.finalConclusion?.trim()) {
    return clientError("invalid_request");
  }

  const supabase = await getSupabaseServerAuthClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", assessor.id)
    .single();

  const certification = {
    assessorName: profile?.full_name ?? assessor.email ?? "assessor",
    assessorPosition: body.assessorPosition?.trim() ?? "",
    assessorQualification: body.assessorQualification?.trim() ?? "",
    reviewDate: new Date().toISOString().slice(0, 10),
    draftNotes: body.finalConclusion,
    selfCertified: true,
  };

  // RLS (projects_assessor_update) bu yozuvni faqat status='draft_generated'
  // bo'lgan loyihalarga cheklaydi — allaqachon imzolangan hujjatni qayta
  // yoza olmaydi.
  const { error } = await supabase
    .from("cpsr_projects")
    .update({
      status: "submission_ready",
      reviewed_by: assessor.id,
      reviewed_at: new Date().toISOString(),
      certification,
    })
    .eq("id", id);

  if (error) return apiError(error, 500);

  // Imzolangandan keyin — yakuniy (imzolangan) PDF+ZIP'ni QAYTA yaratamiz,
  // chunki draft vaqtida saqlangan versiyada hali "not_reviewed" bo'lgan.
  // Eski (draft) versiya storage'da saqlanib qoladi — bu ikkalasi ham
  // audit-trail uchun foydali (qoralama va yakuniy holat ikkalasi ham ko'rinadi).
  try {
    const { data: full } = await supabase
      .from("cpsr_projects")
      .select("product_info, ingredients, product_quality, exposure, report_result")
      .eq("id", id)
      .single();

    if (full?.report_result) {
      const report = full.report_result as CPSRReportDraft;
      const projectData = {
        productInfo: full.product_info,
        ingredients: full.ingredients,
        productQuality: full.product_quality,
        exposure: full.exposure,
        certification,
      };

      const [zipBytes, pdfBytes] = await Promise.all([
        buildEvidencePack(projectData, report),
        buildCPSRPdf(projectData, report),
      ]);

      const signedTag = `signed-${Date.now()}`;
      const [evidencePath, pdfPath] = await Promise.all([
        uploadArtifact(supabase, id, signedTag, "evidence_pack.zip", zipBytes, "application/zip"),
        uploadArtifact(supabase, id, signedTag, "report.pdf", pdfBytes, "application/pdf"),
      ]);

      await supabase
        .from("cpsr_projects")
        .update({ evidence_pack_path: evidencePath, pdf_path: pdfPath })
        .eq("id", id);
    }
  } catch (artifactErr) {
    console.error("Imzolangan artifakt saqlashda xato:", artifactErr);
  }

  return NextResponse.json({ ok: true });
}
