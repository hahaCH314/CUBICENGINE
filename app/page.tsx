import Link from "next/link";

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
          <span className="font-pixel text-[10px]" style={{ color: "#f0a818", opacity: 0.9 }}>LOCAL EDITION</span>
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
          MINECRAFT add-on mod
          <br />
          直感的に作る
        </p>

        <p
          className="text-sm md:text-base text-muted max-w-2xl mx-auto mb-8 font-sans"
          style={{ textShadow: "1.5px 1.5px 0px #1e1208", lineHeight: 1.6 }}
        >
          楽しいビジュアル環境、コーディング不要。
          <br />
          アドオン・MODを設計・構築・エクスポート。
        </p>

        <div className="flex flex-wrap gap-5 justify-center">
          {/* 統合版＝積み木＝アドオン */}
          <Link href="/editor?mode=tsumiki" id="cta-create-now"
            className="group"
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              minWidth: 210, padding: "18px 26px", borderRadius: 16, textDecoration: "none",
              background: "linear-gradient(135deg, #fb7185, #b54a3a)", color: "#fff",
              boxShadow: "0 6px 18px rgba(181,74,58,0.45), inset 0 1px 0 rgba(255,255,255,0.35)",
            }}>
            <span style={{ fontSize: 30 }}>🧱</span>
            <span style={{ fontSize: 18, fontWeight: 900 }}>積み木で作る</span>
            <span style={{ fontSize: 11, fontWeight: 800, opacity: 0.9 }}>統合版・アドオン</span>
          </Link>
          {/* JAVA＝ぶどう＝MOD（新） */}
          <Link href="/editor?mode=grape"
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              minWidth: 210, padding: "18px 26px", borderRadius: 16, textDecoration: "none",
              background: "linear-gradient(135deg, #5fe0b8, #2f8f73)", color: "#08322a",
              boxShadow: "0 6px 18px rgba(47,143,115,0.45), inset 0 1px 0 rgba(255,255,255,0.45)",
            }}>
            <span style={{ fontSize: 30 }}>🍇</span>
            <span style={{ fontSize: 18, fontWeight: 900 }}>ぶどうで作る</span>
            <span style={{ fontSize: 11, fontWeight: 800, opacity: 0.85 }}>JAVA・MOD（新）</span>
          </Link>
        </div>

        <p className="mt-6 text-[11px] text-muted/50 font-sans">
          ローカル/オフラインで動く・アカウント不要
        </p>
      </section>
    </div>
  );
}
