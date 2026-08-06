// Deterministik SED/MoS hisob-kitobi — CPSR_KR_dossier'dagi haqiqiy formulaga
// asoslangan. Bu yerda LLM YO'Q — sof matematika.
//
// SED (mg/kg bw/day) = (A[g/day] x 1000 x RF x C x DAp) / BW[kg]
// MoS = NOAEL[mg/kg bw/day] / SED   (>=100 -> PASS)

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

export function judge(mos: number | null): Judgment {
  if (mos === null) return "insufficient";
  return mos >= 100 ? "pass" : "review";
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
