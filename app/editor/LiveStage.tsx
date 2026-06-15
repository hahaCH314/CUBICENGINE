"use client";

/* ══════════════════════════════════════════════════════════
   LiveStage — 案A「中央＝即時プレビューの小世界」第一弾
   組んだロジック（trigger→nextId 連鎖）を、その場で
   ちびキャラが"上演"する。組んだ瞬間に作ったものが生きて動く。
   ※ プロトタイプ：積み木UIは消さず、横に置く結果ステージ。
   ══════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import { CBlock } from "./_types";

/* 一手＝1ビート */
type Beat = {
  id: string;
  type: string;
  label: string;
  category: string;
  fields: Record<string, string>;
  depth: number;
};

function fieldMap(b: CBlock): Record<string, string> {
  const m: Record<string, string> = {};
  b.fields.forEach(f => (m[f.id] = f.value));
  return m;
}

/** trigger を起点に nextId / thenId をたどって、上演順のビート列を作る */
function buildSequence(blocks: CBlock[]): Beat[] {
  if (!blocks.length) return [];
  const childIds = new Set<string>();
  blocks.forEach(b =>
    [b.nextId, b.thenId, b.elseId, b.innerId].forEach(c => c && childIds.add(c))
  );
  const root =
    blocks.find(b => b.category === "trigger" && !childIds.has(b.id)) ??
    blocks.find(b => b.category === "trigger") ??
    blocks.find(b => !childIds.has(b.id));
  if (!root) return [];

  const byId = (id: string | null) => (id ? blocks.find(b => b.id === id) ?? null : null);
  const acc: Beat[] = [];
  const seen = new Set<string>();

  function walk(startId: string | null, depth: number) {
    let cur = byId(startId);
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      acc.push({ id: cur.id, type: cur.type, label: cur.label, category: cur.category, fields: fieldMap(cur), depth });
      if (cur.thenId) walk(cur.thenId, depth + 1);
      cur = byId(cur.nextId);
    }
  }
  walk(root.id, 0);
  return acc;
}

/* ビートの長さ（ms）。待機ブロックだけ秒数を反映 */
function beatDuration(b: Beat): number {
  if (b.type === "ct_wait") {
    const s = parseFloat(b.fields.s || "1");
    return Math.min(2400, Math.max(700, (isNaN(s) ? 1 : s) * 700));
  }
  return 1050;
}

/* カテゴリ→ステータス用の絵文字 */
const CAT_EMOJI: Record<string, string> = {
  trigger: "⚡", action: "✨", ifelse: "🔀", value: "🔢",
  loop: "🔁", calc: "➗", ui: "🖼️", variable: "📦",
};

