/**
 * Convert a Swedish organisation number to its EU VAT format:
 * SE + 10 digits + "01". Returns "" if the input is not 10 digits.
 *
 * Example: "556471-4474" → "SE556471447401"
 */
export function toSwedishVatNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 10) return "";
  return `SE${digits}01`;
}

/**
 * Format a 10-digit Swedish organisation number with a dash:
 * "5564714474" → "556471-4474"
 */
export function formatSwedishOrgNumber(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length === 10) return `${d.slice(0, 6)}-${d.slice(6)}`;
  return digits;
}

/**
 * Generate a company number based on the current timestamp.
 * Override for project-specific numbering schemes.
 */
export function generateCompanyNumber(): string {
  return `CO${Date.now().toString().slice(-6)}`;
}

/**
 * Parse a multi-line address string from the VIES response into structured
 * fields. Expects lines like:
 *   STREET 1
 *   123 45 CITY
 */
export function parseSwedishAddress(raw: string): {
  address: string;
  postalCode: string;
  city: string;
} {
  const parts = raw
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return { address: "", postalCode: "", city: "" };
  const address = parts[0] ?? "";
  const rest = parts[1] ?? "";
  const m = rest.match(/^(\d{3}\s*\d{2})\s+(.+)$/);
  if (m) {
    return { address, postalCode: m[1].replace(/\s/, " "), city: m[2].trim() };
  }
  return { address, postalCode: "", city: rest };
}
