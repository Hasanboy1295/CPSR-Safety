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
): Promise<{ status: number; headers: Headers; text: string }> {
  const headers: Record<string, string> = {};
  if (opts.cookie) headers["Cookie"] = opts.cookie;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  return { status: res.status, headers: res.headers, text: await res.text() };
}

async function req(
  supabase: SupabaseClient,
  path: string,
  opts: { method?: string; body?: unknown } = {}
): Promise<{ status: number; headers: Headers; text: string }> {
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
  const anonJson = anon.status === 200 ? JSON.parse(anon.text) : {};
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

  let projectId = "";

  try {
    // 3. Loyiha yaratish
    const createdRes = await req(user, "/api/projects", { method: "POST", body: {} });
    ok(createdRes.status === 200, `POST /api/projects → ${createdRes.status}`);
    projectId = JSON.parse(createdRes.text).id;

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
    const gen = JSON.parse(genRes.text);
    ok(genRes.status === 200, `POST /api/generate-report → ${genRes.status}`);
    ok(gen.saved === true, "qoralama saqlangan (saved=true)");
    ok(gen.minMos === 125, `minMoS=125 (haqiqiy: ${gen.minMos})`);

    // 6. PDF yuklab olish
    const pdfRes = await req(user, `/api/projects/${projectId}/pdf`);
    ok(pdfRes.status === 200, `GET /api/projects/[id]/pdf → ${pdfRes.status}`);
    ok((pdfRes.headers.get("content-type") ?? "").includes("application/pdf"), "PDF content-type");
    if (pdfRes.status === 200) {
      const bytes = Buffer.from(pdfRes.text, "binary");
      const doc = await PDFDocument.load(bytes);
      ok(doc.getPageCount() >= 10, `PDF sahifalari ≥ 10 (haqiqiy: ${doc.getPageCount()})`);
    }

    // 7. Evidence pack (zip)
    const zipRes = await req(user, `/api/projects/${projectId}/evidence-pack`);
    ok(zipRes.status === 200, `GET /api/projects/[id]/evidence-pack → ${zipRes.status}`);
    const zipType = zipRes.headers.get("content-type") ?? "";
    ok(zipType.includes("zip") || zipType.includes("octet-stream"), `ZIP content-type (${zipType})`);

    // 8. Review ma'lumotlari
    const reviewRes = await req(user, `/api/review/${projectId}`);
    ok(reviewRes.status === 200, `GET /api/review/[id] → ${reviewRes.status}`);
    const review = JSON.parse(reviewRes.text);
    const rd = review.report ?? review;
    ok(Array.isArray(rd.calcRows) && rd.calcRows.length === 5, `calcRows=5 (haqiqiy: ${rd.calcRows?.length})`);
    ok(rd.partA && rd.partBReasoning, "partA / partBReasoning mavjud");
    ok(Array.isArray(rd.warnings) && rd.warnings.length >= 0, "warnings mavjud");
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
