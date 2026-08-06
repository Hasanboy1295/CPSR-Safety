"use client";

import { useState } from "react";
import Link from "next/link";
import { useWizardText } from "@/lib/i18n";
import { calcShelfLife, type StabilityPoint } from "@/lib/shelf-life";
import { field, label, input, card, badge, btnPrimary, btnGhost } from "@/lib/wizard-ui";

function PointsEditor({
  points,
  onChange,
}: {
  points: StabilityPoint[];
  onChange: (next: StabilityPoint[]) => void;
}) {
  function update(i: number, patch: Partial<StabilityPoint>) {
    onChange(points.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  return (
    <div>
      {points.map((p, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
          <input
            style={input}
            type="number"
            placeholder="hafta"
            value={p.timeWeeks}
            onChange={(e) => update(i, { timeWeeks: parseFloat(e.target.value) || 0 })}
          />
          <input
            style={input}
            type="number"
            placeholder="% qolgan"
            value={p.percentRemaining}
            onChange={(e) => update(i, { percentRemaining: parseFloat(e.target.value) || 0 })}
          />
        </div>
      ))}
      <button
        style={{ ...btnGhost, fontSize: 12, padding: "5px 12px" }}
        onClick={() => onChange([...points, { timeWeeks: 0, percentRemaining: 100 }])}
      >
        + nuqta
      </button>
    </div>
  );
}

export default function ShelfLifePage() {
  const t = useWizardText();

  const [accelTemp, setAccelTemp] = useState(40);
  const [accelPoints, setAccelPoints] = useState<StabilityPoint[]>([
    { timeWeeks: 0, percentRemaining: 100 },
    { timeWeeks: 2, percentRemaining: 96 },
    { timeWeeks: 4, percentRemaining: 91 },
    { timeWeeks: 8, percentRemaining: 84 },
  ]);

  const [longTemp, setLongTemp] = useState(25);
  const [longPoints, setLongPoints] = useState<StabilityPoint[]>([
    { timeWeeks: 0, percentRemaining: 100 },
    { timeWeeks: 4, percentRemaining: 98 },
    { timeWeeks: 8, percentRemaining: 96 },
    { timeWeeks: 12, percentRemaining: 94 },
  ]);

  const result = calcShelfLife({ temperatureC: accelTemp, points: accelPoints }, { temperatureC: longTemp, points: longPoints });

  return (
    <div style={{ maxWidth: 880 }}>
      <Link href="/dashboard" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>
        ← {t("myProjects")}
      </Link>
      <h1 style={{ fontSize: 24, margin: "10px 0 4px" }}>{t("shelfLifeTitle")}</h1>
      <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: 0, maxWidth: 560 }}>{t("shelfLifeSubtitle")}</p>

      <p style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-muted)", margin: "24px 0 20px" }}>
        k = A·exp(−Ea/RT) · t½ = ln(2)/k · t90 = ln(10/9)/k
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={card}>
          <div style={field}>
            <label style={label}>{t("acceleratedTemp")}</label>
            <input style={input} type="number" value={accelTemp} onChange={(e) => setAccelTemp(parseFloat(e.target.value) || 0)} />
          </div>
          <PointsEditor points={accelPoints} onChange={setAccelPoints} />
        </div>
        <div style={card}>
          <div style={field}>
            <label style={label}>{t("longTermTemp")}</label>
            <input style={input} type="number" value={longTemp} onChange={(e) => setLongTemp(parseFloat(e.target.value) || 0)} />
          </div>
          <PointsEditor points={longPoints} onChange={setLongPoints} />
        </div>
      </div>

      <div style={{ ...card, marginTop: 20 }}>
        <h3 style={{ fontSize: 14, marginBottom: 14 }}>{t("shelfLifeResult")}</h3>
        {!result && <p style={{ color: "var(--danger)", fontSize: 13.5 }}>{t("shelfLifeInsufficient")}</p>}
        {result && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
            <div>
              <div style={label}>Ea</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700 }}>{(result.ea / 1000).toFixed(1)} kJ/mol</div>
            </div>
            <div>
              <div style={label}>k (25°C)</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700 }}>{result.k25PerWeek.toFixed(5)} /hafta</div>
            </div>
            <div>
              <div style={label}>{t("halfLife")}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: "var(--accent)" }}>
                {(result.halfLifeWeeks / 4.345).toFixed(1)} {t("months")}
              </div>
            </div>
            <div>
              <div style={label}>t90 (PAO)</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: "var(--gold)" }}>
                {(result.t90Weeks / 4.345).toFixed(1)} {t("months")}
              </div>
            </div>
          </div>
        )}
        <p style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 16 }}>{t("shelfLifeNote")}</p>
      </div>
    </div>
  );
}
