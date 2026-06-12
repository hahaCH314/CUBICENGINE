import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Press_Start_2P, M_PLUS_Rounded_1c } from "next/font/google";
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

// 子供が読みやすい丸ゴシック（手書き風フォントはやめた）
const rounded = M_PLUS_Rounded_1c({
  variable: "--font-yusei", // 既存の --font-sans 参照を活かすため変数名は据え置き
  weight: ["400", "700", "800"],
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
      className={`${geistSans.variable} ${geistMono.variable} ${pressStart.variable} ${rounded.variable} h-full antialiased`}
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
            bottom: 3,
            transform: "translateX(-50%)",
            zIndex: 99999,
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1,
            color: "#fb923c",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            letterSpacing: "0.02em",
            fontFamily: "'Hiragino Kaku Gothic ProN', 'Yu Gothic', 'Meiryo', 'Noto Sans JP', system-ui, sans-serif",
            textShadow: "0 1px 2px rgba(0,0,0,0.9)",
          }}
        >
          © 2026 伊波さん ・ 開発マネージャー：なっとうサイダー
        </div>
      </body>
    </html>
  );
}
