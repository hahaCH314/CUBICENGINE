"use client";

/* ══════════════════════════════════════════════════════════
   /promo — ショート動画 録画用プロモ画面（縦9:16・日本語）
   ブラウザで開いて、中央のタテ枠を画面録画するだけ。約16秒でループ。
   台本: フック → えらぶ/かさねる → 完成 → マイクラへ → ロゴ/CTA
   ※ 本番アプリ(app/editor)には一切影響しない独立ページ。
   ══════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";

type Scene = { id: string; start: number; caption: string };
const SCENES: Scene[] = [
  { id: "hook",  start: 0,     caption: "このアドオン、コードを書かずに作った。" },
  { id: "build", start: 2600,  caption: "えらんで、かさねるだけ。" },
  { id: "done",  start: 8600,  caption: "アドオン完成！🎉" },
  { id: "run",   start: 10800, caption: ".mcaddon を、いつものマイクラへ。" },
  { id: "logo",  start: 13400, caption: "" },
];
const TOTAL = 16000;

export default function PromoPage() {
  const [t, setT] = useState(0);
  const [loop, setLoop] = useState(0);

  useEffect(() => {
    let raf = 0;
    let start = performance.now();
    const tick = (now: number) => {
      let e = now - start;
      if (e >= TOTAL) { start = now; e = 0; setLoop(l => l + 1); }
      setT(e);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const idx = SCENES.reduce((acc, s, i) => (t >= s.start ? i : acc), 0);
  const scene = SCENES[idx];
  const key = `${scene.id}-${loop}`;

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#0b0f14",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
    }}>
      <style>{KEYFRAMES}</style>

      {/* 9:16 ステージ（ここを画面録画する） */}
      <div style={{
        position: "relative", height: "100dvh", maxHeight: "100dvh", aspectRatio: "9 / 16", maxWidth: "100vw",
        overflow: "hidden", borderRadius: 18,
        background: "linear-gradient(#bfe9ff 0%, #8fd2ff 55%, #cfeffb 100%)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        fontFamily: "'M PLUS Rounded 1c', 'Nunito', system-ui, sans-serif",
      }}>
        {/* 上部キャプション */}
        {scene.caption && (
          <div key={`cap-${key}`} style={{
            position: "absolute", top: "7%", left: "6%", right: "6%", zIndex: 20, textAlign: "center",
            animation: "pp-capin 0.45s cubic-bezier(0.2,1.2,0.4,1) both",
          }}>
            <span style={{
              display: "inline-block", padding: "10px 18px", borderRadius: 16,
              background: "rgba(15,23,42,0.86)", color: "#fff", fontWeight: 900,
              fontSize: "clamp(20px, 5.2vh, 34px)", lineHeight: 1.25,
              boxShadow: "0 8px 24px rgba(0,0,0,0.35)", border: "2px solid rgba(255,255,255,0.18)",
            }}>{scene.caption}</span>
          </div>
        )}

        {/* シーン本体 */}
        <div key={key} style={{ position: "absolute", inset: 0 }}>
          {scene.id === "hook" && <MiniWorld title="ようこそ！🎉" />}
          {scene.id === "build" && <BuildBeat />}
          {scene.id === "done" && <DoneBeat />}
          {scene.id === "run" && <MiniWorld title="✨ 効果はつどう！" />}
          {scene.id === "logo" && <LogoBeat />}
        </div>

        {/* 進捗バー */}
        <div style={{ position: "absolute", bottom: 0, left: 0, height: 5, width: `${(t / TOTAL) * 100}%`, background: "rgba(255,255,255,0.85)", zIndex: 30 }} />
      </div>

      {/* レターボックス側の操作（録画には入らない） */}
      <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, display: "flex", gap: 14, alignItems: "center" }}>
        <span>● 録画用：上のタテ枠だけを画面録画してね（約16秒でループ）</span>
        <button onClick={() => { setLoop(l => l + 1); setT(0); }}
          style={{ background: "#1e293b", color: "#fff", border: "1px solid #334155", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontWeight: 800 }}>
          ⟳ もう一回
        </button>
      </div>
    </div>
  );
}

