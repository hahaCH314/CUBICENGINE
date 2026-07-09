"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { useEditorStore } from "./editor/store";
import { t } from "../lib/i18n";
import { Gem, Sparkles } from "lucide-react";

// 子どもでも読みやすいよう、意味のかたまり単位で改行する（かたまりの途中では折り返さない）
// ※スマホ(狭い画面)では、かたまりが画面幅を超えて横にはみ出すのを防ぐため折り返しを許可。
//   sm(640px)以上ではこれまで通り nowrap で作者が意図したきれいな改行を保つ。
function W({ children }: { children: React.ReactNode }) {
  return <span className="inline-block whitespace-normal sm:whitespace-nowrap">{children}</span>;
}

// 紹介動画。ブロッカー等でYouTube埋め込みが出ない時でも"空箱"にならないよう、
// まずブランドの表紙を出し、クリックで初めてiframeを読み込む（プライバシー/表示速度も◎）。
// うまく出ない環境向けに「YouTubeで見る」外部リンクも添える。
const INTRO_VIDEO_ID = "qk6wVNlZtoo";
function IntroVideo() {
  const [play, setPlay] = useState(false);
  return (
    <div className="w-full max-w-2xl mx-auto mt-12 mb-4 px-4">
      <div
        className="relative w-full rounded-3xl overflow-hidden shadow-[0_15px_45px_rgba(0,0,0,0.5)] border-2 border-white/5"
        style={{ aspectRatio: "16 / 9", background: "radial-gradient(circle at 50% 40%, #123, #0a0a0c 75%)" }}
      >
        {play ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${INTRO_VIDEO_ID}?rel=0&autoplay=1`}
            title="CUBICENGINE 使い方紹介動画"
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            style={{ border: 0 }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlay(true)}
            aria-label="紹介動画を再生"
            className="absolute inset-0 w-full h-full flex items-center justify-center group cursor-pointer"
          >
            {/* 本物のYouTubeサムネを表紙に（一目でYouTubeと分かる＝“怪しい踏ませボタン”に見えないように）。
                maxres が無い動画向けに hqdefault へフォールバック。 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://i.ytimg.com/vi/${INTRO_VIDEO_ID}/maxresdefault.jpg`}
              alt="CUBICENGINE 紹介動画のサムネイル"
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                const img = e.currentTarget;
                if (!img.dataset.fb) { img.dataset.fb = "1"; img.src = `https://i.ytimg.com/vi/${INTRO_VIDEO_ID}/hqdefault.jpg`; }
              }}
            />
            {/* うっすら暗幕（ボタンのコントラスト確保） */}
            <span className="absolute inset-0" style={{ background: "rgba(0,0,0,0.18)" }} />
            {/* YouTube風の赤い再生ボタン */}
            <span
              className="relative flex items-center justify-center transition-transform duration-200 group-hover:scale-110 group-active:scale-95"
              style={{ width: 68, height: 48, borderRadius: 14, background: "#ff0000", boxShadow: "0 2px 10px rgba(0,0,0,0.4)" }}
            >
              <span style={{ borderStyle: "solid", borderWidth: "11px 0 11px 19px", borderColor: "transparent transparent transparent #ffffff" }} />
            </span>
          </button>
        )}
      </div>
      <div className="text-center mt-2">
        <a
          href={`https://www.youtube.com/watch?v=${INTRO_VIDEO_ID}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted/70 hover:text-foreground underline underline-offset-2 transition-colors"
        >
          うまく出ないときは YouTube で見る ↗
        </a>
      </div>
    </div>
  );
}

// 1行（作者が意図した改行の区切り）。この単位で必ず改行し、長い行は中の W かたまりで折り返す
function L({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`block ${className}`}>{children}</span>;
}

// 英語表示用: i18n文字列の \n を行区切りにしてプレーンにレンダ（JAは手組みのW/L版を使う）
function EnLines({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <L key={i} className={i ? "mt-1" : ""}>
          {line}
        </L>
      ))}
    </>
  );
}

// ⬇ デスクトップ版のDL先。ビルド&ホスト後にURLを差し替える(BUILD_EXE_PLAN.md)。
const DOWNLOADS = {
  sprout: {
    win: "https://github.com/hahaCH314/CUBICENGINE/releases/latest/download/SPROUT_editor.exe",
    mac: "https://github.com/hahaCH314/CUBICENGINE/releases/latest/download/SPROUT_editor.dmg",
  },
  grove: {
    win: "https://github.com/hahaCH314/CUBICENGINE/releases/latest/download/GROVE_editor.exe",
    mac: "https://github.com/hahaCH314/CUBICENGINE/releases/latest/download/GROVE_editor.dmg",
  },
};

// .exe/.dmg をビルド&リリース(GitHub Releases等)したら true に。
// false の間は DL ボタンを「準備中」表示にして 404 を踏ませない。
const RELEASES_READY = false;

// GROVE(Java)を一般公開＝解禁(2026-07-02)。カードは「Webで試す」→ /editor?mode=grape
// （動作するWebエディタ）へ誘導。.exe/.dmg のデスクトップDLは別フラグ RELEASES_READY
// (=false) で引き続き非表示のため、リンク切れ(404)は出ない。
const JAVA_READY = false; // 2026-07-02 一時停止: Java版エクスポート未完成のため準備中に戻す

// DLボタン：リリース公開済みなら実DL、未公開なら「準備中」の非リンク表示
function DlButton({
  href,
  label,
  kind,
  style,
}: {
  href: string;
  label: string;
  kind: "win" | "mac";
  style: CSSProperties;
}) {
  const locale = useEditorStore((s) => s.locale);
  const cls =
    "w-full inline-flex items-center justify-between px-5 py-3 rounded-xl font-bold text-xs text-white transition-all";
  if (!RELEASES_READY) {
    return (
      <span
        aria-disabled="true"
        title={t(locale, "dl.soonTitle")}
        className={`${cls} border border-white/10 cursor-not-allowed`}
        style={{ background: "rgba(255,255,255,0.05)", opacity: 0.55 }}
      >
        <span>{label}</span>
        <span className="text-[10px] tracking-wide">{t(locale, "dl.soon")}</span>
      </span>
    );
  }
  return (
    <a
      href={href}
      download
      className={`${cls} hover:scale-[1.03]${kind === "mac" ? " border border-white/10" : ""}`}
      style={style}
    >
      <span>{label}</span>
      <span className="opacity-90">{t(locale, "dl.go")}</span>
    </a>
  );
}

function CubeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

// ローカル/オフライン版: アカウント機能なし・1画面に収めたランディング
export default function HomePage() {
  const locale = useEditorStore((s) => s.locale);
  const setLocale = useEditorStore((s) => s.setLocale);
  return (
    <div className="min-h-screen flex flex-col relative" style={{ background: "radial-gradient(circle at 25% 15%, rgba(132, 204, 22, 0.16) 0%, transparent 45%), radial-gradient(circle at 75% 15%, rgba(14, 165, 233, 0.16) 0%, transparent 45%), radial-gradient(circle at 50% 60%, rgba(245, 158, 11, 0.1) 0%, transparent 55%), #171715" }}>
      {/* Navigation（ログイン/新規登録は撤去・ローカル版） */}
      <nav className="shrink-0 bg-panel border-b-4 border-[#121210] h-14">
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <CubeIcon className="w-7 h-7 text-accent group-hover:scale-105 transition-transform" />
            <span className="text-base font-bold tracking-tight">
              CUBICENGINE<span className="text-accent ml-1">Studio</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="font-pixel text-[10px]" style={{ color: "#f0a818", opacity: 0.9 }}>{t(locale, "nav.edition")}</span>
            <button
              type="button"
              onClick={() => setLocale(locale === "ja" ? "en" : "ja")}
              aria-label="switch language"
              className="ml-2 font-pixel text-[10px] px-2.5 py-1 rounded border border-white/15 hover:border-white/40 transition-colors"
              style={{ color: "#e5e7eb" }}
            >
              🌐 {t(locale, "lang.toggle")}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero（縦スクロール型：看板→カード→作者の声） */}
      <section className="flex-1 flex flex-col items-center justify-start px-6 pt-10 pb-16 text-center">
        <h1
          className="text-[clamp(1.2rem,7vw,3rem)] sm:text-6xl md:text-7xl font-pixel tracking-normal sm:tracking-wider mb-2 animate-float-slow"
          style={{
            color: "#fbbf24",
            textShadow: "6px 6px 0px #1e1208, 12px 12px 0px rgba(0,0,0,0.25)",
            imageRendering: "pixelated",
          }}
        >
          CUBIC
          <span style={{ color: "#22d3ee", textShadow: "6px 6px 0px #0b2d3a, 12px 12px 0px rgba(0,0,0,0.25)" }}>ENGINE</span>
        </h1>

        <p
          className="text-lg sm:text-2xl md:text-3xl font-bold text-foreground mb-1.5 tracking-wider font-sans"
          style={{ textShadow: "3px 3px 0px #1e1208", lineHeight: 1.4 }}
        >
          {t(locale, "hero.sub")}
        </p>

        <p
          className="text-sm sm:text-base md:text-lg font-medium text-foreground/80 mb-2 tracking-wider font-sans"
          style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.8)", lineHeight: 1.4 }}
        >
          {t(locale, "hero.tagline")}
        </p>

        <div className="flex flex-col md:flex-row gap-8 justify-center items-stretch max-w-4xl mx-auto mt-4 px-4 py-2 shrink-0 w-full">
          {/* SPROUT Card */}
          <div
            style={{
              maxWidth: "320px",
              padding: "28px 24px",
              borderRadius: "24px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "3px solid #84cc16",
              boxShadow: "0 12px 40px -10px rgba(0, 0, 0, 0.6), 0 0 25px 0 rgba(132, 204, 22, 0.12)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "20px",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
            className="w-full md:w-auto md:flex-[1_1_240px] hover:scale-[1.03] hover:border-[#a3e635] hover:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.8),0_0_35px_0_rgba(132,204,22,0.2)]"
          >
            {/* Tag */}
            <span className="px-4 py-1.5 rounded-full text-xs font-pixel tracking-wider" style={{ background: "rgba(132, 204, 22, 0.15)", color: "#a3e635", border: "1.5px solid rgba(132, 204, 22, 0.3)", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
              {t(locale, "sprout.tag")}
            </span>

            <div className="w-full flex flex-col items-center gap-3">
              <Link
                href="/editor?mode=tsumiki"
                className="w-20 h-20 inline-flex items-center justify-center rounded-2xl transition-all duration-75 relative hover:-translate-y-1 hover:shadow-[0_8px_0_#14532d,0_12px_24px_rgba(0,0,0,0.4)] active:translate-y-1 active:shadow-[0_2px_0_#14532d,0_4px_8px_rgba(0,0,0,0.25)]"
                style={{
                  background: "linear-gradient(135deg, #22c55e, #16a34a)",
                  border: "3px solid #14532d",
                  boxShadow: "0 6px 0 #14532d, 0 8px 16px rgba(0,0,0,0.35)",
                  transform: "translateY(0)",
                }}
                aria-label={t(locale, "cta.tryWeb")}
              >
                <CubeIcon className="w-9 h-9 text-yellow-300" />
              </Link>
              <span className="text-xs font-bold text-white/95" style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.8)" }}>
                {t(locale, "cta.tryWeb")}
              </span>
            </div>
          </div>

          {/* GROVE Card */}
          <div
            style={{
              maxWidth: "320px",
              padding: "28px 24px",
              borderRadius: "24px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "3px solid #0ea5e9",
              boxShadow: "0 12px 40px -10px rgba(0, 0, 0, 0.6), 0 0 25px 0 rgba(14, 165, 233, 0.12)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "20px",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
            className="w-full md:w-auto md:flex-[1_1_240px] hover:scale-[1.03] hover:border-[#38bdf8] hover:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.8),0_0_35px_0_rgba(14, 165, 233, 0.2)]"
          >
            {/* Tag */}
            <span className="px-4 py-1.5 rounded-full text-xs font-pixel tracking-wider" style={{ background: "rgba(14, 165, 233, 0.15)", color: "#38bdf8", border: "1.5px solid rgba(14, 165, 233, 0.3)", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
              {t(locale, "grove.tag")}
            </span>

            <div className="w-full flex flex-col items-center gap-3">
              {JAVA_READY ? (
                <>
                  <Link
                    href="/editor?mode=grape"
                    className="w-20 h-20 inline-flex items-center justify-center rounded-2xl transition-all duration-75 relative hover:-translate-y-1 hover:shadow-[0_8px_0_#0369a1,0_12px_24px_rgba(0,0,0,0.4)] active:translate-y-1 active:shadow-[0_2px_0_#0369a1,0_4px_8px_rgba(0,0,0,0.25)]"
                    style={{
                      background: "linear-gradient(135deg, #38bdf8, #0ea5e9)",
                      border: "3px solid #0369a1",
                      boxShadow: "0 6px 0 #0369a1, 0 8px 16px rgba(0,0,0,0.35)",
                      transform: "translateY(0)",
                    }}
                    aria-label={t(locale, "cta.tryWeb")}
                  >
                    <CubeIcon className="w-9 h-9 text-yellow-200" />
                  </Link>
                  <span className="text-xs font-bold text-white/95" style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.8)" }}>
                    {t(locale, "cta.tryWeb")}
                  </span>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <span
                    aria-label={t(locale, "grove.soon")}
                    title={t(locale, "grove.soonTitle")}
                    className="animate-grove-soon w-20 h-20 inline-flex items-center justify-center rounded-2xl cursor-default"
                    style={{
                      background: "linear-gradient(135deg, rgba(14,165,233,0.15), rgba(3,105,161,0.1))",
                      border: "3px solid rgba(14,165,233,0.45)",
                      boxShadow: "inset 0 0 10px rgba(14,165,233,0.2)",
                    }}
                  >
                    <CubeIcon className="w-8 h-8 text-white/20" />
                  </span>
                  <div className="flex flex-col items-center">
                    <span style={{ color: "#7fe9f7", textShadow: "0 0 8px rgba(14,165,233,0.3)" }} className="text-xs font-bold font-pixel">
                      {t(locale, "grove.soon")}
                    </span>
                    <span className="text-[9px] font-normal mt-0.5" style={{ color: "rgba(127,233,247,0.7)" }}>
                      {t(locale, "grove.soonSub")}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ★紹介動画セクション（ブロックされても空箱にならないクリック再生式） */}
        <IntroVideo />

        {/* ★応援と作者紹介の独立カードエリア */}
        <div className="flex flex-col md:flex-row gap-8 justify-center items-stretch max-w-4xl mx-auto mt-16 mb-12 px-4 w-full">
          <div
            style={{
              padding: "36px 32px",
              borderRadius: "24px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "3px solid #10b981",
              boxShadow: "0 12px 40px -10px rgba(0, 0, 0, 0.6), 0 0 25px 0 rgba(16, 185, 129, 0.12)",
              display: "flex",
              flexDirection: "column",
              gap: "24px",
              position: "relative",
              overflow: "hidden",
            }}
            className="w-full md:w-auto md:flex-[5_1_340px] group hover:border-emerald-400 hover:-translate-y-0.5 transition-all duration-300"
          >
            {/* カード背景にうっすら浮かぶダイヤ */}
            <div className="absolute -right-6 -bottom-6 text-emerald-500/5 pointer-events-none group-hover:scale-110 transition-transform duration-500">
              <Gem className="w-32 h-32 stroke-[1]" />
            </div>

            <h3 className="text-sm font-bold text-white flex items-center justify-center gap-1.5 font-pixel tracking-wide relative z-10" style={{ color: "#34d399" }}>
              <Sparkles className="w-4 h-4 text-yellow-400 animate-pulse" />
              {t(locale, "support.title")}
              <Sparkles className="w-4 h-4 text-yellow-400 animate-pulse" style={{ animationDelay: "0.5s" }} />
            </h3>

            <div className="space-y-5 text-[13px] sm:text-[14px] text-foreground/90 leading-relaxed font-sans flex-1 text-center relative z-10">
              {locale === "ja" ? (
                <>
                  {/* 1段目: はじまり */}
                  <div>
                    <L>
                      <span className="font-extrabold text-[#34d399] text-[15px] inline-flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5">
                        <Gem className="w-3.5 h-3.5 text-emerald-400 animate-bounce shrink-0" />
                        <W>「自分のアドオンで</W>
                        <W>マイクラに無限ダイヤを！」</W>
                      </span>
                    </L>
                    <L className="mt-1">
                      <W>というくだらない夢から</W>
                      <W>始まりました。</W>
                    </L>
                    <L className="mt-2">
                      <W>その夢を形にし</W>
                      <W>実現させたのが</W>
                    </L>
                    <L className="mt-1">
                      <W>本サイト</W>
                      <span className="font-bold text-white"> CUBICENGINE </span>
                      <W>です。</W>
                    </L>
                  </div>

                  {/* 2段目: 12歳とコア機能無料 */}
                  <div className="pt-4 border-t border-dashed border-white/10">
                    <L className="text-white/95">
                      <W>なっとうサイダーは</W>
                      <W>今12歳です。</W>
                    </L>
                    <L className="mt-2 text-white/95">
                      <W>「同じようにマイクラや、</W>
                      <W>プログラミングが好きな人に、</W>
                      <W>作る楽しさを共有したい」</W>
                    </L>
                    <L className="mt-2 text-white/80">
                      <W>との思いから</W>
                      <W>本人の希望により</W>
                      <W>コア機能は全て</W>
                      <W>無料でご利用いただけます。</W>
                    </L>
                  </div>

                  {/* 3段目: 開発費用とお小遣い */}
                  <div className="pt-4 border-t border-dashed border-white/10 text-white/80">
                    <L>
                      <W>まだまだ未熟な</W>
                      <W>開発マネージャーですが、</W>
                    </L>
                    <L className="mt-1">
                      <W>お小遣いを全て</W>
                      <W>開発費用にあててきました。</W>
                    </L>
                    <L className="mt-2 text-white/90">
                      <W>頂いた寄付は今後の運営費、</W>
                    </L>
                    <L className="mt-1 text-white/90">
                      <W>新たな開発費用として大切に使わせていただきます。</W>
                    </L>
                    <L className="mt-2.5 text-white font-bold text-[14px]">
                      <W>よろしくお願いいたします</W>
                    </L>
                  </div>

                  {/* 4段目: 運営情報 */}
                  <div className="pt-4 border-t border-dashed border-white/10 text-xs text-muted/75">
                    <L>
                      <W>CUBICENGINE studioは</W>
                      <W>保護者が運営しております。</W>
                    </L>
                    <L>
                      <W>寄付の受け取り・管理は</W>
                      <W>CUBICENGINE studioが行います。</W>
                    </L>
                  </div>
                </>
              ) : (
                <>
                  <div className="font-semibold text-[#34d399]">
                    <EnLines text={t(locale, "support.story1")} />
                  </div>
                  <div className="pt-4 border-t border-dashed border-white/10 text-white/95">
                    <EnLines text={t(locale, "support.story2")} />
                  </div>
                  <div className="pt-4 border-t border-dashed border-white/10 text-white/80">
                    <EnLines text={t(locale, "support.story3")} />
                  </div>
                  <div className="pt-4 border-t border-dashed border-white/10 text-xs text-muted/75">
                    <EnLines text={t(locale, "support.management")} />
                  </div>
                </>
              )}
            </div>

            {/* 寄付ボタン */}
            <div className="mt-auto pt-4 border-t border-white/5">
              <a
                href="https://ko-fi.com/ihafam"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-6 py-4 rounded-xl font-bold text-white text-sm transition-all hover:scale-[1.03] w-full"
                style={{
                  background: "linear-gradient(135deg, #8faa3c 0%, #6b8524 100%)",
                  boxShadow: "0 4px 14px rgba(120,150,50,0.22)",
                }}
              >
                {t(locale, "support.cta")}
              </a>
              <p className="mt-2.5 text-[10px] text-white/50 text-center leading-normal">
                {t(locale, "support.note")}
              </p>
            </div>
          </div>

          {/* 右カード：作者紹介（コンパクトに写真＋自己紹介） */}
          <div
            style={{
              maxWidth: "360px",
              padding: "36px 32px",
              borderRadius: "24px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "3px solid #f59e0b",
              boxShadow: "0 12px 40px -10px rgba(0, 0, 0, 0.6), 0 0 25px 0 rgba(240, 168, 24, 0.12)",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
            className="w-full md:w-auto md:flex-[4_1_280px] group hover:border-amber-400 hover:-translate-y-0.5 transition-all duration-300"
          >
            <div className="flex flex-col items-center gap-1.5 text-center">
              <p className="font-pixel text-[10px] tracking-widest text-[#f0a818] opacity-85">
                {t(locale, "founder.eyebrow")}
              </p>
              <p className="font-pixel text-[13px] text-[#f0a818]">
                {t(locale, "founder.name")}
              </p>
            </div>
            {/* 写真 */}
            <div
              className="w-full rounded-xl overflow-hidden relative shrink-0"
              style={{
                aspectRatio: "3 / 2",
                backgroundImage: "url(/founder.jpg)",
                backgroundSize: "cover",
                backgroundPosition: "right 35% top 15%",
                backgroundColor: "rgba(240, 168, 24, 0.05)",
                border: "1.5px solid rgba(240, 168, 24, 0.25)",
                boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
              }}
              role="img"
              aria-label={t(locale, "founder.name")}
            >
              {/* 顔は画像ファイル自体をモザイク加工済み（身バレ防止）。CSSベールは廃止 */}
              {/* 画像が無いとき用のフォールバック装飾 */}
              <div 
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{
                  background: "linear-gradient(135deg, rgba(240, 168, 24, 0.08), rgba(251, 191, 36, 0.03))",
                }}
              >
                <span className="text-3xl font-serif text-[#f0a818]/20">“</span>
              </div>
            </div>
            {/* 自己紹介文 */}
            <div className="text-[13px] sm:text-[14px] text-foreground/90 leading-relaxed font-sans text-center space-y-4">
              {locale === "ja" ? (
                <>
                  <div>
                    <L>
                      <W>このアプリで</W>
                      <W>アホほどダイヤ出せます</W>
                    </L>
                    <L className="mt-1">
                      <W>作る楽しさを</W>
                    </L>
                    <L className="mt-1">
                      <span className="font-bold text-[#f59e0b]">くだらない</span>
                      <W>ことで一緒に笑える</W>
                      <W>仲間へ届きますように(o^―^o)ﾆｺ</W>
                    </L>
                  </div>

                  <div className="pt-4 border-t border-dashed border-white/10 text-white/80">
                    <L>
                      <W>ずっと学校に行けなかった</W>
                    </L>
                    <L className="mt-1">
                      <W>苦しい地獄の時間だった</W>
                    </L>
                    <L className="mt-2 text-white/95">
                      <W>でもね、作る楽しさに出会えて</W>
                    </L>
                    <L className="mt-1">
                      <W>僕は１歩踏み出せた</W>
                    </L>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <EnLines text={t(locale, "founder.intro1")} />
                  </div>
                  <div className="pt-4 border-t border-dashed border-white/10 text-white/80">
                    <EnLines text={t(locale, "founder.intro2")} />
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-col items-center gap-1.5">
              {/* 下部の署名「なっとうサイダー」は撤去（上部「これを作ってる人」に名前があり重複のため） */}
              <span className="flex items-center gap-1.5 text-[10px] font-sans">
                <span className="tracking-wide text-white">Special Thanks</span>
                <span className="font-pixel text-[11px] bg-gradient-to-r from-[#ff5ca2] via-[#ffd23f] to-[#22d3ee] bg-clip-text text-transparent">
                  ドーユー☆ラボ
                </span>
              </span>
            </div>

            {/* つながる先 */}
            <div className="mt-auto pt-4 border-t border-white/5">
              <p className="text-[10px] text-muted/60 font-sans tracking-wide mb-2.5">{t(locale, "founder.follow")}</p>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href="https://www.instagram.com/cubic_engine"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[10px] font-bold transition-all border border-[#e1306c]/40 bg-[#1e1e1a] text-[#f472b6] hover:border-[#e1306c] hover:bg-[#e1306c] hover:text-white hover:shadow-[0_0_12px_rgba(225,48,108,0.25)] hover:scale-[1.04]"
                >
                  📷 Instagram
                </a>
                <a
                  href="https://www.youtube.com/channel/UCLFDpyaWesF8TiuYBD5B49w"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[10px] font-bold transition-all border border-[#ff0000]/40 bg-[#1e1e1a] text-[#f87171] hover:border-[#ff0000] hover:bg-[#ff0000] hover:text-white hover:shadow-[0_0_12px_rgba(255,0,0,0.25)] hover:scale-[1.04]"
                >
                  ▶️ YouTube
                </a>
                <a
                  href="https://discord.gg/Hm82tUUY8g"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[10px] font-bold transition-all border border-[#5865F2]/40 bg-[#1e1e1a] text-[#818cf8] hover:border-[#5865F2] hover:bg-[#5865F2] hover:text-white hover:shadow-[0_0_12px_rgba(88,101,242,0.25)] hover:scale-[1.04]"
                >
                  💬 Discord
                </a>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-2 text-[10px] text-muted/50 font-sans shrink-0">
          {t(locale, "footer.note")}
        </p>
        <nav className="mt-1 mb-1 flex items-center justify-center gap-3 text-[11px] text-muted/70 font-sans shrink-0">
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground transition-colors">
            プライバシーポリシー
          </Link>
          <span className="opacity-40">·</span>
          <Link href="/terms" className="underline underline-offset-2 hover:text-foreground transition-colors">
            利用規約
          </Link>
        </nav>
      </section>
    </div>
  );
}
