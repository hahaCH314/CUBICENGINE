import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site";

// Android版(output: 'export')ではビルド時に静的ファイルとして書き出す必要がある。
export const dynamic = "force-static";

// /robots.txt を生成。全クローラに全公開を許可し、sitemap の在処を伝える。
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
