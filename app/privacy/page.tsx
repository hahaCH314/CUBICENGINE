import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  description: "CUBICENGINE のプライバシーポリシー。データ収集・トラッキングなし、完全ローカル動作。",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="text-base font-bold text-foreground mb-2">{title}</h2>
      <div className="text-sm leading-relaxed text-muted space-y-2">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-6 py-16 pb-28 text-foreground">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-sm text-muted hover:text-foreground transition-colors">
          ← ホームに戻る
        </Link>
        <h1 className="text-2xl font-bold mt-4 mb-2">プライバシーポリシー</h1>
        <p className="text-xs text-muted/70 mb-8">CUBICENGINE（以下「本ツール」）における情報の取り扱いについて定めます。</p>

        <Section title="1. 個人情報を収集しません">
          <p>
            本ツールはアカウント登録不要で動作し、氏名・メールアドレス・電話番号・位置情報などの個人情報を
            収集・送信することはありません。アクセス解析・行動トラッキング・広告識別子の類も一切使用しません。
          </p>
        </Section>

        <Section title="2. データは端末内にのみ保存されます">
          <p>
            作成したプロジェクトや各種設定は、お使いのブラウザ/端末内（localStorage 等）にのみ保存され、
            運営者のサーバーへ送信されることはありません。ブラウザのデータを削除すれば、いつでも消去できます。
          </p>
        </Section>

        <Section title="3. Cookie について">
          <p>本ツールは、トラッキングや広告を目的とした Cookie を使用しません。</p>
        </Section>

        <Section title="4. お子様のご利用について">
          <p>
            本ツールは個人情報を収集しないため、保護者の同意取得を前提とする情報収集は行いません。
            お子様にも安心してご利用いただけます。
          </p>
        </Section>

        <Section title="5. ホスティングについて（Web版）">
          <p>
            Web版はホスティング事業者（例：Vercel）上で配信されます。ホスティング提供に伴い一般的に
            記録される技術情報（アクセスログ等）の取り扱いは、各事業者のポリシーに従います。本ツール自体が
            これらを取得・利用することはありません。デスクトップ版（.exe）は完全オフラインで動作します。
          </p>
        </Section>

        <Section title="6. お問い合わせ">
          <p>
            本ポリシーに関するお問い合わせは、公式{" "}
            <a
              href="https://discord.gg/pagpxcfeC"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Discord
            </a>
            {" "}までお願いします。
          </p>
        </Section>

        <Section title="7. 改定">
          <p>本ポリシーは、必要に応じて予告なく改定することがあります。改定後の内容は本ページに掲載した時点で効力を生じます。</p>
        </Section>

        <p className="mt-10 text-xs text-muted/60">
          制定日：2026年6月23日 ・ CUBICENGINE
          <br />
          本ツールは非公式です。Mojang Studios・Microsoft とは関係ありません。Minecraft は Mojang Studios の商標です。
        </p>
      </div>
    </main>
  );
}