/* ───────── ミニ・マイクラ世界（フック／実行カット共用） ───────── */
function MiniWorld({ title }: { title: string }) {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {/* 太陽 */}
      <div style={{ position: "absolute", top: "9%", right: "12%", width: 74, height: 74, borderRadius: "50%", background: "radial-gradient(circle,#fff6c2,#ffd24a)", boxShadow: "0 0 60px #ffd24aaa", animation: "pp-sun 3s ease-in-out infinite" }} />
      {/* 雲 */}
      <div style={{ position: "absolute", top: "16%", left: "-30%", width: 120, height: 36, borderRadius: 30, background: "rgba(255,255,255,0.9)", animation: "pp-cloud 9s linear infinite" }} />
      {/* 地面（草ブロック風） */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "28%", background: "linear-gradient(#7ec850, #5fa83e)", borderTop: "8px solid #4f9134", boxShadow: "inset 0 4px 0 rgba(255,255,255,0.18)" }} />
      {/* キャラ */}
      <div style={{ position: "absolute", left: "50%", bottom: "26%", transform: "translateX(-50%)", animation: "pp-bob 1.6s ease-in-out infinite" }}>
        <Steve />
      </div>
      {/* タイトルポップ */}
      <div style={{ position: "absolute", top: "34%", left: 0, right: 0, textAlign: "center", zIndex: 5 }}>
        <span style={{ display: "inline-block", fontWeight: 900, fontSize: "clamp(26px,6.4vh,44px)", color: "#fff", textShadow: "0 4px 0 #000, 0 0 22px rgba(255,255,255,0.6)", animation: "pp-title 0.55s cubic-bezier(0.2,1.5,0.35,1) both" }}>{title}</span>
      </div>
    </div>
  );
}

function Steve() {
  return (
    <div style={{ width: 56, height: 76, position: "relative" }}>
      <div style={{ position: "absolute", bottom: -8, left: "50%", transform: "translateX(-50%)", width: 44, height: 9, borderRadius: "50%", background: "rgba(0,0,0,0.25)", filter: "blur(2px)" }} />
      {/* 頭 */}
      <div style={{ position: "absolute", top: 0, left: 8, width: 40, height: 34, borderRadius: 5, background: "linear-gradient(#caa074,#b3895f)", border: "3px solid #6f5436", boxSizing: "border-box" }}>
        <div style={{ position: "absolute", top: 13, left: 8, width: 6, height: 7, background: "#2a1d10", borderRadius: 1 }} />
        <div style={{ position: "absolute", top: 13, right: 8, width: 6, height: 7, background: "#2a1d10", borderRadius: 1 }} />
      </div>
      {/* 体 */}
      <div style={{ position: "absolute", top: 32, left: 12, width: 32, height: 36, borderRadius: 4, background: "linear-gradient(#2bb6a8,#1d8f84)", border: "3px solid #145e57", boxSizing: "border-box" }} />
    </div>
  );
}

/* ───────── ビルド演出：キー押下→カードが落ちて重なる ───────── */
function BuildBeat() {
  const cards = [
    { emoji: "⚡", label: "きっかけ", color: "#facc15", delay: 0.2 },
    { emoji: "✨", label: "すること", color: "#38bdf8", delay: 1.6 },
    { emoji: "🔀", label: "もしも",   color: "#a855f7", delay: 3.0 },
  ];
  const keys = ["⚡きっかけ", "✨すること", "🔀もしも", "🔁くりかえし"];
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* 落ちて重なるカード（中央やや上） */}
      <div style={{ position: "absolute", bottom: "28%", left: "50%", transform: "translateX(-50%)", width: 150, height: 300 }}>
        {cards.map((c, i) => (
          <div key={c.label} style={{
            position: "absolute", left: 0, right: 0, bottom: i * 58, margin: "0 auto", width: 130, height: 168,
            animation: `pp-drop 0.7s cubic-bezier(0.2,1.25,0.4,1) ${c.delay}s both`,
          }}>
            <PromoCard emoji={c.emoji} label={c.label} color={c.color} />
          </div>
        ))}
      </div>

      {/* 下部キーボード（押下演出） */}
      <div style={{ position: "absolute", bottom: "6%", left: "5%", right: "5%", display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", animation: "pp-slidein 0.5s ease both" }}>
        {keys.map((k, i) => (
          <span key={k} style={{
            padding: "10px 14px", borderRadius: 11, border: "3px solid #1e293b", background: "linear-gradient(135deg,#fff,#e9eef3)",
            boxShadow: "0 4px 0 #cbd5e1", fontWeight: 900, fontSize: 17, color: "#334155", whiteSpace: "nowrap",
            animation: `pp-keypress 0.5s ease ${0.4 + i * 1.4}s`,
          }}>{k}</span>
        ))}
      </div>
    </div>
  );
}

