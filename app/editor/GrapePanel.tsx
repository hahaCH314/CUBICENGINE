"use client";

import { useState, useRef, useCallback } from "react";

/* ──────────────────────────────────────────────────────────────
   GrapePanel — 🍇 モッド製造機（自然×メタバースの融合）/ 構造は「ハブ」
   - きっかけ(イベント)＝ハブの中心。すること(アクション)が放射状に実る。
   - 選ぶ → 実がぷるんと生成（心臓）。テキストが要る実は「テキスト入力工場(仮)」で書く。
   - 色は今のカテゴリ識別色を流用。明るい舞台＋発光。LogicPanel(積み木)は無傷。
   ────────────────────────────────────────────────────────────── */

type Cat = "trigger" | "action" | "ifelse" | "value" | "loop";

const CAT_STYLE: Record<Cat, { label: string; color: string; glow: string }> = {
  trigger: { label: "きっかけ",   color: "#e0554f", glow: "#ff9089" }, // 赤
  action:  { label: "すること",   color: "#3d7ec0", glow: "#74b4f0" }, // 青
  ifelse:  { label: "じょうけん", color: "#2fa37d", glow: "#5fe0b8" }, // 緑
  value:   { label: "あたい",     color: "#d99a3c", glow: "#ffd166" }, // 黄
  loop:    { label: "くりかえし", color: "#d9743f", glow: "#ffa96e" }, // 橙
};
const CAT_ORDER: Cat[] = ["trigger", "action", "ifelse", "value", "loop"];

interface ItemDef {
  type: string;
  label: string;
  emoji: string;
  cat: Cat;
  needsText: boolean;     // テキスト入力工場を通すか
  placeholder: string;
}

const ITEMS: ItemDef[] = [
  { type: "on_join",  label: "参加したとき",   emoji: "👋", cat: "trigger", needsText: false, placeholder: "" },
  { type: "on_break", label: "ブロック破壊",   emoji: "⛏️", cat: "trigger", needsText: false, placeholder: "" },
  { type: "on_chat",  label: "チャット入力",   emoji: "💬", cat: "trigger", needsText: true,  placeholder: "合言葉" },
  { type: "say",      label: "メッセージ送信", emoji: "📢", cat: "action",  needsText: true,  placeholder: "こんにちは！" },
  { type: "give",     label: "アイテムを渡す", emoji: "🎁", cat: "action",  needsText: true,  placeholder: "diamond ×1" },
  { type: "effect",   label: "効果をつける",   emoji: "✨", cat: "action",  needsText: false, placeholder: "" },
  { type: "if",       label: "もし〜なら",     emoji: "🔀", cat: "ifelse",  needsText: true,  placeholder: "夜のとき" },
  { type: "repeat",   label: "くりかえす",     emoji: "🔄", cat: "loop",    needsText: true,  placeholder: "3 回" },
  { type: "number",   label: "数",             emoji: "💎", cat: "value",   needsText: true,  placeholder: "10" },
];

interface Fruit { id: string; item: ItemDef; text: string; born: number; }
let _gid = 1;

