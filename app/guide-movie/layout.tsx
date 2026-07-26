import type { Metadata } from "next";

// /guide-movie は紹介・解説動画を録画するための内部・プロモ用ステージ。
// 検索エンジン等に出す一般公開のコンテンツ画面ではないため noindex, nofollow に指定します。
export const metadata: Metadata = {
  title: "チュートリアル誘導動画 録画用ステージ",
  robots: { index: false, follow: false },
};

export default function GuideMovieLayout({ children }: { children: React.ReactNode }) {
  return children;
}
