"use client";

/* ══════════════════════════════════════════════════════════
   /guide-movie — チュートリアル＆トップ誘導用 録画ステージ (横 16:9)
   
   ブラウザで開いて横長の 16:9 ステージ全体を画面録画するための専用ページ。
   ループ間隔は 48 秒。以下の 4 要点をストーリーとしてアニメーション表現：
     1. アドオンとは：コード不要でマイクラにルールを追加し .mcaddon を生む魔法
     2. きっかけを置く：「〜したとき」を選択
     3. することを重ねる：★最重要点！カードは繋げないと動かない
     4. 完成→マイクラへ導入
   ※ アナログ/工房系の明るいトランプ＆TCG世界観。暗い背景や蛍光色排除。
   ※ Mojang規約＆「第三者送信ゼロ」規約対応の独自キャラ Builder() 搭載。
   ══════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";

type Scene = { id: string; start: number; caption: string };
const SCENES: Scene[] = [
  { id: "intro",   start: 0,     caption: "コードを1行も書かずに、マイクラをパワーアップ！" },
  { id: "step1",   start: 9000,  caption: "ステップ１：黄色の『きっかけ』カードを選ぼう" },
  { id: "step2",   start: 18000, caption: "ステップ２：青い『すること』を、上に重ねて繋ごう！" },
  { id: "step3",   start: 32000, caption: "完成ボタンを押せば、魔法のファイルができあがり！🎉" },
  { id: "logo",    start: 41000, caption: "さあ、君だけの特別なマイクラの世界へ！" },
];
const TOTAL = 48000;

export default function GuideMoviePage() {
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
      position: "fixed", inset: 0, background: "#1e293b",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
      fontFamily: '"Inter", "Hiragino Sans", "Meiryo", system-ui, sans-serif'
    }}>
      <style>{KEYFRAMES}</style>

      {/* ─── 16:9 横長ステージ（画面録画ターゲット） ─── */}
      <div style={{
        position: "relative", width: "94vw", maxWidth: 1280, aspectRatio: "16 / 9", maxHeight: "86dvh",
        overflow: "hidden", borderRadius: 20,
        background: "linear-gradient(135deg, #e0f2fe 0%, #fefce8 60%, #fef9c3 100%)",
        border: "6px solid #b45309",
        boxShadow: "0 25px 70px rgba(0, 0, 0, 0.4)"
      }}>
        {/* 上部字幕キャプションバナー */}
        <div key={`cap-${key}`} style={{
          position: "absolute", top: "5%", left: "5%", right: "5%", zIndex: 30, textAlign: "center",
          animation: "gm-capin 0.5s cubic-bezier(0.2, 1.2, 0.4, 1) both",
          pointerEvents: "none"
        }}>
          <span style={{
            display: "inline-block", padding: "12px 30px", borderRadius: 9999,
            background: "#451a03", color: "#fef08a", fontWeight: 900,
            fontSize: "clamp(20px, 3.2vw, 32px)", letterSpacing: "0.04em",
            boxShadow: "0 8px 24px rgba(69, 26, 3, 0.35)", border: "3px solid #f59e0b",
          }}>
            {scene.caption}
          </span>
        </div>

        {/* ── シーン切り替えコンバータ ── */}
        <div key={key} style={{ position: "absolute", inset: 0 }}>
          {scene.id === "intro" && <SceneIntro />}
          {scene.id === "step1" && <SceneStep1 />}
          {scene.id === "step2" && <SceneStep2 />}
          {scene.id === "step3" && <SceneStep3 />}
          {scene.id === "logo" && <SceneLogo />}
        </div>

        {/* プログレス・タイムバー */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, height: 8,
          width: `${(t / TOTAL) * 100}%`, background: "linear-gradient(90deg, #f59e0b, #10b981)",
          zIndex: 40, transition: "width 0.1s linear"
        }} />
      </div>

      {/* ─── 外周レターボックス・録画制御バー (動画には映らない領域) ─── */}
      <div style={{ color: "#cbd5e1", fontSize: 13.5, fontWeight: 800, display: "flex", gap: 20, alignItems: "center" }}>
        <span>🎥 動画録画専用：中央の木製風枠（16:9）内部を録画してください（ 48 秒ループ）</span>
        <span style={{ background: "#0f172a", padding: "4px 10px", borderRadius: 8, fontFamily: "monospace" }}>
          経過: {(t / 1000).toFixed(1)}s / 48.0s
        </span>
        <button
          onClick={() => { setLoop(l => l + 1); setT(0); }}
          style={{ background: "#d97706", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontWeight: 900, fontSize: 13 }}
        >
          ⟳ 最初から再生する
        </button>
      </div>
    </div>
  );
}

