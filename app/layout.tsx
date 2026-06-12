import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Press_Start_2P, Yusei_Magic } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegistration from "./ServiceWorkerRegistration";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// マイクラ風ピクセルフォント（Latin/数字専用 — ロゴ・バッジ・カウンタ等にスポット使用）
const pressStart = Press_Start_2P({
  variable: "--font-pixel",
  weight: "400",
  subsets: ["latin"],
});

// 油性マジック手書き風日本語フォント
const yusei = Yusei_Magic({
  variable: "--font-yusei",
  weight: "400",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#fb7185",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "CUBICENGINE Studio — Minecraft Mod Development Platform",
  description:
    "CUBICENGINE Studio is a professional-grade visual development environment for creating Minecraft mods with ease. Design models, build logic, and export with one click.",
  keywords: ["minecraft", "mod", "modding", "blockbench", "editor", "visual programming"],
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CE Studio",
  },
  icons: {
    apple: "/icon-512x512.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} ${pressStart.variable} ${yusei.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ServiceWorkerRegistration />
        {children}
        {/* 全ページ共通クレジット（クリック透過・控えめ表示） */}
        <div
          aria-label="credit"
          style={{
            position: "fixed",
            left: "50%",
            bottom: 1,
            transform: "translateX(-50%)",
            zIndex: 99999,
            fontSize: 9,
            lineHeight: 1,
            color: "rgba(245,240,225,0.32)",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            letterSpacing: "0.03em",
            fontFamily: "var(--font-sans), system-ui, sans-serif",
            textShadow: "0 1px 1px rgba(0,0,0,0.5)",
          }}
        >
          © 伊波さん ・ 開発マネージャー：なっとうサイダー
        </div>
      </body>
    </html>
  );
}
