// Hujjatdan (BOM varaqasi yoki CoA/toksikologiya hujjati) tuzilgan
// ma'lumotni LLM yordamida chiqarib olish. Bu — wizard formalarini
// qo'lda emas, hujjat yuklab avtomatik to'ldirish imkonini beradi.
//
// MUHIM: LLM bu yerda faqat "o'qish/tuzilishga solish" vazifasini
// bajaradi — u hech qanday xavfsizlik xulosasi yozmaydi, faqat
// hujjatda YOZILGAN raqam/matnni JSON'ga ko'chiradi. Agar biror
// maydon hujjatda topilmasa, uni bo'sh qoldirishi SHART (o'ylab
// topmaydi) — bu report.ts'dagi qat'iy qoidaning davomi.

import OpenAI from "openai";
import { randomUUID } from "crypto";
import type { IngredientRow, ToxEndpointStatus, ProductQuality } from "./wizard-types";

const MODEL = "gpt-4o";

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY topilmadi (.env faylni tekshiring)");
  return new OpenAI({ apiKey });
}

const INGREDIENT_EXTRACT_PROMPT = `Senga kosmetika formulasi (BOM — Bill of Materials) hujjatidan
chiqarilgan xom tekst beriladi (Excel varag'i yoki PDF processano dan). Vazifang: shu tekstni
quyidagi JSON tuzilishiga solish:

{
  "rows": [
    {
      "tradeName": "xomashyoning savdo nomi (agar bo'lmasa INCI nomi bilan bir xil)",
      "percentInProduct": "shu xomashyoning mahsulotdagi % (raqam, matn sifatida)",
      "components": [
        { "inciName": "INCI nomi", "cas": "CAS raqami (bo'lmasa bo'sh)", "percentActiveInRaw": "100 (agar xomashyo bitta INCI dan iborat bo'lsa) yoki xomashyo ichidagi ulush %", "functionRole": "vazifasi (masalan: emulsifikator, konservant) — bo'lmasa bo'sh" }
      ]
    }
  ]
}

QOIDALAR:
- Faqat tekstda BOR ma'lumotni ko'chir. Yo'q maydonni bo'sh string "" qil, HECH NARSA O'YLAB TOPMA.
- Har bir jadval qatori — bitta xomashyo (bitta "rows" elementi).
- Agar bitta xomashyoda bir nechta INCI/komponent aniq ko'rsatilgan bo'lsa (masalan "A va B aralashmasi"), ularni components ichida alohida ber.
- Foiz belgisi (%) ni raqamdan olib tashla, faqat son qoldir (masalan "4%" -> "4").
- Faqat JSON qaytar, boshqa hech narsa yozma.`;

export async function extractIngredientsFromText(rawText: string): Promise<IngredientRow[]> {
  const client = getClient();
  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 2048,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: INGREDIENT_EXTRACT_PROMPT },
      { role: "user", content: rawText.slice(0, 20000) },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  let parsed: { rows?: Array<{ tradeName?: string; percentInProduct?: string; components?: Array<{ inciName?: string; cas?: string; percentActiveInRaw?: string; functionRole?: string }> }> };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  return (parsed.rows ?? []).map((row) => ({
    id: randomUUID(),
    tradeName: row.tradeName ?? "",
    percentInProduct: row.percentInProduct ?? "",
    components: (row.components ?? []).map((c) => ({
      id: randomUUID(),
      inciName: c.inciName ?? "",
      cas: c.cas ?? "",
      percentActiveInRaw: c.percentActiveInRaw || "100",
      functionRole: c.functionRole ?? "",
      dermalAbsorptionPercent: "100",
      noael: "",
      cramerClass: "" as const,
      tox: {
        acuteToxicity: "unknown",
        skinIrritation: "unknown",
        eyeIrritation: "unknown",
        skinSensitization: "unknown",
        genotoxicity: "unknown",
        carcinogenicity: "unknown",
        reproductiveToxicity: "unknown",
        phototoxicity: "unknown",
        notes: "",
      },
    })),
  }));
}

// ---- Toksikologiya/CoA hujjatidan mavjud INCI komponentlarga mos ma'lumot chiqarish ----

