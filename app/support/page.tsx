import Link from "next/link";
import type { Metadata } from "next";
import { Compass, Gem, Sparkles } from "lucide-react";

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
    <main className="relative h-dvh overflow-hidden bg-white text-gray-800 flex flex-col items-center justify-center px-5">
      {/* 白背景で固定クレジットを読みやすくするためのCSS上書き */}
      <style dangerouslySetInnerHTML={{ __html: `
        [aria-label="credit"] span:first-of-type {
          color: #475569 !important;
          text-shadow: none !important;
          opacity: 0.8 !important;
        }
        [aria-label="credit"] span:last-of-type {
          color: #d97706 !important;
          text-shadow: none !important;
        }
      ` }} />

      {/* 陽だまりグロー（温かい光だまり） */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-amber-100/40 via-yellow-50/20 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[300px] h-[300px] bg-emerald-50/20 rounded-full blur-3xl pointer-events-none" />

      {/* 漂う冒険モチーフ（極めて淡い色で白基調を邪魔しない） */}
      <div className="absolute top-[18%] left-[10%] opacity-25 text-amber-500 pointer-events-none animate-float hidden md:block">
        <Compass className="w-12 h-12 stroke-[1.5]" />
      </div>
      <div className="absolute top-[28%] right-[12%] opacity-20 text-emerald-500 pointer-events-none animate-float-slow hidden md:block" style={{ animationDelay: "1s" }}>
        <Gem className="w-10 h-10 stroke-[1.5]" />
      </div>
      <div className="absolute bottom-[22%] left-[14%] opacity-20 text-teal-500 pointer-events-none animate-float-slow hidden md:block" style={{ animationDelay: "2s" }}>
        <Sparkles className="w-8 h-8 stroke-[1.5]" />
      </div>

      <Link
        href="/"
        className="absolute top-6 left-6 inline-flex items-center gap-1.5 text-sm font-bold text-gray-400 hover:text-emerald-600 transition-all hover:-translate-x-1 hover:scale-105 active:scale-95 duration-200"
      >
        ← ホーム
      </Link>

      <div className="w-full max-w-xl text-center relative z-10">
        {/* タイトル */}
        <div className="inline-flex items-center justify-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse" />
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-600 via-yellow-500 to-emerald-600 bg-clip-text text-transparent">
            開発・運営を応援してください
          </h1>
          <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse" style={{ animationDelay: "0.5s" }} />
        </div>

        {/* ストーリー（① きっかけ ② コア無料の理由 ③ 運営）。指定の改行・強調を反映 */}
        <div className="mt-6 rounded-2xl border border-emerald-100 bg-white/70 backdrop-blur-md p-6 sm:p-8 text-center text-[15px] leading-relaxed text-gray-700 space-y-5 shadow-[0_12px_40px_-12px_rgba(16,185,129,0.12)] hover:shadow-[0_16px_48px_-10px_rgba(16,185,129,0.18)] hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden group">
          {/* カード背景にうっすら浮かぶダイヤ */}
          <div className="absolute -right-6 -bottom-6 text-emerald-500/5 pointer-events-none group-hover:scale-110 transition-transform duration-500">
            <Gem className="w-32 h-32 stroke-[1]" />
          </div>

          {/* ① はじまり */}
          <div className="relative z-10">
            <L>
              <span className="font-extrabold text-emerald-600 text-[17px] inline-flex items-center gap-1">
                <Gem className="w-4 h-4 text-emerald-500 animate-bounce" />
                <W>『自分のアドオンで</W>
                <W>マイクラに無限ダイヤを！』</W>
              </span>
            </L>
            <L className="mt-1">
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
              <span className="font-bold text-emerald-600">『CUBICENGINE』</span>
            </L>
          </div>
          {/* ② コア機能は無料 */}
          <div className="relative z-10 pt-4 border-t border-dashed border-emerald-100">
            <L>
              <span className="font-extrabold text-emerald-600 text-[15px]">
                <W>「同じようにマイクラが好きな人が、作る楽しさに出会えるように。」</W>
              </span>
            </L>
            <L className="mt-1.5">
              <W>本人の希望により</W>
              <W>コア機能は全て</W>
              <W>無料でご利用いただけます。</W>
            </L>
          </div>
          {/* ③ 運営 */}
          <div className="relative z-10 pt-4 border-t border-dashed border-emerald-100 text-xs sm:text-sm text-gray-500">
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
        <div className="mt-6">
          {DONATE_URL ? (
            <>
              <a
                href={DONATE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-10 py-4.5 rounded-2xl font-bold text-white text-[15px] transition-all hover:scale-105 active:scale-95 duration-200 hover-jelly"
                style={{
                  background: "linear-gradient(135deg, #10b981 0%, #059669 60%, #facc15 100%)",
                  boxShadow: "0 8px 32px rgba(16,185,129,0.3)",
                }}
              >
                💎 この挑戦を応援する（寄付ページへ）
              </a>
              <p className="mt-3 text-xs text-gray-400 leading-normal">
                ※寄付は完全に任意です。全機能をいつでも無料でご利用いただけます。
              </p>
            </>
          ) : (
            <span
              className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-bold text-white/90 text-sm cursor-default"
              style={{ background: "linear-gradient(135deg,#34d399,#10b981)" }}
            >
              ☕ 寄付ページは準備中です
            </span>
          )}
        </div>

        {/* お知らせ・連絡（非公式 / Discord は1行、返金不可はその下の行へ） */}
        <div className="mt-8 space-y-1.5 text-xs text-gray-400 leading-relaxed">
          <p>
            感想・バグ報告は{" "}
            <a
              href="https://discord.gg/Hm82tUUY8g"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-emerald-500 text-gray-500 transition-colors"
            >
              Discord
            </a>
            {" "}へ ・ <span className="whitespace-nowrap">本ツールは非公式（Mojang Studios・Microsoft とは無関係）</span>
          </p>
          <p>
            寄付は原則返金不可（{" "}
            <Link href="/terms" className="underline underline-offset-2 hover:text-gray-700 transition-colors">
              利用規約
            </Link>
            {" "}）
          </p>
        </div>
      </div>
    </main>
  );
}
