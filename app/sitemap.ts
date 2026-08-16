import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site";
import { RECIPES } from "../data/recipes";

// Android版(output: 'export')ではビルド時に静的ファイルとして書き出す必要がある。
export const dynamic = "force-static";

// /sitemap.xml を生成。検索エンジンに主要ページを伝える。
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`,        lastModified: now, changeFrequency: "weekly",  priority: 1.0 },
    // 「マイクラ アドオン 作り方」で検索した人の着地点。読み物なので優先度は高め。
    { url: `${SITE_URL}/guide`,   lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${SITE_URL}/support`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${SITE_URL}/terms`,   lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    // 「〇〇するアドオンの作り方」の記事。増えたぶんだけ自動で載る。
    ...RECIPES.map(r => ({
      url: `${SITE_URL}/guide/${r.slug}`, lastModified: now,
      changeFrequency: "monthly" as const, priority: 0.8,
    })),
  ];
}
