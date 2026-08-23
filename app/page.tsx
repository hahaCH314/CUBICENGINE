"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { useEditorStore } from "./editor/store";
import { t } from "../lib/i18n";
import { Gem, Sparkles } from "lucide-react";
import TutorialOverlay from "./editor/TutorialOverlay";

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
  // 表紙は「自己ホストの動画非依存カバー」＝CSSのみで組み、外部画像を持たない。
  //  ・表示時の第三者通信ゼロ（プライバシーポリシーと整合）
  //  ・自前画像を持たないので絶対に真っ暗にならない／置き去りも起きない
  //  ・動画差し替えは INTRO_VIDEO_ID を変えるだけ（表紙は触らない）
  //  ・クリックで初めて youtube-nocookie の iframe を読み込む（＝ユーザーの操作で通信）
  const [play, setPlay] = useState(false);
  return (
    <div className="w-full max-w-2xl mx-auto mt-12 mb-4 px-4">
      <div
        className="relative w-full rounded-3xl overflow-hidden shadow-[0_15px_45px_rgba(0,0,0,0.5)] border-2 border-white/10"
        style={{ aspectRatio: "16 / 9", background: "#06110f" }}
      >
        {play ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${INTRO_VIDEO_ID}?rel=0&autoplay=1`}
            title="CUBICENGINE 紹介動画"
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
            aria-label="CUBICENGINE 紹介動画を再生"
            className="absolute inset-0 w-full h-full group cursor-pointer overflow-hidden"
          >
            {/* ダークなブランドグラデ地（暗めのエメラルド→ティール） */}
            <span className="absolute inset-0" style={{ background: "linear-gradient(135deg, #052e16 0%, #064e3b 40%, #0f3d3e 70%, #0c2233 100%)" }} />
            {/* うっすらキューブ格子（暗め） */}
            <span className="absolute inset-0" style={{ opacity: 0.3, background: "repeating-linear-gradient(0deg, rgba(52,211,153,0.15) 0 1px, transparent 1px 34px), repeating-linear-gradient(90deg, rgba(52,211,153,0.15) 0 1px, transparent 1px 34px)" }} />
            {/* 再生ボタン背後のソフトグロー */}
            <span className="absolute left-1/2 top-1/2" style={{ transform: "translate(-50%,-50%)", width: 320, height: 260, background: "radial-gradient(circle, rgba(52,211,153,0.2), transparent 70%)", pointerEvents: "none" }} />
            {/* 中身 */}
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-3.5 z-10">
              {/* YouTube風の赤い再生ボタン（一目で動画と分かる） */}
              <span
                className="flex items-center justify-center transition-transform duration-200 group-hover:scale-110 group-active:scale-95"
                style={{ width: 74, height: 52, borderRadius: 15, background: "#ff0000", boxShadow: "0 8px 22px rgba(255,0,0,0.35)" }}
              >
                <span style={{ borderStyle: "solid", borderWidth: "12px 0 12px 21px", borderColor: "transparent transparent transparent #ffffff" }} />
              </span>
              <span className="font-pixel" style={{ fontSize: 12.5, color: "#ffffff", letterSpacing: "0.08em", textShadow: "0 2px 8px rgba(0,0,0,0.45)" }}>
                CUBICENGINE 紹介動画
              </span>
            </span>

            {/* いたずらな影のアニメーション */}
            <style>{`
              @keyframes shadowRun {
                /* 左からダッシュで登場 */
                0%   { left: -40px; top: calc(100% - 32px); transform: rotate(0deg) scaleX(1) scaleY(1); opacity: 0; }
                2%   { left: 0px;   top: calc(100% - 32px); transform: rotate(0deg) scaleX(1) scaleY(1); opacity: 0.75; }
                /* 走る走る… */
                12%  { left: calc(50% - 60px); top: calc(100% - 32px); transform: rotate(0deg) scaleX(1) scaleY(1); opacity: 0.75; }
                /* つまずいてズサーッ（顔から突っ込む） */
                13%  { left: calc(50% - 40px); top: calc(100% - 24px); transform: rotate(25deg) scaleX(1) scaleY(0.7); opacity: 0.8; }
                15%  { left: calc(50%);        top: calc(100% - 16px); transform: rotate(80deg) scaleX(1.3) scaleY(0.4); opacity: 0.8; }
                /* ぺしゃんこで一瞬止まる */
                18%  { left: calc(50% + 10px); top: calc(100% - 12px); transform: rotate(0deg) scaleX(1.6) scaleY(0.3); opacity: 0.75; }
                /* むくっと起き上がる */
                21%  { left: calc(50% + 10px); top: calc(100% - 32px); transform: rotate(0deg) scaleX(1) scaleY(1); opacity: 0.75; }
                /* よろよろ…（ふらつく） */
                23%  { left: calc(50% + 30px); top: calc(100% - 32px); transform: rotate(-8deg) scaleX(1) scaleY(1); opacity: 0.7; }
                25%  { left: calc(50% + 50px); top: calc(100% - 32px); transform: rotate(10deg) scaleX(1) scaleY(1); opacity: 0.7; }
                /* 右壁にドーン！（ぶつかってぺちゃん） */
                32%  { left: calc(100% - 34px); top: calc(100% - 32px); transform: rotate(0deg) scaleX(1) scaleY(1); opacity: 0.75; }
                33%  { left: calc(100% - 20px); top: calc(100% - 30px); transform: rotate(0deg) scaleX(0.4) scaleY(1.2); opacity: 0.8; }
                /* 壁にへばりついてずるずる登る */
                35%  { left: calc(100% - 26px); top: calc(100% - 40px); transform: rotate(-90deg) scaleX(0.8) scaleY(0.9); opacity: 0.7; }
                42%  { left: calc(100% - 26px); top: 30px; transform: rotate(-90deg) scaleX(1) scaleY(1); opacity: 0.7; }
                /* 天井に到達、逆さでチョロチョロ */
                44%  { left: calc(100% - 40px); top: 2px; transform: rotate(180deg) scaleX(1) scaleY(1); opacity: 0.7; }
                56%  { left: 40%; top: 2px; transform: rotate(180deg) scaleX(1) scaleY(1); opacity: 0.7; }
                /* 天井の真ん中で手を滑らせる！ */
                57%  { left: 38%; top: 2px; transform: rotate(190deg) scaleX(1) scaleY(1); opacity: 0.7; }
                /* 落ちるーー！（ぐるぐる回転しながら落下） */
                58%  { left: 36%; top: 15%; transform: rotate(270deg) scaleX(1) scaleY(1); opacity: 0.8; }
                60%  { left: 34%; top: 50%; transform: rotate(540deg) scaleX(1) scaleY(1); opacity: 0.8; }
                /* 着地！ベチャッ（ぺしゃんこ） */
                62%  { left: 33%; top: calc(100% - 10px); transform: rotate(720deg) scaleX(1.8) scaleY(0.25); opacity: 0.85; }
                /* バウンド！ */
                64%  { left: 33%; top: calc(100% - 60px); transform: rotate(750deg) scaleX(0.8) scaleY(1.2); opacity: 0.7; }
                66%  { left: 33%; top: calc(100% - 10px); transform: rotate(760deg) scaleX(1.3) scaleY(0.5); opacity: 0.75; }
                /* もう一回バウンド（小さく） */
                67%  { left: 33%; top: calc(100% - 40px); transform: rotate(770deg) scaleX(1) scaleY(1); opacity: 0.7; }
                69%  { left: 33%; top: calc(100% - 32px); transform: rotate(0deg) scaleX(1) scaleY(1); opacity: 0.7; }
                /* ぶるぶる震えて復活 */
                70%  { left: 33%; top: calc(100% - 32px); transform: rotate(-5deg) scaleX(1) scaleY(1); opacity: 0.7; }
                71%  { left: 33%; top: calc(100% - 32px); transform: rotate(5deg) scaleX(1) scaleY(1); opacity: 0.7; }
                72%  { left: 33%; top: calc(100% - 32px); transform: rotate(0deg) scaleX(1) scaleY(1); opacity: 0.7; }
                /* 懲りずにまた走り出す → 退場 */
                80%  { left: 10%; top: calc(100% - 32px); transform: rotate(0deg) scaleX(-1) scaleY(1); opacity: 0.7; }
                85%  { left: -5%; top: calc(100% - 32px); transform: rotate(0deg) scaleX(-1) scaleY(1); opacity: 0.7; }
                /* 画面外に消えて一瞬… */
                88%  { left: -40px; top: calc(100% - 32px); transform: rotate(0deg) scaleX(-1) scaleY(1); opacity: 0; }
                /* 急に上からニュッ（顔だけ覗く） */
                91%  { left: 60%; top: -30px; transform: rotate(180deg) scaleX(1) scaleY(1); opacity: 0; }
                93%  { left: 60%; top: -8px; transform: rotate(180deg) scaleX(1) scaleY(1); opacity: 0.6; }
                96%  { left: 60%; top: -8px; transform: rotate(180deg) scaleX(1) scaleY(1); opacity: 0.6; }
                /* 引っ込む */
                98%  { left: 60%; top: -30px; transform: rotate(180deg) scaleX(1) scaleY(1); opacity: 0.3; }
                100% { left: 60%; top: -40px; transform: rotate(180deg) scaleX(1) scaleY(1); opacity: 0; }
              }
              @keyframes shadowStride {
                0%, 100% { transform: translateY(0) rotate(0deg); }
                25% { transform: translateY(-3px) rotate(-3deg); }
                75% { transform: translateY(-3px) rotate(3deg); }
              }
              @keyframes shadowPanic {
                0% { transform: scale(1) rotate(0deg); opacity: 0.75; }
                25% { transform: scale(1.1) rotate(-20deg) translateY(-10px); }
                50% { transform: scale(0.6) rotate(30deg) translateY(-30px); }
                100% { transform: scale(0) rotate(-60deg) translateY(-50px); opacity: 0; }
              }
              .shadow-runner {
                position: absolute;
                width: 30px;
                height: 30px;
                animation: shadowRun 16s 2s infinite linear;
                opacity: 0;
                z-index: 15;
              }
              .shadow-inner {
                width: 100%;
                height: 100%;
                animation: shadowStride 0.18s infinite;
              }
              .group:hover .shadow-inner {
                animation: shadowPanic 0.4s forwards;
              }
            `}</style>
            <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
              <div className="shadow-runner">
                <div className="shadow-inner">
                  <svg viewBox="0 0 24 30" width="30" height="30" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <filter id="sg"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                    </defs>
                    <g filter="url(#sg)" opacity="0.9">
                      {/* 頭 */}
                      <circle cx="12" cy="7" r="6.5" fill="#072b1e"/>
                      {/* アホ毛（ぴょこん） */}
                      <path d="M14 1.5 Q16.5 -3 18 1" stroke="#0d4a32" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                      {/* 目（ギラッと光る） */}
                      <circle cx="9.5" cy="7" r="1.8" fill="#34d399"/>
                      <circle cx="14.5" cy="7" r="1.8" fill="#34d399"/>
                      <circle cx="9" cy="6.3" r="0.6" fill="#a7f3d0"/>
                      <circle cx="14" cy="6.3" r="0.6" fill="#a7f3d0"/>
                      {/* にやり */}
                      <path d="M8.5 10.5 Q12 14 15.5 10.5" stroke="#34d399" strokeWidth="1" fill="none" strokeLinecap="round"/>
                      {/* 体（ヒョロ） */}
                      <rect x="9" y="13" width="6" height="10" rx="3" fill="#072b1e"/>
                      {/* 手（棒） */}
                      <line x1="9" y1="15" x2="3" y2="19" stroke="#072b1e" strokeWidth="2.5" strokeLinecap="round"/>
                      <line x1="15" y1="15" x2="21" y2="12" stroke="#072b1e" strokeWidth="2.5" strokeLinecap="round"/>
                      {/* 足（棒） */}
                      <line x1="10" y1="22" x2="7" y2="28" stroke="#072b1e" strokeWidth="2.5" strokeLinecap="round"/>
                      <line x1="14" y1="22" x2="17" y2="28" stroke="#072b1e" strokeWidth="2.5" strokeLinecap="round"/>
                    </g>
                  </svg>
                </div>
              </div>
            </div>
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

// Java版(GROVE)の Windows インストーラだけを個別に解禁するフラグ。
// RELEASES_READY は統合版と共通なので、それを true にすると実体の無い
// SPROUT_editor.exe へのリンクまで出て 404 になる。版ごとに分けている。
// ⚠️ GitHub Releases に GROVE_editor.exe を公開してから true にすること。
// 2026-07-30: v0.1.0 として公開済み。DLリンクの疎通も確認済み。
//
// 2026-08-10 に false へ戻した。**配布中の v0.1.0 が壊れているため。**
//   ・exe が素の electron.exe より約170KB小さく、起動した瞬間に 0x80000003 で落ちる
//   ・仮に起動できても Next 16 の cwd 問題で全リクエストが 500（d65675ad で修正済み）
// 疎通確認（リンクが200を返すか）は通ってしまうので、それだけでは気づけない。
//
// ⚠️ true に戻す前に必ず: タグを打って CI でビルドし直し、
//    Releases の .exe を実際にインストールして起動するところまで確認すること。
//    CI には「実際に起動して 127.0.0.1:3200 が 200 を返すか」の検査を入れてある。
const GROVE_EXE_READY = true;

// 配布中の GROVE_editor.exe の SHA-256。GitHub Releases が公表している digest と
// ダウンロードした実物のハッシュが一致することを確認済み(2026-08-09)。
// VirusTotal のファイルレポートURLはこのハッシュそのものなので、値を1か所に持てば
// リンクも同一性の検証もこれで足りる。
// ⚠️ 新しいリリースを出したらここも更新すること。古いままだと、いま配っている
//    ファイルとは別物の検査結果へ誘導してしまう。
// 2026-08-22 更新: v0.1.3 のもの。GitHub API の digest と、実際に
// releases/latest/download から落とした実物の SHA-256 が一致することを確認済み。
// ⚠️ タグを打ち直したら必ずここも更新すること。古いままだと、いま配っている
//    ファイルとは**別物の検査結果**へ「これは安全です」と誘導することになる。
const GROVE_EXE_SHA256 =
  "0b822763b2a41cb88825b71a630ea32093a10f6b7fd6bdf8bba8f54fa4eb08c9";

// SPROUT(統合版)を一時的にメンテナンス中（false）にするフラグ。
const SPROUT_READY = true;

// GROVE(Java)を一般公開＝解禁(2026-07-02)。カードは「Webで試す」→ /editor?mode=grape
// （動作するWebエディタ）へ誘導。.exe/.dmg のデスクトップDLは別フラグ RELEASES_READY
// (=false) で引き続き非表示のため、リンク切れ(404)は出ない。
// 2026-07-02 一時停止: Java版エクスポート未完成のため準備中に戻していた。
// 2026-07-30 解禁: GUIを介さず本物の exporter を直接呼んで検証し、
//   ・生成された ModEventHandler.java にロジックが入っている（イベント数 N=1）
//   ・gradlew build が BUILD SUCCESSFUL で .jar を生成する
//   の2点を確認できたため。止めていた理由は解消済み。
//
// 2026-08-10 に false へ戻した。このカードのリンク先も GROVE_editor.exe で、
// GROVE_EXE_READY と同じ壊れた配布物を指している。片方だけ止めても
// もう片方から落とせてしまうので、両方を同時に閉じる。
// 戻すときも両方まとめて。理由は GROVE_EXE_READY のコメントを見ること。
const JAVA_READY = true;

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
  // 作り方ガイド（エディタと同じ TutorialOverlay を使い回す）
  const [showGuide, setShowGuide] = useState(false);
  return (
    <div className="min-h-screen flex flex-col relative" style={{ background: "radial-gradient(circle at 25% 15%, rgba(132, 204, 22, 0.16) 0%, transparent 45%), radial-gradient(circle at 75% 15%, rgba(14, 165, 233, 0.16) 0%, transparent 45%), radial-gradient(circle at 50% 60%, rgba(245, 158, 11, 0.1) 0%, transparent 55%), #171715" }}>
      {/* Navigation（ログイン/新規登録は撤去・ローカル版） */}
      <nav className="shrink-0 bg-panel border-b-4 border-[#121210] h-14">
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          <a href="https://cubicenginestudio.vercel.app/" target="_blank" rel="noopener noreferrer" className="flex items-center group relative w-14 h-full justify-center">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] pointer-events-none mix-blend-screen opacity-95 group-hover:scale-110 transition-transform duration-700">
              <img 
                src="/studio-logo.jpg" 
                alt="CUBICENGINEstudio" 
                className="w-full h-full object-contain animate-[spin_3600s_linear_infinite]" 
              />
            </div>
          </a>
          <div className="flex items-center gap-3">
            <span className="font-pixel text-[8px] sm:text-[10px]" style={{ color: "#f0a818", opacity: 0.9 }}>{t(locale, "nav.edition")}</span>
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
          className="text-[12px] min-[380px]:text-[14px] sm:text-base md:text-lg font-medium text-foreground/80 mb-2 tracking-tight sm:tracking-wider font-sans whitespace-nowrap"
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
              {SPROUT_READY ? (
                <>
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
                </>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <span
                    aria-label={t(locale, "sprout.soon")}
                    title={t(locale, "sprout.soonTitle")}
                    className="animate-pulse w-20 h-20 inline-flex items-center justify-center rounded-2xl cursor-default"
                    style={{
                      background: "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(22,163,74,0.1))",
                      border: "3px solid rgba(34,197,94,0.45)",
                      boxShadow: "inset 0 0 10px rgba(34,197,94,0.2)",
                    }}
                  >
                    <CubeIcon className="w-8 h-8 text-white/20" />
                  </span>
                  <div className="flex flex-col items-center">
                    <span style={{ color: "#a3e635", textShadow: "0 0 8px rgba(34,197,94,0.3)" }} className="text-xs font-bold font-pixel">
                      {t(locale, "sprout.soon")}
                    </span>
                    <span className="text-[9px] font-normal mt-0.5" style={{ color: "rgba(163,230,53,0.7)" }}>
                      {t(locale, "sprout.soonSub")}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* GROVE Card */}
          {/* ⚠️ スマホでは出さない（hidden md:flex）。
              Java版は「準備中」の告知しか出せない状態で、スマホでは縦に積まれるため
              統合版カードの真下に居座り、本題（さっそく作る）の後ろに
              まだ使えないものを読ませることになる。
              スマホから来た人は統合版(.mcaddon)の利用者なので、Java版は
              そもそも関係がない。パソコンでは横に並ぶので今までどおり出す。 */}
          <div
            style={{
              maxWidth: "320px",
              padding: "28px 24px",
              borderRadius: "24px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "3px solid #0ea5e9",
              boxShadow: "0 12px 40px -10px rgba(0, 0, 0, 0.6), 0 0 25px 0 rgba(14, 165, 233, 0.12)",
              // ⚠️ display はここに書かないこと。インラインstyleは Tailwind の hidden より
              //    強いので、書くとスマホで隠せなくなる。className 側で hidden md:flex を掛ける
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "20px",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
            className="hidden md:flex w-full md:w-auto md:flex-[1_1_240px] hover:scale-[1.03] hover:border-[#38bdf8] hover:shadow-[0_20px_50px_-10px_rgba(0,0,0,0.8),0_0_35px_0_rgba(14, 165, 233, 0.2)]"
          >
            {/* Tag */}
            <span className="px-4 py-1.5 rounded-full text-xs font-pixel tracking-wider" style={{ background: "rgba(14, 165, 233, 0.15)", color: "#38bdf8", border: "1.5px solid rgba(14, 165, 233, 0.3)", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
              {t(locale, "grove.tag")}
            </span>

            <div className="w-full flex flex-col items-center gap-3">
                {JAVA_READY ? (
                  <>
                    {/* ⚠️ 2026-08-23、Web だけで .jar が作れるようになった。
                        base-mod.jar に設計図を注入する方式で、JDK も gradle も要らない。
                        実機(Forge 1.20.1)で MOD読込・メッセージ・ブロック登録まで確認済み。
                        以前はここが .exe のダウンロードだったが、主役が入れ替わったので
                        Web を大きく、パソコン版を補助に落とす。 */}
                    <Link
                      href="/editor?mode=grape"
                      className="w-20 h-20 inline-flex items-center justify-center rounded-2xl transition-all duration-75 relative hover:-translate-y-1 hover:shadow-[0_8px_0_#0369a1,0_12px_24px_rgba(0,0,0,0.4)] active:translate-y-1 active:shadow-[0_2px_0_#0369a1,0_4px_8px_rgba(0,0,0,0.25)]"
                      style={{
                        background: "linear-gradient(135deg, #38bdf8, #0ea5e9)",
                        border: "3px solid #0369a1",
                        boxShadow: "0 6px 0 #0369a1, 0 8px 16px rgba(0,0,0,0.35)",
                        transform: "translateY(0)",
                      }}
                      aria-label="ブラウザでJava版を作る"
                    >
                      <CubeIcon className="w-9 h-9 text-yellow-200" />
                    </Link>
                    <span className="text-xs font-bold text-white/95" style={{ textShadow: "1px 1px 2px rgba(0,0,0,0.8)" }}>
                      ✨ ブラウザで作る
                    </span>
                    <span className="text-[9px] font-normal mt-0.5 text-center" style={{ color: "rgba(127,233,247,0.7)" }}>
                      .jar がそのまま落ちてきます／インストール不要
                    </span>

                    {/* ⚠️ ここにパソコン版のリンクを置かないこと。
                        すぐ下に GROVE_EXE_READY のDLセクション（大きいボタン）が
                        別にあり、同じものが2つ並んで見える。実際に一度そうなった。
                        カードは「ブラウザで作る」1本に絞る。 */}
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

        {/* ★Java版(GROVE)デスクトップ版のダウンロード。
            Java版のMOD作りは gradlew でのビルドが要るため、ブラウザだけでは完結しない。
            そこだけはデスクトップ版が必要になるので、トップから直接落とせるようにする。
            ※フラグは版ごとに分けている。統合版の .exe はまだ公開していないので、
              共通フラグにすると存在しないファイルへのリンクが出て404になる。 */}
        {/* ⚠️ スマホでは出さない（hidden md:flex）。
            Java版のMODはパソコンでしか作れないので、スマホの人には
            **押せてしまうこと自体が害**になる。171MBのWindows用インストーラを
            落とさせても、その端末では絶対に使えない。
            上の Java版カードは既に隠してあるが、この配布セクションは別物なので
            片方だけ隠しても意味がない（実際にスマホから見えていた）。 */}
        {GROVE_EXE_READY && (
          <div className="hidden md:flex w-full flex-col items-center gap-2 mt-10 mb-2 px-4">
            <a
              href={DOWNLOADS.grove.win}
              download
              className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-2xl font-bold text-[15px] transition-all hover:scale-[1.04] active:scale-95"
              style={{
                background: "linear-gradient(135deg,#7dd3fc,#0ea5e9)",
                border: "3px solid #0c4a6e",
                boxShadow: "0 5px 0 #0369a1, 0 6px 16px rgba(3,105,161,0.3)",
                color: "#082f49",
              }}
            >
              💻 {t(locale, "dl.groveWin")}
            </a>
            <p className="text-[11px] text-muted/70 font-sans text-center leading-relaxed whitespace-pre-line">
              {t(locale, "dl.groveNote")}
            </p>
            {/* 署名なしのため Windows の警告は必ず出る。上の案内だけだと「警告が出るけど
                押して大丈夫」と言っているだけになるので、第三者の検査結果で裏をとれるようにする。
                リンク先URLの末尾は配布ファイルの SHA-256 そのものなので、確かめたい人は
                手元のファイルのハッシュと突き合わせれば同一性まで検証できる。 */}
            <p className="text-[11px] text-muted/70 font-sans text-center leading-relaxed">
              {t(locale, "dl.scanned")}{" "}
              <a
                href={`https://www.virustotal.com/gui/file/${GROVE_EXE_SHA256}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground transition-colors"
              >
                {t(locale, "dl.scanLink")}
              </a>
            </p>
          </div>
        )}

        {/* ★紹介動画セクション（ブロックされても空箱にならないクリック再生式） */}
        <IntroVideo />

        {/* ★作り方ガイド。エディタを開く前に「何を作るのか・どう作るのか」を見られるようにする。
            アドオン/MODという言葉自体を知らない人は、エディタに入っても何をする画面か分からない。
            入る前に読めれば、初めての人でも身構えずに済む。 */}
        <div className="w-full flex flex-col items-center gap-2 mt-6 mb-2 px-4">
          <button
            type="button"
            onClick={() => setShowGuide(true)}
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl font-bold text-[15px] transition-all hover:scale-[1.04] active:scale-95"
            style={{
              background: "linear-gradient(135deg,#fde68a,#fbbf24)",
              border: "3px solid #1e293b",
              boxShadow: "0 5px 0 #b45309, 0 6px 16px rgba(180,83,9,0.28)",
              color: "#451a03",
            }}
          >
            📖 {t(locale, "guide.open")}
          </button>
          <p className="text-[11px] text-muted/70 font-sans">{t(locale, "guide.note")}</p>
          {/* 読み物版への内部リンク。検索エンジンはリンクを辿るので、
              どこからも繋がっていないページは見つけてもらえず評価もされない。 */}
          <Link
            href="/guide"
            className="text-[11px] font-sans underline underline-offset-2 text-muted/60 hover:text-foreground transition-colors"
          >
            {t(locale, "guide.readPage")}
          </Link>
        </div>

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
                        <W>「自分のアドオンでマイクラに<br className="sm:hidden" /></W>
                        <W>無限ダイヤを！」</W>
                      </span>
                    </L>
                    <L className="mt-1">
                      <W>というくだらない夢から<br className="sm:hidden" /></W>
                      <W>始まりました。</W>
                    </L>
                    <L className="mt-2">
                      <W>その夢を形にし、<br className="sm:hidden" /></W>
                    </L>
                    <L className="mt-1">
                      <W>実現させたのが<br className="sm:hidden" /></W>
                      <W>本サイト</W>
                      <span className="font-bold text-white"> CUBICENGINE </span>
                      <W>です。</W>
                    </L>
                  </div>

                  {/* 2段目: 作者の学齢とコア機能無料。
                      ※年齢を「◯歳」と一点で書かない＝未成年の特定情報を減らす（毎年の書き換えも不要）。 */}
                  <div className="pt-4 border-t border-dashed border-white/10">
                    <L className="text-white/95">
                      <W>なっとうサイダーは</W>
                      <W>今、中学生です。</W>
                    </L>
                    <L className="mt-2 text-white/95">
                      <W>「同じようにマイクラや、<br className="sm:hidden" /></W>
                      <W>プログラミングが好きな人に、<br className="sm:hidden" /></W>
                      <W>作る楽しさを共有したい」</W>
                    </L>
                    <L className="mt-2 text-white/80">
                      <W>との思いから、<br className="sm:hidden" />本人の希望により</W>
                      <W>コア機能は全て無料で<br className="sm:hidden" /></W>
                      <W>ご利用いただけます。</W>
                    </L>
                  </div>

                  {/* 3段目: 開発費用とお小遣い */}
                  <div className="pt-4 border-t border-dashed border-white/10 text-white/80">
                    <L>
                      <W>まだまだ未熟な<br className="sm:hidden" />開発マネージャーですが、<br className="sm:hidden" /></W>
                    </L>
                    <L className="mt-1">
                      <W>お小遣いを全て<br className="sm:hidden" />開発費用にあててきました。</W>
                    </L>
                    <L className="mt-2 text-white/90">
                      <W>頂いた寄付は今後の運営費、<br className="sm:hidden" /></W>
                    </L>
                    <L className="mt-1 text-white/90">
                      <W>新たな開発費用として<br className="sm:hidden" />大切に使わせていただきます。</W>
                    </L>
                    <L className="mt-2.5 text-white font-bold text-[14px]">
                      <W>よろしくお願いいたします</W>
                    </L>
                  </div>

                  {/* 4段目: 運営情報 */}
                  <div className="pt-4 border-t border-dashed border-white/10 text-xs text-muted/75">
                    <L>
                      <W>CUBICENGINEstudioは<br className="sm:hidden" />保護者が運営しております。</W>
                    </L>
                    <L className="mt-1">
                      <W>寄付の受け取り・管理は<br className="sm:hidden" />CUBICENGINEstudioが行います。</W>
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
                      <W>アホほど</W>
                      <W>ダイヤ出せます</W>
                    </L>
                    <L className="mt-1">
                      <W>作る楽しさを</W>
                    </L>
                    <L className="mt-1">
                      <span className="font-bold text-[#f59e0b]">くだらない</span>
                      <W>ことで</W>
                      <W>一緒に笑える</W>
                      <W>仲間へ</W>
                      <W>届きますように(o^―^o)ﾆｺ</W>
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
                      <W>でもね、<br className="sm:hidden" /></W>
                      <W>作る楽しさに出会えて</W>
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

            <div className="flex flex-col items-center gap-1.5 my-auto">
              {/* 下部の署名「なっとうサイダー」は撤去（上部「これを作ってる人」に名前があり重複のため） */}
              <div className="flex items-center gap-1.5 text-[10px] font-sans">
                <span className="tracking-wide text-white">Special Thanks</span>
                <span className="font-pixel text-[11px] bg-gradient-to-r from-[#ff5ca2] via-[#ffd23f] to-[#22d3ee] bg-clip-text text-transparent">
                  ドーユー☆ラボ
                </span>
              </div>
              <span className="font-sans font-light text-[11px] text-white/90 tracking-widest pl-16">
                PC99 LABO
              </span>
            </div>

          </div>
        </div>

        {/* 公式SNS */}
        <div className="flex flex-col items-center gap-2 sm:gap-3 mt-4 mb-8">
          <p className="text-[10px] sm:text-[11px] font-pixel tracking-widest text-muted/70">{t(locale, "studio.follow")}</p>
          <div className="flex flex-wrap justify-center items-center gap-2 sm:gap-3">
            {/* ⚠️ **SNS への直リンクは置かない**（2026-08-17、伊波さん
                「ここはもう会社のだから切り離して欲しい」）。
                会社HP が唯一のハブで、そこのフッターに Instagram / TikTok /
                X / YouTube が並んでいる。ここから個別に飛ばすと、
                　- 会社の公式（cubicenginestudio）と古い個人アカウント
                　  （cubic_engine）が混ざる
                　- Discord は誰もいないサーバーなので、招くと逆効果
                という二つの問題が出る。**ハブ1つへ送るだけにする。** */}
            <a
              href="https://cubicenginestudio.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-bold transition-all border border-[#22d3ee]/40 bg-[#1e1e1a]/80 text-[#67e8f9] hover:border-[#22d3ee] hover:bg-[#22d3ee] hover:text-[#0b0b09] hover:shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:-translate-y-0.5"
            >
              🏠 CUBICENGINEstudio
            </a>
          </div>
        </div>

        <p className="mt-2 text-[10px] text-muted/50 font-sans shrink-0">
          {t(locale, "footer.note")}
        </p>

        {/* 開発元への戻り線。ここから会社HP → 他の製品（CMCUBE等）へ辿れるようにする */}
        <a
          href="https://cubicenginestudio.vercel.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 text-[11px] font-sans underline underline-offset-2 text-muted/60 hover:text-foreground transition-colors shrink-0"
        >
          {t(locale, "footer.studio")} ↗
        </a>

        {/* 姉妹アプリ。どちらもブラウザで動く無料のものなので、
            寄付と販売の導線が同じ画面に並ぶことにはならない（2026-08-10） */}
        <a
          href="https://tinycube.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 text-[11px] font-sans underline underline-offset-2 text-muted/60 hover:text-foreground transition-colors shrink-0"
        >
          {t(locale, "footer.tinycube")} ↗
        </a>
      </section>

      {/* 作り方ガイド（エディタと同じものを使い回す＝説明が2箇所に分かれない） */}
      {showGuide && <TutorialOverlay onClose={() => setShowGuide(false)} />}
    </div>
  );
}
