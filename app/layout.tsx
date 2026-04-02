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
    title: "知らない部屋",
    statusBarStyle: "default"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        {children}
        <PwaInstallBanner />
      </body>
    </html>
  );
}
