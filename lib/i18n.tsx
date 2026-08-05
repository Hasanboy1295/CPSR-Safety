"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type Lang = "en" | "ko";

const dict = {
  en: {
    brand: "auto-cpsr",
    tagline: "AI-drafted, evidence-grounded cosmetic safety reports",
    heroTitle: "CPSR reports your assessor can actually trust",
    heroBody:
      "auto-cpsr turns formulation data into a Part A + Part B Cosmetic Product Safety Report, grounded in MFDS, EU SCCS, US MoCRA and China NMPA source text — every claim cited, every conclusion left for a licensed safety assessor to sign.",
    ctaTry: "Try the live RAG engine",
    navDemo: "Live demo",
    navPipeline: "Pipeline",
    navCompliance: "Compliance",
    demoTitle: "Ask a question, get a cited answer",
    demoBody:
      "This calls the real backend (Claude + Voyage AI + Supabase pgvector). Without API keys configured it falls back to DEMO mode — clearly labeled, never silently fake.",
    demoPlaceholder: "e.g. Why was Korea's cosmetic safety evaluation system introduced?",
    demoButton: "Ask",
    demoButtonLoading: "Asking…",
    demoAnswerLabel: "Answer",
    demoSourcesLabel: "Sources (why this answer)",
    demoBanner:
      "DEMO MODE — no real API keys configured. This is keyword matching, not Claude.",
    pipelineTitle: "Four-step CPSR wizard",
    pipelineBody: "Status is shown honestly — built vs. planned, no dead buttons.",
    stepProductInfo: "Product Info",
    stepProductInfoDesc: "Product, manufacturer, responsible party — plain database record.",
    stepIngredients: "Ingredients",
    stepIngredientsDesc: "INCI + % composition, checked against MFDS banned/restricted list.",
    stepToxicology: "Toxicology",
    stepToxicologyDesc: "SED = (A×RF×C×DAp)/BW, MoS = NOAEL/SED — calculated, not guessed.",
    stepCertification: "Certification",
    stepCertificationDesc: "LLM drafts Part A/B text; a licensed assessor reviews and signs.",
    statusLive: "Live",
    statusPlanned: "Planned",
    complianceTitle: "Built around real regulatory text",
    complianceBody:
      "Every generated sentence traces back to a source chunk from these frameworks — not model memory.",
    complianceNote:
      "Source: MFDS cosmetic safety evaluation notice · CPSR dossier template (EC 1223/2009 Annex I, Parts A+B) — both from the project's own reference documents.",
    footerNote: "Prototype — not a submission-ready regulatory document.",
  },
  ko: {
    brand: "auto-cpsr",
    tagline: "AI가 초안을 작성하고, 근거 문서에 기반한 화장품 안전성 보고서",
    heroTitle: "평가자가 실제로 신뢰할 수 있는 CPSR",
    heroBody:
      "auto-cpsr는 제형 데이터를 MFDS·EU SCCS·US MoCRA·중국 NMPA 원문에 근거한 Part A + Part B 화장품 안전성 평가 자료(CPSR)로 변환합니다 — 모든 서술에 출처를 남기고, 최종 결론은 반드시 자격을 갖춘 안전성 평가자가 검토·서명합니다.",
    ctaTry: "실제 RAG 엔진 사용해보기",
    navDemo: "라이브 데모",
    navPipeline: "파이프라인",
    navCompliance: "규정 준거",
    demoTitle: "질문하면, 출처가 달린 답변을 받습니다",
    demoBody:
      "실제 백엔드(Claude + Voyage AI + Supabase pgvector)를 호출합니다. API 키가 설정되지 않으면 DEMO 모드로 전환됩니다 — 명확히 표시되며 조용히 속이지 않습니다.",
    demoPlaceholder: "예: 화장품 안전성 평가 제도는 왜 도입되었나요?",
    demoButton: "질문하기",
    demoButtonLoading: "답변 생성 중…",
    demoAnswerLabel: "답변",
    demoSourcesLabel: "출처 (이 답변이 나온 이유)",
    demoBanner: "DEMO 모드 — 실제 API 키가 설정되지 않았습니다. Claude가 아닌 키워드 매칭 결과입니다.",
    pipelineTitle: "4단계 CPSR 마법사",
    pipelineBody: "상태를 정직하게 표시합니다 — 구현됨 vs 예정, 죽은 버튼 없음.",
    stepProductInfo: "제품 정보",
    stepProductInfoDesc: "제품·제조업자·책임판매업자 — 단순 데이터베이스 기록.",
    stepIngredients: "성분",
    stepIngredientsDesc: "INCI + 함량(%), MFDS 배합금지·제한 목록과 자동 대조.",
    stepToxicology: "독성 평가",
    stepToxicologyDesc: "SED = (A×RF×C×DAp)/BW, MoS = NOAEL/SED — 계산값, 추측 아님.",
    stepCertification: "인증",
    stepCertificationDesc: "LLM이 Part A/B 초안을 작성하고, 자격을 갖춘 평가자가 검토·서명합니다.",
    statusLive: "구현됨",
    statusPlanned: "예정",
    complianceTitle: "실제 규정 원문을 기반으로 구축",
    complianceBody:
      "생성된 모든 문장은 모델의 기억이 아니라 아래 체계의 출처 문단으로 추적됩니다.",
    complianceNote:
      "출처: MFDS 화장품 안전성 평가 제도 안내 · CPSR 견본 문서 (EC 1223/2009 Annex I, Part A+B) — 모두 프로젝트 자체 참고 문서에서 발췌.",
    footerNote: "프로토타입 — 제출 가능한 규제 문서가 아닙니다.",
  },
} as const;

