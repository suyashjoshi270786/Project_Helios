import PDFDocument from "pdfkit";
import type { DocBlock } from "./model.js";

const MARGIN = 50;

function drawTable(doc: PDFKit.PDFDocument, headers: string[], rows: string[][]) {
  const usableWidth = doc.page.width - MARGIN * 2;
  const colWidth = usableWidth / headers.length;

  function drawRow(cells: string[], bold: boolean) {
    const startY = doc.y;
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9);
    let maxHeight = 0;
    cells.forEach((text, i) => {
      const height = doc.heightOfString(text || "—", { width: colWidth - 8 });
      maxHeight = Math.max(maxHeight, height);
    });
    if (startY + maxHeight + 8 > doc.page.height - MARGIN) {
      doc.addPage();
    }
    const rowY = doc.y;
    cells.forEach((text, i) => {
      doc.text(text || "—", MARGIN + i * colWidth + 4, rowY, { width: colWidth - 8 });
    });
    doc.y = rowY + maxHeight + 6;
    doc
      .moveTo(MARGIN, doc.y - 2)
      .lineTo(MARGIN + usableWidth, doc.y - 2)
      .strokeColor("#cccccc")
      .stroke();
  }

  drawRow(headers, true);
  if (rows.length === 0) drawRow(headers.map(() => "—"), false);
  rows.forEach((row) => drawRow(row, false));
  doc.moveDown(0.5);
}

function blockToPdf(doc: PDFKit.PDFDocument, block: DocBlock) {
  switch (block.type) {
    case "heading":
      doc
        .font("Helvetica-Bold")
        .fontSize(block.level === 1 ? 20 : 13)
        .text(block.text, { paragraphGap: 6 })
        .moveDown(0.3);
      return;
    case "paragraph":
      doc
        .font("Helvetica")
        .fontSize(10)
        .text(block.text || "—", { align: "left" })
        .moveDown(0.5);
      return;
    case "keyValueGrid":
      drawTable(
        doc,
        ["Field", "Value"],
        block.pairs.map(([k, v]) => [k, v]),
      );
      return;
    case "table":
      drawTable(doc, block.headers, block.rows);
      return;
    case "checklist":
      doc.font("Helvetica").fontSize(10);
      if (block.items.length === 0) {
        doc.text("—").moveDown(0.2);
      } else {
        block.items.forEach((item) => doc.text(`${item.checked ? "[x]" : "[ ]"} ${item.label}`).moveDown(0.1));
      }
      doc.moveDown(0.3);
      return;
  }
}

export async function renderTestPlanPdf(blocks: DocBlock[], title: string): Promise<Buffer> {
  const doc = new PDFDocument({ margin: MARGIN, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  blocks.forEach((block) => blockToPdf(doc, block));

  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#888888")
      .text(`HeliosQE — ${title}`, MARGIN, doc.page.height - 30, { width: 300, align: "left" })
      .text(`Page ${i + 1} of ${range.count}`, doc.page.width - MARGIN - 150, doc.page.height - 30, {
        width: 150,
        align: "right",
      });
  }

  doc.end();
  return done;
}
