import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "開発を応援する",
  description:
    "CUBICENGINE は無料です。気に入ったら任意の寄付で開発を応援できます（無圧力・コア機能はずっと無料）。",
};

// 寄付リンク：Ko-fi / Buy Me a Coffee 等のURLを用意できたら、ここに入れるだけで有効化されます。
// ※アカウント名義・受け取りは保護者（CUBICENGINE studio）が担当します。
const DONATE_URL = "https://ko-fi.com/ihafam";

// 子どもでも読みやすいよう、意味のかたまり単位で改行する（かたまりの途中では折り返さない）
function W({ children }: { children: React.ReactNode }) {
  return <span className="inline-block whitespace-nowrap">{children}</span>;
}

// 1行（作者が意図した改行の区切り）。この単位で必ず改行し、長い行は中の W かたまりで折り返す
function L({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`block ${className}`}>{children}</span>;
}

export default function SupportPage() {
  return (
    // この画面だけ 白背景・1画面（スクロールなし）・中央寄せ
    <main className="relative h-dvh overflow-hidden bg-white text-gray-800 flex items-center justify-center px-5">
      <Link
        href="/"
        className="absolute top-4 left-4 text-sm text-gray-400 hover:text-gray-700 transition-colors"
      >
        ← ホーム
      </Link>

      <div className="w-full max-w-md text-center">
        {/* タイトル */}
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 bg-clip-text text-transparent">
          開発・運営を応援してください
        </h1>

        {/* ストーリー（① きっかけ ② コア無料の理由 ③ 運営）。指定の改行・強調を反映 */}
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 text-center text-sm leading-relaxed text-gray-700 space-y-3">
          {/* ① はじまり */}
          <div>
            <L>
              <span className="font-extrabold text-emerald-700 text-base">
                <W>『マイクラに、</W>
                <W>無限ダイヤを！』</W>
              </span>
            </L>
            <L>
              <W>という夢から</W>
              <W>はじまりました。</W>
            </L>
            <L className="mt-2">
              <W>それを自分で</W>
              <W>形にしたのが</W>
            </L>
            <L>
              <W>なっとうサイダー(12歳)が</W>
              <W>作った本サイト</W>
            </L>
            <L>
              <span className="font-bold text-emerald-700">『CUBICENGINE』</span>
            </L>
          </div>
          {/* ② コア機能は無料 */}
          <div>
            <L>
              <span className="font-extrabold text-emerald-700 text-[15px]">
                <W>「同じように</W>
                <W>マイクラが好きな人が、</W>
                <W>作る楽しさに</W>
                <W>出会えるように。」</W>
              </span>
            </L>
            <L className="mt-1.5">
              <W>本人の希望により</W>
              <W>コア機能は全て</W>
              <W>無料でご利用いただけます。</W>
            </L>
          </div>
          {/* ③ 運営 */}
          <div>
            <L>
              <W>CUBICENGINE studioは</W>
              <W>保護者が運営しております。</W>
            </L>
            <L>
              <W>寄付の受け取り・管理は</W>
              <W>CUBICENGINE studioが行います。</W>
            </L>
          </div>
        </div>

        {/* 寄付ボタン */}
        <div className="mt-5">
          {DONATE_URL ? (
            <>
              <a
                href={DONATE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-white text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: "linear-gradient(135deg,#34d399,#059669)",
                  boxShadow: "0 8px 24px rgba(16,185,129,0.3)",
                }}
              >
                💎 この挑戦を応援する（寄付ページへ）
              </a>
              <p className="mt-2 text-xs text-gray-400">
                ※寄付は完全に任意です。全機能をいつでも無料でご利用いただけます。
              </p>
            </>
          ) : (
            <span
              className="inline-flex items-center gap-2 px-7 py-3 rounded-xl font-bold text-white/90 text-sm cursor-default"
              style={{ background: "linear-gradient(135deg,#34d399,#10b981)" }}
            >
              ☕ 寄付ページは準備中です
            </span>
          )}
        </div>

        {/* お知らせ・連絡（非公式 / Discord は1行、返金不可はその下の行へ） */}
        <p className="mt-5 text-xs text-gray-400 leading-relaxed">
          感想・バグ報告は{" "}
          <a
            href="https://discord.gg/Hm82tUUY8g"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-emerald-600 text-gray-500 transition-colors"
          >
            Discord
          </a>
          {" "}へ ・ <span className="whitespace-nowrap">本ツールは非公式（Mojang Studios・Microsoft とは無関係）</span>
        </p>
        <p className="mt-1.5 text-xs text-gray-400 leading-relaxed">
          寄付は原則返金不可（
          <Link href="/terms" className="underline underline-offset-2 hover:text-gray-700 transition-colors">
            利用規約
          </Link>
          ）
        </p>
      </div>
    </main>
  );
}
