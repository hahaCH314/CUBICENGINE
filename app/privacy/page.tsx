import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  description: "CUBICENGINE のプライバシーポリシー。個人情報の収集なし、作品データは端末内のみ。Web版のアクセス解析は Cookie を使わない匿名集計のみ。",
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
            収集・送信することはありません。広告目的の行動トラッキングや広告識別子も一切使用しません。
          </p>
          <p>
            ただしWeb版では、どのページがどれくらい見られているかを知るための
            アクセス解析（匿名の集計のみ）を行っています。詳しくは第5項をご覧ください。
          </p>
        </Section>

        <Section title="2. データは端末内にのみ保存されます">
          <p>
            作成したプロジェクトや各種設定は、お使いのブラウザ/端末内（localStorage 等）にのみ保存され、
            運営者のサーバーへ送信されることはありません。ブラウザのデータを削除すれば、いつでも消去できます。
          </p>
        </Section>

        <Section title="3. Cookie について">
          <p>
            本ツールは、トラッキングや広告を目的とした Cookie を使用しません。
            第5項のアクセス解析も Cookie を使わない方式のため、同意バナーの表示や
            設定変更をお願いすることはありません。
          </p>
        </Section>

        <Section title="4. お子様のご利用について">
          <p>
            本ツールは個人情報を収集しないため、保護者の同意取得を前提とする情報収集は行いません。
            第5項のアクセス解析も個人を識別しない集計のみで、どなたが閲覧したかを知ることはできません。
            お子様にも安心してご利用いただけます。
          </p>
        </Section>

        <Section title="5. アクセス解析とホスティングについて（Web版）">
          <p>
            Web版はホスティング事業者（Vercel）上で配信され、同社の Vercel Web Analytics を用いた
            アクセス解析を行っています。集計されるのは、閲覧されたページのURL・リンク元・国や地域・
            端末の種類やブラウザといった大まかな情報のみです。
          </p>
          <p>
            この解析は Cookie を使用せず、IPアドレスを保存せず、閲覧者を識別するための情報も保持しません。
            したがって、個人を特定したり、他サイトをまたいで行動を追跡したりすることはできません。
            目的は「どのページが役に立っているか」を知り、本ツールを改善することに限られます。
          </p>
          <p>
            そのほか、ホスティング提供に伴い一般的に記録される技術情報（アクセスログ等）の取り扱いは、
            各事業者のポリシーに従います。
          </p>
          <p>
            <strong className="text-foreground/90">デスクトップ版（.exe）はこの解析の対象外です。</strong>
            完全オフラインで動作し、外部へ通信を行いません。
          </p>
        </Section>

        <Section title="6. お問い合わせ">
          <p>
            {/* ⚠️ **問い合わせ先はメールにする**（2026-08-17）。
                Discord は誰もいないサーバーなので、窓口として書くと
                実質連絡が取れない。ポリシーの窓口は必ず届く先を書くこと */}
            本ポリシーに関するお問い合わせは{" "}
            <a
              href="mailto:cubicenginestudio@icloud.com"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              cubicenginestudio@icloud.com
            </a>
            {" "}までお願いします。
          </p>
        </Section>

        <Section title="7. 改定">
          <p>本ポリシーは、必要に応じて予告なく改定することがあります。改定後の内容は本ページに掲載した時点で効力を生じます。</p>
        </Section>

        <p className="mt-10 text-xs text-muted/60">
          制定日：2026年6月23日 ・ 最終改定日：2026年8月5日 ・ CUBICENGINE
          <br />
          本ツールは非公式です。Mojang Studios・Microsoft とは関係ありません。Minecraft は Mojang Studios の商標です。
        </p>
      </div>
    </main>
  );
}
