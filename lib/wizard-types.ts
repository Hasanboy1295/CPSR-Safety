export type ProductInfo = {
  productName: string;
  productType: string;
  targetUser: string;
  rinseType: "leave-on" | "rinse-off";
  applicationArea: string;
  manufacturer: string;
  responsibleSeller: string;
};

export type IngredientRow = {
  id: string;
  inciName: string;
  cas: string;
  percentInRaw: string; // 원료중 % (matn sifatida, forma uchun qulay)
  percentInProduct: string; // 제품중 %
  functionRole: string;
  dermalAbsorptionPercent: string; // DAp, default "100" (konservativ)
  noael: string; // mg/kg bw/day — bo'sh bo'lishi mumkin ("검토필요")
};

export type ExposureParams = {
  amountG: string; // A, default "0.8"
  retentionFactor: string; // RF, default "1.0" (leave-on) / "0.01" (rinse-off)
  bodyWeightKg: string; // BW, default "60"
};

export type Certification = {
  assessorName: string;
  reviewDate: string;
  draftNotes: string;
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

export function newIngredientRow(): IngredientRow {
  return {
    id: crypto.randomUUID(),
    inciName: "",
    cas: "",
    percentInRaw: "100",
    percentInProduct: "",
    functionRole: "",
    dermalAbsorptionPercent: "100",
    noael: "",
  };
}

export const emptyExposure: ExposureParams = {
  amountG: "0.8",
  retentionFactor: "1.0",
  bodyWeightKg: "60",
};

export const emptyCertification: Certification = {
  assessorName: "",
  reviewDate: "",
  draftNotes: "",
};

export const emptyWizardData: WizardData = {
  productInfo: emptyProductInfo,
  ingredients: [],
  exposure: emptyExposure,
  certification: emptyCertification,
};

export const WIZARD_STORAGE_KEY = "auto-cpsr:wizard-data:v1";
