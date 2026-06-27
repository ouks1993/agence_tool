/**
 * Builds an .xlsx workbook (one sheet per dataset) from the same
 * {columns, rows} shape the CSV writer uses, via exceljs. Server-only (Node).
 */
import ExcelJS from "exceljs";
import type { Cell } from "./csv";

export type Sheet = { name: string; columns: string[]; rows: Cell[][] };

export async function toXlsx(sheets: Sheet[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Atlas";
  for (const sheet of sheets) {
    // Excel sheet names max 31 chars and can't contain : \ / ? * [ ]
    const safeName = sheet.name.replace(/[:\\/?*[\]]/g, " ").slice(0, 31);
    const ws = wb.addWorksheet(safeName);
    ws.addRow(sheet.columns);
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    for (const r of sheet.rows) ws.addRow(r);
    ws.columns?.forEach((col) => {
      col.width = 20;
    });
  }
  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
