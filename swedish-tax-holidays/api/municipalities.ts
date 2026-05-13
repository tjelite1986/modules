import { NextResponse } from "next/server";
import { getMunicipalityList } from "@/lib/tax-lookup";

export const dynamic = "force-dynamic";

/**
 * GET /api/municipalities
 * Returns every Swedish municipality with its total tax rate and the
 * matching Skatteverket table number, sorted by name (sv-SE).
 */
export async function GET() {
  return NextResponse.json(getMunicipalityList());
}
