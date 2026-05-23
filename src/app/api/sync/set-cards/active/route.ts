import { NextResponse } from "next/server";
import { getActiveSetCardsJobs } from "@/jobs/sync-job-utils";

export async function GET() {
  try {
    const jobs = await getActiveSetCardsJobs();
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Aktive Set-Karten-Jobs konnten nicht geladen werden." },
      { status: 500 },
    );
  }
}
