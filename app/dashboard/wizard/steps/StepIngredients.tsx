"use client";

import { useWizardText } from "@/lib/i18n";
import {
  newIngredientRow,
  newComponent,
  flattenIngredients,
  type IngredientRow,
  type INCIComponent,
} from "@/lib/wizard-types";
import { field, label, input, card, btnPrimary, btnGhost, btnDanger } from "@/lib/wizard-ui";

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

  function updateComponent(rowId: string, compId: string, patch: Partial<INCIComponent>) {
    onChange(
      value.map((row) =>
        row.id !== rowId
          ? row
          : {
              ...row,
              components: row.components.map((c) => (c.id === compId ? { ...c, ...patch } : c)),
            }
      )
    );
  }

  function addRow() {
    onChange([...value, newIngredientRow()]);
  }

  function removeRow(id: string) {
    onChange(value.filter((row) => row.id !== id));
  }

  function addComponent(rowId: string) {
    onChange(
      value.map((row) =>
        row.id === rowId ? { ...row, components: [...row.components, newComponent()] } : row
      )
    );
  }

  function removeComponent(rowId: string, compId: string) {
    onChange(
      value.map((row) =>
        row.id !== rowId
          ? row
          : { ...row, components: row.components.filter((c) => c.id !== compId) }
      )
    );
  }

  const flat = flattenIngredients(value);
  const total = flat.reduce((sum, c) => sum + c.percentInProduct, 0);

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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>
              #{i + 1} — {t("rawMaterial")}
            </span>
            <button style={btnDanger} onClick={() => removeRow(row.id)}>
              {t("removeIngredient")}
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0 16px" }}>
            <div style={field}>
              <label style={label}>{t("tradeName")}</label>
              <input
                style={input}
                placeholder={t("tradeNameHint")}
                value={row.tradeName}
                onChange={(e) => updateRow(row.id, { tradeName: e.target.value })}
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
          </div>

          {/* INCI komponentlar — bitta xomashyoda bir nechtasi bo'lishi mumkin */}
          <div style={{ marginLeft: 4, borderLeft: "2px solid var(--border)", paddingLeft: 14 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {t("inciComponents")} {row.components.length > 1 && `(${t("compositeHint")})`}
            </div>

            {row.components.map((c) => (
              <div
                key={c.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1.2fr 1fr 1.5fr auto",
                  gap: 8,
                  alignItems: "end",
                  marginBottom: 10,
                }}
              >
                <div style={field}>
                  <label style={label}>{t("inciName")}</label>
                  <input
                    style={input}
                    value={c.inciName}
                    onChange={(e) => updateComponent(row.id, c.id, { inciName: e.target.value })}
                  />
                </div>
                <div style={field}>
                  <label style={label}>{t("cas")}</label>
                  <input
                    style={input}
                    value={c.cas}
                    onChange={(e) => updateComponent(row.id, c.id, { cas: e.target.value })}
                  />
                </div>
                <div style={field}>
                  <label style={label}>{t("percentInRaw")}</label>
                  <input
                    style={input}
                    type="number"
                    value={c.percentActiveInRaw}
                    onChange={(e) => updateComponent(row.id, c.id, { percentActiveInRaw: e.target.value })}
                  />
                </div>
                <div style={field}>
                  <label style={label}>{t("functionRole")}</label>
                  <input
                    style={input}
                    value={c.functionRole}
                    onChange={(e) => updateComponent(row.id, c.id, { functionRole: e.target.value })}
                  />
                </div>
                {row.components.length > 1 && (
                  <button
                    style={{ ...btnDanger, marginBottom: 18 }}
                    onClick={() => removeComponent(row.id, c.id)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}

            <button style={{ ...btnGhost, fontSize: 12.5, padding: "6px 12px" }} onClick={() => addComponent(row.id)}>
              {t("addComponent")}
            </button>
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
