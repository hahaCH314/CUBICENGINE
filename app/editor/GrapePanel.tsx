"use client";

import { useState, useRef, useCallback } from "react";

/* ──────────────────────────────────────────────────────────────
   GrapePanel — 🌿 GROVE（JAVA / 自然×メタバース）/ 構造は「ハブ」
   - きっかけ＝ハブの中心。すること等が放射状に実る。
   - タップした場所に候補がブワッと開く(ラジアル)→選ぶ→実がぷるん生成（カーソル移動を最小化）。
   - テキストが要る実は、その場に出る入力でinline編集。下バー/鍵盤は廃止。
   - 色は今のカテゴリ識別色を流用。LogicPanel(積み木/SPROUT)は無傷。
   ────────────────────────────────────────────────────────────── */

type Cat = "trigger" | "action" | "ifelse" | "value" | "loop";

const CAT_STYLE: Record<Cat, { label: string; color: string; glow: string }> = {
  trigger: { label: "きっかけ",   color: "#e0554f", glow: "#ff9089" },
  action:  { label: "すること",   color: "#3d7ec0", glow: "#74b4f0" },
  ifelse:  { label: "じょうけん", color: "#2fa37d", glow: "#5fe0b8" },
  value:   { label: "あたい",     color: "#d99a3c", glow: "#ffd166" },
  loop:    { label: "くりかえし", color: "#d9743f", glow: "#ffa96e" },
};
const CAT_ORDER: Cat[] = ["trigger", "action", "ifelse", "value", "loop"];

interface ItemDef { type: string; label: string; emoji: string; cat: Cat; needsText: boolean; placeholder: string; }

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
interface Spawn { x: number; y: number; phase: "pick" | "type"; item?: ItemDef; editId?: string; }
let _gid = 1;

