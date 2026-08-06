import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { getSupabaseServerAuthClient } from "@/lib/supabase-server-auth";
import { buildEvidencePack } from "@/lib/evidence-pack";
import { buildCPSRPdf } from "@/lib/pdf-report";
import { uploadArtifact } from "@/lib/storage";
import type { CPSRReportDraft } from "@/lib/report";

/**
 * Assessor tasdiqi (imzo). MUHIM xavfsizlik qoidasi: assessorName Client'dan
 * OLINMAYDI — server o'zi, hozir login qilgan foydalanuvchining haqiqiy
 * ismidan oladi (profiles.full_name). Shuning uchun hech kim "men X assessorman"
 * deb boshqa birovning nomidan imzo qo'ya olmaydi.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const assessor = await requireRole("assessor");
  if (!assessor) return NextResponse.json({ error: "Assessor access only" }, { status: 403 });

  const { id } = await params;
  const body = (await req.json()) as { finalConclusion?: string };
  if (!body.finalConclusion?.trim()) {
    return NextResponse.json({ error: "'finalConclusion' shart" }, { status: 400 });
  }

  const supabase = await getSupabaseServerAuthClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", assessor.id)
    .single();

  const certification = {
    assessorName: profile?.full_name ?? assessor.email ?? "assessor",
    assessorPosition: "",
    assessorQualification: "",
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Imzolangandan keyin — yakuniy (imzolangan) PDF+ZIP'ni QAYTA yaratamiz,
  // chunki draft vaqtida saqlangan versiyada hali "not_reviewed" bo'lgan.
  // Eski (draft) versiya storage'da saqlanib qoladi — bu ikkalasi ham
  // audit-trail uchun foydali (qoralama va yakuniy holat ikkalasi ham ko'rinadi).
  try {
    const { data: full } = await supabase
      .from("cpsr_projects")
      .select("product_info, ingredients, exposure, report_result")
      .eq("id", id)
      .single();

    if (full?.report_result) {
      const report = full.report_result as CPSRReportDraft;
      const projectData = {
        productInfo: full.product_info,
        ingredients: full.ingredients,
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
