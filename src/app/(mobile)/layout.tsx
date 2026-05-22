import { BottomNav } from "@/components/bottom-nav";

export const dynamic = "force-dynamic";

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto min-h-screen max-w-lg bg-[#0b0d12] text-white">
      <main className="pb-24">{children}</main>
      <BottomNav />
    </div>
  );
}
