// CPSR_KR_dossier_v7_3 §1 (표 1-1) bo'yicha mahsulot identifikatsiyasi va
// boshqaruv ma'lumotlari. Bo'sh maydonlar PDF'da "검토필요" deb ko'rsatiladi
// (kitob qoidasi: ma'lumot yo'q joyga yozma — uydirma kiritmaymiz).
export type ProductInfo = {
  productName: string;
  productType: string;
  targetUser: string;
  rinseType: "leave-on" | "rinse-off";
  applicationArea: string;
  manufacturer: string;
  responsibleSeller: string;
  productCode: string; // 제품 코드 / 품목보고번호
  batchRef: string; // 처방/배치 참조번호
  salesMarket: string; // 판매 시장
  version: string; // 버전 (예: "Rev. 1.3")
  refNo: string; // CPSR 참조번호 (예: "CPSR-2026-0001")
  responsiblePerson: string; // 책임자 (Responsible Person, EU)
  gmpSite: string; // 제조소 GMP (ISO 22716)
  useInstructions: string; // 사용 방법 (용법·용량) — §2.1.5
  cmrDeclaration: string; // CMR 선언 (§1 표 1-3)
  nanoDeclaration: string; // 나노 선언 (§1 표 1-4)
  hasFragrance: "yes" | "no" | ""; // 향료(PARFUM) 배합 여부
  hasColorant: "yes" | "no" | ""; // 착색제 배합 여부
};

export type ToxEndpointStatus = "unknown" | "available" | "not_available";

// veneks/21512 kabi real CPSR'larda har INCI substansiyaga tegishli
// standart toksikologiya endpoint battery'si (NOAEL yolg'iz emas).
export type ToxicologyProfile = {
  acuteToxicity: ToxEndpointStatus;
  skinIrritation: ToxEndpointStatus;
  eyeIrritation: ToxEndpointStatus;
  skinSensitization: ToxEndpointStatus;
  genotoxicity: ToxEndpointStatus;
  carcinogenicity: ToxEndpointStatus;
  reproductiveToxicity: ToxEndpointStatus;
  phototoxicity: ToxEndpointStatus;
  notes: string; // manba/izoh, masalan "CIR Final Report 2014"
};

export function emptyToxicologyProfile(): ToxicologyProfile {
  return {
    acuteToxicity: "unknown",
    skinIrritation: "unknown",
    eyeIrritation: "unknown",
    skinSensitization: "unknown",
    genotoxicity: "unknown",
    carcinogenicity: "unknown",
    reproductiveToxicity: "unknown",
    phototoxicity: "unknown",
    notes: "",
  };
}

// Bitta INCI substansiyasi — SED/MoS shu daraja uchun hisoblanadi
// (Kosili misolidagi kabi, bitta xomashyo ichida bir nechtasi bo'lishi mumkin).
export type INCIComponent = {
  id: string;
  inciName: string;
  cas: string;
  percentActiveInRaw: string; // 원료중 % — shu INCI xomashyoning necha foizini tashkil qiladi
  functionRole: string;
  dermalAbsorptionPercent: string; // DAp, default "100" (konservativ)
  noael: string; // mg/kg bw/day — bo'sh bo'lishi mumkin ("검토필요")
  cramerClass: "" | "I" | "II" | "III"; // NOAEL yo'q bo'lganda TTC skrining uchun
  tox: ToxicologyProfile;
  // §2.1.2 표 2-2 — 성분별 물리·화학적 특성 (kitob talabi; bo'sh bo'lsa 검토필요)
  molecularWeight: string; // 분자량 (Da)
  physicalForm: string; // 형태 (예: "담황 고체/오일")
  solubility: string; // 용해도
  logKow: string; // log Kow
  uvAbsorption: string; // UV 흡수 특성
};

export function newComponent(): INCIComponent {
  return {
    id: crypto.randomUUID(),
    inciName: "",
    cas: "",
    percentActiveInRaw: "100",
    functionRole: "",
    dermalAbsorptionPercent: "100",
    noael: "",
    cramerClass: "",
    tox: emptyToxicologyProfile(),
    molecularWeight: "",
    physicalForm: "",
    solubility: "",
    logKow: "",
    uvAbsorption: "",
  };
}

// Xomashyo (원료/상품명) — bitta yoki bir nechta INCI komponentdan tashkil topadi
// (Kosili "Nipaguard SCP" = Sorbitan Caprylate + Phenoxyethanol kabi).
export type IngredientRow = {
  id: string;
  tradeName: string; // 원료 상품명, masalan "Nipaguard SCP" (bo'sh bo'lsa INCI nomi bilan bir xil deb olinadi)
  percentInProduct: string; // 제품중 % — shu xomashyoning butun mahsulotdagi ulushi
  components: INCIComponent[];
};

export function newIngredientRow(): IngredientRow {
  return {
    id: crypto.randomUUID(),
    tradeName: "",
    percentInProduct: "",
    components: [newComponent()],
  };
}

// Har INCI komponentni hisob-kitob uchun "yassi" (flat) ro'yxatga aylantiradi —
// StepToxicology/StepCertification/report.ts barchasi shundan foydalanadi.
export type FlatComponent = INCIComponent & {
  rawMaterialId: string;
  tradeName: string;
  percentInProduct: number; // = xomashyo% * shu_INCI_ning_xomashyodagi% / 100
};

