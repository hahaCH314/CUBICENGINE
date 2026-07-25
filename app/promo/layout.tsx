import type { Metadata } from "next";

// /promo はショート動画を録画するための社内用ステージ。検索結果に出す画面ではないので
// noindex にする。（page.tsx は "use client" のため metadata を持てず、ここで指定する）
export const metadata: Metadata = {
  title: "プロモ録画用",
  robots: { index: false, follow: false },
};

export default function PromoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
