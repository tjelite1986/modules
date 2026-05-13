import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  toSwedishVatNumber,
  formatSwedishOrgNumber,
  parseSwedishAddress,
} from "@/lib/vat";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const orgnr = searchParams.get("orgnr")?.trim();

  if (!orgnr) return NextResponse.json({ error: "orgnr is required" }, { status: 400 });

  const vatNumber = toSwedishVatNumber(orgnr);
  if (!vatNumber) {
    return NextResponse.json(
      { error: "Invalid format — provide 10 digits, e.g. 556471-4474" },
      { status: 422 },
    );
  }

  try {
    const url = `https://api.vatcomply.com/vat?vat_number=${vatNumber}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "EU VIES lookup failed" }, { status: 502 });
    }

    const data = (await res.json()) as {
      valid: boolean;
      name?: string;
      address?: string;
      vat_number?: string;
    };

    if (!data.valid || !data.name || data.name === "---") {
      return NextResponse.json(
        {
          error:
            "Company not found in the EU VAT register (VIES). Verify the org number or fill in manually.",
        },
        { status: 404 },
      );
    }

    const digits = orgnr.replace(/\D/g, "");
    const { address, postalCode, city } = parseSwedishAddress(data.address ?? "");

    return NextResponse.json({
      companyName: data.name,
      organisationNumber: formatSwedishOrgNumber(digits),
      address,
      postalCode,
      city,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Timeout";
    return NextResponse.json({ error: `Network error: ${msg}` }, { status: 502 });
  }
}
