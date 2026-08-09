// Deterministik SED/MoS hisob-kitobi — CPSR_KR_dossier'dagi haqiqiy formulaga
// aslangan. Bu yerda LLM YO'Q — sof matematika.
//
// SED (mg/kg bw/day) = (A[g/day] x 1000 x RF x C x DAp) / BW[kg]
// MoS = NOAEL[mg/kg bw/day] / SED
//
// MO'S CHEGARASI — KITOB ASOSIDA (≥100):
// CPSR_KR_dossier_v7_3 da chegara izchil "MoS ≥ 100" deb yozilgan:
//   - §2.1.7 SED/MoS formulasi: "MoS = NOAEL / SED (≥100 이면 충족)"
//   - "계산상 5성분 모두 MoS≥100 (최저 RETINOL 125)" — minimal mezon MoS 100
//   - 부록 D: 식약처 「화장품 위해평가 가이드라인」- "MoS ≥ 100"
// EU 참고 CPSR namunalari (21512.pdf, veneks-safety_report.pdf) esa so'zma-so'z
// "MoS is >100" / "must be greater than 100" deb yozadi. Farq faqat aynan
// MoS = 100.0000 da amal qiladi; asosiy me'yor 100 — shuning uchun KR konteksti
// uchun kitobning "≥ 100" qoidasi ishlatiladi (konservativroq yo'l emas, balki
// asosiy standart). NOAEL manbasi/ishonchliligi tasdiqlanmaguncha PASS
// qo'yilmasligi (§2.1.7: "근거 확보 전 PASS를 부여하지 않는다") alohida kodda
// qo'llaniladi — bu yerda faqat deterministik chegara.

export type ExposureParams = {
  amountG: number; // A — kuniga qo'llanadigan miqdor (g/day)
  retentionFactor: number; // RF — leave-on=1.0, rinse-off odatda 0.01
  bodyWeightKg: number; // BW
};

export function calcSED(
  exposure: ExposureParams,
  concentrationPercent: number, // C — mahsulotdagi % (masalan 0.05)
  dermalAbsorptionPercent: number // DAp — teri orqali so'rilish %, konservativ 100
): number {
  const C = concentrationPercent / 100;
  const DAp = dermalAbsorptionPercent / 100;
  return (
    (exposure.amountG * 1000 * exposure.retentionFactor * C * DAp) /
    exposure.bodyWeightKg
  );
}

export function calcMoS(noaelMgKgDay: number | undefined, sed: number): number | null {
  if (noaelMgKgDay === undefined || noaelMgKgDay <= 0 || sed <= 0) return null;
  return noaelMgKgDay / sed;
}

export type Judgment = "pass" | "review" | "insufficient";

/** Minimal MoS me'yori — kitob: "MoS ≥ 100" (CPSR_KR_dossier_v7_3 §2.1.7). */
export const MIN_MOS = 100;

export function judge(mos: number | null): Judgment {
  if (mos === null) return "insufficient";
  return mos >= MIN_MOS ? "pass" : "review";
}

/** Har bir ingredient uchun hisoblangan yakuniy qator — LLM'ga kontekst sifatida beriladi. */
export type CalcRow = {
  inciName: string;
  cas: string;
  percentInProduct: number;
  noael?: number;
  sed: number;
  mos: number | null;
  judgment: Judgment;
  toxSummary?: string; // "acuteToxicity: available, ..." — Weight-of-Evidence uchun qo'shimcha kontekst
  restrictedNote?: string; // cheklangan modda topilsa — sababi
};
