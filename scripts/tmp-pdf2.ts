import { readFileSync } from "node:fs";
import { PDFParse } from "pdf-parse";
(async () => {
  for (const f of ["sample-cpsr.pdf", "sample-cpsr-demo.pdf"]) {
    try {
      const buf = readFileSync(f);
      const parser = new PDFParse({ data: new Uint8Array(buf) });
      const res = await parser.getText();
      console.log(f, "OK", res.text.slice(0, 60).replace(/\n/g, " "));
      await parser.destroy();
    } catch (e) {
      console.log(f, "ERR:", (e as Error).message);
    }
  }
})();