export type DictKey = keyof (typeof dict)["en"];

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: DictKey) => string;
};

const LanguageContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("ko");
  const t = (key: DictKey) => dict[lang][key];
  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): Ctx {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}

// ---- Wizard-specific matnlar (asosiy lug'atdan alohida, bir xil lang'ni ishlatadi) ----

const wizardDict = {
  en: {
    wizardTitle: "CPSR Safety Assessment Wizard",
    wizardSubtitle: "Data entered here is saved automatically in this browser.",
    stepProductInfo: "Product Info",
    stepIngredients: "Ingredients",
    stepToxicology: "Toxicology",
    stepCertification: "Certification",
    next: "Next step",
    previous: "Previous step",
    reset: "Reset all data",
    savedNote: "Saved automatically",
    // Step 1
    productName: "Product name",
    productType: "Product type",
    targetUser: "Target user",
    rinseType: "Rinse type",
    rinseLeaveOn: "Leave-on",
    rinseRinseOff: "Rinse-off",
    applicationArea: "Application area",
    manufacturer: "Manufacturer",
    responsibleSeller: "Responsible seller",
    required: "required",
    // Step 2
    addIngredient: "+ Add ingredient",
    removeIngredient: "Remove",
    inciName: "INCI name",
    cas: "CAS No.",
    percentInRaw: "% in raw material",
    percentInProduct: "% in product",
    functionRole: "Function",
    totalPercent: "Total (product %)",
    totalWarning: "Total should equal 100%",
    noIngredientsYet: "No ingredients yet — click \"Add ingredient\" to start.",
    // Step 3
    exposureParams: "Exposure parameters",
    amountG: "Daily amount A (g/day)",
    retentionFactor: "Retention factor (RF)",
    bodyWeightKg: "Body weight (kg)",
    dermalAbsorption: "Dermal absorption DAp (%)",
    noael: "NOAEL (mg/kg bw/day)",
    noaelHint: "Leave blank if unknown — will show as \"needs review\"",
    sed: "SED (mg/kg bw/day)",
    mos: "MoS",
    judgment: "Judgment",
    judgmentPass: "PASS (≥100)",
    judgmentReview: "NEEDS REVIEW (<100)",
    judgmentInsufficient: "NOAEL missing",
    formula: "SED = (A × 1000 × RF × C × DAp) / BW · MoS = NOAEL / SED",
    cramerClass: "Cramer class (if NOAEL unknown)",
    cramerNone: "— not selected —",
    ttcResult: "TTC screening",
    ttcWithin: "SED below TTC threshold — low concern",
    ttcExceeded: "SED exceeds TTC threshold — needs review",
    // Step 4
    assessorName: "Safety assessor name",
    reviewDate: "Review date",
    draftNotes: "Draft notes",
    statusDraft: "DRAFT · not_reviewed",
    statusDraftBody:
      "Software does not auto-generate the final safety conclusion. A licensed safety assessor must review every section and sign before this document is submission-ready.",
    summaryTitle: "Summary",
    generateDraft: "Generate CPSR draft (AI)",
    generatingDraft: "Generating…",
    partATitle: "Part A — Product & composition (AI-drafted)",
    partBTitle: "Part B — Weight of Evidence (AI-drafted)",
    dataIntegrityTitle: "Data integrity",
    runId: "Run ID",
    inputHash: "Input hash (SHA-256)",
    configHash: "Config hash (SHA-256)",
    generatedAt: "Generated at",
    demoNotice: "DEMO MODE — no real API keys, this is template text, not Claude.",
  },
  ko: {
    wizardTitle: "CPSR 안전성 평가 마법사",
    wizardSubtitle: "여기 입력한 데이터는 이 브라우저에 자동 저장됩니다.",
    stepProductInfo: "제품 정보",
    stepIngredients: "성분",
    stepToxicology: "독성 평가",
    stepCertification: "인증",
    next: "다음 단계",
    previous: "이전 단계",
    reset: "전체 초기화",
    savedNote: "자동 저장됨",
    // Step 1
    productName: "제품명",
    productType: "제품 유형",
    targetUser: "사용 대상",
    rinseType: "씻어내는 방식",
    rinseLeaveOn: "Leave-on (씻어내지 않음)",
    rinseRinseOff: "Rinse-off (씻어냄)",
    applicationArea: "주요 사용 부위",
    manufacturer: "화장품 제조업자",
    responsibleSeller: "화장품 책임판매업자",
    required: "필수",
    // Step 2
    addIngredient: "+ 성분 추가",
    removeIngredient: "삭제",
    inciName: "INCI 명",
    cas: "CAS 번호",
    percentInRaw: "원료중 %",
    percentInProduct: "제품중 %",
    functionRole: "배합목적",
    totalPercent: "합계 (제품중 %)",
    totalWarning: "합계는 100%가 되어야 합니다",
    noIngredientsYet: "아직 성분이 없습니다 — \"성분 추가\"를 눌러 시작하세요.",
    // Step 3
    exposureParams: "노출 파라미터",
    amountG: "일 적용량 A (g/day)",
    retentionFactor: "잔류계수 (RF)",
    bodyWeightKg: "체중 (kg)",
    dermalAbsorption: "피부흡수율 DAp (%)",
    noael: "NOAEL (mg/kg bw/day)",
    noaelHint: "모르면 비워두세요 — \"검토필요\"로 표시됩니다",
    sed: "SED (mg/kg bw/day)",
    mos: "MoS (안전역)",
    judgment: "판정",
    judgmentPass: "PASS (≥100)",
    judgmentReview: "검토필요 (<100)",
    judgmentInsufficient: "NOAEL 없음",
    formula: "SED = (A × 1000 × RF × C × DAp) / BW · MoS = NOAEL / SED",
    cramerClass: "Cramer class (NOAEL 모를 때)",
    cramerNone: "— 선택 안 됨 —",
    ttcResult: "TTC 스크리닝",
    ttcWithin: "SED가 TTC 이하 — 우려 낮음",
    ttcExceeded: "SED가 TTC 초과 — 검토필요",
    // Step 4
    assessorName: "안전성 평가자 성명",
    reviewDate: "검토일",
    draftNotes: "초안 메모",
    statusDraft: "초안 · not_reviewed",
    statusDraftBody:
      "소프트웨어는 최종 안전성 결론을 자동 생성하지 않습니다. 자격을 갖춘 안전성 평가자가 모든 항목을 검토하고 서명해야 제출 가능 상태가 됩니다.",
    summaryTitle: "요약",
    generateDraft: "CPSR 초안 생성 (AI)",
    generatingDraft: "생성 중…",
    partATitle: "Part A — 제품·조성 (AI 초안)",
    partBTitle: "Part B — Weight of Evidence (AI 초안)",
    dataIntegrityTitle: "데이터 무결성",
    runId: "Run ID",
    inputHash: "입력 해시 (SHA-256)",
    configHash: "설정 해시 (SHA-256)",
    generatedAt: "생성 시각",
    demoNotice: "DEMO 모드 — 실제 API 키 없음, Claude가 아닌 템플릿 텍스트입니다.",
  },
} as const;

export type WizardKey = keyof (typeof wizardDict)["en"];

export function useWizardText() {
  const { lang } = useLanguage();
  return (key: WizardKey) => wizardDict[lang][key];
}
