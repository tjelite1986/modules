# tabular-pdf-generator

A jsPDF helper for documents with the same shape: title + a few header rows ("Period: ...", "Customer: ...") + a column-based body table + a summary/totals box + an optional footer disclaimer.

In the source project (tidsrapport) this powers the payslip ("lönebesked"). The same pattern fits invoices, shipping manifests, expense reports, anything with that shape.

## What's included

- `lib/pdf-generator.ts` — `generateTabularPdf(options)` + `formatPdfNumber()`
- `lib/example-payslip.ts` — *optional* — Swedish payslip implementation as a reference

## API

```ts
import { generateTabularPdf, formatPdfNumber } from "@/lib/pdf-generator";

const doc = generateTabularPdf({
  title: "Invoice #2026-001",

  headerRows: [
    { label: "Date", value: "2026-05-03" },
    { label: "Customer", value: "ACME AB" },
    { label: "Reference", value: "PO-1234" },
  ],

  columnHeaders: ["Description", "Qty", "Unit", "Rate", "Amount"],
  columnOffsets: [0, 60, 90, 110, 130],   // mm from left margin

  bodyRows: [
    { cells: ["Consulting", "10",  "h", "1500", "15 000"] },
    { cells: ["Travel",      "1",   "lump", "", "2 500"] },
  ],

  summaryRows: [
    { label: "Subtotal:", value: "17 500 kr" },
    { label: "VAT (25%):", value: "4 375 kr" },
    { label: "Total:", value: "21 875 kr", emphasis: true },
  ],

  footerLines: [
    "Payment due within 30 days.",
    "Bankgiro 1234-5678. Mark transfer with invoice number.",
  ],
});

doc.save("invoice-2026-001.pdf");
```

## Options

| Field | Required | Notes |
|---|---|---|
| `title` | yes | Big bold heading at the top |
| `pageSize` | no | `"a4"` (default) or `"letter"` |
| `margin` | no | mm, default 20 |
| `headerRows` | no | "Label: value" rows under the title |
| `columnHeaders` | yes | Bolded header row |
| `columnOffsets` | yes | Same length as columnHeaders, mm from left margin |
| `bodyRows` | yes | Each row is `{ cells: string[] }` |
| `summaryRows` | no | Coloured box at the bottom |
| `summaryTitle` | no | Heading inside the summary box |
| `footerLines` | no | Fine-print at the page bottom |

Summary rows support:
- `isDeduction: true` → prepends a minus sign on the value
- `emphasis: true` → renders larger and bold (use for the final "Total" / "Net" line)

## Number formatting

```ts
formatPdfNumber(15000);                    // "15,000.00" (en-US default)
formatPdfNumber(15000, "sv-SE");           // "15 000,00"
formatPdfNumber(15000, "sv-SE", 0);        // "15 000"
```

## Worked example: Swedish payslip

`lib/example-payslip.ts` implements `generatePayslipPDF(data)` — pass it your computed values (basePay, OB breakdown, overtime, sick pay, vacation accrual, gross/tax/net) and you get a complete A4 payslip. Use it as a reference when adapting to your own document type.

## Limitations

- Single-page only — no automatic page breaks. If your body has more rows than fit, paginate yourself by calling `generateTabularPdf` once per chunk and merging.
- No images/logos. Add a logo with `doc.addImage(...)` after generating, before `save()`.
- Latin-1 fonts only (helvetica). For Cyrillic / CJK / extended Latin glyphs, register a custom TTF via `doc.addFileToVFS()` + `doc.addFont()`.

## Customization

- **Colours** — the summary box uses a blue stroke / pale-blue fill. Edit `setFillColor()` / `setDrawColor()` in `pdf-generator.ts` for your brand.
- **Currency suffix** — none built in; embed it in the value strings ("15 000 kr").
- **Multi-currency** — pass a different locale to `formatPdfNumber`.