/* ───────── ちびキャラ（CSSスティーブ風） ───────── */
function Hero({ asleep, x, hop }: { asleep: boolean; x: number; hop: boolean }) {
  return (
    <div style={{
      position: "absolute", left: "50%", bottom: 30,
      transform: `translateX(calc(-50% + ${x}px))`,
      transition: "transform 0.35s cubic-bezier(0.2,0.8,0.2,1)",
      zIndex: 4,
    }}>
      <div style={{
        width: 38, height: 50, position: "relative",
        animation: asleep ? "ls-sleep 3s ease-in-out infinite" : hop ? "ls-hop 0.5s ease" : "ls-bob 2.2s ease-in-out infinite",
        transformOrigin: "bottom center",
      }}>
        {/* 影 */}
        <div style={{ position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)", width: 30, height: 7, borderRadius: "50%", background: "rgba(0,0,0,0.28)", filter: "blur(1px)" }} />
        {/* 頭 */}
        <div style={{ position: "absolute", top: 0, left: 5, width: 28, height: 24, borderRadius: 4, background: "linear-gradient(#caa074,#b3895f)", border: "2px solid #6f5436", boxSizing: "border-box" }}>
          {/* 目 */}
          <div style={{ position: "absolute", top: 9, left: 5, width: 4, height: asleep ? 1.5 : 5, borderRadius: 1, background: "#2a1d10" }} />
          <div style={{ position: "absolute", top: 9, right: 5, width: 4, height: asleep ? 1.5 : 5, borderRadius: 1, background: "#2a1d10" }} />
        </div>
        {/* 体 */}
        <div style={{ position: "absolute", top: 22, left: 7, width: 24, height: 24, borderRadius: 3, background: "linear-gradient(#2bb6a8,#1d8f84)", border: "2px solid #145e57", boxSizing: "border-box" }} />
      </div>
    </div>
  );
}

/* ───────── 各ビートの演出レイヤー ───────── */
function Fx({ beat }: { beat: Beat }) {
  const f = beat.fields;
  const t = beat.type;

  // セリフ吹き出し（メッセージ送信／チャット）
  if (t === "ac_msg" || t === "ev_chat") {
    const text = t === "ac_msg" ? (f.msg || "…") : (f.pat || "…");
    const to = t === "ac_msg" && f.target ? `→ ${f.target}` : "";
    return (
      <div key={beat.id} style={bubbleWrap}>
        <div style={bubble}>
          <span style={{ fontWeight: 900 }}>{text}</span>
          {to && <span style={{ marginLeft: 6, fontSize: 9, color: "#7a8aa0" }}>{to}</span>}
          <span style={bubbleTail} />
        </div>
      </div>
    );
  }
  // タイトル表示
  if (t === "ac_title") {
    return (
      <div key={beat.id} style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 6, pointerEvents: "none" }}>
        <div style={{ fontSize: 26, fontWeight: 900, color: "#fff", textShadow: "0 2px 0 #000, 0 0 12px rgba(255,255,255,0.6)", animation: "ls-title 0.5s cubic-bezier(0.2,1.4,0.4,1)" }}>{f.title || "タイトル"}</div>
        {f.sub && <div style={{ fontSize: 12, fontWeight: 800, color: "#ffe08a", marginTop: 4, textShadow: "0 1px 2px #000", animation: "ls-title 0.6s ease" }}>{f.sub}</div>}
      </div>
    );
  }
  // アイテム付与
  if (t === "ac_give") {
    return (
      <div key={beat.id} style={chipWrap}>
        <div style={{ ...chip, animation: "ls-drop 0.6s cubic-bezier(0.2,1.3,0.4,1)" }}>
          📦 <b>{shortId(f.item)}</b>{f.count && f.count !== "1" ? ` ×${f.count}` : ""}
        </div>
      </div>
    );
  }
  // サウンド
  if (t === "ac_sound") {
    return (
      <div key={beat.id} style={{ position: "absolute", left: "50%", bottom: 52, transform: "translateX(-50%)", zIndex: 5, pointerEvents: "none" }}>
        <span style={{ fontSize: 18, animation: "ls-pop 0.5s ease" }}>🔊</span>
        <span style={ring} /><span style={{ ...ring, animationDelay: "0.18s" }} />
      </div>
    );
  }
  // エフェクト付与
  if (t === "ac_effect") {
    return (
      <div key={beat.id} style={{ position: "absolute", left: "50%", bottom: 40, transform: "translateX(-50%)", zIndex: 6, pointerEvents: "none", animation: "ls-pop 0.5s ease" }}>
        <span style={{ fontSize: 22 }}>✨</span>
      </div>
    );
  }
  // テレポート（演出はキャラ移動側。ここはフラッシュ）
  if (t === "ac_tp") {
    return <div key={beat.id} style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 70%, rgba(150,120,255,0.4), transparent 60%)", zIndex: 3, pointerEvents: "none", animation: "ls-flash 0.5s ease" }} />;
  }
  // 待機
  if (t === "ct_wait") {
    return <div key={beat.id} style={chipWrap}><div style={chip}>⏳ {f.s || "1"}秒…</div></div>;
  }
  // 条件・繰り返し・その他は思考/タグで表現
  if (beat.category === "ifelse") {
    return <div key={beat.id} style={chipWrap}><div style={{ ...chip, background: "#3a2f4d" }}>🤔 もし「{beat.label}」？</div></div>;
  }
  if (t === "ct_rep") {
    return <div key={beat.id} style={chipWrap}><div style={chip}>🔁 ×{f.n || "?"} くりかえし</div></div>;
  }
  // 汎用フォールバック（何のブロックでも"何か起きた"を見せる）
  return (
    <div key={beat.id} style={chipWrap}>
      <div style={chip}>{CAT_EMOJI[beat.category] || "•"} {beat.label}</div>
    </div>
  );
}

function shortId(v?: string) {
  if (!v) return "アイテム";
  return v.replace(/^minecraft:/, "");
}