export default function GrapePanel() {
  const [fruits, setFruits] = useState<Fruit[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pump, setPump] = useState(0);
  const [sending, setSending] = useState(false);
  const [flash, setFlash] = useState(false);
  const [spawn, setSpawn] = useState<Spawn | null>(null);
  const [draft, setDraft] = useState("");
  const stageRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const coords = (e: React.MouseEvent) => {
    const r = stageRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0) + (stageRef.current?.scrollLeft ?? 0), y: e.clientY - (r?.top ?? 0) + (stageRef.current?.scrollTop ?? 0) };
  };

  // 空いてる所をタップ → その場に候補が開く（ラジアル）
  const openPick = useCallback((e: React.MouseEvent) => {
    if (sending) return;
    setSpawn({ ...coords(e), phase: "pick" });
  }, [sending]);

  const doGenerate = (item: ItemDef, text: string) => {
    const id = `g${_gid++}`;
    setFruits((f) => [...f, { id, item, text, born: Date.now() }]);
    setSelectedId(id);
    playPop();
    if (item.cat !== "trigger") setPump((p) => p + 1);
  };

  const pickItem = (item: ItemDef) => {
    if (!spawn) return;
    if (item.needsText) {
      setDraft(item.placeholder ? "" : "");
      setSpawn({ ...spawn, phase: "type", item });
      setTimeout(() => inputRef.current?.focus(), 20);
    } else { doGenerate(item, ""); setSpawn(null); }
  };

  const confirmType = () => {
    if (!spawn?.item) return;
    if (spawn.editId) setFruits((f) => f.map((x) => x.id === spawn.editId ? { ...x, text: draft } : x));
    else doGenerate(spawn.item, draft);
    setSpawn(null);
  };

  const openEdit = (fr: Fruit, e: React.MouseEvent) => {
    setSelectedId(fr.id);
    if (fr.item.needsText) {
      setDraft(fr.text);
      setSpawn({ ...coords(e), phase: "type", item: fr.item, editId: fr.id });
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  };

  const removeFruit = (id: string) => { setFruits((f) => f.filter((x) => x.id !== id)); setSelectedId((s) => s === id ? null : s); };

  const sendToMc = useCallback(() => {
    setFruits((cur) => {
      if (!cur.length) return cur;
      setSending(true); playSend();
      setTimeout(() => { setFruits([]); setSelectedId(null); setSending(false); setFlash(true); setTimeout(() => setFlash(false), 950); }, 640);
      return cur;
    });
  }, []);

  const hub = fruits.find((x) => x.item.cat === "trigger") || null;
  const spokes = fruits.filter((x) => x !== hub);
  const hubGrow = 1 + Math.min(spokes.length * 0.05, 0.32);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      {/* 舞台（全面＝没入背景／タップで種をまく） */}
      <div ref={stageRef} onClick={openPick} style={{
        position: "absolute", inset: 0, overflow: "auto",
        background: "radial-gradient(125% 95% at 50% 8%, #43645a 0%, #36534b 45%, #2b443d 100%)",
        cursor: sending ? "default" : "crosshair",
      }}>
        {/* メタバースのグリッド（両脇まで・中央へ集中） */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "linear-gradient(rgba(150,235,200,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(150,235,200,0.08) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage: "radial-gradient(120% 90% at 50% 12%, #000 35%, transparent 92%)",
          WebkitMaskImage: "radial-gradient(120% 90% at 50% 12%, #000 35%, transparent 92%)",
        }} />

        {/* タイトル＝GROVE */}
        <div style={{ position: "absolute", top: 16, left: 20, zIndex: 2, fontWeight: 900, fontSize: 15, color: "#d3f0e2", letterSpacing: "0.18em", display: "flex", alignItems: "center", gap: 8, textShadow: "0 1px 3px rgba(0,0,0,0.4)", pointerEvents: "none" }}>
          <span style={{ fontSize: 18 }}>🌿</span> GROVE <span style={{ fontSize: 10, fontWeight: 800, opacity: 0.7, letterSpacing: "0.1em" }}>JAVA</span>
        </div>

        {/* 房（ハブ＋スポーク） */}
        <div style={{ minHeight: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "70px 20px 40px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", animation: sending ? "suck-to-mc 0.62s cubic-bezier(0.55,0,0.85,0.35) forwards" : undefined, transformOrigin: "center bottom" }}>
            {hub ? (
              <div style={{ position: "relative", transform: `scale(${hubGrow})`, transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)" }}>
                {pump > 0 && <span key={`ring${pump}`} style={{ position: "absolute", inset: -8, borderRadius: 30, pointerEvents: "none", animation: "hub-pump 0.55s ease-out", boxShadow: "0 0 0 2px #aef7df, 0 0 22px #5fe0b8" }} />}
                <Grape fr={hub} isHub selected={hub.id === selectedId} onSelect={openEdit} onDelete={() => removeFruit(hub.id)} />
              </div>
            ) : (
              <div style={{ padding: "16px 24px", borderRadius: 24, border: "2px dashed rgba(150,235,200,0.45)", color: "#cdeede", fontWeight: 800, fontSize: 14, textAlign: "center", background: "rgba(255,255,255,0.06)", pointerEvents: "none", animation: "grape-breathe 3s ease-in-out infinite" }}>
                🌱 どこかをタップして種をまこう
              </div>
            )}

            {spokes.length > 0 && (
              <>
                <div style={{ position: "relative", width: 3, height: 18, background: "linear-gradient(to bottom,#4a9c6e,#3c7d59)", borderRadius: 2 }}>
                  {pump > 0 && <span key={`pulse${pump}`} style={{ position: "absolute", left: -2.5, bottom: 0, width: 8, height: 8, borderRadius: "50%", background: "#cffbe4", boxShadow: "0 0 10px #5fe0b8, 0 0 4px #aef7df", animation: "stem-pulse 0.5s ease-out", pointerEvents: "none" }} />}
                </div>
                <div style={{ position: "relative", display: "flex", gap: 16, paddingTop: 14, flexWrap: "wrap", justifyContent: "center", maxWidth: 760 }}>
                  {spokes.length > 1 && <div style={{ position: "absolute", top: 0, left: "12%", right: "12%", height: 3, background: "#4a9c6e", borderRadius: 2 }} />}
                  {spokes.map((s) => (
                    <div key={s.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{ width: 3, height: 14, background: "#4a9c6e", borderRadius: 2 }} />
                      <Grape fr={s} selected={s.id === selectedId} onSelect={openEdit} onDelete={() => removeFruit(s.id)} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {fruits.length > 0 && (
            <>
              <div style={{ width: 3, height: 26, background: "linear-gradient(to bottom,#3c7d59,transparent)", borderRadius: 2, marginTop: 14 }} />
              <button type="button" onClick={(e) => { e.stopPropagation(); sendToMc(); }} disabled={sending} style={{
                padding: "9px 18px", borderRadius: 12, border: "none", cursor: sending ? "default" : "pointer",
                background: "linear-gradient(135deg,#5aa0e0,#3d7ec0)", color: "#fff", fontWeight: 900, fontSize: 13,
                boxShadow: "0 4px 16px rgba(61,126,192,0.5), inset 0 1px 0 rgba(255,255,255,0.4)",
                display: "flex", alignItems: "center", gap: 6, animation: "mc-invite 1.8s ease-in-out infinite",
              }}>
                <span style={{ fontSize: 15 }}>⛏️</span> マイクラへ放つ ▶
              </button>
            </>
          )}
        </div>

        {/* 出力成功フラッシュ */}
        {flash && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 5, animation: "mc-flash 0.95s ease-out forwards" }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", textShadow: "0 0 20px #5fe0b8, 0 2px 6px rgba(0,0,0,0.5)" }}>🎉 GROVE から放った！</div>
          </div>
        )}

        {/* 種まきラジアル / インライン入力（カーソルの場所に出る） */}
        {spawn && (
          <>
            <div onClick={(e) => { e.stopPropagation(); setSpawn(null); }} style={{ position: "absolute", inset: 0, zIndex: 20 }} />
            <div onClick={(e) => e.stopPropagation()} style={{
              position: "absolute", left: spawn.x, top: spawn.y, transform: "translate(-50%, 10px)", zIndex: 21,
              background: "rgba(20,30,26,0.96)", border: "1px solid rgba(150,235,200,0.25)", borderRadius: 14,
              padding: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.5)", animation: "pop-in 0.18s cubic-bezier(0.34,1.56,0.64,1)",
              maxWidth: 360,
            }}>
              {spawn.phase === "pick" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {CAT_ORDER.map((cat) => {
                    const cs = CAT_STYLE[cat];
                    const items = ITEMS.filter((it) => it.cat === cat);
                    return (
                      <div key={cat} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: cs.color, boxShadow: `0 0 6px ${cs.glow}`, flexShrink: 0 }} />
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                          {items.map((it) => (
                            <button key={it.type} type="button" onClick={() => pickItem(it)} style={{
                              display: "inline-flex", alignItems: "center", gap: 4, padding: "6px 9px", borderRadius: 9, border: "none", cursor: "pointer",
                              color: "#fff", fontWeight: 800, fontSize: 11.5, background: `linear-gradient(135deg, ${cs.glow}, ${cs.color})`,
                              boxShadow: `0 0 0 1px rgba(255,255,255,0.25) inset`, textShadow: "0 1px 1px rgba(0,0,0,0.3)",
                            }}>
                              <span style={{ fontSize: 13 }}>{it.emoji}</span>{it.label}{it.needsText && <span style={{ fontSize: 9, opacity: 0.85 }}>✎</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : spawn.item ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 240 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#fff", display: "inline-flex", alignItems: "center", gap: 4, background: CAT_STYLE[spawn.item.cat].color, padding: "5px 9px", borderRadius: 8, boxShadow: `0 0 10px ${CAT_STYLE[spawn.item.cat].glow}`, whiteSpace: "nowrap" }}>
                    <span>{spawn.item.emoji}</span>{spawn.item.label}
                  </span>
                  <input ref={inputRef} value={draft} placeholder={spawn.item.placeholder || "中身を書く…"}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") confirmType(); if (e.key === "Escape") setSpawn(null); }}
                    style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "#fff", padding: "7px 10px", borderRadius: 9, border: `2px solid ${CAT_STYLE[spawn.item.cat].glow}`, outline: "none", background: "rgba(0,0,0,0.3)" }} />
                  <button type="button" onClick={confirmType} style={{ border: "none", cursor: "pointer", background: CAT_STYLE[spawn.item.cat].color, color: "#fff", fontWeight: 900, fontSize: 12, padding: "7px 11px", borderRadius: 9 }}>OK</button>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* 1粒の実 — 生成時ぷるん／選択中は呼吸／ハブは大きめ＋リング */
function Grape({ fr, selected, isHub, onSelect, onDelete }: {
  fr: Fruit; selected: boolean; isHub?: boolean; onSelect: (fr: Fruit, e: React.MouseEvent) => void; onDelete: () => void;
}) {
  const cs = CAT_STYLE[fr.item.cat];
  const fresh = Date.now() - fr.born < 700;
  return (
    <div onClick={(e) => { e.stopPropagation(); onSelect(fr, e); }} style={{ position: "relative", animation: fresh ? "grape-pop 0.6s cubic-bezier(0.34,1.56,0.64,1)" : (selected ? "grape-breathe 2.6s ease-in-out infinite" : undefined), cursor: "pointer" }}>
      <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} style={{ position: "absolute", top: -6, right: -6, zIndex: 3, width: 18, height: 18, borderRadius: "50%", border: "none", cursor: "pointer", background: "rgba(0,0,0,0.35)", color: "#fff", fontSize: 11, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
      <div style={{
        minWidth: isHub ? 175 : 145, maxWidth: 230, padding: isHub ? "13px 20px" : "10px 16px", borderRadius: isHub ? 26 : 22,
        background: `radial-gradient(120% 120% at 32% 25%, #ffffff66 0%, ${cs.color} 42%, ${shade(cs.color)} 100%)`,
        boxShadow: selected ? `0 0 0 3px #fff, 0 0 22px ${cs.glow}, 0 6px 16px rgba(0,0,0,0.18)` : isHub ? `0 0 0 2px #ffffffcc, 0 0 18px ${cs.glow}, 0 6px 15px rgba(0,0,0,0.18)` : `0 0 14px ${cs.glow}aa, 0 5px 13px rgba(0,0,0,0.16), inset 0 2px 4px rgba(255,255,255,0.4)`,
        textAlign: "center", position: "relative",
      }}>
        <div style={{ position: "absolute", top: 7, left: 16, width: 22, height: 14, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.85), transparent 70%)", pointerEvents: "none" }} />
        <div style={{ fontSize: isHub ? 12 : 11, fontWeight: 900, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}>
          <span style={{ fontSize: isHub ? 15 : 13 }}>{fr.item.emoji}</span>{fr.item.label}
        </div>
        {fr.item.needsText && (fr.text ? (
          <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginTop: 2, wordBreak: "break-word", textShadow: "0 1px 2px rgba(0,0,0,0.4)" }}>{fr.text}</div>
        ) : (
          <div style={{ fontSize: 10, fontWeight: 700, color: "#ffffffcc", marginTop: 2 }}>✎ タップして書く</div>
        ))}
      </div>
    </div>
  );
}

function shade(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 255) - 55), g = Math.max(0, ((n >> 8) & 255) - 55), b = Math.max(0, (n & 255) - 55);
  return `rgb(${r},${g},${b})`;
}

function playPop() {
  try {
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    const ctx = new AC(); const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(420, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.16, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.2); o.onended = () => ctx.close();
  } catch { /* noop */ }
}

function playSend() {
  try {
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    const ctx = new AC(); const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = "triangle"; o.frequency.setValueAtTime(900, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.5);
    g.gain.setValueAtTime(0.18, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.56); o.onended = () => ctx.close();
  } catch { /* noop */ }
}

const KEYFRAMES = `
  @keyframes grape-pop { 0%{transform:scale(0) translateY(-8px);opacity:0} 55%{transform:scale(1.18);opacity:1} 72%{transform:scale(0.92)} 86%{transform:scale(1.05)} 100%{transform:scale(1)} }
  @keyframes grape-breathe { 0%,100%{transform:scale(1)} 50%{transform:scale(1.035)} }
  @keyframes hub-pump { 0%{opacity:0.9;transform:scale(0.9)} 100%{opacity:0;transform:scale(1.45)} }
  @keyframes stem-pulse { 0%{transform:translateY(8px) scale(0.6);opacity:0} 30%{opacity:1} 100%{transform:translateY(-20px) scale(1.1);opacity:0} }
  @keyframes suck-to-mc { 0%{transform:translateY(0) scale(1);opacity:1} 55%{transform:translateY(40px) scale(0.55);opacity:0.85} 100%{transform:translateY(150px) scale(0.04);opacity:0;filter:blur(2px)} }
  @keyframes mc-invite { 0%,100%{box-shadow:0 4px 16px rgba(61,126,192,0.5), inset 0 1px 0 rgba(255,255,255,0.4)} 50%{box-shadow:0 4px 22px rgba(95,224,184,0.7), 0 0 0 3px rgba(95,224,184,0.25), inset 0 1px 0 rgba(255,255,255,0.4)} }
  @keyframes mc-flash { 0%{opacity:0;transform:scale(0.7)} 25%{opacity:1;transform:scale(1.05)} 70%{opacity:1;transform:scale(1)} 100%{opacity:0;transform:scale(1)} }
  @keyframes pop-in { 0%{opacity:0;transform:translate(-50%,10px) scale(0.7)} 100%{opacity:1;transform:translate(-50%,10px) scale(1)} }
`;
