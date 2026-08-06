import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/auth-guard";
import { getSupabaseServerAuthClient } from "@/lib/supabase-server-auth";
import { buildEvidencePack } from "@/lib/evidence-pack";
import { buildCPSRPdf } from "@/lib/pdf-report";
import { uploadArtifact } from "@/lib/storage";
import type { WizardData } from "@/lib/wizard-types";
import type { CPSRReportDraft } from "@/lib/report";

// E'tibor: RLS (supabase/auth_schema.sql) bu yerdagi so'rovlarni ham qo'shimcha
// himoya qiladi — hatto kod xato yozilgan taqdirda ham, boshqa foydalanuvchining
// loyihasini o'qib/yozib bo'lmaydi. Bu "juda mahkam security" — ikki qatlam.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const supabase = await getSupabaseServerAuthClient();
  const { data, error } = await supabase
    .from("cpsr_projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ project: data });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // Faqat ruxsat etilgan maydonlar yangilanadi — user o'zining status'ini
  // to'g'ridan-to'g'ri "submission_ready" qila olmaydi (bu assessor ishi,
  // /api/review orqali).
  const allowed = ["product_info", "ingredients", "exposure", "certification", "report_result", "status"];
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }
  if (patch.status === "submission_ready") {
    delete patch.status;
  }

  const supabase = await getSupabaseServerAuthClient();
  const { error } = await supabase.from("cpsr_projects").update(patch).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Qoralama birinchi marta yaratilganda — ZIP va PDF'ni BIR MARTA yasab,
  // doimiy saqlaymiz (ALCOA+ "Enduring"). Bu yerdan keyin hech qachon qayta
  // yozilmaydi, shuning uchun keyinchalik hisob-kitob kodi o'zgarsa ham
  // saqlangan dalil o'zgarmay qoladi.
  if (patch.status === "draft_generated" && patch.report_result) {
    try {
      const { data: full } = await supabase
        .from("cpsr_projects")
        .select("product_info, ingredients, exposure, certification")
        .eq("id", id)
        .single();

      if (full) {
        const report = patch.report_result as CPSRReportDraft;
        const projectData: Pick<WizardData, "productInfo" | "ingredients" | "exposure" | "certification"> = {
          productInfo: full.product_info,
          ingredients: full.ingredients,
          exposure: full.exposure,
          certification: full.certification,
        };

        const [zipBytes, pdfBytes] = await Promise.all([
          buildEvidencePack(projectData, report),
          buildCPSRPdf(projectData, report),
        ]);

        const runId = report.integrity.runId;
        const [evidencePath, pdfPath] = await Promise.all([
          uploadArtifact(supabase, id, runId, "evidence_pack.zip", zipBytes, "application/zip"),
          uploadArtifact(supabase, id, runId, "report.pdf", pdfBytes, "application/pdf"),
        ]);

        await supabase
          .from("cpsr_projects")
          .update({ evidence_pack_path: evidencePath, pdf_path: pdfPath })
          .eq("id", id);
      }
    } catch (artifactErr) {
      // Asosiy saqlash muvaffaqiyatli bo'lgan, faqat artifakt saqlashda xato —
      // foydalanuvchiga bloklovchi xato qaytarmaymiz, faqat log qilamiz.
      // (Download endpoint baribir fallback sifatida on-the-fly yasab beradi.)
      console.error("Artifact saqlashda xato:", artifactErr);
    }
  }

  return NextResponse.json({ ok: true });
}
