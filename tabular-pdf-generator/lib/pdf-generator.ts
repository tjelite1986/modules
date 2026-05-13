import jsPDF from "jspdf";

/**
 * Header rows shown above the table. Order matters — first entry first.
 */
export interface HeaderRow {
  label: string;
  value: string;
}

/**
 * One body row. Pass empty strings for cells you want to skip — the column
 * count stays consistent.
 */
export interface BodyRow {
  cells: string[];
}

/**
 * One row in the summary box at the bottom (label + value, optional negative
 * formatting like "-1 234 kr" for tax/deduction rows).
 */
export interface SummaryRow {
  label: string;
  value: string;
  /** Pre-pend a minus sign when rendering. */
  isDeduction?: boolean;
  /** Render bigger/bolder — typically the final "Net" / "Total" row. */
  emphasis?: boolean;
}

export interface TabularPdfOptions {
  /** Big bold heading at the top (e.g. "Payslip", "Invoice", "Manifest"). */
  title: string;
  /** Page size. Default: A4 portrait, mm. */
  pageSize?: "a4" | "letter";
  /** Outer margin in mm. Default: 20. */
  margin?: number;

  /** Optional rows of "Label: value" shown under the title. */
  headerRows?: HeaderRow[];

  /** Column headers for the table. */
  columnHeaders: string[];
  /** Column x-offsets (mm) measured from the left margin. Same length as columnHeaders. */
  columnOffsets: number[];
  /** Body rows. */
  bodyRows: BodyRow[];

  /** Summary rows shown in a coloured box below the table. */
  summaryRows?: SummaryRow[];
  /** Heading for the summary box. Default: "Summary". */
  summaryTitle?: string;

  /** Optional disclaimer rendered in fine print at the page bottom. */
  footerLines?: string[];
}

/**
 * Build a generic tabular PDF (header rows, body table, summary box, footer).
 * Used in the source project for payslips; works equally for invoices,
 * shipping manifests, expense reports, anything with a "header + line items
 * + totals" shape.
 */
export function generateTabularPdf(opts: TabularPdfOptions): jsPDF {
  const {
    title,
    pageSize = "a4",
    margin = 20,
    headerRows = [],
    columnHeaders,
    columnOffsets,
    bodyRows,
    summaryRows = [],
    summaryTitle = "Summary",
    footerLines = [],
  } = opts;

  if (columnHeaders.length !== columnOffsets.length) {
    throw new Error("columnHeaders and columnOffsets must be the same length");
  }

  const doc = new jsPDF("p", "mm", pageSize);
  const pageWidth = pageSize === "a4" ? 210 : 216;
  const contentWidth = pageWidth - 2 * margin;
  let y = margin;

  // Title
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(title, margin, y);
  y += 10;

  // Header rows
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  for (const row of headerRows) {
    doc.text(`${row.label}: ${row.value}`, margin, y);
    y += 5;
  }
  y += 3;

  // Separator
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // Column headers
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y - 4, contentWidth, 7, "F");

  for (let i = 0; i < columnHeaders.length; i++) {
    doc.text(columnHeaders[i], margin + columnOffsets[i], y);
  }
  y += 8;

  // Body rows
  doc.setFont("helvetica", "normal");
  for (const row of bodyRows) {
    for (let i = 0; i < row.cells.length && i < columnHeaders.length; i++) {
      doc.text(row.cells[i], margin + columnOffsets[i], y);
    }
    y += 5.5;
  }

  // Summary
  if (summaryRows.length > 0) {
    y += 3;
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    const boxHeight = 7 + summaryRows.length * 5 + summaryRows.filter((r) => r.emphasis).length * 4;

    doc.setFillColor(245, 250, 255);
    doc.rect(margin, y - 4, contentWidth, boxHeight, "F");
    doc.setDrawColor(59, 130, 246);
    doc.rect(margin, y - 4, contentWidth, boxHeight);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(summaryTitle, margin + 4, y);
    y += 7;

    for (const row of summaryRows) {
      doc.setFont("helvetica", row.emphasis ? "bold" : "normal");
      doc.setFontSize(row.emphasis ? 14 : 9);
      const valueText = (row.isDeduction ? "-" : "") + row.value;
      doc.text(row.label, margin + 4, y);
      doc.text(valueText, margin + contentWidth - 4, y, { align: "right" });
      y += row.emphasis ? 9 : 5;
    }
  }

  // Footer
  if (footerLines.length > 0) {
    const footerY = pageSize === "a4" ? 270 : 250;
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    let fy = footerY;
    for (const line of footerLines) {
      doc.text(line, margin, fy);
      fy += 3.5;
    }
  }

  return doc;
}

/** Format a number using the supplied locale. Default: en-US, 2 decimals. */
export function formatPdfNumber(
  amount: number,
  locale = "en-US",
  fractionDigits = 2,
): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}
