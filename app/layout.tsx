import type { Metadata, Viewport } from "next";
import { PwaInstallBanner } from "@/app/components/pwa-install-banner";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#eeeeee",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export const metadata: Metadata = {
  title: "誰も知らない部屋",
  description: "招待された人だけが入れる部屋",
  applicationName: "誰も知らない部屋",
  appleWebApp: {
    capable: true,
    title: "誰も知らない部屋",
    statusBarStyle: "default"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        {/* Turbopack の CSS @import では可変フォント URL が落ちることがあるため link で読む */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=LINE+Seed+JP:wght@400;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,200..700,0..1,0"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <PwaInstallBanner />
      </body>
    </html>
  );
}