/* ───────── スタイル定数 ───────── */
const bubbleWrap: React.CSSProperties = { position: "absolute", left: "50%", bottom: 78, transform: "translateX(-50%)", zIndex: 6, pointerEvents: "none" };
const bubble: React.CSSProperties = { position: "relative", maxWidth: 240, background: "#fff", color: "#1a2230", borderRadius: 12, padding: "7px 12px", fontSize: 12, boxShadow: "0 6px 16px rgba(0,0,0,0.3)", border: "2px solid #d8dee8", animation: "ls-pop 0.4s cubic-bezier(0.2,1.4,0.4,1)", whiteSpace: "nowrap" };
const bubbleTail: React.CSSProperties = { position: "absolute", bottom: -8, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "7px solid transparent", borderRight: "7px solid transparent", borderTop: "9px solid #fff" };
const chipWrap: React.CSSProperties = { position: "absolute", left: "50%", bottom: 80, transform: "translateX(-50%)", zIndex: 6, pointerEvents: "none" };
const chip: React.CSSProperties = { background: "#1f2937", color: "#fff", borderRadius: 999, padding: "5px 12px", fontSize: 11, fontWeight: 800, boxShadow: "0 4px 10px rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.15)", animation: "ls-pop 0.4s ease", whiteSpace: "nowrap" };
const ring: React.CSSProperties = { position: "absolute", left: "50%", top: "50%", width: 10, height: 10, marginLeft: -5, marginTop: -5, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.7)", animation: "ls-ring 0.7s ease-out forwards" };

/* 置いたブロック一覧（最小・見えるだけ。色はヒマワリが後で整える前提の中立スタイル） */
const placedListWrap: React.CSSProperties = {
  position: "absolute", top: 408, left: "50%", transform: "translateX(-50%)",
  width: "min(760px, 92%)", zIndex: 24, pointerEvents: "auto",
  display: "flex", flexDirection: "column", gap: 6,
};
const placedChip: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  background: "rgba(255,255,255,0.92)", color: "#1e293b",
  border: "1px solid rgba(0,0,0,0.1)", borderRadius: 10,
  padding: "5px 10px", fontSize: 11, boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
};