function PromoCard({ emoji, label, color }: { emoji: string; label: string; color: string }) {
  return (
    <div style={{
      width: "100%", height: "100%", borderRadius: 16, background: "#fff", border: "4px solid #1e293b",
      boxShadow: `0 8px 0 ${color}66, 0 10px 22px rgba(0,0,0,0.18)`,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
    }}>
      <div style={{ width: 64, height: 64, borderRadius: 16, background: color, border: "3px solid #1e293b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34 }}>{emoji}</div>
      <span style={{ fontWeight: 900, fontSize: 19, color: "#1e293b" }}>{label}</span>
    </div>
  );
}

/* ───────── 完成演出：緑のボタン＋紙吹雪 ───────── */
function DoneBeat() {
  const conf = Array.from({ length: 26 });
  const colors = ["#facc15", "#38bdf8", "#a855f7", "#22c55e", "#fb7185", "#fb923c"];
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {conf.map((_, i) => {
        const left = (i * 37) % 100;
        const col = colors[i % colors.length];
        const delay = (i % 8) * 0.06;
        const size = 8 + (i % 4) * 3;
        return (
          <div key={i} style={{
            position: "absolute", top: "-6%", left: `${left}%`, width: size, height: size * 1.4, background: col,
            borderRadius: 2, animation: `pp-confetti ${1.4 + (i % 5) * 0.12}s linear ${delay}s infinite`,
          }} />
        );
      })}
      <div style={{ position: "absolute", top: "44%", left: "50%", transform: "translate(-50%,-50%)", animation: "pp-pop 0.55s cubic-bezier(0.2,1.5,0.35,1) both" }}>
        <div style={{
          padding: "22px 34px", borderRadius: 20, border: "4px solid #1e293b",
          background: "linear-gradient(135deg,#bef264 0%,#4ade80 55%,#22c55e 100%)",
          boxShadow: "0 8px 0 #15803d, 0 10px 26px rgba(34,197,94,0.5)",
          color: "#052e16", fontWeight: 900, fontSize: "clamp(24px,5.6vh,38px)", whiteSpace: "nowrap",
        }}>アドオン完成！🎉</div>
      </div>
    </div>
  );
}

/* ───────── ロゴ＋CTA ───────── */
function LogoBeat() {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, background: "linear-gradient(160deg,#0b1220,#13243b)" }}>
      <div style={{ animation: "pp-popc 0.6s cubic-bezier(0.2,1.4,0.35,1) both", textAlign: "center", width: "100%", padding: "0 18px", boxSizing: "border-box" }}>
        <div style={{ fontWeight: 900, fontSize: "clamp(24px,6vh,42px)", letterSpacing: "0.01em", color: "#fff", textShadow: "0 0 28px rgba(120,200,255,0.6)", whiteSpace: "nowrap" }}>CUBICENGINE</div>
        <div style={{ marginTop: 8, fontWeight: 800, fontSize: "clamp(14px,3vh,20px)", color: "#9fe0ff" }}>マイクラのアドオンを、コードなしで。</div>
      </div>
      <div style={{ animation: "pp-capin 0.5s ease 0.3s both", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <span style={{ padding: "10px 20px", borderRadius: 999, background: "#22c55e", color: "#052e16", fontWeight: 900, fontSize: "clamp(16px,3.4vh,22px)", boxShadow: "0 6px 18px rgba(34,197,94,0.5)" }}>無料・ブラウザで今すぐ</span>
        <span style={{ color: "#cbd5e1", fontWeight: 800, fontSize: "clamp(14px,2.8vh,18px)" }}>cubicengine.vercel.app</span>
      </div>
    </div>
  );
}

const KEYFRAMES = `
  @keyframes pp-capin { 0% { transform: translateY(-14px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
  @keyframes pp-title { 0% { transform: scale(0.5); opacity: 0; } 70% { transform: scale(1.12); } 100% { transform: scale(1); opacity: 1; } }
  @keyframes pp-pop { 0% { transform: translate(-50%,-50%) scale(0.4); opacity: 0; } 70% { transform: translate(-50%,-50%) scale(1.08); } 100% { transform: translate(-50%,-50%) scale(1); opacity: 1; } }
  @keyframes pp-popc { 0% { transform: scale(0.4); opacity: 0; } 70% { transform: scale(1.08); } 100% { transform: scale(1); opacity: 1; } }
  @keyframes pp-drop { 0% { transform: translateY(-220%) rotate(-8deg); opacity: 0; } 60% { opacity: 1; } 80% { transform: translateY(6%) rotate(1deg); } 100% { transform: translateY(0) rotate(0); opacity: 1; } }
  @keyframes pp-keypress { 0%,100% { transform: translateY(0); } 40% { transform: translateY(4px); box-shadow: 0 1px 0 #cbd5e1; } }
  @keyframes pp-slidein { 0% { transform: translateY(40px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
  @keyframes pp-confetti { 0% { transform: translateY(0) rotate(0deg); } 100% { transform: translateY(1200%) rotate(540deg); } }
  @keyframes pp-bob { 0%,100% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(-50%) translateY(-6px); } }
  @keyframes pp-sun { 0%,100% { box-shadow: 0 0 50px #ffd24a88; } 50% { box-shadow: 0 0 80px #ffd24acc; } }
  @keyframes pp-cloud { 0% { transform: translateX(0); } 100% { transform: translateX(360px); } }
`;
