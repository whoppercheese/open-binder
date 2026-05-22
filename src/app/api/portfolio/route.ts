import { NextResponse } from "next/server";
import { getPortfolioSummary } from "@/lib/portfolio";

export async function GET() {
  try {
    const summary = await getPortfolioSummary();
    return NextResponse.json(summary);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Portfolio konnte nicht geladen werden." },
      { status: 500 },
    );
  }
}
