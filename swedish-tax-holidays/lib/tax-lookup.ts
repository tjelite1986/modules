/**
 * Skatteverket monthly tax-table lookup.
 *
 * The two JSON files (tax-data-2025.json, tax-data-2026.json) are parsed
 * exports of Skatteverket's official tax tables, column 1 (normal employment
 * income, under 66, with jobbskatteavdrag).
 *
 * The format encodes both:
 *   - `brackets`: fixed lookup rows (income up to ~80 000 kr/month)
 *   - `percentBrackets`: rate-based rows (income above the table)
 */
import taxData2025 from "../data/tax-data-2025.json";
import taxData2026 from "../data/tax-data-2026.json";
import municipalityData from "../data/municipalities-2026.json";

interface TaxBracket {
  from: number;
  to: number | null;
  tax: number;
}

interface PercentBracket {
  from: number;
  to: number | null;
  rate: number;
}

interface TableData {
  brackets: TaxBracket[];
  percentBrackets: PercentBracket[];
}

const tablesByYear: Record<number, Record<string, TableData>> = {
  2025: taxData2025 as Record<string, TableData>,
  2026: taxData2026 as Record<string, TableData>,
};

const municipalities = municipalityData as Record<
  string,
  { name: string; totalTaxRate: number; tableNumber: number }
>;

function getTablesForYear(year: number): Record<string, TableData> {
  return tablesByYear[year] || tablesByYear[2026];
}

/**
 * Look up monthly tax in kronor for a given gross monthly income and tax
 * table number (29-42). Pass `year` to choose which year's tables to use;
 * defaults to the current year, falling back to 2026 if the year isn't
 * bundled.
 */
export function lookupMonthlyTax(
  grossMonthly: number,
  tableNumber: number,
  year?: number,
): number {
  const tables = getTablesForYear(year || new Date().getFullYear());
  const table = tables[String(tableNumber)];
  if (!table) return 0;

  const rounded = Math.round(grossMonthly);

  // Fixed brackets first (up to ~80 000 kr/month)
  for (const bracket of table.brackets) {
    const to = bracket.to ?? Infinity;
    if (rounded >= bracket.from && rounded <= to) {
      return bracket.tax;
    }
  }

  // Then rate-based brackets (above the table)
  for (const bracket of table.percentBrackets) {
    const to = bracket.to ?? Infinity;
    if (rounded >= bracket.from && rounded <= to) {
      return Math.round((rounded * bracket.rate) / 100);
    }
  }

  // Fallback: above all brackets — apply the last percent bracket's rate
  const lastBracket = table.percentBrackets[table.percentBrackets.length - 1];
  if (lastBracket) {
    return Math.round((rounded * lastBracket.rate) / 100);
  }

  return 0;
}

/**
 * Map a municipal tax rate to the Skatteverket table number (29-42).
 * Rounds to the nearest integer and clamps to the valid range.
 */
export function getTableNumber(municipalTaxRate: number): number {
  const rounded = Math.round(municipalTaxRate);
  return Math.max(29, Math.min(42, rounded));
}

/**
 * Get the table number for a Swedish municipality by name. Case-insensitive.
 * Returns null if the municipality isn't in the bundled list.
 */
export function getMunicipalityTable(municipalityName: string): number | null {
  const entry =
    municipalities[municipalityName] ||
    municipalities[municipalityName.toUpperCase()];
  return entry ? entry.tableNumber : null;
}

function titleCase(str: string): string {
  return str.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

/**
 * List every Swedish municipality with its total tax rate and table number.
 * Sorted by name (sv-SE locale).
 */
export function getMunicipalityList(): {
  name: string;
  taxRate: number;
  tableNumber: number;
}[] {
  return Object.values(municipalities)
    .map((m) => ({
      name: titleCase(m.name),
      taxRate: m.totalTaxRate,
      tableNumber: m.tableNumber,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "sv"));
}

/** Get the table numbers shipped in the bundled JSON (typically 29..42). */
export function getAvailableTableNumbers(): number[] {
  return Object.keys(tablesByYear[2026])
    .map(Number)
    .sort((a, b) => a - b);
}

/** Get the years for which tax tables are bundled. */
export function getAvailableYears(): number[] {
  return Object.keys(tablesByYear)
    .map(Number)
    .sort((a, b) => a - b);
}
