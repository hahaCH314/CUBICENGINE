"use client";

/* ══════════════════════════════════════════════════════════
   カードラボ — 「条件シール」方式の検証用プロトタイプ

   狙い: カードゲームに「カードの中に入るカード」という概念は無い。
   だから入れ子(co_if の innerId/thenId/elseId)は子どもの持っている
   カードの常識と噛み合わない。条件を “動きのカードに貼るシール” に
   すると、差込口も入れ子もアームも全部要らなくなる — その検証。

   ここで消える想定のもの:
     - もしも(inner) / そうなら(then) / ちがうなら(else) の差込口
     - 18px の接続ポート
     - co_and / co_or / co_not の3枚（下の「複数貼り＝かつ」「めくる＝〜じゃない」に吸収）

   ※本番(app/editor)には一切影響しない独立ページ。
   ══════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import * as LucideIcons from "lucide-react";
import { TEMPLATES } from "../../../data/templates";
import { CAT } from "../../../data/categories";

/* ── シールの定義 ───────────────────────────────────────────
   band: カードに貼られたときの短い文言。「〜か」という確認の言い方ではなく
   「スニーク中」と状態そのものを書く（カードに印刷される文字だから短く）。 */
type StickerDef = {
  type: string;
  emoji: string;
  band: (v: string) => string;
  negBand: (v: string) => string;
  field?: { label: string; value: string };
  code: (v: string, neg: boolean) => string;
};

const STICKERS: StickerDef[] = [
  {
    type: "co_sneak", emoji: "EyeOff",
    band: () => "スニーク中", negBand: () => "スニークしてない",
    code: (_v, n) => `${n ? "!" : ""}p.isSneaking`,
  },
  {
    type: "co_night", emoji: "Moon",
    band: () => "夜のとき", negBand: () => "夜じゃないとき",
    code: (_v, n) => `${n ? "!" : ""}world.isNight()`,
  },
  {
    type: "co_rain", emoji: "CloudRain",
    band: () => "雨のとき", negBand: () => "雨じゃないとき",
    code: (_v, n) => `${n ? "!" : ""}world.isRaining()`,
  },
  {
    type: "co_sprint", emoji: "Footprints",
    band: () => "ダッシュ中", negBand: () => "ダッシュしてない",
    code: (_v, n) => `${n ? "!" : ""}p.isSprinting`,
  },
  {
    type: "co_water", emoji: "Droplets",
    band: () => "水の中", negBand: () => "水の中じゃない",
    code: (_v, n) => `${n ? "!" : ""}p.isInWater`,
  },
  {
    type: "co_hp", emoji: "HeartPulse", field: { label: "HP", value: "10" },
    band: v => `HPが${v}以下`, negBand: v => `HPが${v}より多い`,
    code: (v, n) => `p.health ${n ? ">" : "<="} ${v || 0}`,
  },
  {
    type: "co_chance", emoji: "Dices", field: { label: "確率%", value: "50" },
    band: v => `${v}%のとき`, negBand: v => `${v}%を外したとき`,
    code: (v, n) => `${n ? "!" : ""}(Math.random() < ${(Number(v) || 0) / 100})`,
  },
  {
    type: "co_item", emoji: "Search", field: { label: "アイテム", value: "diamond" },
    band: v => `${v}を持ってる`, negBand: v => `${v}を持ってない`,
    code: (v, n) => `${n ? "!" : ""}p.has("${v}")`,
  },
];

const stickerOf = (type: string) => STICKERS.find(s => s.type === type)!;
const tmplOf = (type: string) => TEMPLATES.find(t => t.type === type);

/** カードに貼られた1枚のシール */
type Stuck = { uid: string; type: string; value: string; neg: boolean };
/** 盤面のカード1枚 */
type LabCard = { uid: string; type: string; stickers: Stuck[] };

const INITIAL: LabCard[] = [
  { uid: "c1", type: "ac_give", stickers: [] },
  { uid: "c2", type: "ac_msg", stickers: [] },
  { uid: "c3", type: "ac_sound", stickers: [] },
];

let seq = 0;
const uid = () => `s${++seq}_${Date.now().toString(36)}`;

function Icon({ name, size = 18, color }: { name: string; size?: number; color?: string }) {
  const C = (LucideIcons as unknown as Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>>)[name]
    ?? LucideIcons.HelpCircle;
  return <C size={size} color={color} strokeWidth={2.4} />;
}

