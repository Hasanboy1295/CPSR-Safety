import { PDFDocument } from "pdf-lib";
(async () => {
  const doc = await PDFDocument.create();
  doc.addPage();
  const { PDFParse } = await import("pdf-parse");
  try {
    const parser = new PDFParse({ data: new Uint8Array(await doc.save()) });
    const res = await parser.getText();
    console.log("OK", JSON.stringify(res.text.slice(0, 50)));
    await parser.destroy();
  } catch (e) {
    console.log("ERR", (e as Error).message);
  }
})();