export type ToxExtractUpdate = {
  cas: string;
  inciName: string;
  noael?: string;
  tox?: Partial<Record<Exclude<keyof import("./wizard-types").ToxicologyProfile, "notes">, ToxEndpointStatus>>;
  notes?: string;
};

export async function extractToxicologyFromText(
  rawText: string,
  knownComponents: { inciName: string; cas: string }[]
): Promise<ToxExtractUpdate[]> {
  const client = getClient();

  const componentList = knownComponents
    .map((c) => `- ${c.inciName || "(nomsiz)"} (CAS: ${c.cas || "yo'q"})`)
    .join("\n");

  const systemPrompt = `Senga toksikologiya/CoA/mahsulot spetsifikatsiyasi hujjatidan chiqarilgan
xom tekst beriladi. Loyihada allaqachon quyidagi INCI komponentlar ro'yxatga olingan:
${componentList || "(hozircha bo'sh)"}

Vazifang: hujjat matnidan shu komponentlarga tegishli ma'lumotni topib, JSON qaytarish:
{
  "updates": [
    {
      "cas": "komponentning CAS raqami (yuqoridagi ro'yxatdan, aniq mos kelishi kerak)",
      "inciName": "komponentning INCI nomi",
      "noael": "topilgan NOAEL qiymati mg/kg/day (bo'lmasa bo'sh)",
      "tox": { "acuteToxicity": "available yoki not_available (faqat hujjatda aniq aytilgan bo'lsa)" },
      "notes": "manba/izoh, masalan hujjat nomi yoki sana"
    }
  ]
}

QOIDALAR:
- Faqat yuqoridagi ro'yxatdagi komponentlar uchun natija ber — yangi komponent QO'SHMA.
- Faqat hujjatda ANIQ yozilgan ma'lumotni ko'chir, hech narsa o'ylab topma.
- tox ichidagi maydonlarni faqat hujjatda aniq mavjud/mavjud emas deb aytilgan bo'lsa to'ldir, aks holda umuman qo'shma.
- Faqat JSON qaytar.`;

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 2048,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: rawText.slice(0, 20000) },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(raw) as { updates?: ToxExtractUpdate[] };
    return parsed.updates ?? [];
  } catch {
    return [];
  }
}

// ---- Mahsulot sifat hujjatidan (spec/CoA/barqarorlik hisoboti) maydonlarni chiqarish ----

const PRODUCT_QUALITY_EXTRACT_PROMPT = `Senga mahsulot spetsifikatsiyasi, CoA yoki barqarorlik/mikrobiologiya
sinov hisobotidan chiqarilgan xom tekst beriladi. Vazifang: shu tekstdan quyidagi
JSON maydonlarini to'ldirish:

{
  "physicalForm": "mahsulotning tashqi ko'rinishi (masalan: 반투명한 백색의 에멀젼)",
  "ph": "pH qiymati",
  "viscosityRange": "yopishqoqlik diapazoni (cPs)",
  "stabilityResult": "barqarorlik sinovi natijasi (uzoq muddatli/tezlashtirilgan)",
  "paoMonths": "ochilgandan keyingi ishlatish muddati, faqat son (oy)",
  "microbialLimitResult": "mikroblar chegarasi sinovi natijasi",
  "challengeTestResult": "saqlanuvchanlik (challenge) sinovi natijasi",
  "heavyMetalsResult": "og'ir metall (Pb/As/Hg/Sb/Cd) natijasi",
  "packagingMaterial": "birlamchi idish materiali",
  "packagingSafetyNote": "idish moslik/migratsiya sinovi natijasi",
  "allergenNote": "atir tarkibidagi allergen tekshiruvi natijasi"
}

QOIDALAR: faqat tekstda ANIQ mavjud ma'lumotni ko'chir, yo'q maydonni bo'sh string "" qil, hech narsa o'ylab topma. Faqat JSON qaytar.`;

export async function extractProductQualityFromText(rawText: string): Promise<Partial<ProductQuality>> {
  const client = getClient();
  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 1024,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: PRODUCT_QUALITY_EXTRACT_PROMPT },
      { role: "user", content: rawText.slice(0, 20000) },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  try {
    return JSON.parse(raw) as Partial<ProductQuality>;
  } catch {
    return {};
  }
}
