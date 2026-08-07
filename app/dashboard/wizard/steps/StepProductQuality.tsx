"use client";

import { useWizardText } from "@/lib/i18n";
import type { ProductQuality } from "@/lib/wizard-types";
import { field, label, input, card, grid2 } from "@/lib/wizard-ui";
import { FileDropzone } from "@/components/FileDropzone";

export function StepProductQuality({
  value,
  onChange,
}: {
  value: ProductQuality;
  onChange: (next: ProductQuality) => void;
}) {
  const t = useWizardText();

  function set<K extends keyof ProductQuality>(key: K, v: ProductQuality[K]) {
    onChange({ ...value, [key]: v });
  }

  async function handleUpload(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/extract/product-quality", { method: "POST", body: formData });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || t("extractFailed"));
    onChange({ ...value, ...json.fields });
  }

  return (
    <div style={card}>
      <FileDropzone
        title={t("uploadQuality")}
        hint={t("uploadQualityHint")}
        loadingLabel={t("extracting")}
        onFile={handleUpload}
      />

      <div style={grid2}>
        <div style={field}>
          <label style={label}>{t("physicalForm")}</label>
          <input style={input} value={value.physicalForm} onChange={(e) => set("physicalForm", e.target.value)} />
        </div>
        <div style={field}>
          <label style={label}>pH</label>
          <input style={input} value={value.ph} onChange={(e) => set("ph", e.target.value)} />
        </div>
        <div style={field}>
          <label style={label}>{t("viscosityRange")}</label>
          <input style={input} value={value.viscosityRange} onChange={(e) => set("viscosityRange", e.target.value)} />
        </div>
        <div style={field}>
          <label style={label}>{t("paoMonths")}</label>
          <input style={input} type="number" value={value.paoMonths} onChange={(e) => set("paoMonths", e.target.value)} />
        </div>
      </div>

      <div style={field}>
        <label style={label}>{t("stabilityResult")}</label>
        <textarea
          style={{ ...input, minHeight: 60, resize: "vertical" }}
          value={value.stabilityResult}
          onChange={(e) => set("stabilityResult", e.target.value)}
        />
      </div>

      <div style={grid2}>
        <div style={field}>
          <label style={label}>{t("microbialLimitResult")}</label>
          <input style={input} value={value.microbialLimitResult} onChange={(e) => set("microbialLimitResult", e.target.value)} />
        </div>
        <div style={field}>
          <label style={label}>{t("challengeTestResult")}</label>
          <input style={input} value={value.challengeTestResult} onChange={(e) => set("challengeTestResult", e.target.value)} />
        </div>
        <div style={field}>
          <label style={label}>{t("heavyMetalsResult")}</label>
          <input style={input} value={value.heavyMetalsResult} onChange={(e) => set("heavyMetalsResult", e.target.value)} />
        </div>
        <div style={field}>
          <label style={label}>{t("packagingMaterial")}</label>
          <input style={input} value={value.packagingMaterial} onChange={(e) => set("packagingMaterial", e.target.value)} />
        </div>
        <div style={field}>
          <label style={label}>{t("packagingSafetyNote")}</label>
          <input style={input} value={value.packagingSafetyNote} onChange={(e) => set("packagingSafetyNote", e.target.value)} />
        </div>
        <div style={field}>
          <label style={label}>{t("allergenNote")}</label>
          <input style={input} value={value.allergenNote} onChange={(e) => set("allergenNote", e.target.value)} />
        </div>
      </div>
    </div>
  );
}
