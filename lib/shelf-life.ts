// Muddat (shelf-life) hisob-kitobi — Arrhenius tenglamasi asosida.
// Manba: GBCY2616 grant hujjati §2-2 (1-yil, band 3): "가속 시험(40℃)과 장기
// 보존 시험(25℃) 데이터를 활용하여 Arrhenius 방정식으로 활성화 에너지(Ea) 산출,
// 반감기(t½)와 90% 잔존 시점(t90) 계산" — bu ham deterministik, AI emas.

const R = 8.314; // universal gaz doimiysi, J/(mol·K)

export type StabilityPoint = {
  timeWeeks: number;
  percentRemaining: number; // 0-100
};

/**
 * Bitta haroratdagi o'lchovlar to'plamidan 1-tartibli degradatsiya
 * tezlik konstantasi k'ni topadi: ln(C) = ln(C0) - k*t (chiziqli regressiya).
 * Natija: k (1/hafta).
 */
export function fitFirstOrderK(points: StabilityPoint[]): number | null {
  const valid = points.filter((p) => p.percentRemaining > 0 && p.percentRemaining <= 100);
  if (valid.length < 2) return null;

  const xs = valid.map((p) => p.timeWeeks);
  const ys = valid.map((p) => Math.log(p.percentRemaining / 100));
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  if (den === 0) return null;
  const slope = num / den; // = -k
  const k = -slope;
  return k > 0 ? k : null;
}

/** Ikki haroratdagi k qiymatlaridan faollashtirish energiyasi Ea (J/mol) ni topadi. */
export function arrheniusEa(k1: number, temp1C: number, k2: number, temp2C: number): number | null {
  const T1 = temp1C + 273.15;
  const T2 = temp2C + 273.15;
  const invDiff = 1 / T2 - 1 / T1;
  if (invDiff === 0) return null;
  const ea = (R * Math.log(k1 / k2)) / invDiff;
  return ea;
}

/** Ma'lum Ea yordamida k'ni boshqa haroratga ekstrapolyatsiya qiladi. */
export function extrapolateK(kRef: number, tempRefC: number, ea: number, targetTempC: number): number {
  const Tref = tempRefC + 273.15;
  const Ttarget = targetTempC + 273.15;
  return kRef * Math.exp((ea / R) * (1 / Tref - 1 / Ttarget));
}

export type ShelfLifeResult = {
  ea: number; // J/mol
  k25PerWeek: number;
  halfLifeWeeks: number;
  t90Weeks: number;
};

/**
 * To'liq hisob: ikki xil haroratdagi (masalan 40°C tezlashtirilgan,
 * 25°C uzoq muddatli) o'lchov nuqtalaridan 25°C uchun t½ va t90'ni topadi.
 */
export function calcShelfLife(
  accel: { temperatureC: number; points: StabilityPoint[] },
  longTerm: { temperatureC: number; points: StabilityPoint[] }
): ShelfLifeResult | null {
  const kAccel = fitFirstOrderK(accel.points);
  const kLong = fitFirstOrderK(longTerm.points);
  if (kAccel === null || kLong === null) return null;

  const ea = arrheniusEa(kAccel, accel.temperatureC, kLong, longTerm.temperatureC);
  if (ea === null) return null;

  const k25 = extrapolateK(kLong, longTerm.temperatureC, ea, 25);
  if (k25 <= 0) return null;

  return {
    ea,
    k25PerWeek: k25,
    halfLifeWeeks: Math.log(2) / k25,
    t90Weeks: Math.log(10 / 9) / k25,
  };
}