/* ───────── シーン0：導入（アドオンの言い換えと紹介） ───────── */
function SceneIntro() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <SkyAndGrass />
      <div style={{ display: "flex", alignItems: "center", gap: 60, zIndex: 10, marginTop: 20 }}>
        {/* 左キャラクター */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", animation: "gm-bob 2s ease-in-out infinite" }}>
          <Builder size={1.6} />
          <span style={{ marginTop: 16, fontSize: 20, fontWeight: 900, color: "#047857", background: "#ffffff", padding: "6px 16px", borderRadius: 9999, border: "3px solid #10b981", boxShadow: "0 4px 10px rgba(0,0,0,0.1)" }}>
            君だけの魔法を作ろう！
          </span>
        </div>

        {/* 右アドオンファイル箱 */}
        <div style={{
          background: "#ffffff", border: "5px solid #d97706", borderRadius: 28, padding: "28px 40px",
          boxShadow: "0 16px 40px rgba(217, 119, 6, 0.25)", display: "flex", flexDirection: "column", gap: 14,
          animation: "gm-pop 0.6s cubic-bezier(0.2, 1.4, 0.4, 1) both", minWidth: 420
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 44 }}>🎁</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#b45309" }}>マイクラ パワーアップパック</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: "#78350f" }}>『アドオン』を作る道具！</div>
            </div>
          </div>
          <div style={{ height: 3, background: "#fef08a", width: "100%" }} />
          <p style={{ fontSize: 18, color: "#334155", fontWeight: 800, margin: 0, lineHeight: 1.6 }}>
            作ったカードが <span style={{ background: "#fef08a", padding: "3px 8px", borderRadius: 8, color: "#78350f" }}>.mcaddon</span> という拡張ファイルに変身。
            いつものゲームに読み込むだけで本当に動き出すよ！
          </p>
        </div>
      </div>
    </div>
  );
}

