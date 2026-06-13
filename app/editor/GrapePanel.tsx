"use client";

import { useState, useRef, useCallback, useEffect, type ComponentType } from "react";
import { GrapeIcons, type IconProps } from "./grapeIcons";

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

// 漂う発光の粒（両脇に多め＝遊び場の息づかい）
const MOTES: { x: string; y: string; s: number; c: string; d: number; delay: number }[] = [
  { x: "6%",  y: "30%", s: 4,   c: "#7df0c0", d: 7,  delay: 0 },
  { x: "10%", y: "62%", s: 3,   c: "#aef7df", d: 9,  delay: 1 },
  { x: "4%",  y: "78%", s: 5,   c: "#5fe0b8", d: 8,  delay: 2 },
  { x: "14%", y: "45%", s: 2.5, c: "#cffbe4", d: 11, delay: 0.5 },
  { x: "20%", y: "15%", s: 2.5, c: "#9ff0c8", d: 11, delay: 2 },
  { x: "90%", y: "35%", s: 4,   c: "#7df0c0", d: 8,  delay: 1.5 },
  { x: "94%", y: "60%", s: 3,   c: "#aef7df", d: 10, delay: 0 },
  { x: "88%", y: "75%", s: 5,   c: "#5fe0b8", d: 9,  delay: 2.5 },
  { x: "84%", y: "50%", s: 2.5, c: "#cffbe4", d: 12, delay: 1 },
  { x: "78%", y: "18%", s: 2.5, c: "#9ff0c8", d: 12, delay: 1.2 },
  { x: "30%", y: "85%", s: 3,   c: "#aef7df", d: 10, delay: 0.8 },
  { x: "65%", y: "82%", s: 3.5, c: "#7df0c0", d: 9,  delay: 1.8 },
  { x: "48%", y: "20%", s: 2,   c: "#cffbe4", d: 13, delay: 0.3 },
  { x: "50%", y: "70%", s: 2,   c: "#aef7df", d: 14, delay: 0.6 },
];

// アイテム種別 → 単色SVGアイコン（ヒマワリ作 grapeIcons・currentColorで色は親に追従）
const ICON_MAP: Record<string, ComponentType<IconProps>> = {
  on_join: GrapeIcons.Join, on_break: GrapeIcons.Break, on_chat: GrapeIcons.Chat,
  say: GrapeIcons.Message, give: GrapeIcons.Item, effect: GrapeIcons.Effect,
  if: GrapeIcons.If, repeat: GrapeIcons.Loop, number: GrapeIcons.Number,
};
function ItemGlyph({ type, size }: { type: string; size: number }) {
  const Ic = ICON_MAP[type];
  return Ic ? <Ic size={size} style={{ display: "block", flexShrink: 0 }} /> : null;
}

interface Fruit { id: string; item: ItemDef; text: string; born: number; x: number; y: number; }
interface Spawn { x: number; y: number; phase: "pick" | "type"; item?: ItemDef; editId?: string; }
let _gid = 1;

