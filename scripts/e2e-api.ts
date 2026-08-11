// E2E smole test — haqiqiy Supabase + Next dev server orqali to'liq yo'lni
// tekshiradi: auth → loyiha yaratish → ma'lumot saqlash → CPSR qoralama +
// PDF + evidence pack → yuklab olish. Avval dev serverni ishga tushiring:
//   npm run dev
// Keyin:
//   npm run e2e
// Vaqtinchalik test foydalanuvchisi yaratiladi va oxirida o'chiriladi.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
import { sampleProductWizard } from "./sample-data";
import "@/lib/server-websocket";

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const env = loadEnv();
const BASE = process.env.E2E_BASE ?? "http://localhost:3000";

const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPA_URL) {
  console.error("NEXT_PUBLIC_SUPABASE_URL .env da yo'q — e2e ishlamaydi.");
  process.exit(1);
}

const projectRef = new URL(SUPA_URL).hostname.split(".")[0];
const cookieName = `sb-${projectRef}-auth-token`;

let failed = 0;
function ok(cond: boolean, label: string) {
  console.log(`${cond ? "✓" : "✗"} ${label}`);
  if (!cond) failed += 1;
}

async function rawReq(
  path: string,
  opts: { method?: string; body?: unknown; cookie?: string } = {}
): Promise<{ status: number; headers: Headers; buf: Buffer }> {
  const headers: Record<string, string> = {};
  if (opts.cookie) headers["Cookie"] = opts.cookie;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, headers: res.headers, buf };
}

async function req(
  supabase: SupabaseClient,
  path: string,
  opts: { method?: string; body?: unknown } = {}
): Promise<{ status: number; headers: Headers; buf: Buffer }> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return rawReq(path, { ...opts, cookie: session ? `${cookieName}=${encodeURIComponent(JSON.stringify(session))}` : undefined });
}

