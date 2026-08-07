import OpenAI from "openai";
import type { RetrievedChunk } from "./rag";
import type { ProductInfo, ProductQuality } from "./wizard-types";
import type { CalcRow } from "./calc";

const MODEL = "gpt-4o";

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY topilmadi (.env faylni tekshiring)");
  }
  return new OpenAI({ apiKey });
}

const SYSTEM_PROMPT = `Sen kosmetika xavfsizligi (CPSR) bo'yicha yordamchisan.
Qat'iy qoidalar:
1. FAQAT quyida berilgan "Kontekst" bo'limidagi ma'lumotdan foydalan.
2. Agar kontekstda javob uchun yetarli ma'lumot bo'lmasa, aniq shuni yoz:
   "Berilgan hujjatlarda bu savolga javob topilmadi." — hech narsani o'ylab topma.
3. Har bir da'voning yonida qaysi manbadan olinganini [manba: <source_name>]
   formatida ko'rsat — bu foydalanuvchiga xulosani tekshirish imkonini beradi.
4. O'zbek tilida, aniq va qisqa javob ber.`;

export type GroundedAnswer = {
  answer: string;
  model: string;
};

export async function generateGroundedAnswer(
  question: string,
  chunks: RetrievedChunk[]
): Promise<GroundedAnswer> {
  const client = getClient();

  const context = chunks
    .map(
      (c, i) =>
        `[${i + 1}] manba: ${c.source_name} (o'xshashlik: ${c.similarity.toFixed(2)})\n${c.content}`
    )
    .join("\n\n---\n\n");

  const userMessage = `Kontekst:\n${context || "(hech narsa topilmadi)"}\n\nSavol: ${question}`;

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  return {
    answer: response.choices[0]?.message?.content ?? "",
    model: MODEL,
  };
}

// ---- CPSR Part A / Part B qoralama yozuvchi (report.ts orqali chaqiriladi) ----

const CPSR_DRAFT_SYSTEM_PROMPT = `Sen CPSR (화장품 안전성 평가 자료) hujjatining FAQAT ikki bo'limini yozasan:
- Part A: mahsulot, tarkib, HAMDA fizik-kimyoviy/mikrobiologiya/qadoqlash xususiyatlari
  haqida OBYEKTIV TAVSIF matni (berilgan ma'lumotlarni tartibli bayon qilish — bu real CPSR
  hujjatining 2-6-bo'limlariga mos: mahsulot, tarkib, fizik-kimyoviy barqarorlik, mikrobiologik
  sifat, ifloslik/qadoqlash)
- Part B "Weight-of-Evidence" MULOHAZA: berilgan MoS/hisob-kitob natijalaridan qanday xulosaga
  yaqinlashish mumkinligi haqidagi muhokama (dalil -> mulohaza yo'li, lekin YAKUNIY QAROR emas)

QAT'IY TAQIQLAR (CPSR_KR_dossier original hujjatidan, so'zma-so'z amal qil):
1. Yakuniy "안전성 결론" (xavfsiz/xavfsiz emas degan tugal xulosa) YOZMA. Bu inson
   (xavfsizlik baholovchisi) vazifasi. Buning o'rniga "검토필요 — 평가자 확인 필요" deb yoz.
2. "SAFE" / "적합" / "xavfsiz" degan tasdiqловчи so'zlarni avtomatik yozma.
3. Baholovchi ismi, imzo, sertifikat raqamini TO'QIMA.
4. Mavjud bo'lmagan test raqami, DOI, sertifikat raqamini O'YLAB TOPMA. Manba yo'q
   bo'lsa "검토필요" deb belgila.
5. Har bir raqamli da'vo (MoS, SED va h.k.) berilgan hisob-kitob natijasidan olinishi
   kerak — o'zing raqam to'qima.
6. Har bir reglament/ilmiy da'voning yonida [manba: <source_name>] ko'rsat, faqat
   pastdagi "Kontekst" bo'limidagi manbalardan foydalanib.
7. Kontekstda yo'q narsani "검토필요" deb qoldir, o'ylab topma.
8. Agar hisob-kitob natijasida biror ingredient yonida "⚠ 제한성분" belgisi
   bo'lsa, buni Part A tavsifida va Part B mulohazasida ALOHIDA, ANIQ ta'kidla —
   bu eng muhim xavfsizlik signali, uni yashirma yoki yumshatma.

Chiqishni ANIQ shu formatda ber (ikkita bo'lim, boshqa hech narsa qo'shma):
### PART A
<matn>

### PART B — WEIGHT OF EVIDENCE
<matn>`;

