import Link from "next/link";
import type { Metadata } from "next";
import DexClient from "./DexClient";

export const metadata: Metadata = {
  title: "カード図鑑（全132種）",
  description: "CUBIC ENGINEのブロック（カード）をコンプリート！明るいTCG調の図鑑ページ。",
  // 内部学習・収集用の画面。検索エンジン等のインデックスは対象外。
  robots: { index: false, follow: false },
};

export default function DexPage() {
  return (
    <main style={{ minHeight: "100dvh", background: "#f4f7fa", color: "#1e293b", padding: "28px 20px 80px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* ─── ページトップタイトル部 ─── */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: "0.02em", color: "#0f172a", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
              <span>🃏</span> 
              <span>CUBIC ENGINE カード図鑑</span>
            </h1>
            <p style={{ fontSize: 13.5, color: "#475569", marginTop: 8, lineHeight: 1.6, fontWeight: 700 }}>
              プログラミングで大活躍するすべてのカードを集めたオフィシャル図鑑アルバムです。
              <br />
              使ったことがあるカードは輝いて表示され、まだ見ぬカードは神秘的なシルエットに隠されています！
            </p>
          </div>
          <Link
            href="/editor"
            style={{
              flexShrink: 0,
              fontSize: 14,
              fontWeight: 800,
              color: "#ffffff",
              background: "#0284c7",
              textDecoration: "none",
              padding: "9px 18px",
              borderRadius: 9999,
              boxShadow: "0 3px 6px rgba(2, 132, 199, 0.25)",
              border: "2px solid #38bdf8",
              transition: "transform 0.1s"
            }}
          >
            ← エディタへ戻る
          </Link>
        </div>

        {/* ─── 図鑑クライアントコンポーネント本体 ─── */}
        <DexClient />
      </div>
    </main>
  );
}
