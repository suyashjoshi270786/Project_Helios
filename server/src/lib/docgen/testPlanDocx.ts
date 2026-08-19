import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  Header,
  Footer,
  PageNumber,
  AlignmentType,
} from "docx";
import type { DocBlock } from "./model.js";

function cell(text: string, opts: { header?: boolean } = {}) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, bold: opts.header })] })],
    width: { size: 100, type: WidthType.AUTO },
  });
}

function blockToDocxElements(block: DocBlock) {
  switch (block.type) {
    case "heading":
      return [
        new Paragraph({
          heading: block.level === 1 ? HeadingLevel.TITLE : HeadingLevel.HEADING_1,
          text: block.text,
        }),
      ];
    case "paragraph":
      return [new Paragraph({ text: block.text || "—" })];
    case "keyValueGrid":
      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: block.pairs.map(([k, v]) => new TableRow({ children: [cell(k, { header: true }), cell(v)] })),
        }),
        new Paragraph({ text: "" }),
      ];
    case "table":
      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ children: block.headers.map((h) => cell(h, { header: true })) }),
            ...block.rows.map((row) => new TableRow({ children: row.map((v) => cell(v)) })),
          ],
        }),
        new Paragraph({ text: "" }),
      ];
    case "checklist":
      return block.items.length > 0
        ? block.items.map((item) => new Paragraph({ text: `${item.checked ? "☑" : "☐"} ${item.label}` }))
        : [new Paragraph({ text: "—" })];
  }
}

export async function renderTestPlanDocx(blocks: DocBlock[], title: string): Promise<Buffer> {
  const doc = new Document({
    sections: [
      {
        headers: {
          default: new Header({
            children: [new Paragraph({ text: `HeliosQE — ${title}`, alignment: AlignmentType.RIGHT })],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ children: ["Page ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES] }),
                ],
              }),
            ],
          }),
        },
        children: blocks.flatMap(blockToDocxElements),
      },
    ],
  });

  return Packer.toBuffer(doc);
}
