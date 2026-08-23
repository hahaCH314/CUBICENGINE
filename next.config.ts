import type { NextConfig } from "next";
// CSP の中身は lib/csp.ts に集約（Android版は layout.tsx が <meta> で埋め込むため、
// 2箇所に同じ内容を書くと片方だけ直して食い違う事故が起きる）。
import { buildCsp } from "./lib/csp";

const CSP = buildCsp("web");

// Android(Capacitor)版は out/ を丸ごと .aab に同梱するので静的エクスポートで書き出す。
// MMC_TARGET=android のときだけ有効にし、Web版(Vercel)のビルドには一切影響させない。
//  - headers() は静的エクスポートでは無視される（サーバーが居ないため）。
//    CSP は Capacitor 側 + <meta> で担保する。ここで外さないとビルドが警告で汚れる。
//  - trailingSlash: file:// 由来の WebView から /editor を開くと拡張子無しのパスは
//    解決できないので、/editor/index.html になるディレクトリ形式で出す。
const isAndroid = process.env.MMC_TARGET === "android";

const nextConfig: NextConfig = {
  ...(isAndroid
    ? { output: "export" as const, trailingSlash: true, images: { unoptimized: true } }
    : {}),
  // 開発中にトンネル(cloudflared 等)経由で動作確認/共有するため、dev リソースへの
  // クロスオリジン要求を許可する。ワイルドカードでサブドメインも許可（毎回URLが変わるため）。
  // 本番(next build)には影響しない dev 専用設定。
  // 同じWi-Fiのスマホから http://192.168.x.x:3000 で実機確認するため、
  // LAN内のプライベートIPも許可する。これが無いと /_next/webpack-hmr 等が
  // ブロックされ、ページは200で返るのにハイドレートできず
  // 「ローディング画面から動かない」状態になる。
  allowedDevOrigins: [
    "*.trycloudflare.com", "*.ngrok-free.app", "*.ngrok.io",
    "192.168.*.*", "10.*.*.*", "172.16.*.*", "172.17.*.*", "172.18.*.*", "172.19.*.*",
    "172.20.*.*", "172.21.*.*", "172.22.*.*", "172.23.*.*", "172.24.*.*", "172.25.*.*",
    "172.26.*.*", "172.27.*.*", "172.28.*.*", "172.29.*.*", "172.30.*.*", "172.31.*.*",
  ],
  // Pin the Turbopack workspace root to this project directory.
  // Without this, `next dev` mis-resolved `@import "tailwindcss"` from the
  // parent folder (e:\MMC) instead of this project's node_modules, which
  // triggered a resolve-error → recompile loop → JS heap OOM crash on /editor.
  // `next build` was unaffected, so this is dev-specific. See AGENTS.md / Next 16 docs.
  turbopack: {
    root: process.cwd(),
  },
  // 静的エクスポート(Android版)ではサーバーが居ないので headers() は無視される。
  // 付けたまま build すると「使えない設定」として警告が出るだけなので android では外す。
  ...(isAndroid ? {} : {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Content-Security-Policy", value: CSP },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
      {
        // ⚠️ Java版エンジン。**ファイル名が変わらないのに中身が変わる**唯一のファイル。
        //    差し替えたのに古いものが配られると、TS 側の SPEC_VERSION とズレて
        //    「全ユーザーが参加のたびに警告を見て、モブが無視される」状態になる。
        //    no-cache＝毎回サーバーに確認する（変わっていなければ 304 なので軽い）。
        source: "/base-mod.jar",
        headers: [
          { key: "Cache-Control", value: "no-cache, must-revalidate" },
        ],
      },
    ];
  },
  }),
};

export default nextConfig;
