import type { Metadata } from "next";
import DexClient from "./DexClient";
import DexHeader from "./DexHeader";

// metadata はビルド時にサーバで1回だけ評価されるので、閲覧者のロケールでは出し分けられない。
// t() を通すとサーバ側では常に既定(ja)になるうえ、エディタのストアがサーババンドルに入る。
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
        <DexHeader />

        {/* ─── 図鑑クライアントコンポーネント本体 ─── */}
        <DexClient />
      </div>
    </main>
  );
}
