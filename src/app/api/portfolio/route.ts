import { NextResponse } from "next/server";
import { getPortfolioSummary } from "@/lib/portfolio";
import { getRequestTranslator } from "@/lib/i18n/server";

export async function GET(request: Request) {
  try {
    const { locale } = getRequestTranslator(request);
    const summary = await getPortfolioSummary(locale);
    return NextResponse.json(summary);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { errorCode: "PORTFOLIO_LOAD_FAILED" },
      { status: 500 },
    );
  }
}
