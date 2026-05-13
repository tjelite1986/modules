/**
 * Example: build a Swedish-style payslip ("lönebesked") with the tabular
 * PDF generator. Use this as a reference when adapting to invoices,
 * manifests, expense reports etc.
 *
 * Plug your own data shape into PayslipData and call generatePayslipPDF.
 */
import jsPDF from "jspdf";
import { generateTabularPdf, formatPdfNumber } from "./pdf-generator";

interface PayslipData {
  month: string;
  employeeName: string;
  employerName: string;
  hourlyRate: number;
  workHours: number;
  basePay: number;
  obBreakdown: { percent: number; hours: number; amount: number }[];
  overtimePay?: { label: string; amount: number }[];
  sickDays?: number;
  sickPay?: number;
  vacationPay?: number;
  vacationPayRate?: number;
  vacationDaysPay?: number;
  vacationDaysCount?: number;
  grossPay: number;
  tax: number;
  taxRate: number;
  netPay: number;
  totalHours: number;
}

export function generatePayslipPDF(data: PayslipData): jsPDF {
  const fmt = (n: number) => formatPdfNumber(n, "sv-SE");

  // Body rows
  const bodyRows = [
    {
      cells: [
        "Hourly pay",
        data.workHours.toFixed(2),
        "h",
        fmt(data.hourlyRate),
        fmt(data.basePay),
      ],
    },
    ...data.obBreakdown.map((ob) => ({
      cells: [
        `OB allowance ${ob.percent}%`,
        ob.hours.toFixed(2),
        "h",
        fmt((data.hourlyRate * ob.percent) / 100),
        fmt(ob.amount),
      ],
    })),
    ...(data.overtimePay ?? []).map((o) => ({
      cells: [o.label, "", "", "", fmt(o.amount)],
    })),
  ];

  if (data.sickPay && data.sickPay > 0) {
    bodyRows.push({
      cells: ["Sick pay (80%)", String(data.sickDays ?? 0), "days", "", fmt(data.sickPay)],
    });
  }

  if (data.vacationDaysPay && data.vacationDaysCount) {
    const dailyRate = data.vacationDaysPay / data.vacationDaysCount;
    bodyRows.push({
      cells: [
        "Vacation pay",
        String(data.vacationDaysCount),
        "days",
        fmt(dailyRate),
        fmt(data.vacationDaysPay),
      ],
    });
  }

  if (data.vacationPay && data.vacationPay > 0) {
    bodyRows.push({
      cells: [
        `Vacation accrual (${data.vacationPayRate ?? 12}%)`,
        "",
        "",
        "",
        fmt(data.vacationPay),
      ],
    });
  }

  return generateTabularPdf({
    title: "Payslip",
    headerRows: [
      { label: "Period", value: data.month },
      { label: "Employer", value: data.employerName },
      { label: "Employee", value: data.employeeName },
    ],
    columnHeaders: ["Item", "Qty", "Unit", "Rate", "Amount"],
    columnOffsets: [0, 60, 90, 110, 130],
    bodyRows,
    summaryTitle: "Summary",
    summaryRows: [
      { label: "Gross pay:", value: `${fmt(data.grossPay)} kr` },
      {
        label: `Tax (${data.taxRate}%):`,
        value: `${fmt(data.tax)} kr`,
        isDeduction: true,
      },
      { label: "Hours worked:", value: `${data.totalHours.toFixed(2)} h` },
      { label: "Net pay:", value: `${fmt(data.netPay)} kr`, emphasis: true },
    ],
    footerLines: [
      "This payslip is an estimate based on logged times and contract settings.",
      "It does not replace an official payslip from your employer.",
    ],
  });
}
