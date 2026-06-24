import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "開発を応援する",
  description:
    "CUBICENGINE は無料です。気に入ったら任意の寄付で開発を応援できます（無圧力・コア機能はずっと無料）。",
};

// 寄付リンク：Ko-fi / Buy Me a Coffee 等のURLを用意できたら、ここに入れるだけで有効化されます。
const DONATE_URL = "https://ko-fi.com/ihafam";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-7">
      <h2 className="text-base font-bold text-foreground mb-2">{title}</h2>
      <div className="text-sm leading-relaxed text-muted space-y-2">{children}</div>
    </section>
  );
}

export default function SupportPage() {
  return (
    <main className="min-h-screen px-6 py-16 pb-28 text-foreground">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-sm text-muted hover:text-foreground transition-colors">
          ← ホームに戻る
        </Link>
        <h1 className="text-2xl font-bold mt-4 mb-2">開発や運営を応援お願いします 🌱</h1>
        <p className="text-xs text-muted/70 mb-8">
          CUBICENGINE は「作るって面白い」をすべての人に届けたくて作っています。
          コア機能はこれからもずっと無料です。
        </p>

        <Section title="寄付は“任意”です">
          <p>
            このツールは無料で全機能を使えます。寄付は義務ではありません。
            それでも「ここで何かを作るのが楽しかった」「続いてほしい」と感じてもらえたら、
            任意のご支援がとても励みになります。
          </p>
        </Section>

        <Section title="いただいた支援の使いみち">
          <ul className="list-disc pl-5 space-y-1">
            <li>新機能の開発と改善にあてる時間</li>
            <li>Web版の公開・配布にかかる費用</li>
            <li>ドキュメントやサンプルの拡充</li>
          </ul>
        </Section>

        <div className="my-8">
          {DONATE_URL ? (
            <a
              href={DONATE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-xl font-bold text-white text-sm transition-transform hover:-translate-y-0.5"
              style={{ background: "linear-gradient(135deg,#34d399,#10b981)", boxShadow: "0 6px 18px rgba(16,185,129,0.35)" }}
            >
              ☕ 開発を応援する（寄付ページへ）
            </a>
          ) : (
            <div>
              <span
                className="inline-flex items-center gap-2 px-7 py-3 rounded-xl font-bold text-white/70 text-sm cursor-default"
                style={{ background: "linear-gradient(135deg,#34d39988,#10b98188)" }}
              >
                ☕ 寄付ページは準備中です
              </span>
              <p className="text-xs text-muted/60 mt-2">準備ができ次第、こちらにリンクを掲載します。</p>
            </div>
          )}
        </div>

        <Section title="お金じゃなくても、応援できます">
          <p>
            感想・バグ報告・「こんなの作れた！」のシェアも、とても大きな支えになります。
            公式{" "}
            <a
              href="https://discord.gg/Hm82tUUY8g"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              Discord
            </a>
            {" "}で気軽に声を聞かせてください。
          </p>
        </Section>

        <Section title="大切なお知らせ">
          <p>
            本ツールは非公式です。Mojang Studios および Microsoft とは一切関係がありません。
            寄付はあくまで任意のご支援であり、特定の機能の提供や見返りを保証するものではなく、
            その性質上、原則として返金には応じられません（詳しくは{" "}
            <Link href="/terms" className="underline underline-offset-2 hover:text-foreground transition-colors">
              利用規約
            </Link>
            ）。
          </p>
        </Section>

        <p className="mt-10 text-xs text-muted/60">いつもありがとうございます ・ CUBICENGINE</p>
      </div>
    </main>
  );
}
