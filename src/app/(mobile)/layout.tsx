import { BottomNav } from "@/components/bottom-nav";
import { OfflineBanner } from "@/components/offline-banner";
import { OfflineShell } from "@/components/offline-shell";
import { MobileScrollShell } from "@/components/mobile-scroll-shell";
import { LocaleProvider } from "@/lib/i18n/context";
import { getRequestLocale } from "@/lib/i18n/server";
import { OfflineNavigationProvider } from "@/lib/offline/offline-navigation";
import { OfflineProvider } from "@/lib/offline/offline-provider";
import { ThemeProvider } from "@/lib/theme/context";
import { getRequestColorTheme } from "@/lib/theme/server";

export const dynamic = "force-dynamic";

export default async function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialLocale = await getRequestLocale();
  const initialTheme = await getRequestColorTheme();

  return (
    <LocaleProvider initialLocale={initialLocale}>
      <ThemeProvider initialTheme={initialTheme}>
        <OfflineProvider>
          <OfflineNavigationProvider>
            <div className="fixed inset-0 mx-auto flex w-full max-w-lg flex-col overflow-hidden bg-background text-white">
            <OfflineBanner />
            <MobileScrollShell>
              <OfflineShell>{children}</OfflineShell>
            </MobileScrollShell>
            <BottomNav />
          </div>
        </OfflineNavigationProvider>
      </OfflineProvider>
      </ThemeProvider>
    </LocaleProvider>
  );
}