export default function GrapePanel() {
  const [fruits, setFruits] = useState<Fruit[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pump, setPump] = useState(0);        // 実が付くたびに増やす→幹パルス＆ハブ発光
  const [sending, setSending] = useState(false);
  const [flash, setFlash] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ▼ 心臓：選ぶ → 実がぷるんと生成。テキストが要るものは工場(入力欄)にフォーカス。
  const generate = useCallback((item: ItemDef) => {
    if (sending) return;
    const id = `g${_gid++}`;
    setFruits((f) => [...f, { id, item, text: "", born: Date.now() }]);
    setSelectedId(id);
    playPop();
    if (item.cat !== "trigger") setPump((p) => p + 1); // スポークが付いた→幹に蛍光パルス＋ハブ膨らむ
    if (item.needsText) setTimeout(() => inputRef.current?.focus(), 30);
  }, [sending]);

  // ▼ 完成した房を幹から放つ → マイクラへ吸い込まれる
  const sendToMc = useCallback(() => {
    setFruits((cur) => {
      if (!cur.length) return cur;
      setSending(true);
      playSend();
      setTimeout(() => {
        setFruits([]); setSelectedId(null); setSending(false);
        setFlash(true); setTimeout(() => setFlash(false), 950);
      }, 640);
      return cur;
    });
  }, []);

  const editText = useCallback((id: string, text: string) => {
    setFruits((f) => f.map((x) => (x.id === id ? { ...x, text } : x)));
  }, []);
  const removeFruit = useCallback((id: string) => {
    setFruits((f) => f.filter((x) => x.id !== id));
    setSelectedId((s) => (s === id ? null : s));
  }, []);

  const selected = fruits.find((x) => x.id === selectedId) || null;
  const hub = fruits.find((x) => x.item.cat === "trigger") || null;
  const spokes = fruits.filter((x) => x !== hub);
  const hubGrow = 1 + Math.min(spokes.length * 0.05, 0.32); // スポークが増えるほどハブが膨らむ

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      {/* ═══ 上：見る所（明るい舞台・ハブに実る） ═══ */}
      <div style={{
        flex: 1, position: "relative", overflow: "auto",
        // 明るすぎず暗すぎず＝自然(苔/翡翠)×メタバース(冷たい緑)の中間トーン
        background: "radial-gradient(125% 95% at 50% 8%, #43645a 0%, #36534b 45%, #2b443d 100%)",
      }}>
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "linear-gradient(rgba(150,235,200,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(150,235,200,0.08) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(120% 90% at 50% 12%, #000 35%, transparent 92%)",
          WebkitMaskImage: "radial-gradient(120% 90% at 50% 12%, #000 35%, transparent 92%)",
        }} />

        <div style={{
          position: "absolute", top: 16, left: 20, zIndex: 2,
          fontWeight: 900, fontSize: 13, color: "#d3f0e2", letterSpacing: "0.08em",
          display: "flex", alignItems: "center", gap: 8, textShadow: "0 1px 3px rgba(0,0,0,0.4)",
        }}>
          <span style={{ fontSize: 18 }}>🍇</span> MOD製造機 <span style={{ fontSize: 10, opacity: 0.8 }}>JAVA</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#93c4b1" }}>（選ぶと実がなる）</span>
        </div>

        {/* ハブ＆スポーク */}
        <div style={{ minHeight: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "70px 20px 30px", gap: 0 }}>
          {/* 房（ハブ＋スポーク）— 放つとマイクラへ吸い込まれる */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            animation: sending ? "suck-to-mc 0.62s cubic-bezier(0.55,0,0.85,0.35) forwards" : undefined,
            transformOrigin: "center bottom",
          }}>
            {/* 中心ハブ＝きっかけ（スポークが付くたび膨らむ＋発光） */}
            {hub ? (
              <div style={{ position: "relative", transform: `scale(${hubGrow})`, transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)" }}>
                {pump > 0 && (
                  <span key={`ring${pump}`} style={{ position: "absolute", inset: -8, borderRadius: 30, pointerEvents: "none", animation: "hub-pump 0.55s ease-out", boxShadow: "0 0 0 2px #aef7df, 0 0 22px #5fe0b8" }} />
                )}
                <Grape fr={hub} isHub selected={hub.id === selectedId} onSelect={() => setSelectedId(hub.id)} onDelete={() => removeFruit(hub.id)} />
              </div>
            ) : (
              <div style={{ padding: "14px 22px", borderRadius: 22, border: "2px dashed rgba(150,235,200,0.4)", color: "#bfe0d0", fontWeight: 800, fontSize: 13, textAlign: "center", background: "rgba(255,255,255,0.06)" }}>
                👋 まず「きっかけ」を選んでハブにしよう
              </div>
            )}

            {/* ハブ→スポークのつなぎ＆放射（幹に蛍光パルスが走る） */}
            {spokes.length > 0 && (
              <>
                <div style={{ position: "relative", width: 3, height: 18, background: "linear-gradient(to bottom,#4a9c6e,#3c7d59)", borderRadius: 2 }}>
                  {pump > 0 && (
                    <span key={`pulse${pump}`} style={{ position: "absolute", left: -2.5, bottom: 0, width: 8, height: 8, borderRadius: "50%", background: "#cffbe4", boxShadow: "0 0 10px #5fe0b8, 0 0 4px #aef7df", animation: "stem-pulse 0.5s ease-out", pointerEvents: "none" }} />
                  )}
                </div>
                <div style={{ position: "relative", display: "flex", gap: 16, paddingTop: 14, flexWrap: "wrap", justifyContent: "center", maxWidth: 760 }}>
                  {spokes.length > 1 && (
                    <div style={{ position: "absolute", top: 0, left: "12%", right: "12%", height: 3, background: "#4a9c6e", borderRadius: 2 }} />
                  )}
                  {spokes.map((s) => (
                    <div key={s.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{ width: 3, height: 14, background: "#4a9c6e", borderRadius: 2 }} />
                      <Grape fr={s} selected={s.id === selectedId} onSelect={() => setSelectedId(s.id)} onDelete={() => removeFruit(s.id)} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 出力：完成した房を放つ → マイクラへ */}
          {fruits.length > 0 && (
            <>
              <div style={{ width: 3, height: 26, background: "linear-gradient(to bottom,#3c7d59,transparent)", borderRadius: 2, marginTop: 14 }} />
              <button
                type="button"
                onClick={sendToMc}
                disabled={sending}
                style={{
                  padding: "9px 18px", borderRadius: 12, border: "none", cursor: sending ? "default" : "pointer",
                  background: "linear-gradient(135deg,#5aa0e0,#3d7ec0)", color: "#fff", fontWeight: 900, fontSize: 13,
                  boxShadow: "0 4px 16px rgba(61,126,192,0.5), inset 0 1px 0 rgba(255,255,255,0.4)",
                  display: "flex", alignItems: "center", gap: 6, animation: "mc-invite 1.8s ease-in-out infinite",
                }}
              >
                <span style={{ fontSize: 15 }}>⛏️</span> マイクラへ放つ ▶
              </button>
            </>
          )}
        </div>

        {/* 出力成功フラッシュ */}
        {flash && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 5, animation: "mc-flash 0.95s ease-out forwards" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", textShadow: "0 0 20px #5fe0b8, 0 2px 6px rgba(0,0,0,0.5)" }}>🎉 マイクラへ出力した！</div>
          </div>
        )}
      </div>

      {/* ═══ 下：テキスト入力工場（仮）＋ アイテムの鍵盤 ═══ */}
      <div style={{ flexShrink: 0, background: "linear-gradient(to bottom,#ffffff,#f1f5f3)", borderTop: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 -4px 16px rgba(0,0,0,0.06)", padding: "10px 16px 14px" }}>
        {/* 🏭 テキスト入力工場 */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 12, minHeight: 40,
          background: "#f7faf8", border: "1px solid #e2ece7", borderRadius: 12, padding: "6px 10px",
        }}>
          <span style={{ fontSize: 11, fontWeight: 900, color: "#8a6d3b", whiteSpace: "nowrap" }}>🏭 テキスト入力工場</span>
          {selected && selected.item.needsText ? (
            <>
              <span style={{
                fontSize: 12, fontWeight: 800, color: "#fff", display: "inline-flex", alignItems: "center", gap: 5,
                background: CAT_STYLE[selected.item.cat].color, padding: "5px 10px", borderRadius: 8,
                boxShadow: `0 0 10px ${CAT_STYLE[selected.item.cat].glow}`, whiteSpace: "nowrap",
              }}>
                <span>{selected.item.emoji}</span>{selected.item.label}
              </span>
              <input
                ref={inputRef}
                value={selected.text}
                placeholder={selected.item.placeholder || "テキストを書く…"}
                onChange={(e) => editText(selected.id, e.target.value)}
                style={{ flex: 1, fontSize: 15, fontWeight: 700, color: "#2a2a2a", padding: "9px 12px", borderRadius: 10, border: `2px solid ${CAT_STYLE[selected.item.cat].glow}`, outline: "none", background: "#fff" }}
              />
            </>
          ) : selected ? (
            <span style={{ fontSize: 13, color: "#79a08d", fontWeight: 700 }}>
              ✓「{selected.item.label}」はテキスト不要。そのまま実るよ
            </span>
          ) : (
            <span style={{ fontSize: 13, color: "#9bb6a8", fontWeight: 700 }}>↓ アイテムを選ぶと、ここで中身を書けるよ</span>
          )}
        </div>

        {/* アイテムの鍵盤（カテゴリ＝色で並ぶ） */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {CAT_ORDER.map((cat) => {
            const cs = CAT_STYLE[cat];
            const items = ITEMS.filter((it) => it.cat === cat);
            if (!items.length) return null;
            return (
              <div key={cat} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 10, fontWeight: 900, color: cs.color, letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: cs.color, boxShadow: `0 0 6px ${cs.glow}` }} />
                  {cs.label}
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  {items.map((it) => (
                    <button
                      key={it.type}
                      type="button"
                      onClick={() => generate(it)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 11px", borderRadius: 10, cursor: "pointer",
                        border: "none", color: "#fff", fontWeight: 800, fontSize: 12,
                        background: `linear-gradient(135deg, ${cs.glow}, ${cs.color})`,
                        boxShadow: "0 2px 6px rgba(0,0,0,0.12), 0 0 0 1px rgba(255,255,255,0.35) inset",
                        textShadow: "0 1px 1px rgba(0,0,0,0.25)", transition: "transform 0.08s ease",
                      }}
                      onMouseDown={(e) => { e.currentTarget.style.transform = "translateY(2px) scale(0.97)"; }}
                      onMouseUp={(e) => { e.currentTarget.style.transform = ""; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = ""; }}
                    >
                      <span style={{ fontSize: 14 }}>{it.emoji}</span>{it.label}
                      {it.needsText && <span style={{ fontSize: 10, opacity: 0.85 }}>✎</span>}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* 1粒の実 — 生成時ぷるん／選択中は呼吸／ハブは大きめ＋リング */
function Grape({ fr, selected, isHub, onSelect, onDelete }: {
  fr: Fruit; selected: boolean; isHub?: boolean; onSelect: () => void; onDelete: () => void;
}) {
  const cs = CAT_STYLE[fr.item.cat];
  const fresh = Date.now() - fr.born < 700;
  return (
    <div
      onClick={onSelect}
      style={{ position: "relative", animation: fresh ? "grape-pop 0.6s cubic-bezier(0.34,1.56,0.64,1)" : (selected ? "grape-breathe 2.6s ease-in-out infinite" : undefined), cursor: "pointer" }}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        style={{ position: "absolute", top: -6, right: -6, zIndex: 3, width: 18, height: 18, borderRadius: "50%", border: "none", cursor: "pointer", background: "rgba(0,0,0,0.35)", color: "#fff", fontSize: 11, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}
      >×</button>

      <div style={{
        minWidth: isHub ? 175 : 145, maxWidth: 230, padding: isHub ? "13px 20px" : "10px 16px", borderRadius: isHub ? 26 : 22,
        background: `radial-gradient(120% 120% at 32% 25%, #ffffff66 0%, ${cs.color} 42%, ${shade(cs.color)} 100%)`,
        boxShadow: selected
          ? `0 0 0 3px #fff, 0 0 22px ${cs.glow}, 0 6px 16px rgba(0,0,0,0.18)`
          : isHub
            ? `0 0 0 2px #ffffffcc, 0 0 18px ${cs.glow}, 0 6px 15px rgba(0,0,0,0.18)`
            : `0 0 14px ${cs.glow}aa, 0 5px 13px rgba(0,0,0,0.16), inset 0 2px 4px rgba(255,255,255,0.4)`,
        textAlign: "center", position: "relative",
      }}>
        <div style={{ position: "absolute", top: 7, left: 16, width: 22, height: 14, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.85), transparent 70%)", pointerEvents: "none" }} />
        <div style={{ fontSize: isHub ? 12 : 11, fontWeight: 900, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}>
          <span style={{ fontSize: isHub ? 15 : 13 }}>{fr.item.emoji}</span>{fr.item.label}
        </div>
        {fr.item.needsText && (
          fr.text ? (
            <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginTop: 2, wordBreak: "break-word", textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>{fr.text}</div>
          ) : (
            <div style={{ fontSize: 10, fontWeight: 700, color: "#ffffffcc", marginTop: 2 }}>✎ 工場で書く</div>
          )
        )}
      </div>
    </div>
  );
}

function shade(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 255) - 55);
  const g = Math.max(0, ((n >> 8) & 255) - 55);
  const b = Math.max(0, (n & 255) - 55);
  return `rgb(${r},${g},${b})`;
}

function playPop() {
  try {
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    const ctx = new AC();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(420, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.16, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.2);
    o.onended = () => ctx.close();
  } catch { /* noop */ }
}

// 放つ→マイクラへ吸い込まれる音（下降スイープ＋きらめき）
function playSend() {
  try {
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    const ctx = new AC();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(900, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.5);
    g.gain.setValueAtTime(0.18, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.56);
    o.onended = () => ctx.close();
  } catch { /* noop */ }
}

const KEYFRAMES = `
  @keyframes grape-pop {
    0%   { transform: scale(0) translateY(-8px); opacity: 0; }
    55%  { transform: scale(1.18); opacity: 1; }
    72%  { transform: scale(0.92); }
    86%  { transform: scale(1.05); }
    100% { transform: scale(1); }
  }
  @keyframes grape-breathe {
    0%,100% { transform: scale(1); }
    50%     { transform: scale(1.035); }
  }
  /* 実が付いた瞬間：ハブの周りに蛍光リングが広がる */
  @keyframes hub-pump {
    0%   { opacity: 0.9; transform: scale(0.9); }
    100% { opacity: 0; transform: scale(1.45); }
  }
  /* 幹を駆け上がる蛍光パルス */
  @keyframes stem-pulse {
    0%   { transform: translateY(8px) scale(0.6); opacity: 0; }
    30%  { opacity: 1; }
    100% { transform: translateY(-20px) scale(1.1); opacity: 0; }
  }
  /* 完成した房がマイクラへ吸い込まれる */
  @keyframes suck-to-mc {
    0%   { transform: translateY(0) scale(1); opacity: 1; }
    55%  { transform: translateY(40px) scale(0.55); opacity: 0.85; }
    100% { transform: translateY(150px) scale(0.04); opacity: 0; filter: blur(2px); }
  }
  /* 出力ボタンのおいで演出 */
  @keyframes mc-invite {
    0%,100% { box-shadow: 0 4px 16px rgba(61,126,192,0.5), inset 0 1px 0 rgba(255,255,255,0.4); }
    50%     { box-shadow: 0 4px 22px rgba(95,224,184,0.7), 0 0 0 3px rgba(95,224,184,0.25), inset 0 1px 0 rgba(255,255,255,0.4); }
  }
  /* 出力成功フラッシュ */
  @keyframes mc-flash {
    0%   { opacity: 0; transform: scale(0.7); }
    25%  { opacity: 1; transform: scale(1.05); }
    70%  { opacity: 1; transform: scale(1); }
    100% { opacity: 0; transform: scale(1); }
  }
`;