export default function CardLab() {
  const [cards, setCards] = useState<LabCard[]>(INITIAL);
  const [drag, setDrag] = useState<{ type: string; x: number; y: number } | null>(null);
  const [landed, setLanded] = useState<string | null>(null);   // 貼れた瞬間のカード（演出用）
  const [hover, setHover] = useState<string | null>(null);     // ドラッグ中に狙っているカード
  const dragRef = useRef<{ type: string } | null>(null);

  // ── シールのドラッグ＆ドロップ ──
  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      setDrag(d => (d ? { ...d, x: e.clientX, y: e.clientY } : d));
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      setHover(el?.closest<HTMLElement>("[data-card]")?.dataset.card ?? null);
    };
    const up = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const cardUid = el?.closest<HTMLElement>("[data-card]")?.dataset.card;
      const type = dragRef.current?.type;
      if (cardUid && type) {
        setCards(prev => prev.map(c => {
          if (c.uid !== cardUid) return c;
          // 同じ種類のシールは2枚貼らない（「スニーク中 かつ スニーク中」は無意味）
          if (c.stickers.some(s => s.type === type)) return c;
          const def = stickerOf(type);
          return { ...c, stickers: [...c.stickers, { uid: uid(), type, value: def.field?.value ?? "", neg: false }] };
        }));
        setLanded(cardUid);
        setTimeout(() => setLanded(null), 500);
      }
      dragRef.current = null;
      setDrag(null);
      setHover(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [drag]);

  const startDrag = (type: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    dragRef.current = { type };
    setDrag({ type, x: e.clientX, y: e.clientY });
  };

  const peel = (cardUid: string, sUid: string) =>
    setCards(prev => prev.map(c => c.uid === cardUid ? { ...c, stickers: c.stickers.filter(s => s.uid !== sUid) } : c));

  const flip = (cardUid: string, sUid: string) =>
    setCards(prev => prev.map(c => c.uid === cardUid
      ? { ...c, stickers: c.stickers.map(s => s.uid === sUid ? { ...s, neg: !s.neg } : s) } : c));

  const setVal = (cardUid: string, sUid: string, value: string) =>
    setCards(prev => prev.map(c => c.uid === cardUid
      ? { ...c, stickers: c.stickers.map(s => s.uid === sUid ? { ...s, value } : s) } : c));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <style>{KEYFRAMES}</style>

      {/* ── シール置き場 ── */}
      <section style={panel}>
        <h2 style={h2}>🏷️ 条件シール<span style={hint}>カードにドラッグして貼る</span></h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {STICKERS.map(s => {
            const t = tmplOf(s.type);
            return (
              <div key={s.type} onPointerDown={startDrag(s.type)} style={stickerChip}>
                <Icon name={s.emoji} size={15} color="#9d174d" />
                <span>{s.band(s.field?.value ?? "")}</span>
                {t && <span style={{ fontSize: 9, color: "#be185d99" }}>{t.label}</span>}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 盤面 ── */}
      <section style={panel}>
        <h2 style={h2}>🃏 動きのカード<span style={hint}>シールを貼ると「そのときだけ動く」カードになる</span></h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "flex-start" }}>
          {cards.map(c => {
            const t = tmplOf(c.type);
            const cat = CAT[t?.category ?? "action"];
            const isTarget = hover === c.uid;
            const kira = c.stickers.length > 0;
            return (
              <div key={c.uid} data-card={c.uid} style={{
                position: "relative", width: 188, borderRadius: 16,
                background: "#fff", border: `3px solid ${isTarget ? "#ec4899" : "#1e293b"}`,
                boxShadow: isTarget
                  ? "0 0 0 4px rgba(236,72,153,0.35), 0 10px 22px rgba(0,0,0,0.3)"
                  : "0 6px 16px rgba(0,0,0,0.28)",
                transform: isTarget ? "translateY(-3px) scale(1.02)" : "none",
                transition: "all 0.15s cubic-bezier(0.2,0.9,0.3,1)",
                animation: landed === c.uid ? "cl-land 0.5s cubic-bezier(0.2,1.4,0.35,1)" : undefined,
                overflow: "hidden",
              }}>
                {/* 貼られたシール＝条件の帯。上から順に「かつ」で繋がる */}
                {c.stickers.map((s, i) => {
                  const def = stickerOf(s.type);
                  return (
                    <div key={s.uid}>
                      {i > 0 && <div style={andRow}>かつ</div>}
                      <div style={{ ...band, background: s.neg ? "#fb923c" : "#ec4899" }}>
                        <Icon name={def.emoji} size={13} color="#fff" />
                        <button onClick={() => flip(c.uid, s.uid)} title="めくる（〜じゃないとき に変える）" style={bandText}>
                          {(s.neg ? def.negBand : def.band)(s.value)}
                        </button>
                        {def.field && (
                          <input
                            value={s.value}
                            onChange={e => setVal(c.uid, s.uid, e.target.value)}
                            style={bandInput}
                          />
                        )}
                        <button onClick={() => peel(c.uid, s.uid)} title="はがす" style={peelBtn}>✕</button>
                      </div>
                    </div>
                  );
                })}

                {/* カード本体 */}
                <div style={{ padding: "14px 12px 12px", position: "relative" }}>
                  {kira && <div style={holo} />}
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, margin: "0 auto 8px",
                    background: cat.bg, border: "2.5px solid #1e293b",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <Icon name={t?.emoji ?? "Wand2"} size={22} color="#fff" />
                  </div>
                  <div style={{ textAlign: "center", fontWeight: 900, fontSize: 13, color: "#1e293b" }}>{t?.label}</div>
                  <div style={{ textAlign: "center", fontSize: 10, color: "#64748b", marginTop: 3, lineHeight: 1.4 }}>
                    {t?.sublabel}
                  </div>
                  {c.stickers.length === 0 && (
                    <div style={emptyHint}>いつでも動く</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 出力の確認 ── */}
      <section style={panel}>
        <h2 style={h2}>💻 これで出るコード<span style={hint}>入れ子が無くても if は作れている</span></h2>
        <pre style={pre}>{cards.map(c => {
          const t = tmplOf(c.type);
          const body = `  ${c.type}(); // ${t?.label ?? ""}`;
          if (!c.stickers.length) return `${body.trim()}\n`;
          const cond = c.stickers.map(s => stickerOf(s.type).code(s.value, s.neg)).join(" && ");
          return `if (${cond}) {\n${body}\n}\n`;
        }).join("\n")}</pre>
      </section>

      {/* ドラッグ中の分身 */}
      {drag && (
        <div style={{
          position: "fixed", left: drag.x, top: drag.y, transform: "translate(-50%,-50%) rotate(-6deg) scale(1.1)",
          pointerEvents: "none", zIndex: 9999, ...stickerChip,
          boxShadow: "0 10px 24px rgba(0,0,0,0.4)",
        }}>
          <Icon name={stickerOf(drag.type).emoji} size={15} color="#9d174d" />
          <span>{stickerOf(drag.type).band(stickerOf(drag.type).field?.value ?? "")}</span>
        </div>
      )}
    </div>
  );
}

/* ── スタイル ───────────────────────────────────────────── */
const panel: React.CSSProperties = {
  background: "#11151c", border: "1px solid #1f2937", borderRadius: 14, padding: "14px 16px 16px",
};
const h2: React.CSSProperties = {
  fontSize: 13, fontWeight: 900, color: "#e2e8f0", marginBottom: 11,
  display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap",
};
const hint: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#7c8798" };
const stickerChip: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "7px 11px", borderRadius: 999, cursor: "grab", userSelect: "none", touchAction: "none",
  background: "linear-gradient(135deg,#fce7f3,#fbcfe8)", border: "2.5px solid #ec4899",
  color: "#9d174d", fontSize: 12, fontWeight: 900,
  boxShadow: "0 3px 0 #db2777",
};
const band: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 5, padding: "5px 7px",
  color: "#fff", fontSize: 11, fontWeight: 900,
};
const bandText: React.CSSProperties = {
  flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer",
  color: "#fff", fontSize: 11, fontWeight: 900, padding: 0,
};
const bandInput: React.CSSProperties = {
  width: 52, borderRadius: 6, border: "none", padding: "2px 5px",
  fontSize: 10, fontWeight: 900, color: "#9d174d", background: "rgba(255,255,255,0.9)",
};
const peelBtn: React.CSSProperties = {
  flexShrink: 0, width: 18, height: 18, borderRadius: "50%", cursor: "pointer",
  background: "rgba(0,0,0,0.25)", border: "none", color: "#fff", fontSize: 10, fontWeight: 900,
};
const andRow: React.CSSProperties = {
  textAlign: "center", fontSize: 9, fontWeight: 900, color: "#be185d",
  background: "#fce7f3", padding: "1px 0",
};
const emptyHint: React.CSSProperties = {
  marginTop: 9, textAlign: "center", fontSize: 10, fontWeight: 800, color: "#94a3b8",
  border: "1.5px dashed #cbd5e1", borderRadius: 8, padding: "4px 0",
};
const holo: React.CSSProperties = {
  position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.45,
  background: "linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.9) 50%, transparent 60%)",
  backgroundSize: "300% 100%", mixBlendMode: "screen",
  animation: "cl-sheen 3.2s ease-in-out infinite",
};
const pre: React.CSSProperties = {
  margin: 0, padding: 12, borderRadius: 10, background: "#0a0c10", border: "1px solid #1f2937",
  color: "#a5f3fc", fontSize: 11.5, lineHeight: 1.7, overflowX: "auto",
  fontFamily: "var(--font-geist-mono), monospace", whiteSpace: "pre",
};

const KEYFRAMES = `
  @keyframes cl-land { 0% { transform: scale(1); } 45% { transform: scale(1.06) rotate(-1.5deg); } 100% { transform: scale(1); } }
  @keyframes cl-sheen { 0% { background-position: 140% 0; } 100% { background-position: -40% 0; } }
`;
