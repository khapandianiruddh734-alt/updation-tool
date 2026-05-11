import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import type { CompareRow, ChangeLogEntry } from "./types";

type BuildArgs = {
  headers: string[];
  rows: Record<string, string>[];
  compare: CompareRow[];
  changeLog?: ChangeLogEntry[];
  priceCol: string;
  delimiter?: string;
};

function goodsServicesIndex(headers: string[]): number {
  return headers.findIndex((h) => /goods\s*\/?\s*services/i.test(h));
}

function insertRemarksColumn(headers: string[]): { outHeaders: string[]; insertAt: number } {
  const remarksCol = "Update Remarks";
  const gIdx = goodsServicesIndex(headers);
  const outHeaders = [...headers];
  const insertAt = gIdx >= 0 ? gIdx + 1 : outHeaders.length;
  outHeaders.splice(insertAt, 0, remarksCol);
  return { outHeaders, insertAt };
}

export function buildStyledXlsx({
  headers,
  rows,
  compare,
  changeLog,
  priceCol,
}: BuildArgs): Promise<Blob> {
  return (async () => {
    // Insert "Update Remarks" right after "Goods/Services" if present, else at end
    const { outHeaders, insertAt } = insertRemarksColumn(headers);

    // Create workbook using exceljs
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Updated Menu");

    // Add headers
    ws.addRow(outHeaders);
    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD3D3D3" }, // Light gray
    };

    // Add data rows
    rows.forEach((r, i) => {
      const cmp = compare[i];
      const row: (string | number)[] = [];

      for (let hIdx = 0; hIdx < headers.length; hIdx++) {
        const h = headers[hIdx];
        if (h === priceCol && cmp && (cmp.status === "updated" || cmp.status === "multi-match")) {
          row.push(cmp.newPrice);
        } else {
          const v = r[h] ?? "";
          const num = Number(v);
          row.push(v !== "" && !Number.isNaN(num) && /^\s*-?\d+(\.\d+)?\s*$/.test(v) ? num : v);
        }
      }
      row.splice(insertAt, 0, cmp?.remarks ?? "");
      
      const dataRow = ws.addRow(row);
      
      // Find and highlight the price column
      let priceColIndex = -1;
      for (let hIdx = 0; hIdx < headers.length; hIdx++) {
        if (headers[hIdx] === priceCol) {
          priceColIndex = hIdx < insertAt ? hIdx : hIdx + 1;
          break;
        }
      }
      
      // Apply yellow highlighting to updated prices
      if (cmp && (cmp.status === "updated" || cmp.status === "multi-match") && priceColIndex >= 0) {
        const cell = dataRow.getCell(priceColIndex + 1); // +1 because exceljs uses 1-based indexing
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFFF00" }, // Yellow
        };
        cell.font = { bold: true, color: { argb: "FF000000" } }; // Bold black text
        cell.alignment = { horizontal: "center", vertical: "center" };
      }
    });

    // Set column widths
    outHeaders.forEach((h, idx) => {
      const colWidth = Math.min(50, Math.max(12, h.length + 2));
      ws.columns[idx].width = colWidth;
    });

    // Freeze panes
    ws.views = [{ state: "frozen", ySplit: 1 }];

    // Add Change Log sheet if available
    if (changeLog && changeLog.length > 0) {
      const wsChangeLog = wb.addWorksheet("Change Log");
      
      const changeLogHeaders = [
        "Timestamp",
        "Item ID",
        "Item Name",
        "Variation",
        "Old Price",
        "New Price",
        "Change Type",
        "Match Source",
        "Match %",
        "Variation Mapping",
      ];
      
      wsChangeLog.addRow(changeLogHeaders);
      const changeLogHeaderRow = wsChangeLog.getRow(1);
      changeLogHeaderRow.font = { bold: true };
      changeLogHeaderRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD3D3D3" }, // Light gray
      };
      
      changeLog.forEach((entry) => {
        const changeLogRow = wsChangeLog.addRow([
          entry.timestamp,
          entry.itemId,
          entry.itemName,
          entry.variation,
          entry.oldPrice,
          entry.newPrice,
          entry.changeType,
          entry.matchSource,
          entry.matchScore,
          entry.variationMapping,
        ]);
        
        // Highlight Old Price and New Price columns if price was updated
        if (entry.changeType === "price_update") {
          const oldPriceCell = changeLogRow.getCell(5); // Old Price column
          const newPriceCell = changeLogRow.getCell(6); // New Price column
          
          oldPriceCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFFF00" }, // Yellow
          };
          oldPriceCell.font = { bold: true, color: { argb: "FF000000" } };
          oldPriceCell.alignment = { horizontal: "center", vertical: "center" };
          
          newPriceCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFFF00" }, // Yellow
          };
          newPriceCell.font = { bold: true, color: { argb: "FF000000" } };
          newPriceCell.alignment = { horizontal: "center", vertical: "center" };
        }
      });
      
      // Set column widths for change log
      const colWidths = [19, 15, 25, 15, 12, 12, 18, 25, 10, 20];
      wsChangeLog.columns.forEach((col, idx) => {
        col.width = colWidths[idx] || 15;
      });
      
      wsChangeLog.views = [{ state: "frozen", ySplit: 1 }];
    }

    // Write to buffer
    const buffer = await wb.xlsx.writeBuffer();
    return new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  })();
}

export function buildUpdatedCsv({
  headers,
  rows,
  compare,
  priceCol,
  delimiter = ",",
}: BuildArgs): Blob {
  const { outHeaders, insertAt } = insertRemarksColumn(headers);
  const lines = [outHeaders.map((cell) => escapeCsvCell(cell, delimiter)).join(delimiter)];

  rows.forEach((r, i) => {
    const cmp = compare[i];
    const cells = headers.map((h) => {
      if (h === priceCol && cmp && (cmp.status === "updated" || cmp.status === "multi-match")) {
        return String(cmp.newPrice);
      }
      return r[h] ?? "";
    });

    cells.splice(insertAt, 0, cmp?.remarks ?? "");
    lines.push(cells.map((cell) => escapeCsvCell(cell, delimiter)).join(delimiter));
  });

  return new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
}

function escapeCsvCell(value: string | number, delimiter: string): string {
  const s = String(value ?? "");
  return s.includes(delimiter) || /["\r\n]/.test(s)
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

export function buildComparisonCsv(rows: CompareRow[]): Blob {
  const headers = [
    "Row",
    "Item Name",
    "Variation",
    "Old Price",
    "New Price",
    "Status",
    "Remarks",
    "Matched Source",
    "Score",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    const cells = [
      r.rowIndex,
      r.itemName,
      r.variation,
      r.oldPrice,
      r.newPrice,
      r.status,
      r.remarks,
      r.matchedSource ?? "",
      r.matchScore ?? "",
    ].map((v) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    });
    lines.push(cells.join(","));
  }
  return new Blob([lines.join("\n")], { type: "text/csv" });
}
