import { test } from "node:test";
import assert from "node:assert/strict";
import { calcSED, calcMoS, judge, MIN_MOS, type Judgment } from "@/lib/calc";
import { ttcScreen } from "@/lib/ttc";

test("MIN_MOS = 100 (kitob: MoS ≥ 100)", () => {
  assert.equal(MIN_MOS, 100);
});

test("calcSED — kitob formulasi: SED=(A×1000×RF×C×DAp)/BW", () => {
  // A=0.8 g/day, RF=1.0, C=0.05%, DAp=100%, BW=60
  const sed = calcSED({ amountG: 0.8, retentionFactor: 1.0, bodyWeightKg: 60 }, 0.05, 100);
  assert.equal(sed, (0.8 * 1000 * 1.0 * 0.0005 * 1.0) / 60);
  assert.ok(Math.abs(sed - 0.0066666667) < 1e-9);
});

test("calcMoS = NOAEL / SED", () => {
  assert.equal(calcMoS(500, 0.12), 4166.666666666667);
  assert.equal(calcMoS(undefined, 0.12), null);
  assert.equal(calcMoS(0, 0.12), null);
  assert.equal(calcMoS(-5, 0.12), null);
  assert.equal(calcMoS(500, 0), null);
});

test("judge — chegara MoS≥100 (kitob)", () => {
  assert.equal(judge(null), "insufficient");
  assert.equal(judge(100), "pass"); // aynan 100.0 → PASS (kitob: ≥100)
  assert.equal(judge(100.0001), "pass");
  assert.equal(judge(99.999), "review");
  assert.equal(judge(50), "review");
});

test("ttc — Cramer III chegara 1.5 µg/kg/day", () => {
  const r = ttcScreen("III", 0.0005); // 0.5 µg/kg/day
  assert.equal(r.thresholdUgKgDay, 1.5);
  assert.equal(r.sedUgKgDay, 0.5);
  assert.equal(r.withinTTC, true);
  const above = ttcScreen("III", 0.002); // 2 µg/kg/day > 1.5
  assert.equal(above.withinTTC, false);
  assert.equal(ttcScreen("I", 0.02).thresholdUgKgDay, 30);
  assert.equal(ttcScreen("II", 0.02).thresholdUgKgDay, 9);
});

test("SED=0 yoki NOAEL=0 → insufficient emas, review bo'lmaydi (null himoyasi)", () => {
  const sed = calcSED({ amountG: 0, retentionFactor: 1.0, bodyWeightKg: 60 }, 0.05, 100);
  assert.equal(sed, 0);
  assert.equal(calcMoS(500, sed), null); // sed<=0 → null
});
