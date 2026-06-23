import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "利用規約",
  description: "CUBICENGINE の利用規約。非公式・自己責任・無保証、禁止事項、寄付について。",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="text-base font-bold text-foreground mb-2">{title}</h2>
      <div className="text-sm leading-relaxed text-muted space-y-2">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <main className="min-h-screen px-6 py-16 pb-28 text-foreground">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-sm text-muted hover:text-foreground transition-colors">
          ← ホームに戻る
        </Link>
        <h1 className="text-2xl font-bold mt-4 mb-2">利用規約</h1>
        <p className="text-xs text-muted/70 mb-8">
          本規約は、CUBICENGINE（以下「本ツール」）の利用条件を定めるものです。本ツールを利用した時点で、本規約に同意したものとみなします。
        </p>

        <Section title="1. 本ツールについて">
          <p>
            本ツールは、コーディング不要で Minecraft 向けのアドオン（統合版）・MOD（Java）を
            設計・作成・エクスポートできるビジュアル開発ツールです。
          </p>
        </Section>

        <Section title="2. 非公式であること">
          <p>
            本ツールは非公式です。Mojang Studios および Microsoft とは一切関係がなく、これらの承認・提携・出資を
            受けていません。「Minecraft」は Mojang Studios の商標です。本ツールおよび生成物の Minecraft 環境での
            利用にあたっては、Minecraft の各種規約・ガイドラインを遵守してください。
          </p>
        </Section>

        <Section title="3. 自己責任・無保証">
          <p>
            本ツールおよび生成物は「現状有姿」で提供されます。動作・正確性・特定目的への適合性・継続提供について
            いかなる保証も行いません。ご利用は利用者ご自身の責任で行ってください。
          </p>
        </Section>

        <Section title="4. 禁止事項">
          <p>以下の行為を禁止します。</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>法令または公序良俗に反する行為</li>
            <li>他者の権利・利益を侵害する行為</li>
            <li>グリーフ・チート・嫌がらせなど、他者のゲーム体験を妨げる目的での利用</li>
            <li>許可を得ていないサーバー・ワールドでの使用</li>
            <li>本ツールおよび生成物を悪用する一切の行為</li>
          </ul>
        </Section>

        <Section title="5. 生成物の権利">
          <p>
            利用者が本ツールで作成した内容（生成物）の権利は、利用者に帰属します。ただし Minecraft に関する
            知的財産権は Mojang Studios / Microsoft に帰属し、その利用は同社の規約に従うものとします。
          </p>
        </Section>

        <Section title="6. 料金・寄付について">
          <p>
            本ツールのコア機能は無料で提供します。運営継続のため、任意の寄付を受け付ける場合があります。
            寄付はあくまで任意のご支援であり、特定の機能の提供や何らかの対価を保証するものではありません。
            その性質上、原則として返金には応じられません。
          </p>
        </Section>

        <Section title="7. 免責">
          <p>
            本ツールの利用、または生成物の使用によって生じたいかなる損害・トラブルについても、
            運営者・作者は一切の責任を負いません。
          </p>
        </Section>

        <Section title="8. 準拠法">
          <p>本規約は日本法に準拠し、解釈されるものとします。</p>
        </Section>

        <Section title="9. 改定">
          <p>本規約は、必要に応じて予告なく改定することがあります。改定後の内容は本ページに掲載した時点で効力を生じます。</p>
        </Section>

        <Section title="10. お問い合わせ">
          <p>本規約に関するお問い合わせは、公式 Discord までお願いします。</p>
        </Section>

        <p className="mt-10 text-xs text-muted/60">制定日：2026年6月23日 ・ CUBICENGINE</p>
      </div>
    </main>
  );
}
