import { BottomNav } from "@/components/bottom-nav";
import { MobileScrollShell } from "@/components/mobile-scroll-shell";

export const dynamic = "force-dynamic";

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 mx-auto flex w-full max-w-lg flex-col overflow-hidden bg-[#0b0d12] text-white">
      <MobileScrollShell>{children}</MobileScrollShell>
      <BottomNav />
    </div>
  );
}