/* ───────── シーン1：きっかけを置く ───────── */
function SceneStep1() {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <SkyAndGrass />
      <div style={{ display: "flex", alignItems: "center", gap: 80, zIndex: 10, width: "80%", justifyContent: "space-between", marginTop: 20 }}>
        {/* 左手：選んだきっかけカードが空からポンッ！ */}
        <div style={{ width: 340, height: 260, animation: "gm-drop 0.7s cubic-bezier(0.2, 1.25, 0.4, 1) 0.3s both" }}>
          <TCGCard emoji="⚡" cat="きっかけ（イベント）" title="ブロックを叩いたとき" desc="「何かを壊した瞬間」を発知する一番最初のスタートカードだ！" color="#facc15" border="#d97706" text="#451a03" />
        </div>

        {/* 右手：キーボード選出の説明 */}
        <div style={{ background: "#fffbeb", border: "4px solid #f59e0b", borderRadius: 24, padding: "28px 36px", flex: 1, boxShadow: "0 12px 30px rgba(0,0,0,0.12)" }}>
          <h3 style={{ fontSize: 26, fontWeight: 900, color: "#854d0e", margin: "0 0 12px 0" }}>
            👉 最初のルールを決めよう！
          </h3>
          <p style={{ fontSize: 18, fontWeight: 800, color: "#451a03", lineHeight: 1.6, margin: "0 0 20px 0" }}>
            「何が起こったら」プログラムが始まるか？
            <br />
            まずは画面の下の黄色の <b>『きっかけ』</b> キーを選んで、キャンバスにスタートの種を植えよう！
          </p>
          <div style={{ display: "flex", gap: 12 }}>
            <span style={{ padding: "12px 20px", borderRadius: 12, background: "#fef08a", border: "3px solid #d97706", fontWeight: 900, fontSize: 18, color: "#451a03", animation: "gm-keypress 0.5s ease 0.6s" }}>
              ⚡ きっかけ
            </span>
            <span style={{ padding: "12px 20px", borderRadius: 12, background: "#ffffff", border: "2px solid #cbd5e1", fontWeight: 800, fontSize: 18, color: "#64748b" }}>
              ✨ すること
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────── シーン2：繋ぐと動く（※最大の重要ポイント演出） ───────── */
function SceneStep2() {
  const [phase, setPhase] = useState<"disconnected" | "connected">("disconnected");

  useEffect(() => {
    const timer = setTimeout(() => setPhase("connected"), 6500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <SkyAndGrass />
      <div style={{ display: "flex", width: "86%", gap: 60, alignItems: "center", zIndex: 10, marginTop: 20 }}>

        {/* 左手：カード合体実演エリア */}
        <div style={{ width: 440, height: 380, position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          {phase === "disconnected" ? (
            /* 離れて置いた状態（動かない） */
            <div style={{ display: "flex", flexDirection: "column", gap: 24, alignItems: "center", width: "100%" }}>
              <div style={{ width: "90%", height: 130 }}>
                <TCGCard emoji="⚡" cat="きっかけ" title="叩いたとき" desc="ブロックが壊れた！" color="#facc15" border="#d97706" text="#451a03" />
              </div>
              <div style={{ background: "#fee2e2", border: "3px solid #ef4444", borderRadius: 12, padding: "8px 16px", color: "#991b1b", fontWeight: 900, fontSize: 18, animation: "gm-pulse 1s infinite" }}>
                ❌ スキマがあいて離れてる…（動きません）
              </div>
              <div style={{ width: "90%", height: 130, transform: "rotate(4deg)" }}>
                <TCGCard emoji="✨" cat="すること" title="ダイヤをあげる" desc="お宝プレゼント！" color="#38bdf8" border="#0284c7" text="#0369a1" />
              </div>
            </div>
          ) : (
            /* 重なってピッタリ合体した状態！ */
            <div style={{ display: "flex", flexDirection: "column", gap: 0, alignItems: "center", width: "100%", animation: "gm-snap 0.5s cubic-bezier(0.2, 1.5, 0.4, 1) both" }}>
              <div style={{ width: "95%", height: 140, zIndex: 2 }}>
                <TCGCard emoji="⚡" cat="きっかけ" title="叩いたとき" desc="ブロックが壊れた！" color="#facc15" border="#d97706" text="#451a03" />
              </div>
              <div style={{ margin: "-12px 0", zIndex: 5, background: "#10b981", color: "#ffffff", fontWeight: 900, fontSize: 20, padding: "6px 22px", borderRadius: 9999, border: "3px solid #047857", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
                🔗 ぴたっ！と繋がって合体成功！！
              </div>
              <div style={{ width: "95%", height: 140, zIndex: 1, marginTop: -6 }}>
                <TCGCard emoji="✨" cat="すること" title="ダイヤをあげる" desc="お宝プレゼント！" color="#38bdf8" border="#0284c7" text="#0369a1" />
              </div>
            </div>
          )}
        </div>

        {/* 右手：注意解説ボックス */}
        <div style={{ flex: 1, background: phase === "disconnected" ? "#fef2f2" : "#ecfdf5", border: `5px solid ${phase === "disconnected" ? "#ef4444" : "#10b981"}`, borderRadius: 28, padding: "32px 38px", boxShadow: "0 14px 35px rgba(0,0,0,0.15)", transition: "all 0.4s" }}>
          {phase === "disconnected" ? (
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#991b1b", display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <span>⚠️</span> <span>一番大事な注意！！</span>
              </div>
              <p style={{ fontSize: 21, fontWeight: 900, color: "#7f1d1d", margin: "0 0 16px 0", lineHeight: 1.6 }}>
                カードをキャンバスに <b>バラバラで置いただけ</b> では、何も起きません！
              </p>
              <p style={{ fontSize: 17, fontWeight: 800, color: "#991b1b", margin: 0, lineHeight: 1.5 }}>
                マイクラに伝えるには、カード同士を結びつける必要があります。青のカードを掴んで、<b>『きっかけ』の上へと乗せてみよう…！</b>
              </p>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#065f46", display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <span>🌟</span> <span>これがプログラミングだ！</span>
              </div>
              <p style={{ fontSize: 22, fontWeight: 900, color: "#047857", margin: "0 0 16px 0", lineHeight: 1.6 }}>
                <b>上に重ねて、ピタッ！と接続完了！</b>
                <br />これで初めて魔法が連動して動くようになります！
              </p>
              <p style={{ fontSize: 17, fontWeight: 800, color: "#065f46", margin: 0, lineHeight: 1.5 }}>
                好きなアクションを上から順番にいくつでもドッキングさせて、無敵のオリジナルアドオンを作ろう！
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

/* ───────── シーン3：完成と.mcaddon誕生 ───────── */
function SceneStep3() {
  const conf = Array.from({ length: 30 });
  const colors = ["#facc15", "#38bdf8", "#a855f7", "#22c55e", "#fb7185", "#fb923c"];
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <SkyAndGrass />
      {/* 紙吹雪シャワー */}
      {conf.map((_, i) => {
        const left = (i * 33) % 100;
        const col = colors[i % colors.length];
        const delay = (i % 6) * 0.1;
        const size = 10 + (i % 5) * 3;
        return (
          <div key={i} style={{
            position: "absolute", top: "-10%", left: `${left}%`, width: size, height: size * 1.5, background: col,
            borderRadius: 4, animation: `gm-confetti ${1.8 + (i % 4) * 0.2}s linear ${delay}s infinite`, zIndex: 15
          }} />
        );
      })}

      <div style={{ zIndex: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 30, marginTop: 20 }}>
        <div style={{
          padding: "24px 56px", borderRadius: 24, border: "6px solid #052e16",
          background: "linear-gradient(135deg, #4ade80 0%, #22c55e 55%, #15803d 100%)",
          boxShadow: "0 16px 0 #064e3b, 0 20px 40px rgba(34, 197, 94, 0.4)",
          color: "#ffffff", fontWeight: 900, fontSize: "clamp(28px, 4vw, 48px)",
          animation: "gm-pop 0.6s cubic-bezier(0.2, 1.5, 0.35, 1) both"
        }}>
          アドオン完成！🎉 （ビルド＆ダウンロード）
        </div>

        <div style={{
          background: "#ffffff", border: "4px solid #f59e0b", borderRadius: 20, padding: "18px 36px",
          display: "flex", alignItems: "center", gap: 20, boxShadow: "0 8px 25px rgba(0,0,0,0.12)"
        }}>
          <span style={{ fontSize: 36 }}>🕹️</span>
          <span style={{ fontSize: 20, fontWeight: 900, color: "#451a03" }}>
            手に入れた <span style={{ background: "#fef08a", padding: "4px 10px", borderRadius: 8 }}>my_addon.mcaddon</span> をダブルクリックしてマイクラの世界へ挑もう！
          </span>
        </div>
      </div>
    </div>
  );
}

/* ───────── シーン4：ロゴとCTA ───────── */
function SceneLogo() {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, background: "linear-gradient(145deg, #ffffff 0%, #fefce8 60%, #fef08a 100%)" }}>
      <div style={{ animation: "gm-pop 0.6s cubic-bezier(0.2, 1.4, 0.35, 1) both", textAlign: "center" }}>
        <div style={{ fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 900, color: "#78350f", letterSpacing: "0.02em", textShadow: "0 4px 10px rgba(217, 119, 6, 0.2)" }}>
          🃏 CUBIC ENGINE
        </div>
        <div style={{ marginTop: 12, fontSize: "clamp(18px, 2.5vw, 26px)", fontWeight: 800, color: "#b45309" }}>
          〜 楽しくつなげる、本格マイクラ・アドオン制作図鑑 〜
        </div>
      </div>

      <div style={{ display: "flex", gap: 20, alignItems: "center", marginTop: 16 }}>
        <div style={{ padding: "14px 32px", borderRadius: 9999, background: "#22c55e", color: "#ffffff", fontWeight: 900, fontSize: 24, border: "4px solid #065f46", boxShadow: "0 8px 24px rgba(34, 197, 94, 0.4)" }}>
          無料・ブラウザですぐ遊ぼう！
        </div>
      </div>
    </div>
  );
}

/** TCG調カードコンポーネント */
function TCGCard({ emoji, cat, title, desc, color, border, text }: { emoji: string; cat: string; title: string; desc: string; color: string; border: string; text: string }) {
  return (
    <div style={{
      width: "100%", height: "100%", background: "#ffffff", borderRadius: 20, border: `4px solid ${border}`,
      boxShadow: `0 8px 20px rgba(0, 0, 0, 0.12)`, padding: "14px 18px", boxSizing: "border-box",
      display: "flex", flexDirection: "column", justifyContent: "space-between"
    }}>
      <div>
        <div style={{ background: color, padding: "4px 10px", borderRadius: 8, fontSize: 12.5, fontWeight: 900, color: text, display: "inline-block", marginBottom: 8 }}>
          ★ {cat}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 36, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))" }}>{emoji}</span>
          <span style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>{title}</span>
        </div>
      </div>
      <div style={{ background: "#fefce8", border: "1px solid #fef08a", borderRadius: 10, padding: "8px 12px" }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#334155" }}>「{desc}」</span>
      </div>
    </div>
  );
}

/** 空と太陽、あたたかな草原テーブル背景 */
function SkyAndGrass() {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {/* 太陽 */}
      <div style={{ position: "absolute", top: "12%", right: "10%", width: 90, height: 90, borderRadius: "50%", background: "radial-gradient(circle, #fffbeb, #fbbf24)", boxShadow: "0 0 60px rgba(251, 191, 36, 0.6)", animation: "gm-sun 3s ease-in-out infinite" }} />
      {/* 地面 */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "24%", background: "linear-gradient(#86efac, #22c55e)", borderTop: "8px solid #16a34a" }} />
    </div>
  );
}

/** 安全でかわいいブランドキャラクター */
function Builder({ size = 1 }: { size?: number }) {
  return (
    <div style={{ width: 56 * size, height: 76 * size, position: "relative", flexShrink: 0, transform: `scale(${size})`, transformOrigin: "center top" }}>
      <div style={{ position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)", width: 42, height: 8, borderRadius: "50%", background: "rgba(0,0,0,0.2)" }} />
      <div style={{ position: "absolute", top: 0, left: 8, width: 40, height: 34, borderRadius: 9, background: "linear-gradient(#fcd9a0,#f0b970)", border: "3px solid #b07a3a", boxSizing: "border-box" }}>
        <div style={{ position: "absolute", top: 13, left: 8, width: 6, height: 7, background: "#3b2a14", borderRadius: 2 }} />
        <div style={{ position: "absolute", top: 13, right: 8, width: 6, height: 7, background: "#3b2a14", borderRadius: 2 }} />
      </div>
      <div style={{ position: "absolute", top: 32, left: 12, width: 32, height: 36, borderRadius: 8, background: "linear-gradient(#34d399,#10b981)", border: "3px solid #065f46", boxSizing: "border-box" }} />
    </div>
  );
}

const KEYFRAMES = `
  @keyframes gm-capin { 0% { transform: translateY(-20px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
  @keyframes gm-pop { 0% { transform: scale(0.6); opacity: 0; } 70% { transform: scale(1.06); } 100% { transform: scale(1); opacity: 1; } }
  @keyframes gm-drop { 0% { transform: translateY(-160%) rotate(-6deg); opacity: 0; } 80% { transform: translateY(5%) rotate(1deg); } 100% { transform: translateY(0) rotate(0); opacity: 1; } }
  @keyframes gm-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
  @keyframes gm-sun { 0%, 100% { box-shadow: 0 0 50px rgba(251, 191, 36, 0.5); } 50% { box-shadow: 0 0 80px rgba(251, 191, 36, 0.8); } }
  @keyframes gm-confetti { 0% { transform: translateY(0) rotate(0deg); } 100% { transform: translateY(1100%) rotate(540deg); } }
  @keyframes gm-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.03); } }
  @keyframes gm-snap { 0% { transform: scale(0.95); } 50% { transform: scale(1.04); } 100% { transform: scale(1); } }
  @keyframes gm-keypress { 0%, 100% { transform: translateY(0); } 40% { transform: translateY(4px); } }
`;
