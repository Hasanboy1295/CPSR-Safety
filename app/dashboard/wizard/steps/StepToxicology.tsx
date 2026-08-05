"use client";

import { useState } from "react";
import { useWizardText } from "@/lib/i18n";
import type { ExposureParams, IngredientRow, INCIComponent, ToxicologyProfile, ToxEndpointStatus } from "@/lib/wizard-types";
import { calcSED, calcMoS, judge } from "@/lib/calc";
import { ttcScreen, type CramerClass } from "@/lib/ttc";
import { field, label, input, select as selectStyle, card, badge, btnGhost } from "@/lib/wizard-ui";

const TOX_ENDPOINTS: { key: keyof ToxicologyProfile; labelKey: string }[] = [
  { key: "acuteToxicity", labelKey: "toxAcute" },
  { key: "skinIrritation", labelKey: "toxSkinIrritation" },
  { key: "eyeIrritation", labelKey: "toxEyeIrritation" },
  { key: "skinSensitization", labelKey: "toxSensitization" },
  { key: "genotoxicity", labelKey: "toxGenotoxicity" },
  { key: "carcinogenicity", labelKey: "toxCarcinogenicity" },
  { key: "reproductiveToxicity", labelKey: "toxReproductive" },
  { key: "phototoxicity", labelKey: "toxPhototoxicity" },
];

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
  const [expanded, setExpanded] = useState<string | null>(null);

  function setExposureField<K extends keyof ExposureParams>(key: K, v: ExposureParams[K]) {
    onExposureChange({ ...exposure, [key]: v });
  }

  function updateComponent(rowId: string, compId: string, patch: Partial<INCIComponent>) {
    onIngredientsChange(
      ingredients.map((row) =>
        row.id !== rowId
          ? row
          : { ...row, components: row.components.map((c) => (c.id === compId ? { ...c, ...patch } : c)) }
      )
    );
  }

  function setToxField(rowId: string, compId: string, key: keyof ToxicologyProfile, v: ToxEndpointStatus | string) {
    const row = ingredients.find((r) => r.id === rowId);
    const comp = row?.components.find((c) => c.id === compId);
    if (!comp) return;
    updateComponent(rowId, compId, { tox: { ...comp.tox, [key]: v } });
  }

  const A = parseFloat(exposure.amountG) || 0;
  const RF = parseFloat(exposure.retentionFactor) || 0;
  const BW = parseFloat(exposure.bodyWeightKg) || 1;

  const anyComponents = ingredients.some((r) => r.components.length > 0);

  return (
    <div style={card}>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)", marginTop: 0, marginBottom: 20 }}>
        {t("formula")}
      </p>

      <h3 style={{ fontSize: 14, marginBottom: 12 }}>{t("exposureParams")}</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0 16px", marginBottom: 24 }}>
        <div style={field}>
          <label style={label}>{t("amountG")}</label>
          <input style={input} type="number" value={exposure.amountG} onChange={(e) => setExposureField("amountG", e.target.value)} />
        </div>
        <div style={field}>
          <label style={label}>{t("retentionFactor")}</label>
          <input style={input} type="number" step="0.01" value={exposure.retentionFactor} onChange={(e) => setExposureField("retentionFactor", e.target.value)} />
        </div>
        <div style={field}>
          <label style={label}>{t("bodyWeightKg")}</label>
          <input style={input} type="number" value={exposure.bodyWeightKg} onChange={(e) => setExposureField("bodyWeightKg", e.target.value)} />
        </div>
      </div>

      {!anyComponents && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{t("noIngredientsYet")}</p>}

      {ingredients.map((row) =>
        row.components.map((c) => {
          const rawPct = parseFloat(row.percentInProduct) || 0;
          const activePct = parseFloat(c.percentActiveInRaw);
          const C = (rawPct * (Number.isFinite(activePct) ? activePct : 100)) / 100;
          const DAp = parseFloat(c.dermalAbsorptionPercent) || 0;
          const NOAEL = c.noael ? parseFloat(c.noael) : undefined;
          const sed = calcSED({ amountG: A, retentionFactor: RF, bodyWeightKg: BW }, C, DAp);
          const mos = calcMoS(NOAEL, sed);
          const verdict = judge(mos);
          const isOpen = expanded === c.id;

          return (
            <div key={c.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 16, marginBottom: 14, background: "var(--surface-2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>
                  {c.inciName || "—"}{" "}
                  {row.components.length > 1 && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>({row.tradeName})</span>
                  )}
                </span>
                <span style={badge(verdict === "pass" ? "pass" : verdict === "review" ? "review" : "insufficient")}>
                  {verdict === "pass" ? t("judgmentPass") : verdict === "review" ? t("judgmentReview") : t("judgmentInsufficient")}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0 16px" }}>
                <div style={field}>
                  <label style={label}>{t("dermalAbsorption")}</label>
                  <input style={input} type="number" value={c.dermalAbsorptionPercent} onChange={(e) => updateComponent(row.id, c.id, { dermalAbsorptionPercent: e.target.value })} />
                </div>
                <div style={field}>
                  <label style={label}>{t("noael")}</label>
                  <input style={input} type="number" placeholder={t("noaelHint")} value={c.noael} onChange={(e) => updateComponent(row.id, c.id, { noael: e.target.value })} />
                </div>
                <div style={field}>
                  <label style={label}>{t("sed")}</label>
                  <div style={{ ...input, background: "var(--bg)", fontFamily: "var(--font-mono)" }}>{sed.toFixed(6)}</div>
                </div>
                <div style={field}>
                  <label style={label}>{t("mos")}</label>
                  <div style={{ ...input, background: "var(--bg)", fontFamily: "var(--font-mono)" }}>{mos === null ? "—" : mos.toFixed(1)}</div>
                </div>
              </div>

              {!c.noael && (
                <div style={{ marginTop: 4, paddingTop: 14, borderTop: "1px dashed var(--border)" }}>
                  <div style={field}>
                    <label style={label}>{t("cramerClass")}</label>
                    <select style={selectStyle} value={c.cramerClass} onChange={(e) => updateComponent(row.id, c.id, { cramerClass: e.target.value as INCIComponent["cramerClass"] })}>
                      <option value="">{t("cramerNone")}</option>
                      <option value="I">Cramer I</option>
                      <option value="II">Cramer II</option>
                      <option value="III">Cramer III</option>
                    </select>
                  </div>
                  {c.cramerClass &&
                    (() => {
                      const ttc = ttcScreen(c.cramerClass as CramerClass, sed);
                      return (
                        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                          <span style={{ color: "var(--text-muted)" }}>{t("ttcResult")}:</span>
                          <span style={badge(ttc.withinTTC ? "pass" : "review")}>
                            {ttc.sedUgKgDay.toFixed(3)} / {ttc.thresholdUgKgDay} µg/kg/day — {ttc.withinTTC ? t("ttcWithin") : t("ttcExceeded")}
                          </span>
                        </div>
                      );
                    })()}
                </div>
              )}

              {/* Kengaytirilgan toksikologiya profili — veneks/21512 real CPSR'lardagi kabi */}
              <button
                style={{ ...btnGhost, fontSize: 12, padding: "5px 10px", marginTop: 14 }}
                onClick={() => setExpanded(isOpen ? null : c.id)}
              >
                {isOpen ? "▲" : "▼"} {t("toxProfileToggle")}
              </button>

              {isOpen && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed var(--border)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0 16px" }}>
                    {TOX_ENDPOINTS.map((ep) => (
                      <div key={ep.key} style={field}>
                        <label style={label}>{t(ep.labelKey as never)}</label>
                        <select
                          style={selectStyle}
                          value={c.tox[ep.key] as string}
                          onChange={(e) => setToxField(row.id, c.id, ep.key, e.target.value as ToxEndpointStatus)}
                        >
                          <option value="unknown">{t("toxUnknown")}</option>
                          <option value="available">{t("toxAvailable")}</option>
                          <option value="not_available">{t("toxNotAvailable")}</option>
                        </select>
                      </div>
                    ))}
                  </div>
                  <div style={field}>
                    <label style={label}>{t("toxNotes")}</label>
                    <input
                      style={input}
                      placeholder="CIR Final Report 2014, SCCS Opinion..."
                      value={c.tox.notes}
                      onChange={(e) => setToxField(row.id, c.id, "notes", e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
