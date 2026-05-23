import { BottomNav } from "@/components/bottom-nav";

export const dynamic = "force-dynamic";

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 mx-auto flex w-full max-w-lg flex-col overflow-hidden bg-[#0b0d12] text-white">
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-6">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
