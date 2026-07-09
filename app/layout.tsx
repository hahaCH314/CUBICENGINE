import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Press_Start_2P, M_PLUS_Rounded_1c, Outfit, Nunito } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegistration from "./ServiceWorkerRegistration";
import InstallPrompt from "./InstallPrompt";
import { SITE_URL } from "../lib/site";

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

// エディタUIの見出し用（旧: LogicPanel 内の @import で fonts.googleapis から実行時取得していたが、
// プライバシーポリシー「完全ローカル/オフライン・第三者送信なし」と矛盾するため next/font で自己ホスト化）
const outfit = Outfit({
  variable: "--font-outfit",
  weight: ["800", "900"],
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  weight: ["800", "900"],
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#fb7185",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

// 公開URL（正規URL）は lib/site.ts に集約。VERCEL_URL(使い捨て)は使わない。

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "CUBICENGINE — マイクラのアドオン・MODを直感的に作る",
    template: "%s | CUBICENGINE",
  },
  description:
    "コーディング不要のビジュアル開発環境。Minecraft のアドオン（統合版）・MOD（Java）を設計・構築し、ワンクリックでエクスポート。完全ローカル・オフラインで動作、アカウント不要。",
  applicationName: "CUBICENGINE",
  keywords: ["Minecraft", "マイクラ", "アドオン", "MOD", "統合版", "Java", "コーディング不要", "ビジュアルプログラミング", "CUBICENGINE", "SPROUT", "GROVE"],
  authors: [{ name: "CUBICENGINE studio" }],
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "CUBICENGINE" },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "CUBICENGINE",
    url: SITE_URL,
    title: "CUBICENGINE — マイクラのアドオン・MODを直感的に作る",
    description: "コーディング不要。マイクラのアドオン/MODを設計・構築・エクスポート。ローカル/オフライン・アカウント不要。",
    // ※ヒマワリ: /public/og.png（1200×630のSNSサムネ）を用意するとシェア時に表示される
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "CUBICENGINE" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "CUBICENGINE — マイクラのアドオン・MODを直感的に作る",
    description: "コーディング不要。マイクラのアドオン/MODを直感的に作る。",
    images: ["/og.png"],
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
      className={`${geistSans.variable} ${geistMono.variable} ${pressStart.variable} ${rounded.variable} ${outfit.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ServiceWorkerRegistration />
        <InstallPrompt />
        {children}
        {/* 全ページ共通クレジット（クリック透過・控えめ表示） */}
        <div
          aria-label="credit"
          style={{
            position: "relative",
            marginTop: "auto",
            paddingTop: "40px",
            paddingBottom: "16px",
            left: "auto",
            bottom: "auto",
            transform: "none",
            zIndex: 99999,
            pointerEvents: "none",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            width: "100%",
            maxWidth: "96vw",
            textAlign: "center",
            fontFamily: "'Hiragino Kaku Gothic ProN', 'Yu Gothic', 'Meiryo', 'Noto Sans JP', system-ui, sans-serif",
            textShadow: "0 1px 2px rgba(0,0,0,0.9)",
            marginRight: "auto",
            marginLeft: "auto",
          }}
        >
          {/* 非公式ディスクレーマ（Mojangブランドガイドライン対応・全ページ表示） */}
          <span style={{ fontSize: 9, fontWeight: 600, lineHeight: 1.25, color: "#cbd5e1", opacity: 0.85 }}>
            ※非公式ツールです。<br className="sm:hidden" />Mojang Studios・Microsoft とは関係ありません。<br className="sm:hidden" />Minecraft は Mojang Studios の商標です。
          </span>
          <span 
            className="whitespace-nowrap"
            style={{ fontSize: "clamp(9px, 2.8vw, 13px)", fontWeight: 700, lineHeight: 1.4, color: "#f0a818", letterSpacing: "0.02em" }}
          >
            © 2026 CUBICENGINE studio ・ 開発マネージャー：なっとうサイダー
          </span>
          {/* 法務リンク（クレジットは click 透過なので、このリンク行だけ pointerEvents を戻す） */}
          <nav
            style={{ pointerEvents: "auto", display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 4 }}
          >
            {[
              { href: "/privacy", label: "プライバシー" },
              { href: "/terms", label: "利用規約" },
              { href: "/licenses", label: "ライセンス表記" },
            ].map((l) => (
              <a
                key={l.href}
                href={l.href}
                style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textDecoration: "none", opacity: 0.85 }}
              >
                {l.label}
              </a>
            ))}
          </nav>
        </div>
      </body>
    </html>
  );
}
