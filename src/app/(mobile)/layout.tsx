import { BottomNav } from "@/components/bottom-nav";
import { MobileScrollShell } from "@/components/mobile-scroll-shell";
import { LocaleProvider } from "@/lib/i18n/context";

export const dynamic = "force-dynamic";

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LocaleProvider>
      <div className="fixed inset-0 mx-auto flex w-full max-w-lg flex-col overflow-hidden bg-[#0b0d12] text-white">
        <MobileScrollShell>{children}</MobileScrollShell>
        <BottomNav />
      </div>
    </LocaleProvider>
  );
}
