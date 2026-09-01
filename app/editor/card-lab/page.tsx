import type { Metadata } from "next";
import CardLab from "./CardLab";
import CardLabHeader from "./CardLabHeader";

// metadata はビルド時にサーバで1回だけ評価されるので、閲覧者のロケールでは出し分けられない。
// t() を通すとサーバ側では常に既定(ja)になるうえ、エディタのストアがサーババンドルに入る。
export const metadata: Metadata = {
  title: "カードラボ（試作）",
  description: "条件を「シール」でカードに貼る方式の試作。入れ子をやめてカードゲームに寄せる検証用。",
  // 検証用の内部ページ。検索結果に出す画面ではない。
  robots: { index: false, follow: false },
};

export default function CardLabPage() {
  return (
    <main style={{ minHeight: "100dvh", background: "#0a0c10", color: "#e5e7eb", padding: "24px 20px 60px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <CardLabHeader />
        <CardLab />
      </div>
    </main>
  );
}
