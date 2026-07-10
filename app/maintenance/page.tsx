import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "メンテナンス中",
  robots: { index: false, follow: false },
};

// メンテナンス画面。proxy.ts が MAINTENANCE_MODE=true の間、全ページをここへ振り替える。
// 外部画像なし＝プライバシー/軽量方針を維持（CSSのみ）。
export default function MaintenancePage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "24px",
        color: "#e6fff9",
        background:
          "radial-gradient(circle at 30% 15%, rgba(52,211,153,0.18) 0%, transparent 45%), radial-gradient(circle at 75% 20%, rgba(34,211,238,0.16) 0%, transparent 45%), #0a1614",
      }}
    >
      <div style={{ fontSize: 64, marginBottom: 12, filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.4))" }}>🔧</div>
      <h1
        className="font-pixel"
        style={{ fontSize: 22, letterSpacing: "0.08em", color: "#5eead4", textShadow: "0 2px 8px rgba(0,0,0,0.5)", margin: "0 0 16px" }}
      >
        メンテナンス中
      </h1>
      <p style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.9, maxWidth: 460, margin: 0, color: "#d7fff7" }}>
        ただいま CUBICENGINE をより良くするための
        <br />
        メンテナンスを行っています。
      </p>
      <p style={{ fontSize: 13, lineHeight: 1.9, marginTop: 14, color: "rgba(215,255,247,0.7)" }}>
        しばらくしてから、もう一度おこしください。
      </p>
      <p className="font-pixel" style={{ fontSize: 11, letterSpacing: "0.12em", marginTop: 40, color: "rgba(94,234,212,0.6)" }}>
        CUBICENGINE studio
      </p>
    </main>
  );
}
