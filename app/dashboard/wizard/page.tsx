"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLanguage, useWizardText } from "@/lib/i18n";
import {
  emptyWizardData,
  WIZARD_STORAGE_KEY,
  type WizardData,
} from "@/lib/wizard-types";
import { btnPrimary, btnGhost } from "@/lib/wizard-ui";
import { StepProductInfo } from "./steps/StepProductInfo";
import { StepIngredients } from "./steps/StepIngredients";
import { StepToxicology } from "./steps/StepToxicology";
import { StepCertification } from "./steps/StepCertification";

const STEP_KEYS = [
  "stepProductInfo",
  "stepIngredients",
  "stepToxicology",
  "stepCertification",
] as const;

function WizardInner() {
  const { t: tBrand } = useLanguage();
  const t = useWizardText();
  const projectId = useSearchParams().get("project");

  const [data, setData] = useState<WizardData>(emptyWizardData);
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Yuklash: agar ?project=<id> bo'lsa — Supabase'dan (login+RLS himoyasi
  // ostida, "auto to'ldirish" shu yerda sodir bo'ladi — server profildan
  // manufacturer/responsibleSeller'ni oldindan to'ldirib yuboradi).
  // Bo'lmasa — eski localStorage (anonim/demo foydalanish, o'zgarmagan).
  useEffect(() => {
    if (projectId) {
      fetch(`/api/projects/${projectId}`)
        .then((r) => r.json())
        .then((json) => {
          if (json.project) {
            setData({
              productInfo: json.project.product_info,
              ingredients: json.project.ingredients,
              exposure: json.project.exposure,
              certification: json.project.certification,
            });
          }
          setLoaded(true);
        })
        .catch(() => setLoaded(true));
      return;
    }

    const raw = window.localStorage.getItem(WIZARD_STORAGE_KEY);
    if (raw) {
      try {
        setData(JSON.parse(raw) as WizardData);
      } catch {
        // buzilgan JSON bo'lsa — bo'sh holatda qoladi
      }
    }
    setLoaded(true);
  }, [projectId]);

  // Avtomatik saqlash: project bo'lsa Supabase'ga (debounce bilan), bo'lmasa localStorage.
  useEffect(() => {
    if (!loaded) return;

    if (!projectId) {
      window.localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(data));
      return;
    }

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_info: data.productInfo,
          ingredients: data.ingredients,
          exposure: data.exposure,
          certification: data.certification,
        }),
      }).catch(() => {});
    }, 600);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [data, loaded, projectId]);

  function resetAll() {
    setData(emptyWizardData);
    setStep(0);
  }

  return (
    <div style={{ maxWidth: 880 }}>
      <Link href={projectId ? "/dashboard" : "/"} style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>
        ← {projectId ? t("myProjects") : tBrand("brand")}
      </Link>
      <h1 style={{ fontSize: 24, margin: "10px 0 4px" }}>{t("wizardTitle")}</h1>
      <p style={{ fontSize: 13.5, color: "var(--text-muted)", margin: 0 }}>
        {projectId ? t("autoFilledNote") : t("wizardSubtitle")}
      </p>

      {/* Step indikator */}
      <div style={{ display: "flex", gap: 6, margin: "28px 0 24px" }}>
        {STEP_KEYS.map((key, i) => (
          <button
            key={key}
            onClick={() => setStep(i)}
            style={{
              flex: 1,
              padding: "10px 8px",
              fontSize: 12.5,
              fontWeight: 600,
              textAlign: "center",
              borderRadius: 8,
              cursor: "pointer",
              border: i === step ? "1px solid var(--accent)" : "1px solid var(--border)",
              background: i === step ? "var(--accent-soft)" : "var(--surface)",
              color: i === step ? "var(--accent)" : "var(--text-muted)",
            }}
          >
            {i + 1}. {t(key)}
          </button>
        ))}
      </div>

      {/* Joriy bosqich */}
      {step === 0 && (
        <StepProductInfo
          value={data.productInfo}
          onChange={(productInfo) => setData((d) => ({ ...d, productInfo }))}
        />
      )}
      {step === 1 && (
        <StepIngredients
          value={data.ingredients}
          onChange={(ingredients) => setData((d) => ({ ...d, ingredients }))}
        />
      )}
      {step === 2 && (
        <StepToxicology
          ingredients={data.ingredients}
          onIngredientsChange={(ingredients) => setData((d) => ({ ...d, ingredients }))}
          exposure={data.exposure}
          onExposureChange={(exposure) => setData((d) => ({ ...d, exposure }))}
        />
      )}
      {step === 3 && (
        <StepCertification
          data={data}
          onChange={(certification) => setData((d) => ({ ...d, certification }))}
          projectId={projectId}
        />
      )}

      {/* Navigatsiya */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24 }}>
        <button style={btnGhost} onClick={resetAll}>
          {t("reset")}
        </button>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            ✓ {t("savedNote")}
          </span>
          {step > 0 && (
            <button style={btnGhost} onClick={() => setStep((s) => Math.max(0, s - 1))}>
              ← {t("previous")}
            </button>
          )}
          {step < STEP_KEYS.length - 1 && (
            <button style={btnPrimary} onClick={() => setStep((s) => Math.min(STEP_KEYS.length - 1, s + 1))}>
              {t("next")} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WizardPage() {
  return (
    <Suspense fallback={null}>
      <WizardInner />
    </Suspense>
  );
}
