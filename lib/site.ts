// サイトの正規URL（SEO/OGP/sitemap/robots で共有）。
// Vercelの VERCEL_URL はデプロイ毎に変わる使い捨てURLなので使わない。
// 本番ドメインを既定にし、必要なら NEXT_PUBLIC_SITE_URL で上書きできる。
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://cubicengine.vercel.app";
