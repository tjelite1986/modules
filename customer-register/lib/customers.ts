/**
 * Generate a customer number based on the current timestamp.
 * Format: C + last 6 digits of unix-ms.
 *
 * Override this if your project has its own numbering scheme.
 */
export function generateCustomerNumber(): string {
  return `C${Date.now().toString().slice(-6)}`;
}

/**
 * Generate all common format variants of a Swedish-style SSN (personnummer)
 * for flexible exact lookup. Handles both 10- and 12-digit forms with or
 * without dashes/spaces.
 *
 * Drop this if your locale uses a different ID format.
 */
export function ssnVariants(ssn: string): string[] {
  const clean = ssn.replace(/[-\s]/g, "");
  const variants = new Set<string>([ssn, clean]);
  if (clean.length === 12) {
    const d10 = clean.slice(2);
    variants.add(d10);
    variants.add(d10.slice(0, 6) + "-" + d10.slice(6));
    variants.add(clean.slice(0, 8) + "-" + clean.slice(8));
  } else if (clean.length === 10) {
    variants.add("19" + clean);
    variants.add("20" + clean);
    variants.add(clean.slice(0, 6) + "-" + clean.slice(6));
    variants.add("19" + clean.slice(0, 6) + "-" + clean.slice(6));
  }
  return Array.from(variants).filter((v) => v.length >= 4);
}

/**
 * Compose a full name from first/last name parts, falling back to either part
 * if only one is present.
 */
export function composeName(firstName: string, lastName: string): string {
  const f = firstName.trim();
  const l = lastName.trim();
  return [f, l].filter(Boolean).join(" ");
}
