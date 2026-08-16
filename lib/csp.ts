// Content-Security-Policy をWeb版/Android版で共有する。
//
// Web版(Vercel): next.config.ts の headers() でHTTPヘッダとして送る。
// Android版(Capacitor): 静的エクスポートでは headers() が無視されるため、
//   layout.tsx が <meta http-equiv> として埋め込む。
//
// Blockly と Three.js がシェーダのコンパイルとブロックのコード生成に
// unsafe-inline/unsafe-eval を要求するため、script-src は厳格にできない。
// それでも外部リソースの読み込み・クリックジャッキング・baseタグ注入・
// クロスオリジンへの情報漏れは意味のある形で塞げている。

type CspTarget = "web" | "android";

export function buildCsp(target: CspTarget = "web"): string {
  // Capacitor は WebView に https://localhost で配信し、ネイティブ層との橋渡しに
  // capacitor:// スキームを使う。これらを self に足さないと自分自身のJS/CSSすら
  // 読めずに真っ白な画面になる。
  const self =
    target === "android"
      ? "'self' https://localhost capacitor://localhost"
      : "'self'";

  return [
    `default-src ${self}`,
    `script-src ${self} 'unsafe-inline' 'unsafe-eval'`,
    `style-src ${self} 'unsafe-inline'`,
    `img-src ${self} data: blob:`,
    `font-src ${self} data:`,
    `connect-src ${self}`,
    // 紹介動画は youtube-nocookie のみ（app/page.tsx）。www.youtube.com は追跡Cookieを置くので
    // プライバシーポリシーと矛盾しないよう許可しない。
    `frame-src ${self} https://www.youtube-nocookie.com/`,
    `worker-src ${self} blob:`,
    "object-src 'none'",
    // Android版は WebView 自身がトップレベルの枠なので frame-ancestors 'none' だと
    // 表示自体が拒否されうる。埋め込み攻撃の対象になるのはWebだけなのでWeb限定にする。
    ...(target === "web" ? ["frame-ancestors 'none'"] : []),
    `base-uri ${self}`,
    `form-action ${self}`,
  ].join("; ");
}
