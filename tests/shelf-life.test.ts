import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fitFirstOrderK,
  arrheniusEa,
  extrapolateK,
  calcShelfLife,
  type StabilityPoint,
} from "@/lib/shelf-life";

const R = 8.314;

test("fitFirstOrderK — 1-tartibli degradatsiya k ni topadi", () => {
  // ln(C) = -k*t, C0=100. k = 0.1 /hafta deylik
  const pts: StabilityPoint[] = [
    { timeWeeks: 0, percentRemaining: 100 },
    { timeWeeks: 4, percentRemaining: 100 * Math.exp(-0.1 * 4) },
    { timeWeeks: 8, percentRemaining: 100 * Math.exp(-0.1 * 8) },
  ];
  const k = fitFirstOrderK(pts);
  assert.ok(k !== null);
  assert.ok(Math.abs(k! - 0.1) < 1e-6);
});

test("fitFirstOrderK — yetarli nuqta yo'q bo'lsa null", () => {
  assert.equal(fitFirstOrderK([{ timeWeeks: 0, percentRemaining: 100 }]), null);
  assert.equal(fitFirstOrderK([{ timeWeeks: 0, percentRemaining: 0 }]), null);
});

test("arrheniusEa + extrapolateK — Ea hisoblash va ekstrapolyatsiya", () => {
  // Sintetik: T1=313.15K k1=0.2, T2=298.15K k2=0.05 → Ea o'zaro mos
  const ea = arrheniusEa(0.2, 40, 0.05, 25);
  assert.ok(ea !== null);
  // k = A*exp(-Ea/(RT)) → Ea = R*ln(k1/k2)/(1/T2-1/T1)
  const expectEa = (R * Math.log(0.2 / 0.05)) / (1 / 298.15 - 1 / 313.15);
  assert.ok(Math.abs(ea! - expectEa) < 1e-6);
  // 40C dagi k ni 25C ga ekstrapolyatsiya → k2 ga yaqin bo'lishi kerak (avval T1=40 dan)
  const kBack = extrapolateK(0.2, 40, ea!, 25);
  assert.ok(Math.abs(kBack - 0.05) < 1e-6);
});

test("calcShelfLife — t90 va t½ to'g'ri", () => {
  const accel = {
    temperatureC: 40,
    points: [
      { timeWeeks: 0, percentRemaining: 100 },
      { timeWeeks: 4, percentRemaining: 100 * Math.exp(-0.2 * 4) },
    ],
  };
  const longTerm = {
    temperatureC: 25,
    points: [
      { timeWeeks: 0, percentRemaining: 100 },
      { timeWeeks: 8, percentRemaining: 100 * Math.exp(-0.05 * 8) },
    ],
  };
  const r = calcShelfLife(accel, longTerm);
  assert.ok(r !== null);
  assert.ok(Math.abs(r.t90Weeks - Math.log(10 / 9) / 0.05) < 1e-6);
  assert.ok(Math.abs(r.halfLifeWeeks - Math.log(2) / 0.05) < 1e-6);
  assert.ok(r.ea > 0);
});
