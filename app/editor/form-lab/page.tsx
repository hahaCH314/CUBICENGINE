import type { Metadata } from "next";
import FormBuilder from "../FormBuilder";
import FormLabHeader from "./FormLabHeader";

// metadata はビルド時にサーバで1回だけ評価されるので、閲覧者のロケールでは出し分けられない。
// t() を通すとサーバ側では常に既定(ja)になるうえ、エディタのストアがサーババンドルに入る。
export const metadata: Metadata = {
  title: "フォームビルダー（試作）",
  description: "UIをUIで作る試作画面。Bedrockの3フォーム型を組み立ててコード生成。",
  // 試作中の内部ページ。検索結果に出ると「未完成の画面」が入口になってしまうので載せない。
  robots: { index: false, follow: false },
};

export default function FormLabPage() {
  return (
    <main style={{ minHeight: "100dvh", background: "#0a0c10", color: "#e5e7eb", padding: "28px 20px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <FormLabHeader />
        <FormBuilder />
      </div>
    </main>
  );
}
