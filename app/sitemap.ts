import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site";

// /sitemap.xml を生成。検索エンジンに主要ページを伝える。
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`,        lastModified: now, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${SITE_URL}/support`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${SITE_URL}/terms`,   lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
  ];
}
