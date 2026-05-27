import { BottomNav } from "@/components/bottom-nav";
import { OfflineBanner } from "@/components/offline-banner";
import { OfflineShell } from "@/components/offline-shell";
import { MobileScrollShell } from "@/components/mobile-scroll-shell";
import { LocaleProvider } from "@/lib/i18n/context";
import { getRequestLocale } from "@/lib/i18n/server";
import { OfflineNavigationProvider } from "@/lib/offline/offline-navigation";
import { OfflineProvider } from "@/lib/offline/offline-provider";

export const dynamic = "force-dynamic";

export default async function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialLocale = await getRequestLocale();

  return (
    <LocaleProvider initialLocale={initialLocale}>
      <OfflineProvider>
        <OfflineNavigationProvider>
          <div className="fixed inset-0 mx-auto flex w-full max-w-lg flex-col overflow-hidden bg-[#0b0d12] text-white">
            <OfflineBanner />
            <OfflineShell>
              <MobileScrollShell>{children}</MobileScrollShell>
            </OfflineShell>
            <BottomNav />
          </div>
        </OfflineNavigationProvider>
      </OfflineProvider>
    </LocaleProvider>
  );
}
