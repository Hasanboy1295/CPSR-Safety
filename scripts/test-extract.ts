// Extract endpointlarini mahalliy repro: xato xabari (error_code + message)
// haqiqiy 500 holatini aniqlash uchun.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
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

const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY!;
const BASE = "http://localhost:3000";
const cookieName = `sb-${SUPA_URL.match(/https:\/\/([^.]+)/)?.[1]}-auth-token`;

function ok(cond: boolean, label: string) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) process.exitCode = 1;
}

async function main() {
  const admin = createClient(SUPA_URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
  const email = `extract-${Date.now()}@example.com`;
  const password = "E2e-test-12345!";
  const { data: created, error: createErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (createErr || !created.user) throw new Error(`createUser: ${createErr?.message}`);

  const user = createClient(SUPA_URL, ANON);
  const { data: signIn, error: signInErr } = await user.auth.signInWithPassword({ email, password });
  if (signInErr || !signIn.session) throw new Error(`signIn: ${signInErr?.message}`);

  const {
    data: { session },
  } = await user.auth.getSession();
  const cookie = `${cookieName}=${encodeURIComponent(JSON.stringify(session))}`;

  const authProbe = await fetch(`${BASE}/api/projects`, { headers: { Cookie: cookie } });
  console.log(`auth probe /api/projects → ${authProbe.status}`);
  console.log(`cookie name: ${cookieName}`);

  async function postFile(path: string, filename: string, text: string, extra?: string) {
    const form = new FormData();
    form.set("file", new Blob([text], { type: "text/plain" }), filename);
    if (extra) form.set("knownComponents", extra);
    const res = await fetch(`${BASE}${path}`, { method: "POST", headers: { Cookie: cookie }, body: form });
    const body = await res.text();
    console.log(`\n${path} (${filename}) → ${res.status}`);
    console.log(body.slice(0, 600));
    return res.status;
  }

  const bom = `제품: Example Serum
순번	원료명	INCI	CAS	원료중%	제품중%
1	정제수	AQUA	7732-18-5	100	90.80
2	글리세린	GLYCERIN	56-81-5	100	5.00
3	트리에틸시트레이트	TRIETHYL CITRATE	77-93-0	100	2.00
4	하이드록시에틸셀룰로오스	HYDROXYETHYLCELLULOSE	9004-62-0	100	0.80
5	나이아신아마이드	NIACINAMIDE	98-92-0	100	1.00
6	판테놀	PANTHENOL	81-13-0	100	0.40`;

  const tox = `COA — TRIETHYL CITRATE
CAS: 77-93-0
NOAEL: 2500 mg/kg/day (dermal, rat)
Acute oral LD50: 7000 mg/kg
Skin irritation: non-irritant
Eye irritation: non-irritant
Genotoxicity: negative (AMES test)
Carcinogenicity: no evidence`;

  const s1 = await postFile("/api/extract/ingredients", "bom.xlsx", bom);
  const s2 = await postFile("/api/extract/toxicology", "coa.pdf", tox, JSON.stringify([{ inciName: "TRIETHYL CITRATE", cas: "77-93-0" }]));
  const s3 = await postFile("/api/extract/product-quality", "spec.txt", tox);

  ok(s1 === 200, "ingredients → 200");
  ok(s2 === 200, "toxicology → 200");
  ok(s3 === 200, "product-quality → 200");

  await admin.auth.admin.deleteUser(created.user.id);
}

main().catch((e) => {
  console.error("SCRIPT ERROR:", e);
  process.exit(1);
});