async function main() {
  const genBody = {
    productInfo: sampleProductWizard.productInfo,
    ingredients: sampleProductWizard.ingredients,
    productQuality: sampleProductWizard.productQuality,
    exposure: sampleProductWizard.exposure,
    lang: "ko",
  };

  // ============ A. Anonim yo'l (auth shart emas) ============
  console.log("— Anonim: POST /api/generate-report (projectId yo'q) —");
  const anon = await rawReq("/api/generate-report", { method: "POST", body: genBody });
  const anonJson = anon.status === 200 ? JSON.parse(anon.buf.toString("utf8")) : {};
  ok(anon.status === 200, `generate-report (anon) → ${anon.status}`);
  ok(anonJson.minMos === 125, `minMoS=125 (haqiqiy: ${anonJson.minMos})`);
  ok(Array.isArray(anonJson.calcRows) && anonJson.calcRows.length === 5, `calcRows=5 (haqiqiy: ${anonJson.calcRows?.length})`);

  // ============ B. Autentifikatsiyalangan yo'l ============
  if (!ANON || !SERVICE) {
    console.log("\n⚠️  NEXT_PUBLIC_SUPABASE_ANON_KEY / SERVICE_ROLE .env da yo'q —");
    console.log("    auth yo'l (loyiha saqlash + PDF download) tekshirilmadi.");
    process.exit(failed === 0 ? 0 : 1);
  }

  const admin = createClient(SUPA_URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });

  // 1. Vaqtinchalik foydalanuvchi
  const email = `e2e-${Date.now()}@example.com`;
  const password = "E2e-test-12345!";
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) throw new Error(`createUser: ${createErr?.message}`);

  // 2. Sessiya
  const user = createClient(SUPA_URL, ANON);
  const { data: signIn, error: signInErr } = await user.auth.signInWithPassword({ email, password });
  if (signInErr || !signIn.session) throw new Error(`signIn: ${signInErr?.message}`);

  // Assessor oqimini sinash uchun test foydalanuvchiga "assessor" roli beriladi
  // (e2e test uchun — haqiqiy oqimda rol faqat admin tomonidan beriladi).
  const { error: profErr } = await admin.from("profiles").upsert({
    id: created.user.id,
    role: "assessor",
    full_name: "E2E Assessor",
    company: "E2E Company",
  });
  if (profErr) throw new Error(`profile upsert: ${profErr.message}`);

  let projectId = "";

  try {
    // 3. Loyiha yaratish
    const createdRes = await req(user, "/api/projects", { method: "POST", body: {} });
    ok(createdRes.status === 200, `POST /api/projects → ${createdRes.status}`);
    projectId = JSON.parse(createdRes.buf.toString("utf8")).id;

    // 4. Namuna ma'lumotni saqlash
    const putRes = await req(user, `/api/projects/${projectId}`, {
      method: "PUT",
      body: {
        product_info: sampleProductWizard.productInfo,
        ingredients: sampleProductWizard.ingredients,
        product_quality: sampleProductWizard.productQuality,
        exposure: sampleProductWizard.exposure,
        certification: sampleProductWizard.certification,
      },
    });
    ok(putRes.status === 200, `PUT /api/projects/[id] → ${putRes.status}`);

    // 5. CPSR qoralama yaratish (real yo'l: hisob + RAG + LLM + integrity)
    const genRes = await req(user, "/api/generate-report", {
      method: "POST",
      body: { projectId, ...genBody },
    });
    const gen = JSON.parse(genRes.buf.toString("utf8"));
    ok(genRes.status === 200, `POST /api/generate-report → ${genRes.status}`);
    ok(gen.saved === true, "qoralama saqlangan (saved=true)");
    ok(gen.minMos === 125, `minMoS=125 (haqiqiy: ${gen.minMos})`);

    // 6. PDF yuklab olish
    const pdfRes = await req(user, `/api/projects/${projectId}/pdf`);
    ok(pdfRes.status === 200, `GET /api/projects/[id]/pdf → ${pdfRes.status}`);
    ok((pdfRes.headers.get("content-type") ?? "").includes("application/pdf"), "PDF content-type");
    if (pdfRes.status === 200) {
      const bytes = pdfRes.buf;
      const doc = await PDFDocument.load(bytes);
      ok(doc.getPageCount() >= 10, `PDF sahifalari ≥ 10 (haqiqiy: ${doc.getPageCount()})`);
    }

    // 7. Evidence pack (zip)
    const zipRes = await req(user, `/api/projects/${projectId}/evidence-pack`);
    ok(zipRes.status === 200, `GET /api/projects/[id]/evidence-pack → ${zipRes.status}`);
    const zipType = zipRes.headers.get("content-type") ?? "";
    ok(zipType.includes("zip") || zipType.includes("octet-stream"), `ZIP content-type (${zipType})`);

    // 8. Assessor tasdiqi (imzo) — PUT /api/review/[id]
    const reviewPut = await req(user, `/api/review/${projectId}`, {
      method: "PUT",
      body: {
        finalConclusion: "E2E sinovi: mahsulot xavfsiz, MoS>=100 tasdiqlandi.",
        assessorPosition: "안전성 평가자 (E2E)",
        assessorQualification: "E2E-DEGREE",
      },
    });
    ok(reviewPut.status === 200, `PUT /api/review/[id] (imzo) → ${reviewPut.status}`);

    // 9. Loyiha holati: draft_generated → submission_ready + certification
    const projRes = await req(user, `/api/projects/${projectId}`);
    ok(projRes.status === 200, `GET /api/projects/[id] → ${projRes.status}`);
    const proj = JSON.parse(projRes.buf.toString("utf8")).project;
    const rd = proj.report_result ?? {};
    ok(proj.status === "submission_ready", `status=submission_ready (haqiqiy: ${proj.status})`);
    ok(proj.certification?.selfCertified === true, "certification.selfCertified=true");
    ok(proj.certification?.assessorName === "E2E Assessor", `assessorName (haqiqiy: ${proj.certification?.assessorName})`);
    ok(Array.isArray(rd.calcRows) && rd.calcRows.length === 5, `calcRows=5 (haqiqiy: ${rd.calcRows?.length})`);
    ok(rd.partA && rd.partBReasoning, "partA / partBReasoning mavjud");
    ok(Array.isArray(rd.warnings) && rd.warnings.length >= 0, "warnings mavjud");

    // 10. Imzolangan PDF — sarlavhada submission_ready belgisi chiqishi kerak
    const signedPdf = await req(user, `/api/projects/${projectId}/pdf`);
    ok(signedPdf.status === 200, `GET PDF (imzolangan) → ${signedPdf.status}`);
    if (signedPdf.status === 200) {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(signedPdf.buf) });
      try {
        const { text } = await parser.getText();
        ok(text.includes("submission_ready"), "PDF footerdagi status: submission_ready");
        ok(text.includes("E2E Assessor"), "PDFda assessor nomi ko'rsatilgan");
      } finally {
        await parser.destroy();
      }
    }
  } catch (err) {
    failed += 1;
    console.error("E2E xatosi:", err);
  } finally {
    // 9. Tozalash
    if (projectId) await admin.from("cpsr_projects").delete().eq("id", projectId);
    await admin.auth.admin.deleteUser(created.user.id);
  }

  console.log(failed === 0 ? "\nE2E: hammasi OK ✅" : `\nE2E: ${failed} ta xato ❌`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