/* ───────── 本体 ───────── */
export default function LiveStage({ blocks }: { blocks: CBlock[] }) {
  const seq = useMemo(() => buildSequence(blocks), [blocks]);
  const [step, setStep] = useState(0);
  const [hopKey, setHopKey] = useState(0);

  // ロジックが変わったら頭から上演し直す＝「組んだ瞬間に動く」
  useEffect(() => { setStep(0); }, [seq]);

  // ステップ送り（待機は秒数反映、末尾で少し止めてループ）
  useEffect(() => {
    if (!seq.length) return;
    if (step >= seq.length) {
      const t = setTimeout(() => setStep(0), 1700);
      return () => clearTimeout(t);
    }
    setHopKey(k => k + 1);
    const t = setTimeout(() => setStep(s => s + 1), beatDuration(seq[step]));
    return () => clearTimeout(t);
  }, [step, seq]);

  const active = step < seq.length ? seq[step] : null;
  const hasTrigger = seq.length > 0;
  const hasBlocks = blocks.length > 0;

  // テレポートでキャラ位置をずらす（その手前まで left 寄り→右へワープ）
  const heroX = active?.type === "ac_tp" ? 74 : 0;

  return (
    <>
    <div style={{
      position: "absolute", top: 44, left: "calc(50% - 180px)",
      transform: "translateX(-50%) scale(1.5)", transformOrigin: "top center",
      width: 460, height: 232, zIndex: 25, pointerEvents: "none",
    }}>
      <style>{`
        @keyframes ls-bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes ls-hop { 0%{transform:translateY(0)} 35%{transform:translateY(-10px) scaleY(1.05)} 70%{transform:translateY(0) scaleY(0.94)} 100%{transform:translateY(0)} }
        @keyframes ls-sleep { 0%,100%{transform:rotate(-2deg)} 50%{transform:rotate(2deg) translateY(-2px)} }
        @keyframes ls-pop { 0%{transform:scale(0.4);opacity:0} 60%{transform:scale(1.08)} 100%{transform:scale(1);opacity:1} }
        @keyframes ls-drop { 0%{transform:translateY(-34px) rotate(-12deg);opacity:0} 60%{opacity:1} 100%{transform:translateY(0) rotate(0)} }
        @keyframes ls-title { 0%{transform:scale(0.5);opacity:0} 70%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
        @keyframes ls-ring { 0%{width:10px;height:10px;opacity:0.8} 100%{width:64px;height:64px;margin-left:-32px;margin-top:-32px;opacity:0} }
        @keyframes ls-flash { 0%{opacity:0} 40%{opacity:1} 100%{opacity:0} }
        @keyframes ls-entrance { 0%{transform:translateX(-120px);opacity:0} 100%{transform:translateX(0);opacity:1} }
      `}</style>

      {/* ステージ枠（工房のランプに照らされた小さなマイクラ世界） */}
      <div style={{
        position: "absolute", inset: 0, borderRadius: 14, overflow: "hidden",
        background: "linear-gradient(#bfe3ff 0%, #dff0ff 52%)",
        border: "3px solid #2a2520",
        boxShadow: "0 10px 30px rgba(0,0,0,0.4), inset 0 2px 0 rgba(255,255,255,0.6)",
        pointerEvents: "auto",
      }}>
        {/* お日さま光 */}
        <div style={{ position: "absolute", top: -40, left: "50%", transform: "translateX(-50%)", width: 220, height: 120, background: "radial-gradient(ellipse, rgba(255,238,180,0.7), transparent 70%)" }} />
        {/* 地面（草） */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 46, background: "linear-gradient(#5fa845,#4a7d36)", borderTop: "4px solid #3c8a2f", boxShadow: "inset 0 3px 0 rgba(255,255,255,0.15)" }} />

        {/* ステータス（いま何が起きてる？） */}
        <div style={{
          position: "absolute", top: 8, left: 8, display: "flex", alignItems: "center", gap: 6,
          background: "rgba(20,16,12,0.78)", color: "#fff", borderRadius: 999, padding: "3px 10px",
          fontSize: 11, fontWeight: 800, boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: hasTrigger ? "#ff5a5a" : "#888", boxShadow: hasTrigger ? "0 0 6px #ff5a5a" : "none" }} />
          {active ? `${CAT_EMOJI[active.category] || "▶"} ${active.label}` : hasTrigger ? "LIVE" : "プレビュー"}
        </div>

        {/* キャラ＋演出 */}
        {hasTrigger ? (
          <>
            <div key={`ent-${hopKey === 1 ? "in" : "stay"}`} style={step === 0 ? { animation: "ls-entrance 0.7s cubic-bezier(0.2,0.9,0.3,1)" } : undefined}>
              <Hero asleep={false} x={heroX} hop={hopKey % 2 === 0} />
            </div>
            {active && <Fx beat={active} />}
          </>
        ) : (
          <>
            <Hero asleep x={0} hop={false} />
            <div style={{ position: "absolute", left: 0, right: 0, top: 70, textAlign: "center", color: "#3a4a5a", fontSize: 12, fontWeight: 800, pointerEvents: "none" }}>
              {hasBlocks ? "▲ きっかけ ブロックから つなげてみて" : "ここに 作ったものが 動くよ"}
            </div>
          </>
        )}

        {/* もう一回 */}
        {hasTrigger && (
          <button
            onClick={() => setStep(0)}
            style={{
              position: "absolute", right: 8, bottom: 8, zIndex: 8,
              background: "rgba(20,16,12,0.82)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 999, padding: "4px 12px", fontSize: 11, fontWeight: 800, cursor: "pointer",
              boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
            }}
          >▶ もう一回</button>
        )}
      </div>
    </div>

    {/* おいたブロック一覧（最小・見えるだけ。接続有無に関わらず全部出す） */}
    {blocks.length > 0 && (
      <div style={placedListWrap}>
        <div style={{ fontSize: 12, fontWeight: 900, color: "#475569", textAlign: "center" }}>📦 おいたブロック（{blocks.length}）</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          {blocks.map(b => {
            const vals = b.fields.map(f => f.value).filter(Boolean).join(" / ").replace(/minecraft:/g, "");
            return (
              <div key={b.id} style={placedChip}>
                <span style={{ fontSize: 14 }}>{CAT_EMOJI[b.category] || "•"}</span>
                <span style={{ fontWeight: 900 }}>{b.label}</span>
                {vals && <span style={{ color: "#64748b", fontSize: 10 }}>{vals}</span>}
              </div>
            );
          })}
        </div>
      </div>
    )}
    </>
  );
}
