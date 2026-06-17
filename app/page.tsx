"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useEditorStore } from "./editor/store";
import { t } from "../lib/i18n";

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
    <div className="h-screen overflow-hidden flex flex-col relative">
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
              className="font-pixel text-[10px] px-2.5 py-1 rounded border border-white/15 hover:border-white/40 transition-colors"
              style={{ color: "#e5e7eb" }}
            >
              🌐 {t(locale, "lang.toggle")}
            </button>
          </div>
        </div>
      </nav>

      {/* Hero（1画面に収まる中央配置） */}
      <section className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 text-center overflow-hidden">
        <h1
          className="text-5xl sm:text-7xl md:text-8xl font-pixel tracking-wider mb-5 animate-float-slow"
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
          className="text-xl sm:text-3xl font-bold text-foreground mb-4 tracking-wider font-pixel"
          style={{ textShadow: "3px 3px 0px #1e1208", lineHeight: 1.5 }}
        >
          {t(locale, "hero.sub")}
          <br />
          {t(locale, "hero.tagline")}
        </p>

        <p
          className="text-sm md:text-base text-muted max-w-2xl mx-auto mb-8 font-sans"
          style={{ textShadow: "1.5px 1.5px 0px #1e1208", lineHeight: 1.6 }}
        >
          {t(locale, "hero.desc1")}
          <br />
          {t(locale, "hero.desc2")}
        </p>
        <div className="flex flex-col md:flex-row gap-6 justify-center items-stretch max-w-4xl mx-auto mt-2 px-4 py-4 shrink-0 w-full">
          {/* SPROUT Card */}
          <div
            style={{
              flex: "1 1 300px",
              maxWidth: "350px",
              padding: "24px",
              borderRadius: "20px",
              background: "rgba(255, 255, 255, 0.03)",
              border: "2px solid rgba(163, 230, 53, 0.15)",
              boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
              backdropFilter: "blur(4px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "14px",
              transition: "transform 0.2s ease, border-color 0.2s ease",
            }}
            className="hover:scale-[1.02] hover:border-[#a3e635]/40"
          >
            <span style={{ fontSize: 44, filter: "drop-shadow(0 0 10px rgba(163,230,53,0.3))" }}>🌱</span>
            <div>
              <h2 className="text-xl font-bold font-pixel tracking-wider text-[#a3e635] mb-1">
                SPROUT
              </h2>
              <p className="text-[10px] font-pixel text-[#a3e635]/90 mb-2">{t(locale, "sprout.tag")}</p>
              <p className="text-xs text-muted leading-relaxed text-center font-sans max-w-[280px] mx-auto">
                {t(locale, "sprout.desc")}
              </p>
            </div>

            <div className="w-full flex flex-col gap-2.5 mt-auto">
              <Link
                href="/editor?mode=tsumiki"
                className="w-full inline-flex items-center justify-center px-5 py-3 rounded-xl font-bold text-sm text-white transition-all hover:scale-[1.03]"
                style={{
                  background: "linear-gradient(135deg, #a3e635, #16a34a)",
                  boxShadow: "0 6px 18px rgba(22,163,74,0.45)",
                }}
              >
                {t(locale, "cta.tryWeb")}
              </Link>
              <DlButton
                href={DOWNLOADS.sprout.win}
                kind="win"
                label={t(locale, "dl.win")}
                style={{
                  background: "linear-gradient(135deg, #a3e635, #16a34a)",
                  boxShadow: "0 4px 12px rgba(22,163,74,0.3)",
                }}
              />
              <DlButton
                href={DOWNLOADS.sprout.mac}
                kind="mac"
                label={t(locale, "dl.mac")}
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                }}
              />
            </div>
          </div>

          {/* GROVE Card */}
          <div
            style={{
              flex: "1 1 300px",
              maxWidth: "350px",
              padding: "24px",
              borderRadius: "20px",
              background: "rgba(255, 255, 255, 0.03)",
              border: "2px solid rgba(34, 211, 238, 0.15)",
              boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
              backdropFilter: "blur(4px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "14px",
              transition: "transform 0.2s ease, border-color 0.2s ease",
            }}
            className="hover:scale-[1.02] hover:border-[#22d3ee]/40"
          >
            <span style={{ fontSize: 44, filter: "drop-shadow(0 0 10px rgba(34,211,238,0.3))" }}>🌿</span>
            <div>
              <h2 className="text-xl font-bold font-pixel tracking-wider text-[#22d3ee] mb-1">
                GROVE
              </h2>
              <p className="text-[10px] font-pixel text-[#22d3ee]/90 mb-2">{t(locale, "grove.tag")}</p>
              <p className="text-xs text-muted leading-relaxed text-center font-sans max-w-[280px] mx-auto">
                {t(locale, "grove.desc")}
              </p>
            </div>

            <div className="w-full flex flex-col gap-2.5 mt-auto">
              <Link
                href="/editor?mode=grape"
                className="w-full inline-flex items-center justify-center px-5 py-3 rounded-xl font-bold text-sm text-white transition-all hover:scale-[1.03]"
                style={{
                  background: "linear-gradient(135deg, #22d3ee, #0891b2)",
                  boxShadow: "0 6px 18px rgba(8,145,178,0.45)",
                }}
              >
                {t(locale, "cta.tryWeb")}
              </Link>
              <DlButton
                href={DOWNLOADS.grove.win}
                kind="win"
                label={t(locale, "dl.win")}
                style={{
                  background: "linear-gradient(135deg, #22d3ee, #0891b2)",
                  boxShadow: "0 4px 12px rgba(8,145,178,0.3)",
                }}
              />
              <DlButton
                href={DOWNLOADS.grove.mac}
                kind="mac"
                label={t(locale, "dl.mac")}
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                }}
              />
            </div>
          </div>
        </div>

        <p className="mt-6 text-[10px] text-muted/50 font-sans shrink-0">
          {t(locale, "footer.note")}
        </p>
      </section>
    </div>
  );
}
