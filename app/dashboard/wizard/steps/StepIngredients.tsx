"use client";

import { useWizardText } from "@/lib/i18n";
import { newIngredientRow, type IngredientRow } from "@/lib/wizard-types";
import { field, label, input, card, btnPrimary, btnDanger } from "@/lib/wizard-ui";

export function StepIngredients({
  value,
  onChange,
}: {
  value: IngredientRow[];
  onChange: (next: IngredientRow[]) => void;
}) {
  const t = useWizardText();

  function updateRow(id: string, patch: Partial<IngredientRow>) {
    onChange(value.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addRow() {
    onChange([...value, newIngredientRow()]);
  }

  function removeRow(id: string) {
    onChange(value.filter((row) => row.id !== id));
  }

  const total = value.reduce((sum, row) => sum + (parseFloat(row.percentInProduct) || 0), 0);

  return (
    <div style={card}>
      {value.length === 0 && (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{t("noIngredientsYet")}</p>
      )}

      {value.map((row, i) => (
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
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>
              #{i + 1}
            </span>
            <button style={btnDanger} onClick={() => removeRow(row.id)}>
              {t("removeIngredient")}
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0 16px" }}>
            <div style={field}>
              <label style={label}>{t("inciName")}</label>
              <input
                style={input}
                value={row.inciName}
                onChange={(e) => updateRow(row.id, { inciName: e.target.value })}
              />
            </div>
            <div style={field}>
              <label style={label}>{t("cas")}</label>
              <input
                style={input}
                value={row.cas}
                onChange={(e) => updateRow(row.id, { cas: e.target.value })}
              />
            </div>
            <div style={field}>
              <label style={label}>{t("percentInRaw")}</label>
              <input
                style={input}
                type="number"
                value={row.percentInRaw}
                onChange={(e) => updateRow(row.id, { percentInRaw: e.target.value })}
              />
            </div>
            <div style={field}>
              <label style={label}>{t("percentInProduct")}</label>
              <input
                style={input}
                type="number"
                value={row.percentInProduct}
                onChange={(e) => updateRow(row.id, { percentInProduct: e.target.value })}
              />
            </div>
            <div style={field}>
              <label style={label}>{t("functionRole")}</label>
              <input
                style={input}
                value={row.functionRole}
                onChange={(e) => updateRow(row.id, { functionRole: e.target.value })}
              />
            </div>
          </div>
        </div>
      ))}

      <button style={btnPrimary} onClick={addRow}>
        {t("addIngredient")}
      </button>

      {value.length > 0 && (
        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: "1px dashed var(--border)",
            display: "flex",
            justifyContent: "space-between",
            fontSize: 13.5,
          }}
        >
          <span style={{ color: "var(--text-muted)" }}>{t("totalPercent")}</span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: 700,
              color: Math.abs(total - 100) < 0.01 ? "var(--accent)" : "var(--gold)",
            }}
          >
            {total.toFixed(2)}% {Math.abs(total - 100) >= 0.01 && `— ${t("totalWarning")}`}
          </span>
        </div>
      )}
    </div>
  );
}
