export type ProductInfo = {
  productName: string;
  productType: string;
  targetUser: string;
  rinseType: "leave-on" | "rinse-off";
  applicationArea: string;
  manufacturer: string;
  responsibleSeller: string;
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

export type ExposureParams = {
  amountG: string; // A, default "0.8"
  retentionFactor: string; // RF, default "1.0" (leave-on) / "0.01" (rinse-off)
  bodyWeightKg: string; // BW, default "60"
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
};

export const emptyExposure: ExposureParams = {
  amountG: "0.8",
  retentionFactor: "1.0",
  bodyWeightKg: "60",
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
  exposure: emptyExposure,
  certification: emptyCertification,
};

export const WIZARD_STORAGE_KEY = "auto-cpsr:wizard-data:v2";
