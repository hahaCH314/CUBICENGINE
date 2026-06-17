import type { NextConfig } from "next";

// Blockly and Three.js require unsafe-inline/unsafe-eval for shader compilation
// and dynamic block code generation, so strict script-src is not possible.
// The directives below still meaningfully restrict external resource loading
// and eliminate clickjacking, base-tag injection, and cross-origin data leaks.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // 開発中にトンネル(cloudflared 等)経由で動作確認/共有するため、dev リソースへの
  // クロスオリジン要求を許可する。ワイルドカードでサブドメインも許可（毎回URLが変わるため）。
  // 本番(next build)には影響しない dev 専用設定。
  allowedDevOrigins: ["*.trycloudflare.com", "*.ngrok-free.app", "*.ngrok.io"],
  // Pin the Turbopack workspace root to this project directory.
  // Without this, `next dev` mis-resolved `@import "tailwindcss"` from the
  // parent folder (e:\MMC) instead of this project's node_modules, which
  // triggered a resolve-error → recompile loop → JS heap OOM crash on /editor.
  // `next build` was unaffected, so this is dev-specific. See AGENTS.md / Next 16 docs.
  turbopack: {
    root: process.cwd(),
  },
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
    ];
  },
};

export default nextConfig;