export function flattenIngredients(rows: IngredientRow[]): FlatComponent[] {
  return rows.flatMap((row) => {
    const rawPct = parseFloat(row.percentInProduct) || 0;
    return row.components.map((c) => {
      const activePct = parseFloat(c.percentActiveInRaw);
      const effectiveActivePct = Number.isFinite(activePct) ? activePct : 100;
      return {
        ...c,
        rawMaterialId: row.id,
        tradeName: row.tradeName || c.inciName,
        percentInProduct: (rawPct * effectiveActivePct) / 100,
      };
    });
  });
}

// Real CPSR namunasi (CPSR_고보습_영유아_로션.docx, 4-6-bo'lim) asosida —
// fizik-kimyoviy xususiyat, barqarorlik, mikrobiologiya, qadoqlash.
// AI EMAS — foydalanuvchi laboratoriya natijasini shu yerga kiritadi.
export type ProductQuality = {
  physicalForm: string; // 성상 — masalan "반투명한 백색의 에멀젼"
  ph: string;
  viscosityRange: string; // 점도 (cPs)
  stabilityResult: string; // 장기보존/가속시험 natijasi
  paoMonths: string; // 개봉 후 사용기간 (oy)
  microbialLimitResult: string; // 미생물한도 시험natijasi
  challengeTestResult: string; // 보존력 시험 (Challenge Test, ISO 11930)
  heavyMetalsResult: string; // og'ir metall (Pb/As/Hg/Sb/Cd) natijasi
  packagingMaterial: string; // birlamchi idish materiali
  packagingSafetyNote: string; // moslik/migratsiya testi
  allergenNote: string; // atir tarkibidagi allergen tekshiruvi
  // §2.1.3 표 2-5 — ISO 17516 kategoriya + 특정세균
  microCategory: "" | "Cat1" | "Cat2"; // 눈/영유아 → Cat1, 기타 → Cat2
  specificBacteriaResult: string; // 특정세균 (대장균·녹농균·황색포도상구균)
  // §2.1.4 표 2-7 — 불순물 실측 (1,4-dioxane, 니트로사민) + 포장 이행
  impurityDioxaneResult: string; // 1,4-Dioxane
  impurityNitrosamineResult: string; // N-니트로사민 (정성/정량)
  packagingMigrationResult: string; // 포장재-내용물 이행 시험 결과
  // §2.1.2 표 2-4 — 안정성 시험 유형별 결과
  stabilityAcceleratedResult: string; // 가속 40°C/75%RH
  stabilityLongTermResult: string; // 장기 25°C
  stabilityFreezeThawResult: string; // 저온/동결-융해
  stabilityPhotoResult: string; // 광안정성 (RETINOL kabi fotosensitiv 성분)
};

export function emptyProductQuality(): ProductQuality {
  return {
    physicalForm: "",
    ph: "",
    viscosityRange: "",
    stabilityResult: "",
    paoMonths: "",
    microbialLimitResult: "",
    challengeTestResult: "",
    heavyMetalsResult: "",
    packagingMaterial: "",
    packagingSafetyNote: "",
    allergenNote: "",
    microCategory: "",
    specificBacteriaResult: "",
    impurityDioxaneResult: "",
    impurityNitrosamineResult: "",
    packagingMigrationResult: "",
    stabilityAcceleratedResult: "",
    stabilityLongTermResult: "",
    stabilityFreezeThawResult: "",
    stabilityPhotoResult: "",
  };
}

export type ExposureParams = {
  amountG: string; // A, default "0.8"
  retentionFactor: string; // RF, default "1.0" (leave-on) / "0.01" (rinse-off)
  bodyWeightKg: string; // BW, default "60"
  frequency: string; // F (적용 빈도), default "1" 회/일
};

export type Certification = {
  assessorName: string;
  assessorPosition: string;
  assessorQualification: string;
  reviewDate: string;
  draftNotes: string;
  selfCertified: boolean;
};

export type WizardData = {
  productInfo: ProductInfo;
  ingredients: IngredientRow[];
  productQuality: ProductQuality;
  exposure: ExposureParams;
  certification: Certification;
};

export const emptyProductInfo: ProductInfo = {
  productName: "",
  productType: "",
  targetUser: "",
  rinseType: "leave-on",
  applicationArea: "",
  manufacturer: "",
  responsibleSeller: "",
  productCode: "",
  batchRef: "",
  salesMarket: "",
  version: "",
  refNo: "",
  responsiblePerson: "",
  gmpSite: "",
  useInstructions: "",
  cmrDeclaration: "",
  nanoDeclaration: "",
  hasFragrance: "",
  hasColorant: "",
};

export const emptyExposure: ExposureParams = {
  amountG: "0.8",
  retentionFactor: "1.0",
  bodyWeightKg: "60",
  frequency: "1",
};

export const emptyCertification: Certification = {
  assessorName: "",
  assessorPosition: "",
  assessorQualification: "",
  reviewDate: "",
  draftNotes: "",
  selfCertified: false,
};

export const emptyWizardData: WizardData = {
  productInfo: emptyProductInfo,
  ingredients: [],
  productQuality: emptyProductQuality(),
  exposure: emptyExposure,
  certification: emptyCertification,
};

export const WIZARD_STORAGE_KEY = "auto-cpsr:wizard-data:v4";
