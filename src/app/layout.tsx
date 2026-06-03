import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { getRequestLocale } from "@/lib/i18n/server";
import { themeTokensToStyle } from "@/lib/theme/css-vars";
import { getRequestColorTheme } from "@/lib/theme/server";
import { THEME_DEFINITIONS } from "@/lib/theme/themes";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OpenBinder — Pokémon TCG",
  description:
    "Mobile-first, self-hostable Pokémon TCG binder with checklist, inventory, and Cardmarket links.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "OpenBinder",
    statusBarStyle: "black-translucent",
  },
  applicationName: "OpenBinder",
};

export const viewport: Viewport = {
  themeColor: "#0b0d12",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();
  const colorTheme = await getRequestColorTheme();
  const themeStyle = themeTokensToStyle(THEME_DEFINITIONS[colorTheme].tokens);

  return (
    <html
      lang={locale}
      data-theme={colorTheme}
      style={themeStyle}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden bg-background text-white">
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
