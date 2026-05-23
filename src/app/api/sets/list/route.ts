import { NextResponse } from "next/server";
import { getSetListEntries } from "@/lib/sets-list.server";

export async function GET() {
  try {
    const sets = await getSetListEntries();
    return NextResponse.json({ sets });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Sets konnten nicht geladen werden." },
      { status: 500 },
    );
  }
}
