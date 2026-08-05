// TTC (Threshold of Toxicological Concern) — NOAEL topilmagan moddalar uchun
// ikkinchi darajali skrining. Bu ham qoida-asosli, ML "bashorat" emas.
// Standart Munro/SCCS TTC qiymatlari (Cramer class bo'yicha).

export type CramerClass = "I" | "II" | "III";

export const TTC_UG_KG_DAY: Record<CramerClass, number> = {
  I: 30, // past tashvish
  II: 9, // o'rta tashvish
  III: 1.5, // yuqori tashvish (masalan reaktiv/alert struktura)
};

export type TTCResult = {
  cramerClass: CramerClass;
  thresholdUgKgDay: number;
  sedUgKgDay: number;
  withinTTC: boolean; // true => SED < threshold => tashvish past
};

/** sedMgKgDay — lib/calc.ts'dagi calcSED() natijasi (mg/kg bw/day). */
export function ttcScreen(cramerClass: CramerClass, sedMgKgDay: number): TTCResult {
  const thresholdUgKgDay = TTC_UG_KG_DAY[cramerClass];
  const sedUgKgDay = sedMgKgDay * 1000;
  return {
    cramerClass,
    thresholdUgKgDay,
    sedUgKgDay,
    withinTTC: sedUgKgDay < thresholdUgKgDay,
  };
}