export type CPSRDraft = {
  partA: string;
  partBReasoning: string;
  model: string;
};

export async function draftCPSRSections(
  productInfo: ProductInfo,
  productQuality: ProductQuality,
  calcRows: CalcRow[],
  context: RetrievedChunk[]
): Promise<CPSRDraft> {
  const client = getClient();

  const contextText = context
    .map((c, i) => `[${i + 1}] manba: ${c.source_name}\n${c.content}`)
    .join("\n\n---\n\n");

  const calcText = calcRows
    .map(
      (r) =>
        `- ${r.inciName || "(nomsiz)"} (CAS ${r.cas || "검토필요"}, ${r.percentInProduct}%): ` +
        `SED=${r.sed.toFixed(6)} mg/kg/gün, NOAEL=${r.noael ?? "검토필요"}, ` +
        `MoS=${r.mos === null ? "검토필요" : r.mos.toFixed(1)}, holat=${r.judgment}` +
        (r.toxSummary ? ` | 독성 프로필: ${r.toxSummary}` : "") +
        (r.restrictedNote ? ` | ⚠ 제한성분: ${r.restrictedNote}` : "")
    )
    .join("\n");

  const userMessage = [
    `Mahsulot ma'lumoti:`,
    `- Nomi: ${productInfo.productName || "검토필요"}`,
    `- Turi: ${productInfo.productType || "검토필요"}`,
    `- Foydalanuvchi: ${productInfo.targetUser || "검토필요"}`,
    `- Qo'llash: ${productInfo.rinseType}`,
    `- Ishlab chiqaruvchi: ${productInfo.manufacturer || "검토필요"}`,
    ``,
    `Fizik-kimyoviy/mikrobiologiya/qadoqlash ma'lumoti (laboratoriya natijasi, foydalanuvchi kiritgan — o'zgartirma, faqat bayon qil):`,
    `- 성상 (ko'rinish): ${productQuality.physicalForm || "검토필요"}`,
    `- pH: ${productQuality.ph || "검토필요"}`,
    `- 점도 (yopishqoqlik): ${productQuality.viscosityRange || "검토필요"}`,
    `- 안정성 시험 (barqarorlik): ${productQuality.stabilityResult || "검토필요"}`,
    `- PAO: ${productQuality.paoMonths ? `${productQuality.paoMonths}개월` : "검토필요"}`,
    `- 미생물한도: ${productQuality.microbialLimitResult || "검토필요"}`,
    `- 보존력 시험: ${productQuality.challengeTestResult || "검토필요"}`,
    `- 중금속 등: ${productQuality.heavyMetalsResult || "검토필요"}`,
    `- 포장재: ${productQuality.packagingMaterial || "검토필요"} (${productQuality.packagingSafetyNote || "검토필요"})`,
    `- 알레르기 성분: ${productQuality.allergenNote || "검토필요"}`,
    ``,
    `Hisob-kitob natijalari (deterministik, sen bularni o'zgartirmaysan):`,
    calcText || "(tarkib kiritilmagan)",
    ``,
    `Kontekst (faqat shundan foydalan):`,
    contextText || "(manba topilmadi — barchasini 검토필요 deb belgila)",
  ].join("\n");

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 1536,
    messages: [
      { role: "system", content: CPSR_DRAFT_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  const full = response.choices[0]?.message?.content ?? "";

  const partAMatch = full.match(/### PART A\s*([\s\S]*?)(?=### PART B|$)/i);
  const partBMatch = full.match(/### PART B.*?\n([\s\S]*)$/i);

  return {
    partA: partAMatch?.[1]?.trim() || full,
    partBReasoning: partBMatch?.[1]?.trim() || "",
    model: MODEL,
  };
}
