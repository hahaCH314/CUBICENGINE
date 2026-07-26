import Link from "next/link";
import type { Metadata } from "next";
import CardLab from "./CardLab";

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
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, letterSpacing: "0.02em" }}>🃏 カードラボ（試作）</h1>
            <p style={{ fontSize: 12.5, color: "#8b93a1", marginTop: 5, lineHeight: 1.6 }}>
              条件を「もしもカードの中に入れる」のをやめて、<b>動きのカードに貼るシール</b>にしたらどうなるかの検証。
              <br />
              入れ子・差込口・そうなら／ちがうなら が全部消えて、カードゲームの常識だけで組めるかを見る。
            </p>
          </div>
          <Link href="/editor" style={{ flexShrink: 0, fontSize: 13, fontWeight: 800, color: "#60a5fa", textDecoration: "none" }}>← エディタへ</Link>
        </div>
        <CardLab />
      </div>
    </main>
  );
}
