import Link from "next/link";
import { getSession } from "@/lib/session";
import { NavUserSection } from "@/app/NavUserSection";

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

function BlockGrid() {
  return null;
}

const features = [
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </svg>
    ),
    title: "3Dモデルエディター",
    desc: "Blockbenchスタイルのボクセルエディタで、ブロック・アイテム・エンティティモデルを直感的に作成。",
    color: "from-violet-500/20 to-indigo-500/20",
    borderColor: "border-violet-500/30",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
    title: "ビジュアルロジック",
    desc: "ドラッグ＆ドロップのビジュアルプログラミングでModのロジックを構築。コーディング不要。",
    color: "from-cyan-500/20 to-teal-500/20",
    borderColor: "border-cyan-500/30",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1m-4-4-4 4m0 0-4-4m4 4V4" />
      </svg>
    ),
    title: "ワンクリックエクスポート",
    desc: "Bedrock・Java対応のアドオンパックを即座に生成。面倒な設定は不要。",
    color: "from-amber-500/20 to-orange-500/20",
    borderColor: "border-amber-500/30",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: "リアルタイムプレビュー",
    desc: "変更が即座に反映されるライブプレビューで、開発サイクルを劇的に短縮。",
    color: "from-emerald-500/20 to-green-500/20",
    borderColor: "border-emerald-500/30",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z" />
      </svg>
    ),
    title: "統合開発環境",
    desc: "モデル・ロジック・設定をすべて一つの画面で管理できるオールインワンIDE。",
    color: "from-rose-500/20 to-pink-500/20",
    borderColor: "border-rose-500/30",
  },
  {
    icon: (
      <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 1 0 0 4m0-4a2 2 0 1 1 0 4m-6 8a2 2 0 1 0 0-4m0 4a2 2 0 1 1 0-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 1 0 0-4m0 4a2 2 0 1 1 0-4m0 4v2m0-6V4" />
      </svg>
    ),
    title: "高度なカスタマイズ",
    desc: "テーマ・レイアウト・ショートカットを自由に設定し、自分だけのワークスペースを構築。",
    color: "from-sky-500/20 to-blue-500/20",
    borderColor: "border-sky-500/30",
  },
];

export default async function HomePage() {
  const session = await getSession();
  const user = session ? { username: session.username } : null;
  return (
    <div className="min-h-screen relative">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-panel border-b-4 border-[#121210] h-16">
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative">
              <CubeIcon className="w-8 h-8 text-accent group-hover:scale-105 transition-transform" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              CUBICENGINE
              <span className="text-accent ml-1">Studio</span>
            </span>
          </Link>

          <NavUserSection user={user} />
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
        <BlockGrid />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">


          <div className="animate-fade-in-up opacity-0 delay-200">
            <h1 className="text-5xl sm:text-7xl md:text-8xl font-pixel tracking-wider mb-6 animate-float-slow"
                style={{
                  color: "#fbbf24", // マイクラ公式ロゴ風のゴールド（金鉱石）
                  textShadow: "6px 6px 0px #1e1208, 12px 12px 0px rgba(0,0,0,0.25)", // マイクラ風の極太立体黒影
                  imageRendering: "pixelated"
                }}>
              CUBIC
              <span style={{ color: "#22d3ee", textShadow: "6px 6px 0px #0b2d3a, 12px 12px 0px rgba(0,0,0,0.25)" }}>ENGINE</span>
            </h1>
          </div>

          <p className="text-xl sm:text-3xl font-bold text-foreground mb-6 tracking-wider font-pixel animate-fade-in-up opacity-0 delay-300"
             style={{ textShadow: "3px 3px 0px #1e1208", lineHeight: 1.6 }}>
            MINECRAFT add-on mod
            <br />
            直感的に作る
          </p>

          <p className="text-sm md:text-lg text-muted max-w-2xl mx-auto mb-10 animate-fade-in-up opacity-0 delay-400 font-sans"
             style={{ textShadow: "1.5px 1.5px 0px #1e1208", lineHeight: 1.6 }}>
            楽しいビジュアル環境、コーディング不要
            <br />
            アドオン、MODを設計・構築・エクスポート
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 animate-fade-in-up opacity-0 delay-400">
            <Link
              href="/editor"
              id="cta-create-now"
              className="mc-btn mc-btn--lg mc-btn--primary"
            >
              今すぐ作る ➔
            </Link>

            <a
              href="#features"
              className="mc-btn mc-btn--lg"
            >
              機能を見る
            </a>
          </div>


        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              すべてが
              <span className="text-accent">一つ</span>
              に
            </h2>
            <p className="text-muted text-lg max-w-xl mx-auto">
              モデリング、ロジック、設定管理をシームレスに統合した開発体験。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div
                key={i}
                className="mc-panel p-6"
                style={{ backgroundColor: "var(--surface)" }}
              >
                <div className="w-12 h-12 mc-bevel-inset bg-[#1f1e1a] flex items-center justify-center text-accent mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-bold mb-2 font-pixel text-accent">{feature.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About / CTA Section */}
      <section id="about" className="relative py-32 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="relative inline-block mb-8 animate-float">
            <CubeIcon className="w-20 h-20 text-accent" />
          </div>

          <h2 className="text-3xl md:text-5xl font-bold mb-6" style={{ textShadow: "2px 2px 0px #1e1208" }}>
            創造力を解放しよう
          </h2>
          <p className="text-muted text-lg mb-10 max-w-xl mx-auto">
            CUBICENGINE Studioは、初心者からプロまで誰でも使えるMinecraft Mod開発プラットフォームです。
            今すぐ始めて、あなたのアイデアを形にしましょう。
          </p>

          <Link
            href="/editor"
            className="mc-btn mc-btn--lg mc-btn--primary px-10 py-5 text-xl"
          >
            開発を始める ➔
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted">
          <div className="flex items-center gap-2">
            <CubeIcon className="w-5 h-5 text-accent" />
            <span>CUBICENGINE Studio</span>
          </div>
          <p>&copy; 2026 CUBICENGINE. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
