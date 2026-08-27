import { readFileSync } from "node:fs";
import pdf from "pdf-parse";
import * as XLSX from "xlsx";
(async () => {
  // 1. pdf-parse v1
  try {
    const data = await pdf(readFileSync("sample-cpsr.pdf"));
    console.log("v1 OK pages:", data.numpages, "| text:", data.text.slice(0, 40).replace(/\n/g, " "));
  } catch (e) {
    console.log("v1 ERR:", (e as Error).message);
  }
  // 2. xlsx (SheetJS) real .xlsx parse
  try {
    const wb = XLSX.read("dummy", { type: "buffer" });
    console.log("xlsx import OK");
  } catch (e) {
    console.log("xlsx ERR:", (e as Error).message);
  }
})();
