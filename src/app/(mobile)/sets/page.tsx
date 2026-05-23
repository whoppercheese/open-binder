import { SetsPageContent } from "@/app/(mobile)/sets/sets-page-content";
import { getSetListEntries } from "@/lib/sets-list.server";

export default async function SetsPage() {
  const setEntries = await getSetListEntries();
  return <SetsPageContent initialSets={setEntries} />;
}
