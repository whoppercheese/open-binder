import { BottomNav } from "@/components/bottom-nav";
import { OfflineBanner } from "@/components/offline-banner";
import { OfflineRedirect } from "@/components/offline-redirect";
import { MobileScrollShell } from "@/components/mobile-scroll-shell";
import { LocaleProvider } from "@/lib/i18n/context";
import { getRequestLocale } from "@/lib/i18n/server";
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
        <div className="fixed inset-0 mx-auto flex w-full max-w-lg flex-col overflow-hidden bg-[#0b0d12] text-white">
          <OfflineBanner />
          <OfflineRedirect />
          <MobileScrollShell>{children}</MobileScrollShell>
          <BottomNav />
        </div>
      </OfflineProvider>
    </LocaleProvider>
  );
}
