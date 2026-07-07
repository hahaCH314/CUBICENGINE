import Link from "next/link";
import type { Metadata } from "next";
import FormBuilder from "../FormBuilder";

export const metadata: Metadata = {
  title: "フォームビルダー（試作）",
  description: "UIをUIで作る試作画面。Bedrockの3フォーム型を組み立ててコード生成。",
};

export default function FormLabPage() {
  return (
    <main style={{ minHeight: "100dvh", background: "#0a0c10", color: "#e5e7eb", padding: "28px 20px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, letterSpacing: "0.02em" }}>🧩 フォームビルダー（試作）</h1>
            <p style={{ fontSize: 12.5, color: "#8b93a1", marginTop: 4 }}>
              「みため」をブロックではなく <b>UIで作る</b> ための試作。組んだ内容が右にプレビュー＆コードで出ます。
            </p>
          </div>
          <Link href="/editor" style={{ fontSize: 13, fontWeight: 800, color: "#60a5fa", textDecoration: "none" }}>← エディタへ</Link>
        </div>
        <FormBuilder />
      </div>
    </main>
  );
}
