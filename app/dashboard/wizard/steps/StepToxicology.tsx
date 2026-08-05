"use client";

import { useWizardText } from "@/lib/i18n";
import type { ExposureParams, IngredientRow } from "@/lib/wizard-types";
import { calcSED, calcMoS, judge } from "@/lib/calc";
import { field, label, input, card, badge } from "@/lib/wizard-ui";

export function StepToxicology({
  ingredients,
  onIngredientsChange,
  exposure,
  onExposureChange,
}: {
  ingredients: IngredientRow[];
  onIngredientsChange: (next: IngredientRow[]) => void;
  exposure: ExposureParams;
  onExposureChange: (next: ExposureParams) => void;
}) {
  const t = useWizardText();

  function setExposure<K extends keyof ExposureParams>(key: K, v: ExposureParams[K]) {
    onExposureChange({ ...exposure, [key]: v });
  }

  function updateRow(id: string, patch: Partial<IngredientRow>) {
    onIngredientsChange(
      ingredients.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  }

  const A = parseFloat(exposure.amountG) || 0;
  const RF = parseFloat(exposure.retentionFactor) || 0;
  const BW = parseFloat(exposure.bodyWeightKg) || 1;

  return (
    <div style={card}>
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: "var(--text-muted)",
          marginTop: 0,
          marginBottom: 20,
        }}
      >
        {t("formula")}
      </p>

      <h3 style={{ fontSize: 14, marginBottom: 12 }}>{t("exposureParams")}</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0 16px", marginBottom: 24 }}>
        <div style={field}>
          <label style={label}>{t("amountG")}</label>
          <input
            style={input}
            type="number"
            value={exposure.amountG}
            onChange={(e) => setExposure("amountG", e.target.value)}
          />
        </div>
        <div style={field}>
          <label style={label}>{t("retentionFactor")}</label>
          <input
            style={input}
            type="number"
            step="0.01"
            value={exposure.retentionFactor}
            onChange={(e) => setExposure("retentionFactor", e.target.value)}
          />
        </div>
        <div style={field}>
          <label style={label}>{t("bodyWeightKg")}</label>
          <input
            style={input}
            type="number"
            value={exposure.bodyWeightKg}
            onChange={(e) => setExposure("bodyWeightKg", e.target.value)}
          />
        </div>
      </div>

      {ingredients.length === 0 && (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{t("noIngredientsYet")}</p>
      )}

      {ingredients.map((row) => {
        const C = parseFloat(row.percentInProduct) || 0;
        const DAp = parseFloat(row.dermalAbsorptionPercent) || 0;
        const NOAEL = row.noael ? parseFloat(row.noael) : undefined;
        const sed = calcSED({ amountG: A, retentionFactor: RF, bodyWeightKg: BW }, C, DAp);
        const mos = calcMoS(NOAEL, sed);
        const verdict = judge(mos);

        return (
          <div
            key={row.id}
            style={{
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: 16,
              marginBottom: 14,
              background: "var(--surface-2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>
                {row.inciName || `#${ingredients.indexOf(row) + 1}`}
              </span>
              <span
                style={badge(
                  verdict === "pass" ? "pass" : verdict === "review" ? "review" : "insufficient"
                )}
              >
                {verdict === "pass"
                  ? t("judgmentPass")
                  : verdict === "review"
                    ? t("judgmentReview")
                    : t("judgmentInsufficient")}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0 16px" }}>
              <div style={field}>
                <label style={label}>{t("dermalAbsorption")}</label>
                <input
                  style={input}
                  type="number"
                  value={row.dermalAbsorptionPercent}
                  onChange={(e) => updateRow(row.id, { dermalAbsorptionPercent: e.target.value })}
                />
              </div>
              <div style={field}>
                <label style={label}>{t("noael")}</label>
                <input
                  style={input}
                  type="number"
                  placeholder={t("noaelHint")}
                  value={row.noael}
                  onChange={(e) => updateRow(row.id, { noael: e.target.value })}
                />
              </div>
              <div style={field}>
                <label style={label}>{t("sed")}</label>
                <div style={{ ...input, background: "var(--bg)", fontFamily: "var(--font-mono)" }}>
                  {sed.toFixed(6)}
                </div>
              </div>
              <div style={field}>
                <label style={label}>{t("mos")}</label>
                <div style={{ ...input, background: "var(--bg)", fontFamily: "var(--font-mono)" }}>
                  {mos === null ? "—" : mos.toFixed(1)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
