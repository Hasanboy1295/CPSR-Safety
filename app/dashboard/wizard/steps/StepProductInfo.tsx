"use client";

import { useWizardText } from "@/lib/i18n";
import type { ProductInfo } from "@/lib/wizard-types";
import { field, label, input, select, card, grid2 } from "@/lib/wizard-ui";

export function StepProductInfo({
  value,
  onChange,
}: {
  value: ProductInfo;
  onChange: (next: ProductInfo) => void;
}) {
  const t = useWizardText();

  function set<K extends keyof ProductInfo>(key: K, v: ProductInfo[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div style={card}>
      <div style={grid2}>
        <div style={field}>
          <label style={label}>
            {t("productName")} <span style={{ color: "var(--danger)" }}>*</span>
          </label>
          <input
            style={input}
            value={value.productName}
            onChange={(e) => set("productName", e.target.value)}
          />
        </div>

        <div style={field}>
          <label style={label}>
            {t("productType")} <span style={{ color: "var(--danger)" }}>*</span>
          </label>
          <input
            style={input}
            value={value.productType}
            onChange={(e) => set("productType", e.target.value)}
          />
        </div>

        <div style={field}>
          <label style={label}>{t("targetUser")}</label>
          <input
            style={input}
            value={value.targetUser}
            onChange={(e) => set("targetUser", e.target.value)}
          />
        </div>

        <div style={field}>
          <label style={label}>{t("rinseType")}</label>
          <select
            style={select}
            value={value.rinseType}
            onChange={(e) => set("rinseType", e.target.value as ProductInfo["rinseType"])}
          >
            <option value="leave-on">{t("rinseLeaveOn")}</option>
            <option value="rinse-off">{t("rinseRinseOff")}</option>
          </select>
        </div>

        <div style={field}>
          <label style={label}>{t("applicationArea")}</label>
          <input
            style={input}
            value={value.applicationArea}
            onChange={(e) => set("applicationArea", e.target.value)}
          />
        </div>

        <div style={field}>
          <label style={label}>
            {t("manufacturer")} <span style={{ color: "var(--danger)" }}>*</span>
          </label>
          <input
            style={input}
            value={value.manufacturer}
            onChange={(e) => set("manufacturer", e.target.value)}
          />
        </div>

        <div style={field}>
          <label style={label}>
            {t("responsibleSeller")} <span style={{ color: "var(--danger)" }}>*</span>
          </label>
          <input
            style={input}
            value={value.responsibleSeller}
            onChange={(e) => set("responsibleSeller", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