export default function GrapePanel() {
  const [fruits, setFruits] = useState<Fruit[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [spawn, setSpawn] = useState<Spawn | null>(null);
  const [draft, setDraft] = useState("");
  const [reveal, setReveal] = useState<string[] | null>(null); // コード誕生の演出
  const [shown, setShown] = useState(0);                       // 何行まで生まれたか
  const stageRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // コードが1行ずつ"生まれる"ストリーム
  useEffect(() => {
    if (!reveal) return;
    let i = 0;
    const id = setInterval(() => {
      i++; setShown(i);
      if (i >= reveal.length) { clearInterval(id); setTimeout(() => { setReveal(null); setSending(false); }, 1700); }
    }, 80);
    return () => clearInterval(id);
  }, [reveal]);

  const coords = (e: React.MouseEvent) => {
    const r = stageRef.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0) + (stageRef.current?.scrollLeft ?? 0), y: e.clientY - (r?.top ?? 0) + (stageRef.current?.scrollTop ?? 0) };
  };

  // 空いてる所をタップ → その場に候補が開く（ラジアル）
  const openPick = useCallback((e: React.MouseEvent) => {
    if (sending) return;
    setSpawn({ ...coords(e), phase: "pick" });
  }, [sending]);

  // 植えた場所(x,y)に実が生る
  const doGenerate = (item: ItemDef, text: string, x: number, y: number) => {
    const id = `g${_gid++}`;
    setFruits((f) => [...f, { id, item, text, born: Date.now(), x, y }]);
    setSelectedId(id);
    playPop();
  };

  const pickItem = (item: ItemDef) => {
    if (!spawn) return;
    if (item.needsText) {
      setDraft("");
      setSpawn({ ...spawn, phase: "type", item });
      setTimeout(() => inputRef.current?.focus(), 20);
    } else { doGenerate(item, "", spawn.x, spawn.y); setSpawn(null); }
  };

  const confirmType = () => {
    if (!spawn?.item) return;
    if (spawn.editId) setFruits((f) => f.map((x) => x.id === spawn.editId ? { ...x, text: draft } : x));
    else doGenerate(spawn.item, draft, spawn.x, spawn.y);
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

  // 放つ → あなたが書いた事になるコードが生まれる（魂＝創造のロマン）
  const sendToMc = useCallback(() => {
    const h = fruits.find((x) => x.item.cat === "trigger") || null;
    if (!h) return;
    const sp = fruits.filter((x) => x !== h);
    setShown(0); setReveal(fruitsToCode(h, sp)); setSending(true); playSend();
  }, [fruits]);


  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      {/* 舞台（全面＝没入背景：アバター/パンドラの夜の森／タップで種をまく） */}
      <div ref={stageRef} onClick={openPick} style={{
        position: "absolute", inset: 0, overflow: "auto",
        background: "radial-gradient(120% 95% at 50% 2%, #163a33 0%, #0d251f 42%, #061310 100%)",
        cursor: sending ? "default" : "crosshair",
      }}>
        {/* 方眼紙(グリッド)は撤去：暗い森に格子は不要。メタ感は発光の粒/コードで出す */}
        {/* 上からの光芒（god rays） */}
        <div style={{ position: "absolute", top: "-12%", left: "50%", transform: "translateX(-50%)", width: "62%", height: "95%", pointerEvents: "none", filter: "blur(7px)", opacity: 0.8,
          background: "conic-gradient(from 178deg at 50% 0%, transparent 0deg, rgba(150,235,200,0.07) 10deg, transparent 20deg, rgba(150,235,200,0.05) 30deg, transparent 40deg, rgba(150,235,200,0.06) 50deg, transparent 60deg)" }} />
        {/* 両脇のバイオ発光（＝遊び場） */}
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "24%", pointerEvents: "none", background: "radial-gradient(58% 48% at 0% 58%, rgba(60,220,160,0.20), transparent 72%)" }} />
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "24%", pointerEvents: "none", background: "radial-gradient(58% 48% at 100% 46%, rgba(45,205,180,0.18), transparent 72%)" }} />
        {/* 底のもや */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "32%", pointerEvents: "none", background: "linear-gradient(to top, rgba(35,150,120,0.22), transparent)", filter: "blur(12px)" }} />
        {/* 漂う発光の粒（両脇に多め） */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
          {MOTES.map((m, i) => (
            <span key={i} style={{ position: "absolute", left: m.x, top: m.y, width: m.s, height: m.s, borderRadius: "50%", background: m.c, boxShadow: `0 0 ${m.s * 2.5}px ${m.c}`, animation: `mote ${m.d}s ease-in-out ${m.delay}s infinite` }} />
          ))}
        </div>
        {/* 周辺ビネット（中央へ集中させる） */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", boxShadow: "inset 0 0 200px rgba(0,0,0,0.72)" }} />

        {/* タイトル＝GROVE */}
        <div style={{ position: "absolute", top: 16, left: 20, zIndex: 2, fontWeight: 900, fontSize: 15, color: "#d3f0e2", letterSpacing: "0.18em", display: "flex", alignItems: "center", gap: 8, textShadow: "0 1px 3px rgba(0,0,0,0.4)", pointerEvents: "none" }}>
          <span style={{ fontSize: 18 }}>🌿</span> GROVE <span style={{ fontSize: 10, fontWeight: 800, opacity: 0.7, letterSpacing: "0.1em" }}>JAVA</span>
        </div>

        {/* 空状態：シンプルな案内（前の版に戻す） */}
        {fruits.length === 0 && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ padding: "16px 28px", borderRadius: 24, border: "2px dashed rgba(150,235,200,0.45)", color: "#cdeede", fontWeight: 900, fontSize: 16, letterSpacing: "0.18em", textAlign: "center", background: "rgba(255,255,255,0.06)", animation: "grape-breathe 3s ease-in-out infinite" }}>
              🌳 TAP
            </div>
          </div>
        )}

        {/* 植えた場所で育つ：実は植えた点の上に生り、下へ芽の茎が伸びる */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", animation: sending ? "suck-to-mc 0.62s cubic-bezier(0.55,0,0.85,0.35) forwards" : undefined, transformOrigin: "center bottom" }}>
          {fruits.map((fr) => (
            <div key={fr.id} style={{ position: "absolute", left: fr.x, top: fr.y, transform: "translate(-50%, -50%)", pointerEvents: "auto" }}>
              <Grape fr={fr} selected={fr.id === selectedId} onSelect={openEdit} onDelete={() => removeFruit(fr.id)} />
            </div>
          ))}
        </div>

        {/* マイクラへ放つ（固定・右下） */}
        {fruits.length > 0 && (
          <button type="button" onClick={(e) => { e.stopPropagation(); sendToMc(); }} disabled={sending} style={{
            position: "absolute", right: 20, bottom: 20, zIndex: 10,
            padding: "10px 18px", borderRadius: 12, border: "none", cursor: sending ? "default" : "pointer",
            background: "linear-gradient(135deg,#5aa0e0,#3d7ec0)", color: "#fff", fontWeight: 900, fontSize: 13,
            boxShadow: "0 4px 16px rgba(61,126,192,0.5), inset 0 1px 0 rgba(255,255,255,0.4)",
            display: "flex", alignItems: "center", gap: 6, animation: "mc-invite 1.8s ease-in-out infinite",
          }}>
            <span style={{ fontSize: 15 }}>⛏️</span> マイクラへ放つ ▶
          </button>
        )}

        {/* さりげない演出：光るコードが流れて、そのまま空へ昇って消える */}
        {reveal && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 30, pointerEvents: "none",
            background: "rgba(6,14,10,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
            animation: "reveal-fade 0.6s ease-out",
          }}>
            <div style={{
              fontFamily: "monospace", fontSize: 13.5, lineHeight: 1.85, color: "#c2f7e0",
              textShadow: "0 0 12px rgba(95,224,184,0.6)",
              animation: shown >= reveal.length ? "code-ascend 1.6s ease-in forwards" : undefined,
            }}>
              {reveal.slice(0, shown).map((ln, i) => (
                <div key={i} style={{ whiteSpace: "pre", opacity: ln.trim().startsWith("//") ? 0.6 : 1, animation: "code-line-in 0.3s ease-out" }}>{ln || " "}</div>
              ))}
              {shown < reveal.length && <span style={{ color: "#5fe0b8" }}>▋</span>}
            </div>
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
                              display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 9px", borderRadius: 9, border: "none", cursor: "pointer",
                              color: "#fff", fontWeight: 800, fontSize: 11.5, background: `linear-gradient(135deg, ${cs.glow}, ${cs.color})`,
                              boxShadow: `0 0 0 1px rgba(255,255,255,0.25) inset`, textShadow: "0 1px 1px rgba(0,0,0,0.3)",
                            }}>
                              <ItemGlyph type={it.type} size={14} />{it.label}{it.needsText && <span style={{ fontSize: 9, opacity: 0.85 }}>✎</span>}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : spawn.item ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 240 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#fff", display: "inline-flex", alignItems: "center", gap: 5, background: CAT_STYLE[spawn.item.cat].color, padding: "5px 9px", borderRadius: 8, boxShadow: `0 0 10px ${CAT_STYLE[spawn.item.cat].glow}`, whiteSpace: "nowrap" }}>
                    <ItemGlyph type={spawn.item.type} size={14} />{spawn.item.label}
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
        <div style={{ fontSize: isHub ? 12 : 11, fontWeight: 900, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}>
          <ItemGlyph type={fr.item.type} size={isHub ? 16 : 14} />{fr.item.label}
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

// 組んだ実 → "あなたが書いた事になる"コード（Java/GROVE 風・演出用の本物っぽい見せ方）
const TRIGGER_JAVA: Record<string, string> = { on_join: "onPlayerJoin", on_break: "onBlockBreak", on_chat: "onPlayerChat" };
function fruitsToCode(hub: Fruit, spokes: Fruit[]): string[] {
  const ev = TRIGGER_JAVA[hub.item.type] || "onEvent";
  const lines: string[] = [];
  lines.push("// ⚡ あなたが創った MOD — CUBICENGINE GROVE");
  lines.push("@SubscribeEvent");
  lines.push(`public void ${ev}(Player player) {`);
  if (hub.item.type === "on_chat" && hub.text) lines.push(`    if (!message.equals("${hub.text}")) return;`);
  if (spokes.length === 0) lines.push("    // 「すること」を足してみよう");
  for (const s of spokes) lines.push("    " + actionToJava(s));
  lines.push("}");
  return lines;
}
function actionToJava(f: Fruit): string {
  const t = f.text.trim();
  switch (f.item.type) {
    case "say":    return `player.sendMessage("${t || "こんにちは！"}");`;
    case "give":   return `player.give(new ItemStack("${t || "diamond"}"));`;
    case "effect": return `player.addEffect(Effects.JUMP_BOOST, 200);`;
    case "if":     return `if (world.isNight()) { /* ${t || "じょうけん"} */ }`;
    case "repeat": return `for (int i = 0; i < ${parseInt(t) || 3}; i++) { /* くりかえす */ }`;
    case "number": return `int value = ${parseInt(t) || 0};`;
    default:       return `// ${f.item.label}`;
  }
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
  @keyframes reveal-fade { 0%{opacity:0} 100%{opacity:1} }
  @keyframes code-line-in { 0%{opacity:0;transform:translateX(-6px)} 100%{opacity:1;transform:translateX(0)} }
  @keyframes mote { 0%,100%{opacity:0.18;transform:translateY(0)} 50%{opacity:0.85;transform:translateY(-14px)} }
  @keyframes code-ascend { 0%{transform:translateY(0);opacity:1} 100%{transform:translateY(-100px);opacity:0;filter:blur(3px)} }
`;
