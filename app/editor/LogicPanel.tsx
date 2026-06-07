"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useEditorStore } from "./store";
import { McButton, McBadge } from "../_mc";

import { Category, FieldDef, CBlock, Tmpl, CalcSubCat, CatDef } from "./_types";
import { BW, BH, GAP, SNAP, BASE_ZOOM } from "./_constants";
import { CAT } from "../../data/categories";
import { TEMPLATES, CALC_SUBTABS, getCalcSubCat } from "../../data/templates";
import { ITEM_NAMES } from "../../data/itemNames";
import { blockH, getStackHeight, getDepth, getPos, getFamily, detach, attach, dist, findSnap } from "../../lib/blockGraph";
import { escStr, escId, gf, sanitizeVarName, genChain, genBlock, genExpr, genCond, genTrigger } from "../../lib/codegen";
let _uid = 6000;
const uid = () => `b${_uid++}`;

/* ══════════════════════════════════════════════════════════
   スロット定義 — 条件分岐 / 繰り返しの差込口が受け付けるカテゴリと色
   ══════════════════════════════════════════════════════════ */
const SLOT_ACCEPT: Record<string, Category[]> = {
  inner: ["ifelse", "calc", "value", "variable"],   // もしも：条件式
  then: ["action", "ifelse", "loop", "ui", "variable"],  // そうなら：動作
  else: ["action", "ifelse", "loop", "ui", "variable"],  // ちがうなら：動作
};
const SLOT_BADGE: Record<string, { icon: string; label: string; color: string }> = {
  inner: { icon: "💎", label: "値・条件", color: "#9b59b6" },
  then: { icon: "⚡", label: "動作", color: "#2ecc71" },
  else: { icon: "⚡", label: "動作", color: "#ff7f50" },
};
const SLOT_HEAD: Record<string, { glyph: string; jp: string }> = {
  inner: { glyph: "⬦", jp: "もしも" },
  then: { glyph: "✓", jp: "そうなら" },
  else: { glyph: "✗", jp: "ちがうなら" },
};

/** スロットへ対象ブロックをハメてよいか */
function slotAccepts(slot: string, blockCategory: Category): boolean {
  return SLOT_ACCEPT[slot]?.includes(blockCategory) ?? false;
}

function spawnBlock(t: Tmpl, x: number, y: number): CBlock {
  return {
    id: uid(), type: t.type, emoji: t.emoji, label: t.label, sublabel: t.sublabel,
    category: t.category, fields: t.fields.map(f => ({ ...f })),
    x, y, nextId: null, innerId: null, thenId: null, elseId: null
  };
}

function makeInitial(): CBlock[] {
  return [];
}

/* ══════════════════════════════════════════════════════════
   プリセットプロジェクト（テンプレート集）
   ══════════════════════════════════════════════════════════ */

function mkPreset(blocks: CBlock[]): CBlock[] {
  const idMap = new Map<string, string>();
  const newBlocks = blocks.map(b => {
    const newId = uid();
    idMap.set(b.id, newId);
    return { ...b, id: newId };
  });
  return newBlocks.map(b => ({
    ...b,
    nextId: b.nextId ? (idMap.get(b.nextId) ?? null) : null,
    innerId: b.innerId ? (idMap.get(b.innerId) ?? null) : null,
    thenId: b.thenId ? (idMap.get(b.thenId) ?? null) : null,
    elseId: b.elseId ? (idMap.get(b.elseId) ?? null) : null,
  }));
}

const T = (type: string) => TEMPLATES.find(t => t.type === type)!;
const sf = (b: CBlock, id: string, val: string): CBlock =>
  ({ ...b, fields: b.fields.map((f: FieldDef) => f.id === id ? { ...f, value: val } : f) });

interface PresetProject {
  name: string; emoji: string; desc: string;
  create: () => CBlock[];
}

const PRESET_PROJECTS: PresetProject[] = [
  {
    name: "ウェルカムMod", emoji: "👋", desc: "参加時に歓迎メッセージを送信",
    create: () => {
      const a = spawnBlock(T("ev_join"), 100, 600);
      let b = spawnBlock(T("ac_msg"), 100, 600 - BH - GAP);
      b = sf(sf(b, "msg", "ようこそ！🎉 Modが動いています！"), "target", "@a");
      a.nextId = b.id;
      return mkPreset([a, b]);
    },
  },
  {
    name: "HP危険警告", emoji: "🩸", desc: "HP10以下で赤いメッセージを表示",
    create: () => {
      const a = spawnBlock(T("ev_hurt"), 80, 600);
      const donut = spawnBlock(T("co_if"), 300, 600 - BH - GAP);
      const cond = spawnBlock(T("co_hp"), 80, 600 - BH - GAP);
      cond.fields = cond.fields.map(f => f.id === "threshold" ? { ...f, value: "10" } : f);
      let msg = spawnBlock(T("ac_msg"), 600, 600 - BH * 2 - GAP * 2);
      msg = sf(sf(msg, "msg", "§c§l⚠️ HPが残り少ない！回復して！"), "target", "@s");
      a.nextId = donut.id;
      donut.innerId = cond.id;
      donut.thenId = msg.id;
      return mkPreset([a, donut, cond, msg]);
    }
  }
];

/* ══════════════════════════════════════════════════════════
   サウンドシステム（Web Audio API）
   ══════════════════════════════════════════════════════════ */

function tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.25, freqEnd?: number) {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new AC() as AudioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(); osc.stop(ctx.currentTime + dur);
  } catch { /* ミュート環境では無視 */ }
}

/** ブロックが接続されたとき — カチッ（2音コード） */
function playSnapSound() {
  tone(523, 0.07, "sine", 0.22);          // C5
  setTimeout(() => tone(784, 0.05, "sine", 0.12), 10); // G5
}

/** サイドバーからブロックを追加したとき — ポワン */
function playAddSound() {
  tone(330, 0.14, "sine", 0.2, 523);      // E4 → C5 rising
}

/** ブロックを削除したとき — ポン */
function playDeleteSound() {
  tone(440, 0.11, "sawtooth", 0.18, 110); // 降下
}

/** ツールバーボタン — カチッ（極短） */
function playClickSound() { tone(1100, 0.022, "sine", 0.12); }
function playSuccessSound() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.18, "sine", 0.18), i * 75)); }
function playWireDeleteSound() { tone(600, 0.08, "sawtooth", 0.15, 200); }

function playEatSound() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx: AudioContext = new Ctx();
    const master = ctx.createGain();
    master.connect(ctx.destination);

    const osc1 = ctx.createOscillator();
    osc1.type = "sawtooth";
    osc1.frequency.setValueAtTime(600, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.18);
    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.28, ctx.currentTime);
    g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc1.connect(g1); g1.connect(master);
    osc1.start(); osc1.stop(ctx.currentTime + 0.18);

    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(320, ctx.currentTime + 0.14);
    osc2.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.45);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.22, ctx.currentTime + 0.14);
    g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc2.connect(g2); g2.connect(master);
    osc2.start(ctx.currentTime + 0.14); osc2.stop(ctx.currentTime + 0.45);
  } catch { /* 音が出ない環境は無視 */ }
}

function buildCode(blocks: CBlock[]): string {
  const roots = blocks.filter(b => {
    for (const p of blocks)
      if (p.nextId === b.id || p.innerId === b.id || p.thenId === b.id || p.elseId === b.id) return false;
    return true;
  });
  const triggers = roots.filter(b => b.category === "trigger");
  const hasUI = blocks.some(b => b.category === "ui");
  const varNames = new Set<string>();
  blocks.filter(b => b.category === "variable").forEach(b => {
    const name = b.fields.find(f => f.id === "name")?.value || "myVar";
    varNames.add(`_v_${sanitizeVarName(name)}`);
  });
  const varDecls = [...varNames].map(n => `let ${n} = 0; // 変数: ${n.replace("_v_", "")}`).join("\n");
  const header = [
    `// ============================================================`,
    `//  CUBICENGINE Studio — 自動生成コード`,
    `//  @minecraft/server 1.6.0  (実験的機能不要 / Minecraft 1.20.30+)`,
    `// ============================================================`,
    ``,
    `import { world, system } from "@minecraft/server";`,
    ...(hasUI ? [`import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";`] : []),
    ``,
    ...(varDecls ? [varDecls, ``] : []),
    `// ★ 起動確認`,
    `let _ce_ok = false;`,
    `world.afterEvents.playerJoin.subscribe((ev) => {`,
    `  if (_ce_ok) return;`,
    `  _ce_ok = true;`,
    `  const _name = ev.playerName;`,
    `  system.runTimeout(() => {`,
    `    const _p = world.getPlayers().find(p => p.name === _name);`,
    `    if (_p) _p.sendMessage("§a§l[CUBICENGINE] §r§aアドオン起動！ イベント${triggers.length}個");`,
    `    else { for (const _ap of world.getPlayers()) _ap.sendMessage("§a§l[CUBICENGINE] §r§aアドオン起動！"); }`,
    `  }, 40);`,
    `});`,
    ``,
  ].join("\n");
  if (!triggers.length) return header + "// ⚡ きっかけブロックをキャンバスにおいてください！\n";
  return header + triggers.map(t => genTrigger(t, blocks)).join("\n\n") + "\n";
}

/* ══════════════════════════════════════════════════════════
   ブロック描画コンポーネント
   ══════════════════════════════════════════════════════════ */

function ToyCubeBlock({ b, pos, selected, snapSlot, isEating, isSnapping, isAdding, isDeleting, innerBlock, blocks, onDown, onDelete, onFieldChange, onEjectInner, focusedField, setFocusedField, wireDrag, onSlotClick, isShaking, isDragging }: {
  b: CBlock; pos: { x: number; y: number }; selected: boolean; snapSlot: string | null;
  isEating?: boolean; isSnapping?: boolean; isAdding?: boolean; isDeleting?: boolean;
  innerBlock?: CBlock | null; blocks: CBlock[];
  onDown: (e: React.MouseEvent, id: string) => void;
  onDelete: (id: string) => void;
  onFieldChange: (id: string, fid: string, val: string) => void;
  onEjectInner?: (id: string) => void;
  focusedField?: { blockId: string; fieldId: string } | null;
  setFocusedField?: (val: { blockId: string; fieldId: string } | null) => void;
  wireDrag: { sourceBlockId: string; slot: string; armed: boolean; accepts: Category[] } | null;
  onSlotClick: (blockId: string, slot: string) => void;
  isShaking?: boolean;
  isDragging?: boolean;
}) {
  const cat = CAT[b.category];
  const hl = snapSlot !== null;
  const isCond = b.type === "co_if";
  const isLoop = b.type === "ct_rep";
  const thenH = isCond || isLoop ? (b.thenId ? getStackHeight(b.thenId, blocks) : 40) : 0;
  const elseH = isCond ? (b.elseId ? getStackHeight(b.elseId, blocks) : 40) : 0;
  const depth = getDepth(b.id, blocks);

  const isAcceptable = wireDrag && wireDrag.armed && wireDrag.accepts.includes(b.category) && wireDrag.sourceBlockId !== b.id;
  const isDimmed = wireDrag && wireDrag.armed && !isAcceptable && wireDrag.sourceBlockId !== b.id;
  const badgeColor = wireDrag ? SLOT_BADGE[wireDrag.slot]?.color : "#ffffff";

  const anim = isEating ? "swallow 0.55s ease-in forwards"
    : isDeleting ? "blockDelete 0.6s cubic-bezier(0.36,0.07,0.19,0.97) forwards"
      : isAdding ? "blockAdd 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards"
        : isSnapping ? "blockSnap 0.12s ease-out"
          : isShaking ? "blockShake 0.3s ease-in-out" // Error shake
            : isAcceptable ? "wireTargetGlow 1.2s ease-in-out infinite"
              : isDragging ? "blockDragHover 0.55s ease-in-out infinite"
                : "none";

  let contentW = b.label.length * 16;
  b.fields.forEach(f => {
    let d = f.value || "";
    if (d.startsWith("minecraft:")) {
      const item = ITEM_NAMES[d];
      if (item) d = `${item.icon} ${item.jp}`;
    }
    const flen = f.label.length + d.length;
    contentW = Math.max(contentW, flen * 15 + 60);
  });
  if (b.type === "co_if" || b.type === "ct_rep") {
    const slots = ["inner", "then", "else"] as const;
    slots.forEach(slot => {
      const targetId = slot === "inner" ? b.innerId : slot === "then" ? b.thenId : b.elseId;
      if (targetId) {
        const tb = blocks.find(x => x.id === targetId);
        // 2行スロット(見出し上/値下)。値は単独行なので幅は控えめでOK
        if (tb) contentW = Math.max(contentW, tb.label.length * 12 + 100);
      } else {
        // 空スロット: 2行目の受け入れバッジ([💎条件/値])が1行で収まる幅
        contentW = Math.max(contentW, 140);
      }
    });
  }
  const w = Math.max(BW, contentW + 40);
  const h = blockH(b);
  const R = 8;

  const innerBorder = "inset 4px 4px 0 rgba(255,255,255,0.22), inset -4px -4px 0 rgba(0,0,0,0.15)";

  const renderSlotButton = (slotKey: "inner" | "then" | "else") => {
    const badge = SLOT_BADGE[slotKey];
    const head = SLOT_HEAD[slotKey];
    const targetId = slotKey === "inner" ? b.innerId : slotKey === "then" ? b.thenId : b.elseId;
    const targetBlock = targetId ? blocks.find(x => x.id === targetId) : null;
    const isArmedThis = wireDrag && wireDrag.sourceBlockId === b.id && wireDrag.slot === slotKey && wireDrag.armed;

    const acceptBadge = slotKey === "inner" ? "[💎条件/値]" : "[⚡動作]";

    return (
      <button
        key={slotKey}
        className={isArmedThis ? "slot-btn slot-btn--armed" : "slot-btn"}
        onMouseDown={e => {
          e.stopPropagation();
          onSlotClick(b.id, slotKey);
        }}
        style={{
          // 改行2行レイアウト: 見出し(上) / 値・受け入れバッジ(下・全幅)。横に詰めず縦で見せる＝見切れ防止
          display: "flex", flexDirection: "column", alignItems: "stretch", gap: 3,
          width: "100%", minHeight: 42, padding: "5px 8px", marginTop: 4,
          background: badge.color,
          border: isArmedThis ? "2px solid #ffffff" : `2px solid rgba(0,0,0,0.28)`,
          borderRadius: 7, color: "#ffffff", fontSize: 13, fontWeight: 900,
          cursor: "pointer",
          // 凸ボタン: 上に光・下に影＋足元の段差(0 3px 0)で「押せる」立体感
          boxShadow: isArmedThis
            ? `0 0 12px ${badge.color}, inset 0 2px 0 rgba(255,255,255,0.45)`
            : "inset 0 2px 0 rgba(255,255,255,0.35), inset 0 -3px 0 rgba(0,0,0,0.28), 0 3px 0 rgba(0,0,0,0.3), 0 4px 5px rgba(0,0,0,0.25)",
          animation: isArmedThis ? "slotPulse 1.0s ease-in-out infinite" : "none",
          fontFamily: "'M PLUS Rounded 1c', 'Nunito', sans-serif",
          textShadow: "0px -1px 1px rgba(0,0,0,0.55), 0px 1px 1px rgba(255,255,255,0.2)",
          transition: "transform 0.08s ease, box-shadow 0.08s ease, filter 0.1s ease",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 5, lineHeight: 1 }}>
          <span style={{ fontSize: 14 }}>{badge.icon}</span>
          <span>{head.jp}</span>
        </span>

        {targetBlock ? (
          <span style={{
            width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            fontSize: 12, background: "rgba(0,0,0,0.55)", padding: "3px 7px", borderRadius: 5, color: "#fff",
            textShadow: "none", textAlign: "left", lineHeight: 1.25, boxShadow: "inset 0 1px 2px rgba(0,0,0,0.35)"
          }}>
            {targetBlock.label}
          </span>
        ) : (
          <span style={{
            width: "100%", fontSize: 12, color: "rgba(255,255,255,0.85)",
            background: "rgba(0,0,0,0.28)",
            padding: "3px 7px", borderRadius: 5,
            textShadow: "none", textAlign: "left", lineHeight: 1.25, whiteSpace: "nowrap",
            overflow: "hidden", textOverflow: "ellipsis", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.3)"
          }}>
            {acceptBadge}
          </span>
        )}
      </button>
    );
  };

  return (
    <div onMouseDown={e => onDown(e, b.id)} style={{
      position: "absolute", left: pos.x, top: pos.y,
      width: w, height: h,
      cursor: isDragging ? "grabbing" : "grab", userSelect: "none",
      animation: anim,
      transformOrigin: isAdding ? "bottom center" : "center center",
      zIndex: isDragging ? 9999 : (selected ? 1000 : 20) + depth * 10,
      opacity: isDimmed ? 0.35 : 1.0,
      filter: isDimmed ? "grayscale(0.5)" : isDragging ? "brightness(1.08) drop-shadow(0 12px 24px rgba(0,0,0,0.45)) drop-shadow(0 4px 8px rgba(0,0,0,0.3))" : "none",
      transition: "opacity 0.25s ease, filter 0.15s, transform 0.1s",
    }}>
      <div style={{
        position: "absolute",
        left: 0,
        top: -21,
        width: w,
        height: 21,
        background: `linear-gradient(to right, ${cat.top}, ${cat.top})`,
        borderRadius: `${R}px ${R}px 0 0`,
        transform: "skewX(-45deg)",
        transformOrigin: "bottom left",
        borderTop: `4px solid ${cat.border}`,
        borderLeft: `4px solid ${cat.border}`,
        borderRight: `2px solid rgba(0,0,0,0.08)`,
        borderBottom: `2px solid rgba(0,0,0,0.08)`,
        boxSizing: "border-box",
        zIndex: 1,
      }} />
      <div style={{
        position: "absolute",
        left: w,
        top: 0,
        width: 21,
        height: h,
        background: `linear-gradient(to bottom, ${cat.side}, ${cat.side})`,
        borderRadius: `0 ${R}px ${R}px 0`,
        transform: "skewY(-45deg)",
        transformOrigin: "top left",
        borderTop: `2px solid rgba(0,0,0,0.08)`,
        borderRight: `4px solid ${cat.border}`,
        borderBottom: `4px solid ${cat.border}`,
        borderLeft: `2px solid rgba(0,0,0,0.08)`,
        boxSizing: "border-box",
        zIndex: 1,
      }} />
      <div style={{
        position: "absolute",
        left: 0, top: 0, width: w, height: h,
        background: `linear-gradient(135deg, ${cat.top}, ${cat.bg})`,
        // 融合: 正面は独立カードに見せない。継ぎ目側(上・右)の角丸と縁を消す。
        // 折れ目(立体の角)は上面のborderBottom/横面のborderLeftが1本だけ担う(消さない)。
        borderRadius: `${R}px 0 0 ${R}px`,
        borderLeft: `4px solid ${cat.border}`,
        borderBottom: `4px solid ${cat.border}`,
        borderRight: `2px solid transparent`,
        borderTop: `2px solid transparent`,
        boxShadow: selected
          ? `${innerBorder}, 0 0 0 3px #ffffff, 0 0 0 7px ${cat.border}`
          : hl
            ? `${innerBorder}, 0 0 0 4px #ffffff`
            : isAcceptable
              ? `${innerBorder}, 0 0 0 4px #ffffff, 0 0 16px ${badgeColor}`
              : `${innerBorder}, 4px 4px 0px rgba(0,0,0,0.15)`,
        transition: "box-shadow 0.15s, transform 0.1s",
        display: "flex", flexDirection: "column", padding: "4px 14px", boxSizing: "border-box",
        overflow: "hidden",
        zIndex: 2,
        justifyContent: "center",
      }}>
        <div style={{
          display: "flex", justifyContent: "center", alignItems: "center",
          marginTop: (isCond || isLoop) ? 12 : 2,
          paddingRight: 18, // ✕ボタン(14px+余白)の展限回避
        }}>
          <div style={{
            fontSize: b.label.length > 10 ? 9 : b.label.length > 8 ? 10 : b.label.length > 6 ? 12 : 14,
            fontWeight: 900,
            color: cat.text,
            lineHeight: 1.1,
            textAlign: "center",
            width: "100%",
            textShadow: cat.text === "#ffffff"
              ? "1px 1px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000, -1px -1px 0 #000"
              : "1px 1px 0 rgba(255,255,255,0.7), -1px 1px 0 rgba(255,255,255,0.7), 1px -1px 0 rgba(255,255,255,0.7), -1px -1px 0 rgba(255,255,255,0.7)",
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
          }}>
            {b.label}
          </div>
        </div>
        <div style={{
          fontSize: 11,
          color: cat.text === "#ffffff" ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.7)",
          textAlign: "center",
          textShadow: cat.text === "#ffffff"
            ? "1px 1px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000, -1px -1px 0 #000"
            : "1px 1px 0 rgba(255,255,255,0.5), -1px 1px 0 rgba(255,255,255,0.5), 1px -1px 0 rgba(255,255,255,0.5), -1px -1px 0 rgba(255,255,255,0.5)",
          fontWeight: 800, marginTop: 4, letterSpacing: "0.04em"
        }}>
          {cat.icon} {cat.label}
        </div>
        {isCond && (
          <div style={{ marginTop: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
            {renderSlotButton("inner")}
            {renderSlotButton("then")}
            {renderSlotButton("else")}
          </div>
        )}
        {isLoop && (
          <div style={{ marginTop: 2 }}>
            {renderSlotButton("then")}
          </div>
        )}
        {!isCond && b.fields.length > 0 && (
          <div style={{
            marginTop: 6, display: "flex", flexDirection: "column", gap: 4,
            background: "rgba(0,0,0,0.12)", padding: "6px", borderRadius: 8,
            border: `2px solid ${cat.border}`, boxShadow: "inset 2.5px 2.5px 0 rgba(0,0,0,0.18)"
          }}>
            {b.fields.map(f => {
              const isFocused = focusedField?.blockId === b.id && focusedField?.fieldId === f.id;
              return (
                <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 6, position: "relative", minHeight: 32 }}>
                  <span style={{
                    fontSize: 12, color: cat.text, fontWeight: 900, minWidth: 32,
                    textShadow: cat.text === "#ffffff"
                      ? "1px 1px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000, -1px -1px 0 #000"
                      : "none"
                  }}>{f.label}</span>
                  {f.options ? (
                    <select value={f.value} onChange={e => onFieldChange(b.id, f.id, e.target.value)}
                      onMouseDown={e => e.stopPropagation()}
                      onFocus={() => setFocusedField?.({ blockId: b.id, fieldId: f.id })}
                      onBlur={() => setFocusedField?.(null)}
                      style={{
                        flex: isFocused ? "none" : 1,
                        position: isFocused ? "absolute" : "relative",
                        left: isFocused ? 38 : "auto",
                        width: isFocused ? 220 : "100%",
                        zIndex: isFocused ? 999 : 1,
                        transition: "width 0.25s ease, z-index 0.25s",
                        fontSize: 15, background: "#2c2c2c", border: `2px solid #57606f`, borderRadius: 6, color: "#fff", padding: "5px 6px", outline: "none", fontWeight: 800,
                        boxShadow: "inset 1.5px 1.5px 0 rgba(0,0,0,0.5)", fontFamily: "inherit"
                      }}>
                      {f.options.map(o => {
                        let disp = o;
                        if (disp.startsWith("minecraft:")) {
                          const n = disp.replace("minecraft:", "").replace(/_/g, " ");
                          disp = (n.includes("sword") || n.includes("pickaxe") || n.includes("axe") || n.includes("shovel") || n.includes("hoe")) ? `⚔️ ${n}`
                            : (n.includes("helmet") || n.includes("chestplate") || n.includes("leggings") || n.includes("boots")) ? `🛡️ ${n}`
                              : (n.includes("stone") || n.includes("block") || n.includes("planks") || n.includes("log") || n.includes("dirt")) ? `🧱 ${n}`
                                : `💎 ${n}`;
                        }
                        return <option key={o} value={o}>{disp}</option>;
                      })}
                    </select>
                  ) : (() => {
                    let disp = f.value || "";
                    if (!isFocused && disp.startsWith("minecraft:")) {
                      const item = ITEM_NAMES[disp];
                      if (item) disp = `${item.icon} ${item.jp}`;
                    }
                    return (
                      <input value={isFocused ? (f.value || "") : disp} onChange={e => onFieldChange(b.id, f.id, e.target.value)}
                        onMouseDown={e => e.stopPropagation()}
                        onFocus={() => setFocusedField?.({ blockId: b.id, fieldId: f.id })}
                        onBlur={() => setFocusedField?.(null)}
                        style={{
                          flex: isFocused ? "none" : 1,
                          position: isFocused ? "absolute" : "relative",
                          left: isFocused ? 38 : "auto",
                          width: isFocused ? 220 : "100%",
                          zIndex: isFocused ? 999 : 1,
                          transition: "width 0.25s ease, z-index 0.25s",
                          fontSize: 15, background: "#2c2c2c", border: `2px solid #57606f`, borderRadius: 6, color: "#fff", padding: "5px 8px", outline: "none", fontWeight: 800,
                          boxShadow: "inset 1.5px 1.5px 0 rgba(0,0,0,0.5)", fontFamily: "inherit"
                        }} />
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!isEating && (
        <button
          onMouseDown={e => { e.stopPropagation(); onDelete(b.id); }}
          title="削除"
          style={{
            position: "absolute", top: 4, right: 6,
            width: 20, height: 20, borderRadius: 4,
            background: "rgba(0,0,0,0.25)",
            border: `1px solid ${cat.border}`,
            color: cat.text, fontSize: 12, fontWeight: 900,
            cursor: "pointer", zIndex: 30, display: "flex", alignItems: "center", justifyContent: "center",
            opacity: 0.5,
            padding: 0,
            lineHeight: 1,
            transition: "opacity 0.15s, transform 0.1s",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.opacity = "1";
            e.currentTarget.style.transform = "scale(1.05)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.opacity = "0.5";
            e.currentTarget.style.transform = "scale(1)";
          }}
        >✕</button>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   3Dトイスペース背景（床と壁の奥行き空間）
   ══════════════════════════════════════════════════════════ */

function ToyWall(_props: { pan: { x: number; y: number }; zoom: number }) {
  // シンプルな縦方向の "奥行き" 表現のみ。
  // - 上端：奥から差し込む光（やや明るい）
  // - 下端：床に向かって暗くなる
  // 四隅は内側シャドウで軽くビネット。
  return (
    <div style={{
      position: "absolute",
      inset: 0,
      overflow: "hidden",
      zIndex: 0,
      pointerEvents: "none",
      background: "linear-gradient(to bottom, #2a262d 0%, #1d1c20 50%, #14131a 100%)",
      boxShadow: "inset 0 0 180px rgba(0,0,0,0.55)",
    }} />
  );
}

/**
 * "床" のミニマル版 — screen 座標で画面最下端に固定された薄いネオンライン1本だけ。
 * 旧版（24000×4000 の content 座標巨大ブロック + ドット3層 + 深い影）は撤去し、
 * 縦方向のスペース消費を 100px → 3px に圧縮（ノートPC/タブレット対応）。
 * "床" の演出は最小限、ブロックがここに着地することだけを示す。
 */
function ToyFloor() {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 1,
        pointerEvents: "none",
        background: "rgba(255,255,255,0.05)",
      }}
    />
  );
}

/* ══════════════════════════════════════════════════════════
   インテリアテーマ — Phase 1: 背景レイヤーのみ
   ──────────────────────────────────────────────────────────
   E. WorkshopBackdrop : レトロ電器店（屋内・夜・真鍮＋暖色）
   S. SatoyamaBackdrop : 里山（屋外・昼・遠山＋田んぼ＋雑木林）
   ══════════════════════════════════════════════════════════ */

function WorkshopBackdrop() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      {/* 地下っぽい暗い暖色グラデーション */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(circle at center 30%, #2a2015 0%, #0d0a08 100%)",
      }} />
      {/* 吊りランプの暖かいグロー */}
      <div style={{
        position: "absolute", top: -50, left: "50%", transform: "translateX(-50%)", width: 400, height: 300,
        background: "radial-gradient(ellipse at center top, rgba(255,180,100,0.12) 0%, transparent 70%)",
        filter: "blur(15px)",
      }} />
      {/* 極薄の木目テクスチャ */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.01) 0px, rgba(255,255,255,0.01) 1px, transparent 1px, transparent 16px)",
        opacity: 0.15,
      }} />
      {/* 中央ビネット */}
      <div style={{
        position: "absolute", inset: 0,
        boxShadow: "inset 0 0 150px rgba(0,0,0,0.85)",
      }} />
    </div>
  );
}

function CyberBackdrop() {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      {/* 黒紺ベース */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(circle at center, #0a1120 0%, #03060d 100%)",
      }} />
      {/* ホログラム1色の細いグリッド */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(rgba(6,182,212,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,0.08) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
        opacity: 0.4,
      }} />
      {/* シアンの柔らかいグロー */}
      <div style={{
        position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", width: 600, height: 600,
        background: "radial-gradient(circle, rgba(6,182,212,0.04) 0%, transparent 60%)",
        filter: "blur(40px)",
      }} />
      {/* 中央ビネット */}
      <div style={{
        position: "absolute", inset: 0,
        boxShadow: "inset 0 0 180px rgba(0,0,0,0.9)",
      }} />
    </div>
  );
}

function ThemeBackdrop({ theme }: { theme: "workshop" | "cyber" }) {
  return theme === "cyber" ? <CyberBackdrop /> : <WorkshopBackdrop />;
}

/* ══════════════════════════════════════════════════════════
   接続コネクター
   ══════════════════════════════════════════════════════════ */

function Connector({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <div style={{
      position: "absolute",
      left: x - BW / 2,
      top: y - 2,
      width: BW,
      height: 3,
      background: `linear-gradient(90deg, transparent 0%, ${color} 20%, rgba(255,255,255,0.7) 50%, ${color} 80%, transparent 100%)`,
      boxShadow: `0 0 6px ${color}, 0 0 2px rgba(255,255,255,0.6)`,
      zIndex: 10,
      pointerEvents: "none",
    }} />
  );
}

/* ══════════════════════════════════════════════════════════
   スナップインジケーター
   ══════════════════════════════════════════════════════════ */

function SnapIndicator({ x, y, color, zoom, slot }: { x: number; y: number; color: string; zoom: number; slot: string }) {
  const width = BW * zoom;
  const height = BH * zoom;
  const R = 8 * zoom;

  // 接続スロットごとに矢印 + 短い説明
  const labelMap: Record<string, string> = {
    next: "▼ ここに積む",
    then: "▼ そうなら",
    else: "▶ ちがうなら",
    inner: "◀ ここに入れる",
  };
  const label = labelMap[slot] ?? "▼ ここに接続";

  return (
    <>
      {/* メインのスナップゾーン — 二重枠 + 半透明フィル + パルス */}
      <div style={{
        position: "absolute",
        left: x - width / 2,
        top: y - height / 2,
        width, height,
        borderRadius: R,
        border: `4px solid ${color}`,
        outline: `2px solid rgba(255,255,255,0.95)`,
        outlineOffset: `-2px`,
        background: `${color}33`,
        boxShadow: `0 0 0 3px ${color}55, 0 0 28px ${color}, inset 0 0 18px ${color}55`,
        animation: "snapPulse 0.55s ease-in-out infinite alternate",
        zIndex: 100,
        pointerEvents: "none",
      }} />
      {/* 中央の十字スナップポイント (磁石の中心) */}
      <div style={{
        position: "absolute",
        left: x - 10, top: y - 10,
        width: 20, height: 20,
        zIndex: 101,
        pointerEvents: "none",
      }}>
        <div style={{ position: "absolute", left: 9, top: 0, width: 2, height: 20, background: "#fff", boxShadow: `0 0 6px ${color}` }} />
        <div style={{ position: "absolute", left: 0, top: 9, width: 20, height: 2, background: "#fff", boxShadow: `0 0 6px ${color}` }} />
      </div>
      {/* 方向ラベル — スロットに応じた説明 */}
      <div style={{
        position: "absolute",
        left: x - 75,
        top: y - height / 2 - 32,
        width: 150,
        textAlign: "center",
        fontFamily: "var(--font-pixel), monospace",
        fontSize: 10,
        letterSpacing: "0.05em",
        color: "#fff",
        background: color,
        border: `2px solid #fff`,
        padding: "4px 6px",
        boxShadow: `0 2px 0 rgba(0,0,0,0.4), 0 0 12px ${color}`,
        animation: "snapLabelBob 0.45s ease-in-out infinite alternate",
        zIndex: 102,
        pointerEvents: "none",
        whiteSpace: "nowrap",
        textShadow: "1px 1px 0 rgba(0,0,0,0.6)",
      }}>{label}</div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════
   サイドバー
   ══════════════════════════════════════════════════════════ */

function BlockTray({
  filtered,
  onAdd,
  searching,
  activeCategory
}: {
  filtered: Tmpl[];
  onAdd: (t: Tmpl) => void;
  searching: boolean;
  activeCategory: Category;
}) {
  // 演算カテゴリ専用のサブタブ状態
  const [calcSub, setCalcSub] = useState<CalcSubCat>("arith");
  const showSubtabs = activeCategory === "calc" && !searching;

  // 演算サブタブ選択中は、その分類のテンプレートだけに更にフィルタ
  const visibleTemplates = showSubtabs
    ? filtered.filter(t => getCalcSubCat(t) === calcSub)
    : filtered;

  return (
    <div className="mc-bevel" style={{
      width: "100%",
      height: showSubtabs ? 124 : 96,
      flexShrink: 0,
      background: "#3a3833",
      display: "flex",
      flexDirection: "row",
      overflow: "hidden",
      borderTop: "3px solid #1f1e1a",
      borderBottom: "none",
      borderLeft: "none",
      borderRight: "none",
      boxSizing: "border-box"
    }}>
      {/* 左端アクション（ランダム追加ボタン） */}
      <div style={{
        width: 104,
        padding: "6px 8px",
        borderRight: "2px solid #1f1e1a",
        background: "linear-gradient(90deg, #2a2924 0%, #1f1e1a 100%)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: 3,
        flexShrink: 0
      }}>
        <McButton
          size="sm"
          variant="primary"
          disabled={filtered.length === 0}
          title={filtered.length > 0 ? "ランダムに1個追加" : "該当ブロックなし"}
          onClick={() => {
            if (filtered.length === 0) return;
            const pick = filtered[Math.floor(Math.random() * filtered.length)];
            onAdd(pick);
          }}
          style={{ width: "100%" }}
        >
          🎲 ランダム
        </McButton>
        <span style={{ fontSize: 9, color: "#c8c4b8", fontWeight: 600, textAlign: "center", lineHeight: 1.1 }}>
          {searching
            ? <>検索: <strong style={{ color: "#f9a8d4" }}>{filtered.length}</strong> 件</>
            : <>全 <strong style={{ color: "#f5f0e1" }}>{filtered.length}</strong> 個</>}
        </span>
      </div>

      {/* 中央：横スクロールするブロックアイテム一覧 */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* 演算カテゴリのみ：サブタブ */}
        {showSubtabs && (
          <div style={{
            display: "flex",
            flexDirection: "row",
            gap: 3,
            padding: "3px 10px 2px",
            borderBottom: "2px solid #1f1e1a",
            background: "linear-gradient(180deg, #2a2924 0%, #232220 100%)",
            flexShrink: 0,
          }}>
            {CALC_SUBTABS.map(s => {
              const active = calcSub === s.key;
              return (
                <button key={s.key}
                  onClick={() => setCalcSub(s.key)}
                  title={s.label}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "4px 10px",
                    fontSize: 11, fontWeight: 800,
                    fontFamily: "var(--font-pixel), monospace",
                    letterSpacing: "0.03em",
                    color: active ? "#111111" : "#c8c4b8",
                    background: active
                      ? "linear-gradient(135deg,#7fd831 0%,#5dbb1a 100%)"
                      : "#1f1e1a",
                    border: "2px solid",
                    borderTopColor: active ? "#a4e85a" : "#3a3833",
                    borderLeftColor: active ? "#a4e85a" : "#3a3833",
                    borderRightColor: active ? "#1a4d04" : "#0a0907",
                    borderBottomColor: active ? "#1a4d04" : "#0a0907",
                    borderRadius: 0,
                    cursor: "pointer",
                    transition: "all 0.1s ease",
                    boxShadow: active
                      ? "0 2px 0 #1a4d04, 0 0 12px rgba(125,216,49,0.4)"
                      : "0 2px 0 #0a0907",
                    textShadow: active ? "1px 1px 0 rgba(255,255,255,0.3)" : "none",
                  }}>
                  <span style={{ fontSize: 13 }}>{s.icon}</span>
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ブロックリスト本体（横スクロール） */}
        <div style={{
          flex: 1,
          overflowX: "auto",
          overflowY: "hidden",
          padding: "0 18px",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 22,
          scrollbarWidth: "thin",
          scrollbarColor: "#4a4842 #2a2924"
        }}>
          {visibleTemplates.map(t => {
            const c = CAT[t.category];

            // キャンバスのブロックと統一した 3D キューブの内側ベベル
            const innerBorder = "inset 3px 3px 0 rgba(255,255,255,0.32), inset -3px -3px 0 rgba(0,0,0,0.22)";
            const hoverInnerBorder = "inset 3px 3px 0 rgba(255,255,255,0.45), inset -3px -3px 0 rgba(0,0,0,0.26)";
            const pressInnerBorder = "inset 3px 3px 0 rgba(0,0,0,0.32), inset -3px -3px 0 rgba(255,255,255,0.20)";
            const bw_w = 92;
            const bw_h = 62;
            const FACE_D = 16;
            const R = 8;

            return (
              <button key={t.type + t.label} onClick={() => onAdd(t)} title={t.sublabel}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
                  width: bw_w, height: bw_h, padding: "4px 3px",
                  // 融合: 正面(=このボタン)を独立カードに見せない。継ぎ目側(上/右)の角丸と縁を消す。
                  borderRadius: `${R}px 0 0 ${R}px`,
                  background: `linear-gradient(135deg, ${c.top}, ${c.bg})`,
                  borderLeft: `4px solid ${c.border}`,
                  borderBottom: `4px solid ${c.border}`,
                  borderRight: `2px solid transparent`,
                  borderTop: `2px solid transparent`,
                  cursor: "pointer",
                  transition: "transform 0.1s cubic-bezier(0.2,0.8,0.2,1), box-shadow 0.1s ease, filter 0.1s ease",
                  // ブロックの体: 浮く"ボタン影"は出さず、キャンバスブロックと同じ斜めオフセット影で地に置く
                  boxShadow: `${innerBorder}, 3px 3px 0 rgba(0,0,0,0.18)`,
                  flexShrink: 0,
                  position: "relative",
                  overflow: "visible",
                  marginTop: FACE_D, // 3D 上面分の余白を上に確保（はみ出し防止）
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget;
                  // 持ち上げない。ブロックが"光る"だけ
                  el.style.boxShadow = `${hoverInnerBorder}, 3px 3px 0 rgba(0,0,0,0.2)`;
                  el.style.filter = "brightness(1.09)";
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget;
                  el.style.transform = "";
                  el.style.boxShadow = `${innerBorder}, 3px 3px 0 rgba(0,0,0,0.18)`;
                  el.style.filter = "";
                }}
                onMouseDown={e => {
                  const el = e.currentTarget;
                  // ブロックが地面に"押し込まれる"(沈む＝影を畳む)。ボタンの上下移動ではない
                  el.style.transform = "scale(0.95)";
                  el.style.boxShadow = `${pressInnerBorder}, 1px 1px 0 rgba(0,0,0,0.2)`;
                }}
                onMouseUp={e => {
                  const el = e.currentTarget;
                  el.style.transform = "";
                  el.style.boxShadow = `${hoverInnerBorder}, 3px 3px 0 rgba(0,0,0,0.2)`;
                }}
              >
                {/* 3D 上面 — キャンバスブロックと同じ skewX 形状（角丸厚みアップ） */}
                <div style={{
                  position: "absolute",
                  left: 0,
                  top: -FACE_D,
                  width: bw_w,
                  height: FACE_D,
                  background: c.top,
                  borderRadius: `${R}px ${R}px 0 0`,
                  transform: "skewX(-45deg)",
                  transformOrigin: "bottom left",
                  borderTop: `3.5px solid ${c.border}`,
                  borderLeft: `3.5px solid ${c.border}`,
                  borderRight: `1.5px solid rgba(0,0,0,0.22)`,
                  borderBottom: `1.5px solid rgba(0,0,0,0.22)`,
                  boxSizing: "border-box",
                  pointerEvents: "none",
                  zIndex: 1,
                }} />

                {/* 3D 右側面 — キャンバスブロックと同じ skewY 形状 */}
                <div style={{
                  position: "absolute",
                  left: bw_w,
                  top: 0,
                  width: FACE_D,
                  height: bw_h,
                  background: c.side,
                  borderRadius: `0 ${R}px ${R}px 0`,
                  transform: "skewY(-45deg)",
                  transformOrigin: "top left",
                  borderTop: `1.5px solid rgba(0,0,0,0.22)`,
                  borderRight: `3.5px solid ${c.border}`,
                  borderBottom: `3.5px solid ${c.border}`,
                  borderLeft: `1.5px solid rgba(0,0,0,0.22)`,
                  boxSizing: "border-box",
                  pointerEvents: "none",
                  zIndex: 1,
                }} />

                <span style={{ fontSize: t.type === "co_if" ? 22 : 20, filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.4))", lineHeight: 1, zIndex: 2, position: "relative" }}>
                  {t.emoji}
                </span>
                <span style={{
                  fontSize: t.label.length > 7 ? 10 : 12,
                  fontWeight: 900,
                  color: c.text,
                  textAlign: "center",
                  lineHeight: 1.1,
                  width: "100%",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  textShadow: c.text === "#ffffff"
                    ? "1.5px 1.5px 0 #000, -1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000"
                    : "none",
                  zIndex: 2, position: "relative",
                }}>
                  {t.label}
                </span>
              </button>
            );
          })}
          {visibleTemplates.length === 0 && (
            <div style={{ color: "#9c9890", fontSize: 12, padding: "10px 20px" }}>
              該当するブロックなし
            </div>
          )}
        </div>{/* /inner scroll */}
      </div>{/* /outer column */}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   プロジェクト管理パネル
   ══════════════════════════════════════════════════════════ */

interface SavedProject { name: string; savedAt: string; blocks: CBlock[] }

function ProjectPanel({ blocks, onLoad, onClose }: {
  blocks: CBlock[];
  onLoad: (blocks: CBlock[]) => void;
  onClose: () => void;
}) {
  const [projects, setProjects] = useState<Omit<SavedProject, "blocks">[]>([]);
  const [saveName, setSaveName] = useState("マイプロジェクト");
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    try {
      const stored: Record<string, SavedProject> = JSON.parse(localStorage.getItem("mmc-projects") || "{}");
      setProjects(Object.values(stored).map(p => ({ name: p.name, savedAt: p.savedAt })));
    } catch { }
  }, []);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 2000); };

  const save = () => {
    if (!saveName.trim()) return;
    const stored: Record<string, SavedProject> = JSON.parse(localStorage.getItem("mmc-projects") || "{}");
    const project: SavedProject = { name: saveName, savedAt: new Date().toLocaleString("ja-JP"), blocks };
    stored[saveName] = project;
    localStorage.setItem("mmc-projects", JSON.stringify(stored));
    setProjects(Object.values(stored).map(p => ({ name: p.name, savedAt: p.savedAt })));
    flash("💾 保存しました！");
  };

  const load = (name: string) => {
    const stored: Record<string, SavedProject> = JSON.parse(localStorage.getItem("mmc-projects") || "{}");
    if (stored[name]) { onLoad(stored[name].blocks); onClose(); }
  };

  const del = (name: string) => {
    const stored: Record<string, SavedProject> = JSON.parse(localStorage.getItem("mmc-projects") || "{}");
    delete stored[name];
    localStorage.setItem("mmc-projects", JSON.stringify(stored));
    setProjects(Object.values(stored).map(p => ({ name: p.name, savedAt: p.savedAt })));
  };

  const exportJson = () => {
    const data = JSON.stringify({ name: saveName, blocks, version: "2.0" }, null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${saveName.replace(/\s+/g, "_")}.mmc.json`; a.click();
    URL.revokeObjectURL(url);
    flash("📤 ダウンロードしました！");
  };

  const importJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.blocks) { onLoad(data.blocks); onClose(); }
      } catch { flash("❌ 読み込みに失敗しました"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="mc-panel" style={{
      position: "absolute", top: 50, left: "50%", transform: "translateX(-50%)", zIndex: 50,
      width: 460, background: "var(--surface)", boxShadow: "0 12px 48px rgba(0,0,0,0.6)", overflow: "hidden"
    }}>
      {/* ヘッダー */}
      <div style={{
        padding: "10px 16px", background: "var(--panel)", borderBottom: "2px solid var(--border-color)",
        display: "flex", justifyContent: "space-between", alignItems: "center"
      }}>
        <span className="font-pixel text-[11px]" style={{ color: "var(--accent)", letterSpacing: "0.05em" }}>📁 PROJECTS</span>
        <button onClick={onClose} className="mc-btn mc-btn--sm">✕ 閉じる</button>
      </div>

      <div style={{ padding: "16px 18px", maxHeight: 440, overflowY: "auto", background: "var(--surface)" }}>
        {/* 保存 */}
        <div style={{ marginBottom: 16 }}>
          <div className="font-pixel" style={{ fontSize: 10, color: "var(--foreground)", marginBottom: 8, letterSpacing: "0.05em" }}>💾 現在の作業を保存</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={saveName} onChange={e => setSaveName(e.target.value)}
              style={{
                flex: 1, padding: "8px 12px", borderRadius: 0, border: "2px solid var(--border-color)",
                borderTopColor: "#1f1e1a", borderLeftColor: "#1f1e1a",
                background: "#1f1e1a", color: "var(--foreground)", fontSize: 12, outline: "none", fontWeight: 600
              }}
              placeholder="プロジェクト名" />
            <button onClick={save} className="mc-btn mc-btn--primary">保存</button>
          </div>
          {msg && <div className="font-pixel" style={{ marginTop: 8, fontSize: 10, color: "#6ee7b7" }}>{msg}</div>}
        </div>

        {/* 保存済みプロジェクト */}
        {projects.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div className="font-pixel" style={{ fontSize: 10, color: "var(--foreground)", marginBottom: 8, letterSpacing: "0.05em" }}>📂 保存済みプロジェクト</div>
            {projects.map(p => (
              <div key={p.name} className="mc-bevel-inset" style={{
                display: "flex", alignItems: "center", gap: 6, padding: "8px 10px",
                background: "#1f1e1a", marginBottom: 6
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: "var(--muted)" }}>{p.savedAt}</div>
                </div>
                <button onClick={() => load(p.name)} className="mc-btn mc-btn--sm mc-btn--info">開く</button>
                <button onClick={() => del(p.name)} className="mc-btn mc-btn--sm mc-btn--danger">削除</button>
              </div>
            ))}
          </div>
        )}

        {/* インポート/エクスポート */}
        <div style={{ borderTop: "2px solid var(--border-color)", paddingTop: 14, display: "flex", gap: 8 }}>
          <button onClick={exportJson} className="mc-btn mc-btn--warning" style={{ flex: 1 }}>📤 JSON ダウンロード</button>
          <button onClick={() => fileRef.current?.click()} className="mc-btn mc-btn--success" style={{ flex: 1 }}>📥 JSON 読み込み</button>
          <input ref={fileRef} type="file" accept=".json,.mmc.json" onChange={importJson} style={{ display: "none" }} />
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   テンプレートギャラリー
   ══════════════════════════════════════════════════════════ */

function TemplateGallery({ onSelect, onClose }: {
  onSelect: (blocks: CBlock[]) => void;
  onClose: () => void;
}) {
  return (
    <div className="mc-panel" style={{
      position: "absolute", top: 50, left: "50%", transform: "translateX(-50%)", zIndex: 50,
      width: 540, background: "var(--surface)", boxShadow: "0 12px 48px rgba(0,0,0,0.6)", overflow: "hidden"
    }}>
      <div style={{
        padding: "10px 16px", background: "var(--panel)", borderBottom: "2px solid var(--border-color)",
        display: "flex", justifyContent: "space-between", alignItems: "center"
      }}>
        <span className="font-pixel text-[11px]" style={{ color: "#22d3ee", letterSpacing: "0.05em" }}>🎮 TEMPLATES</span>
        <button onClick={onClose} className="mc-btn mc-btn--sm">✕ 閉じる</button>
      </div>
      <div style={{ padding: "14px 18px", maxHeight: 460, overflowY: "auto", background: "var(--surface)" }}>
        <div className="font-pixel" style={{ fontSize: 10, color: "var(--muted)", marginBottom: 14, letterSpacing: "0.04em" }}>
          クリックで今のキャンバスに追加（既存ブロックは残ります）
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {PRESET_PROJECTS.map((p, i) => (
            <button key={i} onClick={() => { onSelect(p.create()); onClose(); }}
              className="mc-bevel-inset"
              style={{
                textAlign: "left", padding: "14px 14px",
                background: "#1f1e1a", cursor: "pointer",
                transition: "all 0.12s, transform 0.08s",
                color: "var(--foreground)"
              }}
              onMouseEnter={e => { const el = e.currentTarget; el.style.background = "#2a2924"; el.style.borderColor = "#ec4899"; el.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { const el = e.currentTarget; el.style.background = "#1f1e1a"; el.style.borderColor = ""; el.style.transform = ""; }}>
              <div style={{ fontSize: 26, marginBottom: 6, filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.4))" }}>{p.emoji}</div>
              <div className="font-pixel" style={{ fontSize: 11, color: "var(--foreground)", marginBottom: 4, letterSpacing: "0.03em" }}>{p.name}</div>
              <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.45 }}>{p.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   メインパネル
   ══════════════════════════════════════════════════════════ */

export default function LogicPanel() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const setGeneratedJsCode = useEditorStore(s => s.setGeneratedJsCode);
  const setLogicGraphJson = useEditorStore(s => s.setLogicGraphJson);

  // 古い記憶（過去のセーブデータ）を最新の仕様に浄化（絵文字分離・ラベル統一）
  const migrateBlocks = (blocks: any[]): CBlock[] => {
    return blocks.map(b => {
      const tmpl = TEMPLATES.find(t => t.type === b.type);
      if (!tmpl) return b;
      return {
        ...b,
        emoji: tmpl.emoji,
        label: tmpl.label,
        sublabel: tmpl.sublabel,
        category: tmpl.category,
      };
    });
  };

  const [blocks, setBlocks] = useState<CBlock[]>(() => {
    try {
      const j = useEditorStore.getState().logicGraphJson;
      if (j) {
        const parsed = JSON.parse(j);
        const raw = parsed.nodes ?? parsed.blocks;
        if (raw) return migrateBlocks(raw);
      }
    } catch { }
    try {
      if (typeof window !== "undefined") {
        const local = localStorage.getItem("mmc-autosave-logic");
        if (local) {
          const parsed = JSON.parse(local);
          const raw = parsed.blocks ?? parsed;
          if (Array.isArray(raw)) return migrateBlocks(raw);
        }
      }
    } catch { }
    return makeInitial();
  });
  const [pan, setPan] = useState({ x: 60, y: 60 });
  // ズーム機能（復活）：縦に積んだ時の全体俯瞰用。0.4 〜 1.0 の範囲。
  const [zoom, setZoom] = useState(BASE_ZOOM);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showLib, setShowLib] = useState(true);
  const [activeCategory, setActiveCategory] = useState<Category>("trigger");
  const [focusedField, setFocusedField] = useState<{ blockId: string; fieldId: string } | null>(null);
  /** インテリアテーマ — Phase 1 では切替トグルのみ、永続化は未実装（後で store に移す） */
  const [interiorTheme, setInteriorTheme] = useState<"workshop" | "cyber">("workshop");
  // armed 接続（タップ→タップ）用の状態
  const [wireDrag, setWireDrag] = useState<{ sourceBlockId: string; slot: string; armed: boolean; accepts: Category[] } | null>(null);
  // マウスのキャンバス上の座標（ドラッグ中のワイヤー追従用）
  const [mouseCanvasPos, setMouseCanvasPos] = useState({ x: 0, y: 0 });

  const searching = search.trim().length > 0;
  const filtered = searching
    ? TEMPLATES.filter(t => t.label.includes(search) || t.sublabel.includes(search))
    : TEMPLATES.filter(t => t.category === activeCategory);
  const [showCode, setShowCode] = useState(false);
  const [showHelp, setShowHelp] = useState(true);
  const [genCode, setGenCode] = useState("");
  const [snapHint, setSnapHint] = useState<{ targetId: string; slot: string; pos: { x: number; y: number } } | null>(null);
  const [eating, setEating] = useState<string | null>(null);
  const [chomping, setChomping] = useState<string | null>(null);
  const [snapAnim, setSnapAnim] = useState<string | null>(null);   // スナップ時バウンス
  const [addAnim, setAddAnim] = useState<string | null>(null);   // 追加時スライドイン
  const [deleteAnim, setDeleteAnim] = useState<string | null>(null);   // 削除時フェードアウト
  const [shakeAnim, setShakeAnim] = useState<string | null>(null);   // エラー時ブルブル

  // パーティクルバースト (スクリーン座標)
  const [particles, setParticles] = useState<{ id: string; x: number; y: number; color: string }[]>([]);
  // 着地時の衝撃リング / 光フラッシュ
  const [impacts, setImpacts] = useState<{ id: string; x: number; y: number; color: string }[]>([]);
  // 紙吹雪（co_if など特別ブロック用）
  const [confetti, setConfetti] = useState<{ id: string; x: number; y: number }[]>([]);
  const [showProjects, setShowProjects] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [toast, setToast] = useState<{ message: string; level: "success" | "error" | "warning" } | null>(null);

  // ─── 床（content Y=660）を画面底辺に揃える ───
  // 数式: pan.y + 660 * zoom = rect.height  →  pan.y = rect.height - 660 * zoom
  // マウント時とウィンドウリサイズ時に再計算。X は触らない（自由パン維持）。
  useEffect(() => {
    const alignFloor = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || rect.height <= 0) return;
      const groundY = 600 + BH; // = 660（ToyFloor の content Y）
      const desiredPanY = rect.height - groundY * live.current.zoom;
      setPan(p => ({ ...p, y: desiredPanY }));
    };
    alignFloor();                                  // 初回
    window.addEventListener("resize", alignFloor); // ウィンドウサイズ変動時
    return () => window.removeEventListener("resize", alignFloor);
  }, []);

  // ─── Undo / Redo ───
  const historyRef = useRef<string[]>([JSON.stringify(blocks)]);
  const historyIdx = useRef(0);
  const skipHistory = useRef(false);

  useEffect(() => {
    if (skipHistory.current) { skipHistory.current = false; return; }
    const timer = setTimeout(() => {
      const json = JSON.stringify(blocks);
      if (json === historyRef.current[historyIdx.current]) return;
      historyRef.current = historyRef.current.slice(0, historyIdx.current + 1);
      historyRef.current.push(json);
      if (historyRef.current.length > 60) historyRef.current.shift();
      historyIdx.current = historyRef.current.length - 1;
    }, 350);
    return () => clearTimeout(timer);
  }, [blocks]);

  const undo = useCallback(() => {
    if (historyIdx.current <= 0) return;
    historyIdx.current--;
    skipHistory.current = true;
    setBlocks(JSON.parse(historyRef.current[historyIdx.current]));
  }, []);

  const redo = useCallback(() => {
    if (historyIdx.current >= historyRef.current.length - 1) return;
    historyIdx.current++;
    skipHistory.current = true;
    setBlocks(JSON.parse(historyRef.current[historyIdx.current]));
  }, []);

  const resetPanZoom = useCallback(() => {
    setZoom(BASE_ZOOM);
    const { blocks } = live.current;
    const rect = containerRef.current?.getBoundingClientRect();
    if (blocks.length === 0) {
      if (rect) {
        // ズーム基準を掛けて、初期ブロック(content≈200,600)を画面下・中央寄りに置く
        const groundY = 600 + BH;
        setPan({ x: rect.width / 2 - 200 * BASE_ZOOM, y: rect.height - groundY * BASE_ZOOM });
      } else {
        setPan({ x: 60, y: 60 });
      }
      return;
    }
    const positions = blocks.map(b => getPos(b.id, blocks));
    const minX = Math.min(...positions.map(p => p.x));
    const maxX = Math.max(...positions.map(p => p.x + BW));
    const minY = Math.min(...positions.map(p => p.y));
    const maxY = Math.max(...positions.map(p => p.y + BH));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    if (rect) {
      // 中央寄せは zoom を掛ける（基準ズーム0.68でも画面中央に来るように）
      setPan({ x: rect.width / 2 - cx * BASE_ZOOM, y: rect.height / 2 - cy * BASE_ZOOM });
    } else {
      setPan({ x: 60, y: 60 });
    }
  }, []);

  useEffect(() => {
    if (blocks.length === 0) {
      resetPanZoom();
    }
  }, [blocks.length, resetPanZoom]);

  // 初回マウント時、既存ブロックがあれば画面中央に寄せる（100%=真ん中）
  useEffect(() => {
    resetPanZoom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const live = useRef({ pan, zoom, blocks, selected, snapHint, wireDrag });
  live.current = { pan, zoom, blocks, selected, snapHint, wireDrag };

  const panDrag = useRef({ active: false, sx: 0, sy: 0, sp: { x: 0, y: 0 } });
  const blockDrag = useRef({ active: false, id: "", offX: 0, offY: 0 });

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const fac = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    setZoom(z => {
      const nz = Math.min(2.5, Math.max(0.2, z * fac));
      setPan(p => ({
        // X: マウス位置を画面上で固定（カーソルへ向かってズーム）
        x: mx - (mx - p.x) * (nz / z),
        // Y: キャンバスの底辺を画面上で固定（rect.height を不動点に）
        y: rect.height - (rect.height - p.y) * (nz / z),
      }));
      return nz;
    });
  }, []);

  const handleBgDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    if (live.current.wireDrag) {
      setWireDrag(null);
      return;
    }
    panDrag.current = { active: true, sx: e.clientX, sy: e.clientY, sp: { ...live.current.pan } };
    setSelected(null); e.preventDefault();
  }, []);

  const handleBlockDown = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const { wireDrag, blocks, zoom, pan } = live.current;
    if (wireDrag && wireDrag.armed) {
      const b = blocks.find(x => x.id === id);
      if (b) {
        const isAccept = slotAccepts(wireDrag.slot, b.category);
        if (isAccept && wireDrag.sourceBlockId !== id) {
          setBlocks(prev => attach(id, wireDrag.sourceBlockId, wireDrag.slot, prev));
          playSnapSound();

          const pos = getPos(id, blocks);
          const screenX = pos.x * zoom + pan.x;
          const screenY = pos.y * zoom + pan.y;
          burstParticles(screenX, screenY, CAT[b.category].bg);

          setWireDrag(null);
          return;
        } else {
          setShakeAnim(id);
          tone(150, 0.1, "sawtooth", 0.3); // Error sound
          setTimeout(() => setShakeAnim(null), 300);
          setWireDrag(null);
          return;
        }
      }
    }

    playClickSound(); // 拾った瞬間のカチッ感触
    const rect = containerRef.current!.getBoundingClientRect();
    const pos = getPos(id, blocks);
    const visX = pos.x, visY = pos.y;
    setBlocks(prev => {
      const detached = detach(id, prev);
      return detached.map(b => b.id === id ? { ...b, x: visX, y: visY } : b);
    });
    const mx = (e.clientX - rect.left) / zoom - pan.x / zoom;
    const my = (e.clientY - rect.top) / zoom - pan.y / zoom;
    blockDrag.current = { active: true, id, offX: mx - visX, offY: my - visY };
    setSelected(id);
  }, []);

  const handleSlotClick = useCallback((blockId: string, slot: string) => {
    const accepts: Category[] = slot === "inner"
      ? ["ifelse", "value", "calc", "variable"]
      : ["trigger", "action", "loop", "ui"]; // then, else用

    setWireDrag({
      sourceBlockId: blockId,
      slot: slot,
      armed: true,
      accepts
    });
  }, []);

  const handleFieldChange = useCallback((id: string, fid: string, val: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, fields: b.fields.map(f => f.id === fid ? { ...f, value: val } : f) } : b));
  }, []);

  const handleDelete = useCallback((id: string) => {
    playDeleteSound();
    setDeleteAnim(id);
    setTimeout(() => {
      setBlocks(prev => { const d = detach(id, prev); return d.filter(b => !getFamily(id, d).includes(b.id)); });
      setSelected(null);
      setDeleteAnim(null);
    }, 320);
  }, []);

  const handleEjectInner = useCallback((donutId: string) => {
    setBlocks(prev => {
      const donut = prev.find(b => b.id === donutId);
      if (!donut?.innerId) return prev;
      const innerId = donut.innerId;
      const dp = getPos(donutId, prev);
      return prev.map(b => {
        if (b.id === donutId) return { ...b, innerId: null };
        if (b.id === innerId) return { ...b, x: dp.x + BW + GAP * 2, y: dp.y };
        return b;
      });
    });
  }, []);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const rect = containerRef.current?.getBoundingClientRect(); if (!rect) return;
      const { pan, zoom, blocks } = live.current;

      const mx = (e.clientX - rect.left) / zoom - pan.x / zoom;
      const my = (e.clientY - rect.top) / zoom - pan.y / zoom;
      setMouseCanvasPos({ x: mx, y: my });

      if (panDrag.current.active) {
        // Y は固定（底辺ロック）。X のみ自由パン。
        setPan(p => ({ x: panDrag.current.sp.x + (e.clientX - panDrag.current.sx), y: p.y }));
        return;
      }
      if (!blockDrag.current.active) return;
      const cx = (e.clientX - rect.left) / zoom - pan.x / zoom - blockDrag.current.offX;
      const cy = (e.clientY - rect.top) / zoom - pan.y / zoom - blockDrag.current.offY;
      const id = blockDrag.current.id;
      setBlocks(prev => prev.map(b => b.id === id ? { ...b, x: cx, y: cy } : b));

      // スナップ検知
      const center = { x: cx + BW / 2, y: cy + BH / 2 };
      const snap = findSnap(id, center, blocks);
      if (snap) {
        const tp = getPos(snap.targetId, blocks);
        const td = blockH(blocks.find(b => b.id === snap.targetId) ?? blocks[0]);
        let hx = tp.x, hy = tp.y;
        if (snap.slot === "next") {
          const target = blocks.find(bl => bl.id === snap.targetId);
          if (target && (target.type === "co_if" || target.type === "ct_rep")) {
            const thenH = target.thenId ? getStackHeight(target.thenId, blocks) : 40;
            const elseH = target.type === "co_if" && target.elseId ? getStackHeight(target.elseId, blocks) : 0;
            const maxArmH = Math.max(thenH, elseH);
            hx = tp.x; hy = tp.y - maxArmH - 45;
          } else {
            hx = tp.x; hy = tp.y - td - GAP;
          }
        }
        else if (snap.slot === "inner") { hx = tp.x + BW + GAP; hy = tp.y; }
        else if (snap.slot === "then") { hx = tp.x; hy = tp.y - td - GAP; }
        else if (snap.slot === "else") { hx = tp.x + BW + GAP + 120; hy = tp.y; }
        const screenX = (hx + BW / 2) * zoom + pan.x, screenY = (hy + BH / 2) * zoom + pan.y;
        setSnapHint({ targetId: snap.targetId, slot: snap.slot, pos: { x: screenX, y: screenY } });
      } else {
        setSnapHint(null);
      }
    }
    function onUp() {
      if (panDrag.current.active) { panDrag.current.active = false; return; }
      if (!blockDrag.current.active) return;
      const { blocks } = live.current;
      const id = blockDrag.current.id;
      const b = blocks.find(b => b.id === id)!;
      const center = { x: b.x + BW / 2, y: b.y + BH / 2 };
      const snap = findSnap(id, center, blocks);
      if (snap) {
        setBlocks(prev => attach(id, snap.targetId, snap.slot, prev));
        playSnapSound();
        setSnapAnim(snap.targetId);
        setTimeout(() => setSnapAnim(null), 150);
        const { pan, zoom } = live.current;
        const tp = getPos(snap.targetId, blocks);
        const td = BW;
        const sx = (tp.x + td / 2) * zoom + pan.x;
        const sy = (tp.y + BH / 2) * zoom + pan.y;
        const color = CAT[blocks.find(bl => bl.id === snap.targetId)?.category || "action"].bg;
        burstParticles(sx, sy, color);
        if (snap.slot === "inner") {
          setEating(id);
          setChomping(snap.targetId);
          playEatSound();
          setTimeout(() => setEating(null), 580);
          setTimeout(() => setChomping(null), 580);
        }
        setSnapHint(null);
      } else {
        // スナップなしドロップ→ 重なった親なしブロックを右へ弾き飛ばす
        playClickSound(); // 床に置いた開放直後のカチッ音
        const droppedBlock = blocks.find(bl => bl.id === id)!;
        const bumpTargets = blocks.filter(bl => {
          if (bl.id === id) return false;
          // 親なしブロックのみ対象
          const hasParent = blocks.some(p =>
            p.nextId === bl.id || p.innerId === bl.id || p.thenId === bl.id || p.elseId === bl.id
          );
          if (hasParent) return false;
          const bPos = getPos(bl.id, blocks);
          const overlapX = droppedBlock.x < bPos.x + BW && droppedBlock.x + BW > bPos.x;
          const overlapY = droppedBlock.y < bPos.y + (BH - 5) && droppedBlock.y + (BH - 5) > bPos.y;
          return overlapX && overlapY;
        });
        if (bumpTargets.length > 0) {
          setBlocks(prev => prev.map(bl => {
            if (bumpTargets.some(t => t.id === bl.id)) {
              return { ...bl, x: bl.x + BW + 20 };
            }
            return bl;
          }));
        }
        blockDrag.current.active = false;
        setSnapHint(null);
        return;
      }
      blockDrag.current.active = false;
      setSnapHint(null);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (live.current.wireDrag) {
          setWireDrag(null);
          return;
        }
      }
      const tag = (e.target as HTMLElement).tagName;
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && tag !== "INPUT") { e.preventDefault(); undo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "Z")) && tag !== "INPUT") { e.preventDefault(); redo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === "s" && tag !== "INPUT") { e.preventDefault(); setShowProjects(true); return; }
      if (tag === "INPUT" || !live.current.selected) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        const id = live.current.selected;
        if (id) {
          setDeleteAnim(id);
          setTimeout(() => {
            setBlocks(prev => { const d = detach(id, prev); return d.filter(b => !getFamily(id, d).includes(b.id)); });
            setSelected(null);
            setDeleteAnim(null);
          }, 180);
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "d") {
        e.preventDefault();
        const src = live.current.blocks.find(b => b.id === live.current.selected);
        if (src) { const cl = { ...src, id: uid(), x: src.x + 20, y: src.y + 20, nextId: null, innerId: null, thenId: null, elseId: null, fields: src.fields.map(f => ({ ...f })) }; setBlocks(p => [...p, cl]); setSelected(cl.id); }
      }
    }
    document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const burstParticles = useCallback((sx: number, sy: number, color: string) => {
    const id = uid();
    const sparkId = id + "_spark";
    setParticles(prev => [
      ...prev,
      { id, x: sx, y: sy, color },
      { id: sparkId, x: sx, y: sy, color: "#ffffff" } // 白いカチッと衝撃火花
    ]);
    setTimeout(() => setParticles(prev => prev.filter(p => p.id !== id && p.id !== sparkId)), 400); // 400ms で素早く消えるように
  }, []);

  const addBlock = useCallback((t: Tmpl) => {
    const { pan, zoom, blocks } = live.current;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // 自動積み上げ配置
    let targetX = 200;
    let targetY = 600;

    if (t.category !== "trigger") {
      const triggers = blocks.filter(b => b.category === "trigger");
      if (triggers.length > 0) {
        const firstTrigger = triggers[0];
        let current: CBlock | null = firstTrigger;
        while (current) {
          const next = blocks.find(b => b.id === current?.nextId);
          if (next) current = next;
          else break;
        }
        if (current) {
          const pos = getPos(current.id, blocks);
          targetX = pos.x;
          targetY = pos.y - BH - GAP;
        }
      } else {
        targetX = 200;
        targetY = 600 - BH - GAP;
      }
    } else {
      const triggers = blocks.filter(b => b.category === "trigger");
      targetX = 200 + triggers.length * (BW + GAP * 2);
      targetY = 600;
    }

    const nb = spawnBlock(t, targetX, targetY);

    // トレイから追加時、指定位置と重なる親なしブロックを右へバンプ
    const bumpedBlocks = blocks.filter(bl => {
      const hasParent = blocks.some(p =>
        p.nextId === bl.id || p.innerId === bl.id || p.thenId === bl.id || p.elseId === bl.id
      );
      if (hasParent) return false;
      const bPos = getPos(bl.id, blocks);
      const overlapX = targetX < bPos.x + BW && targetX + BW > bPos.x;
      const overlapY = targetY < bPos.y + (BH - 5) && targetY + (BH - 5) > bPos.y;
      return overlapX && overlapY;
    });
    const bumpedIds = new Set(bumpedBlocks.map(b => b.id));
    setBlocks(prev => [
      ...prev.map(bl => bumpedIds.has(bl.id) ? { ...bl, x: bl.x + BW + 20 } : bl),
      nb
    ]);
    setAddAnim(nb.id);
    playAddSound();

    // カテゴリ色（衝撃リング/フラッシュをカテゴリらしく）
    const catColor = CAT[t.category]?.bg ?? "#ec4899";

    // 着地タイミング (アニメの 50% = 0.6s × 0.5 = 300ms) に演出を集約
    setTimeout(() => {
      const sx = (targetX + BW / 2) * zoom + pan.x;
      const sy = (targetY + BH) * zoom + pan.y;
      // 横方向の土煙バースト
      burstParticles(sx - BW / 2, sy, "#c8c4b8");
      burstParticles(sx + BW / 2, sy, "#c8c4b8");
      // 衝撃リング（地面に広がる楕円）+ 光フラッシュ
      const impactId = uid();
      setImpacts(prev => [...prev, { id: impactId, x: sx, y: sy, color: catColor }]);
      setTimeout(() => setImpacts(prev => prev.filter(p => p.id !== impactId)), 700);
      // co_if（条件分岐ドーナツ）だけは紙吹雪で特別扱い
      if (t.type === "co_if") {
        const confId = uid();
        setConfetti(prev => [...prev, { id: confId, x: sx, y: sy - BH / 2 }]);
        setTimeout(() => setConfetti(prev => prev.filter(p => p.id !== confId)), 900);
      }
    }, 300);

    setTimeout(() => setAddAnim(null), 620);
  }, [burstParticles]);

  const zoomToFit = useCallback(() => {
    const { blocks } = live.current; const rect = containerRef.current?.getBoundingClientRect(); if (!rect || !blocks.length) return;
    const pad = 80;
    const positions = blocks.map(b => { const p = getPos(b.id, blocks); const d = blockH(b); return { x1: p.x, y1: p.y, x2: p.x + BW, y2: p.y + d }; });
    const minX = Math.min(...positions.map(p => p.x1)) - pad, minY = Math.min(...positions.map(p => p.y1)) - pad;
    const maxX = Math.max(...positions.map(p => p.x2)) + pad, maxY = Math.max(...positions.map(p => p.y2)) + pad;
    const nz = Math.min(2, Math.max(0.2, Math.min(rect.width / (maxX - minX), rect.height / (maxY - minY))));
    setZoom(nz); setPan({ x: -minX * nz + (rect.width - (maxX - minX) * nz) / 2, y: -minY * nz + (rect.height - (maxY - minY) * nz) / 2 });
  }, []);

  useEffect(() => {
    const code = buildCode(blocks);
    setGenCode(code); setGeneratedJsCode(code);
    setLogicGraphJson(JSON.stringify({ blocks }));
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("mmc-autosave-logic", JSON.stringify({ blocks }));
      }
    } catch { }
  }, [blocks, setGeneratedJsCode, setLogicGraphJson]);

  const connectors: { x: number; y: number; color: string }[] = [];
  const cables: { x1: number; y1: number; x2: number; y2: number; color: string }[] = [];

  for (const b of blocks) {
    if (b.nextId) {
      const pp = getPos(b.id, blocks);
      const nextBlock = blocks.find(x => x.id === b.nextId);
      const nextH = nextBlock ? blockH(nextBlock) : BH;
      if (b.type === "co_if" || b.type === "ct_rep") {
        const thenH = b.thenId ? getStackHeight(b.thenId, blocks) : 40;
        const elseH = b.type === "co_if" && b.elseId ? getStackHeight(b.elseId, blocks) : 0;
        const maxArmH = Math.max(thenH, elseH);
        connectors.push({ x: pp.x + BW / 2, y: pp.y - maxArmH - 45, color: CAT[b.category].bg });
      } else {
        connectors.push({ x: pp.x + BW / 2, y: pp.y - nextH - GAP, color: CAT[b.category].bg });
      }
    }

    const pp = getPos(b.id, blocks);
    if (b.innerId) {
      const target = blocks.find(x => x.id === b.innerId);
      if (target) {
        const tp = getPos(target.id, blocks);
        const th = blockH(target);
        cables.push({
          x1: pp.x + BW - 20, // 右側のボタン位置付近から出る
          y1: pp.y + 60,
          x2: tp.x + 0,       // ターゲットの左端へ接続
          y2: tp.y + th / 2,
          color: SLOT_BADGE.inner.color
        });
      }
    }

    if (b.thenId) {
      const target = blocks.find(x => x.id === b.thenId);
      if (target) {
        const tp = getPos(target.id, blocks);
        const th = blockH(target);
        cables.push({
          x1: pp.x + BW - 20,
          y1: pp.y + 80,
          x2: tp.x + 0,
          y2: tp.y + th / 2,
          color: SLOT_BADGE.then.color
        });
      }
    }

    if (b.elseId) {
      const target = blocks.find(x => x.id === b.elseId);
      if (target) {
        const tp = getPos(target.id, blocks);
        const th = blockH(target);
        cables.push({
          x1: pp.x + BW - 20,
          y1: pp.y + 100,
          x2: tp.x + 0,
          y2: tp.y + th / 2,
          color: SLOT_BADGE.else.color
        });
      }
    }
  }

  // ドラッグ中・追従アームワイヤー
  if (wireDrag && wireDrag.armed) {
    const parent = blocks.find(x => x.id === wireDrag.sourceBlockId);
    if (parent) {
      const ppos = getPos(parent.id, blocks);
      let sY = ppos.y + 40;
      if (wireDrag.slot === "inner") sY = ppos.y + 60;
      else if (wireDrag.slot === "then") sY = ppos.y + 80;
      else if (wireDrag.slot === "else") sY = ppos.y + 100;

      cables.push({
        x1: ppos.x + BW - 20,
        y1: sY,
        x2: mouseCanvasPos.x,
        y2: mouseCanvasPos.y,
        color: SLOT_BADGE[wireDrag.slot].color
      });
    }
  }

  const cats: Category[] = ["trigger", "action", "ifelse", "value", "loop", "calc", "ui", "variable"];

  /* ════ レンダー ════ */

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: "#23211e" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@800;900&family=Nunito:wght@800;900&family=M+PLUS+Rounded+1c:wght@800;900&display=swap');

        * {
          font-family: 'Outfit', 'Nunito', 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif !important;
        }

        /* スロット=押すボタン(凸)。ホバーで浮く・押すと沈む */
        .slot-btn:hover { filter: brightness(1.08); }
        .slot-btn:active {
          transform: translateY(3px);
          box-shadow: inset 0 2px 3px rgba(0,0,0,0.35), 0 0px 0 rgba(0,0,0,0.3) !important;
        }
        .slot-btn--armed:active { transform: none; }

        @keyframes pulse   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.7;transform:scale(1.15)} }
        @keyframes swallow { 0%{transform:scale(1)rotate(0deg);opacity:1} 30%{transform:scale(1.15)rotate(6deg);opacity:1} 70%{transform:scale(0.3)rotate(-8deg);opacity:0.6} 100%{transform:scale(0)rotate(0deg);opacity:0} }
        @keyframes chomp   { 0%{transform:scale(1)} 15%{transform:scale(1.14)} 35%{transform:scale(0.93)} 55%{transform:scale(1.07)} 75%{transform:scale(0.97)} 100%{transform:scale(1)} }

        @keyframes blockSnap {
          0%  { transform: translateY(-14px) scaleY(0.9); filter: brightness(2.2); }
          40% { transform: translateY(4px) scaleY(0.93); filter: brightness(1.4); }
          70% { transform: translateY(-2px) scaleY(1.02); filter: brightness(1.1); }
          100%{ transform: translateY(0) scaleY(1); filter: brightness(1); }
        }
        @keyframes blockAdd {
          /* 高所から落下 → 着地でぐにゃっと潰れる → 跳ね返り → 微振動 → 静止 */
          0%   { transform: translateY(-90px) scaleY(1.18) scaleX(0.92); opacity: 0; filter: drop-shadow(0 30px 6px rgba(0,0,0,0)); }
          15%  { opacity: 1; }
          50%  { transform: translateY(0) scaleY(1.18) scaleX(0.92); filter: drop-shadow(0 4px 10px rgba(0,0,0,0.45)); }
          60%  { transform: translateY(0) scaleY(0.68) scaleX(1.20); filter: drop-shadow(0 1px 8px rgba(0,0,0,0.35)); }
          72%  { transform: translateY(-9px) scaleY(1.08) scaleX(0.95); }
          83%  { transform: translateY(0) scaleY(0.95) scaleX(1.03); }
          92%  { transform: translateY(-2px) scaleY(1.02) scaleX(0.99); }
          100% { transform: translateY(0) scaleY(1) scaleX(1); opacity: 1; }
        }
        @keyframes impactRing {
          0%   { width: 18px; height: 6px; opacity: 0.85; border-width: 4px; }
          60%  { opacity: 0.5; }
          100% { width: 180px; height: 30px; opacity: 0; border-width: 1px; }
        }
        @keyframes impactFlash {
          0%   { width: 0; height: 0; opacity: 0.65; }
          100% { width: 220px; height: 220px; opacity: 0; }
        }
        @keyframes confettiBurst {
          0%   { transform: translate(0,0) rotate(0deg) scale(0.6); opacity: 0; }
          15%  { opacity: 1; }
          100% { transform: translate(var(--dx),var(--dy)) rotate(var(--rot)) scale(1); opacity: 0; }
        }
        @keyframes blockDelete {
          0%   { transform: scale(1)    rotate(0deg);  opacity: 1;    filter: brightness(1); }
          16%  { transform: scale(1.20) rotate(-7deg); opacity: 1;    filter: brightness(1.7); }
          34%  { transform: scale(0.82) rotate(8deg);  opacity: 0.95; filter: brightness(1.2); }
          60%  { transform: scale(1.06) rotate(-4deg) translateY(-10px); opacity: 0.65; filter: brightness(0.9); }
          100% { transform: scale(0)    rotate(40deg)  translateY(28px); opacity: 0;    filter: brightness(0.4); }
        }
        @keyframes blockDragHover {
          0%, 100% { transform: scale(1.06) rotate(-2deg) translateY(-3px); }
          50%      { transform: scale(1.06) rotate(2deg)  translateY(-5px); }
        }
        @keyframes blockClickPress {
          0%   { transform: scale(1)    translateY(0); }
          45%  { transform: scale(0.92) translateY(2px); }
          100% { transform: scale(1)    translateY(0); }
        }
        @keyframes toastSlideDown {
          0%   { transform: translate(-50%, -22px); opacity: 0; }
          100% { transform: translate(-50%, 0);     opacity: 1; }
        }
        @keyframes slotPulse {
          0%, 100% { filter: brightness(1.0); }
          50%      { filter: brightness(1.35); }
        }
        @keyframes wireTargetGlow {
          0%, 100% { filter: drop-shadow(0 0 4px currentColor) brightness(1.04); }
          50%      { filter: drop-shadow(0 0 14px currentColor) brightness(1.18); }
        }
        @keyframes particle {
          0%  {transform:translate(0,0)scale(1);opacity:1}
          100%{transform:translate(var(--dx),var(--dy))scale(0);opacity:0}
        }
        @keyframes glowPulse {
          0%,100%{filter:drop-shadow(0 0 8px var(--glow))}
          50%    {filter:drop-shadow(0 0 18px var(--glow))}
        }
        @keyframes wireAppear {
          0%  {stroke-dashoffset:1000;opacity:0}
          100%{stroke-dashoffset:0;opacity:0.9}
        }
        @keyframes bgFloat {
          0%,100%{background-position-y:0px}
          50%    {background-position-y:6px}
        }
        @keyframes snapPulse {
          0%   { transform: scale(1);    opacity: 1; }
          100% { transform: scale(1.04); opacity: 0.85; }
        }
        @keyframes snapLabelBob {
          0%   { transform: translateY(0);   }
          100% { transform: translateY(-3px);}
        }
        @keyframes hintFloat {
          0%,100%{ transform: translateY(0)   rotate(-2deg); }
          50%   { transform: translateY(-12px) rotate(2deg); }
        }
        @keyframes hintBounce {
          0%,100% { transform: translateY(0); opacity:0.85; }
          50%     { transform: translateY(6px); opacity:1; }
        }
        @keyframes hintFloat {
          0%,100%{ transform: translateY(0)   rotate(-2deg); }
          50%   { transform: translateY(-12px) rotate(2deg); }
        }
        @keyframes hintAura {
          0%,100%{ opacity: 0.55; transform: scale(1);    }
          50%   { opacity: 0.95; transform: scale(1.15); }
        }
        @keyframes neonBeam {
          0%,100%{ opacity: 0.4; }
          50%   { opacity: 1;   }
        }
        @keyframes snapPulse {
          0%   { transform: scale(1);    opacity: 1; }
          100% { transform: scale(1.04); opacity: 0.85; }
        }
        @keyframes snapLabelBob {
          0%   { transform: translateY(0);   }
          100% { transform: translateY(-3px);}
        }
        @keyframes spectrumShift {
          0%   { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        .btn-keycap:hover {
          transform: translateY(-1px);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -2px 3px rgba(0,0,0,0.04), 0 3px 0 #c9c3b0, 0 5px 10px rgba(120,100,60,0.18) !important;
        }
        .btn-keycap:active {
          transform: translateY(2px) !important;
          box-shadow: inset 0 1px 2px rgba(0,0,0,0.08), 0 0 0 #c9c3b0, 0 1px 2px rgba(120,100,60,0.08) !important;
        }
        @keyframes hintFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(1.5deg); }
        }
        @keyframes hintAura {
          0%, 100% { transform: scale(0.9); opacity: 0.25; filter: blur(15px); }
          50% { transform: scale(1.2); opacity: 0.55; filter: blur(25px); }
        }
      `}</style>

      {/* 1. 最上部ヘッダー（すべての操作を1行に集約 ＆ ブロックトレイ） */}
      <div className="mc-bevel" style={{
        background: "#2a2924",
        borderBottom: "2px solid #1f1e1a",
        display: "flex",
        flexDirection: "column",
        zIndex: 30,
        flexShrink: 0
      }}>
        {/* 1行目：カテゴリ、各種機能ボタン、検索窓をすべて1列に配置 */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", padding: "6px 12px", boxSizing: "border-box" }}>
          {/* 左端：トレイ開閉 */}
          <McButton size="sm" onClick={() => setShowLib(v => !v)} active={showLib} title={showLib ? "ブロックトレイを閉じる" : "ブロックトレイを開く"}>
            {showLib ? "📂 閉じる" : "📂 開く"}
          </McButton>
          <div style={{ width: 2, height: 16, background: "#4a4842", margin: "0 2px" }} />

          {/* カテゴリ選択タブ */}
          {cats.map(cat => {
            const c = CAT[cat];
            const isActive = !searching && cat === activeCategory;
            const borderBottomSize = isActive ? "4px" : "3px";
            return (
              <button key={cat} onClick={() => { setActiveCategory(cat); if (searching) setSearch(""); }}
                style={{
                  display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 12,
                  background: isActive ? `linear-gradient(135deg, ${c.top}, ${c.bg})` : "#3a3833",
                  borderLeft: `2.5px solid ${isActive ? c.border : "#5a574e"}`,
                  borderBottom: `${borderBottomSize} solid ${isActive ? c.border : "#1f1e1a"}`,
                  borderRight: `1.5px solid ${isActive ? "rgba(0,0,0,0.2)" : "#1f1e1a"}`,
                  borderTop: `1.5px solid ${isActive ? "rgba(255,255,255,0.2)" : "#5a574e"}`,
                  boxShadow: isActive ? "inset 2px 2px 0 rgba(255,255,255,0.4), 2px 2px 0 rgba(0,0,0,0.15)" : "2px 2px 0 rgba(0,0,0,0.15)",
                  color: isActive ? "#fff" : "#c8c4b8", fontWeight: 900, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
                  transform: isActive ? "translateY(1px)" : "none",
                  transition: "all 0.08s ease"
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.boxShadow = "3px 3px 0 rgba(0,0,0,0.2)";
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = "2px 2px 0 rgba(0,0,0,0.15)";
                  }
                }}
              >
                <span style={{ fontSize: 13 }}>{c.icon}</span><span style={{ whiteSpace: "nowrap" }}>{c.label}</span>
              </button>
            );
          })}
          <div style={{ width: 2, height: 16, background: "#4a4842", margin: "0 2px" }} />

          {/* 各種ツールボタン */}
          <McButton size="sm" onClick={zoomToFit} title="全ブロックを画面に収める">⊡</McButton>
          <McButton size="sm" onClick={resetPanZoom} title="ズーム＆位置をリセット (100% + 中央寄せ)">⊙</McButton>
          <McButton size="sm" onClick={undo} title="元に戻す (Ctrl+Z)">↩</McButton>
          <McButton size="sm" onClick={redo} title="やり直す (Ctrl+Y)">↪</McButton>

          <div style={{ width: 2, height: 16, background: "#4a4842", margin: "0 2px" }} />

          <McButton size="sm" variant={showProjects ? "grape" : "default"} onClick={() => setShowProjects(v => !v)} active={showProjects} title="プロジェクトの保存・読み込み">
            💾 保存/読込
          </McButton>
          <McButton size="sm" variant={showTemplates ? "info" : "default"} onClick={() => setShowTemplates(v => !v)} active={showTemplates} title="テンプレートギャラリー">
            🎮 サンプル
          </McButton>
          <McButton size="sm" variant={showCode ? "warning" : "default"} onClick={() => setShowCode(v => !v)} active={showCode} title="生成コードを表示">
            💻 コード
          </McButton>
          <McButton size="sm" variant={showHelp ? "primary" : "default"} onClick={() => setShowHelp(v => !v)} active={showHelp} title="操作ガイドを開く">
            ❓ ヘルプ
          </McButton>

          <div style={{ width: 2, height: 16, background: "#4a4842", margin: "0 2px" }} />

          {/* インテリアテーマ切替（Phase 1：工房 ⇄ 電脳） P9: 背景が変わると分かるUI */}
          <div
            title="このボタンで背景の雰囲気が変わる（工房=アナログ ⇄ 電脳=デジタル）"
            style={{
              display: "inline-flex",
              alignItems: "center",
              background: "#1f1e1a",
              border: "2px solid #0e0d0a",
              borderRadius: 10,
              padding: 2,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            <span style={{ fontSize: 10, fontWeight: 900, color: "#a59c8a", padding: "0 6px 0 5px", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>🎨 背景</span>
            <button
              onClick={() => setInteriorTheme("workshop")}
              aria-pressed={interiorTheme === "workshop"}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "4px 9px", fontSize: 11, fontWeight: 900, lineHeight: 1,
                background: interiorTheme === "workshop"
                  ? "linear-gradient(180deg, #b08040 0%, #6b4720 100%)"
                  : "transparent",
                color: interiorTheme === "workshop" ? "#fff8e6" : "#a59c8a",
                border: "none", borderRadius: 8, cursor: "pointer",
                boxShadow: interiorTheme === "workshop"
                  ? "inset 0 1px 0 rgba(255,230,170,0.5), 0 0 6px rgba(220,160,90,0.35)"
                  : "none",
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "linear-gradient(135deg,#e0a85a,#7a4f23)", boxShadow: "0 0 0 1px rgba(0,0,0,0.4)", display: "inline-block" }} />
              📻 <span>アナログ</span>
            </button>
            <button
              onClick={() => setInteriorTheme("cyber")}
              aria-pressed={interiorTheme === "cyber"}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "4px 9px", fontSize: 11, fontWeight: 900, lineHeight: 1,
                background: interiorTheme === "cyber"
                  ? "linear-gradient(180deg, #ec4899 0%, #06b6d4 100%)"
                  : "transparent",
                color: interiorTheme === "cyber" ? "#0a0517" : "#a59c8a",
                border: "none", borderRadius: 8, cursor: "pointer",
                boxShadow: interiorTheme === "cyber"
                  ? "inset 0 1px 0 rgba(255,255,255,0.4), 0 0 8px rgba(236,72,153,0.55)"
                  : "none",
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "linear-gradient(135deg,#ec4899,#06b6d4)", boxShadow: "0 0 0 1px rgba(0,0,0,0.4)", display: "inline-block" }} />
              📡 <span>デジタル</span>
            </button>
          </div>

          {/* 右端：検索窓 */}
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 さがす..."
            style={{
              marginLeft: "auto", width: 180, boxSizing: "border-box", padding: "6px 12px", fontSize: 13,
              background: "#ffffff", border: "3px solid #1f1e1a", borderRadius: 8, color: "#1f1e1a", outline: "none", fontWeight: 800,
              boxShadow: "inset 2px 2px 0 rgba(0,0,0,0.1), 3px 3px 0 rgba(0,0,0,0.15)",
              fontFamily: "'DotGothic16', sans-serif"
            }} />
        </div>

        {/* 2行目：ブロックトレイ */}
        {showLib && (
          <BlockTray filtered={filtered} onAdd={addBlock} searching={searching} activeCategory={activeCategory} />
        )}
      </div>

      {/* 2. 下部：メインキャンバス領域 */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", backgroundColor: "#252320" }}>
        {showProjects && (
          <ProjectPanel
            blocks={blocks}
            onLoad={b => { setBlocks(b); }}
            onClose={() => setShowProjects(false)}
          />
        )}
        {showTemplates && (
          <TemplateGallery
            onSelect={b => { setBlocks(prev => [...prev, ...b]); }}
            onClose={() => setShowTemplates(false)}
          />
        )}

        {showHelp && (
          <div className="mc-panel" style={{ position: "absolute", top: 10, right: 10, zIndex: 40, width: 250, background: "var(--surface)", overflow: "hidden" }}>
            <div style={{ padding: "10px 14px 8px", borderBottom: "2px solid var(--border-color)", background: "var(--panel)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="font-pixel text-[11px] text-accent">🎮 HOW TO PLAY</span>
              <button onClick={() => setShowHelp(false)} className="mc-btn mc-btn--sm" style={{ padding: "2px 6px" }}>✕</button>
            </div>
            <div style={{ padding: "12px 14px" }}>
              {[
                { icon: "🧩", s: "1", t: "上部トレイのブロックをクリックで追加" },
                { icon: "👆", s: "2", t: "条件のスロット（もしも/そうなら）をタップ → つなげる相手が光る" },
                { icon: "✨", s: "3", t: "光った相手をタップで接続（カチッ！）" },
                { icon: "🗑️", s: "4", t: "ブロックを選んで Delete で削除 / Ctrl+D でコピー" },
                { icon: "⎋", s: "⎋", t: "Esc で接続をキャンセル" },
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 12 }}>
                  <span className="mc-bevel-inset" style={{ width: 24, height: 24, background: "var(--panel)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>{s.icon}</span>
                  <div>
                    <span className="mc-badge mc-badge--sm" style={{ marginBottom: 4, fontSize: 9 }}>STEP {s.s}</span>
                    <div style={{ fontSize: 11, color: "var(--foreground)", fontWeight: 600, lineHeight: 1.4 }}>{s.t}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 統計インジケーター（スリム版） */}
        <div style={{
          position: "absolute", top: 8, left: 8, zIndex: 20,
          display: "flex", gap: 5
        }}>
          {/* ブロック数（P5: 上限なし・個数のみ表示） */}
          <div title={`配置ブロック ${blocks.length}個`} style={{
            background: "rgba(25, 25, 28, 0.82)",
            backdropFilter: "blur(4px)",
            border: "1px solid rgba(255,255,255,0.12)",
            padding: "3px 8px",
            borderRadius: 6,
            display: "inline-flex", alignItems: "center", gap: 4,
            boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
            color: "#fff",
            fontSize: 11, fontWeight: 800,
          }}>
            <span style={{ fontSize: 12 }}>📦</span>
            <span style={{
              fontFamily: "monospace", letterSpacing: "0.02em", color: "#00cec9"
            }}>{blocks.length}<span style={{ fontSize: 9, marginLeft: 1 }}>個</span></span>
          </div>

          {/* ズーム倍率（クリックで100%＋中央へ戻る） */}
          <button onClick={resetPanZoom} title="クリックで 100% + 画面中央に戻る" style={{
            background: "rgba(25, 25, 28, 0.82)",
            backdropFilter: "blur(4px)",
            border: "1px solid rgba(255,255,255,0.12)",
            padding: "3px 8px",
            borderRadius: 6,
            display: "inline-flex", alignItems: "center", gap: 4,
            boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
            color: "#fff",
            fontSize: 11, fontWeight: 800, cursor: "pointer",
          }}>
            <span style={{ fontSize: 12 }}>🎯</span>
            <span style={{ fontFamily: "monospace", letterSpacing: "0.02em", color: "#00b4d8" }}>{Math.round(zoom / BASE_ZOOM * 100)}%</span>
            <span style={{ fontSize: 9, color: "#888", marginLeft: 1 }}>↺戻る</span>
          </button>
        </div>

        {/* トースト通知（画面上部中央） */}
        {toast && (
          <div style={{
            position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
            zIndex: 100,
            padding: "10px 18px",
            borderRadius: 10,
            background: toast.level === "error" ? "rgba(220,53,69,0.96)"
              : toast.level === "warning" ? "rgba(255,193,7,0.96)"
                : "rgba(13,110,253,0.96)",
            color: toast.level === "warning" ? "#1a1a1a" : "#ffffff",
            fontSize: 13, fontWeight: 900,
            border: "2px solid rgba(0,0,0,0.4)",
            boxShadow: "0 6px 18px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.25)",
            pointerEvents: "none",
            maxWidth: "80%",
            textAlign: "center",
            animation: "toastSlideDown 0.25s cubic-bezier(0.2,0.8,0.2,1)",
          }}>
            <span style={{ fontSize: 15, marginRight: 6 }}>
              {toast.level === "error" ? "⚠️" : toast.level === "warning" ? "⚡" : "💡"}
            </span>
            {toast.message}
          </div>
        )}

        {/* 空キャンバス・ヒント */}
        {blocks.length === 0 && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            pointerEvents: "none", zIndex: 5,
          }}>
            {/* 黄金のオーラ効果 */}
            <div style={{
              position: "absolute",
              width: 240,
              height: 240,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(251,191,36,0.32) 0%, rgba(245,158,11,0.06) 50%, transparent 70%)",
              animation: "hintAura 4s ease-in-out infinite",
              zIndex: 1,
            }} />

            {/* 鍵とテキストのコンテナ */}
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              animation: "hintFloat 3.2s ease-in-out infinite",
              zIndex: 2,
            }}>
              {/* 黄金鍵のSVG */}
              <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: "drop-shadow(0 6px 14px rgba(245,158,11,0.45))" }}>
                {/* 持ち手 */}
                <path d="M 32,22 H 68 V 58 H 32 Z M 44,34 H 56 V 46 H 44 Z" fill="#78350f" />
                <path d="M 35,25 H 65 V 55 H 35 Z M 44,34 H 56 V 46 H 44 Z" fill="#fbbf24" />
                <path d="M 38,28 H 62 V 52 H 38 Z M 44,34 H 56 V 46 H 44 Z" fill="#f59e0b" />
                {/* 埋め込まれたダイヤモンド */}
                <path d="M 44,34 H 56 V 46 H 44 Z" fill="#00cec9" />
                <path d="M 46,36 H 54 V 44 H 46 Z" fill="#81ecec" />
                <path d="M 46,36 H 49 V 39 H 46 Z" fill="#ffffff" />

                {/* 軸 */}
                <path d="M 45,58 H 55 V 88 H 45 Z" fill="#78350f" />
                <path d="M 47,58 H 53 V 86 H 47 Z" fill="#d97706" />
                <path d="M 47,58 H 50 V 86 H 47 Z" fill="#fbbf24" />

                {/* 鍵歯 */}
                <path d="M 55,66 H 69 V 74 H 55 Z M 55,78 H 69 V 86 H 55 Z" fill="#78350f" />
                <path d="M 55,68 H 66 V 72 H 55 Z M 55,80 H 66 V 84 H 55 Z" fill="#f59e0b" />
                <path d="M 55,68 H 60 V 70 H 55 Z M 55,80 H 60 V 82 H 55 Z" fill="#fbbf24" />
              </svg>

              {/* CRAFT YOUR COMPONENT */}
              <h2 className="font-pixel" style={{
                fontSize: 16,
                marginTop: 16,
                marginBottom: 6,
                letterSpacing: "0.15em",
                background: "linear-gradient(to bottom, #ffeaa7, #fdcb6e)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                textShadow: "0 2px 4px rgba(0,0,0,0.55), 0 0 1px #000",
                fontWeight: 900,
              }}>
                CRAFT YOUR COMPONENT
              </h2>

              <p style={{
                fontSize: 11,
                color: "#a4b0be",
                fontWeight: 800,
                textAlign: "center",
                maxWidth: 320,
                lineHeight: 1.6,
                textShadow: "0 1px 2px rgba(0,0,0,0.6)",
              }}>
                トレイからブロックを選択し、キャンバスへ置いてロジックをクラフトしましょう。
              </p>
            </div>
          </div>
        )}

        {/* コードプレビュー */}
        {showCode && (
          <div className="mc-panel" style={{ position: "absolute", bottom: 10, left: 8, right: 8, zIndex: 40, maxHeight: 240, background: "var(--panel)", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", borderBottom: "2px solid var(--border-color)" }}>
              <span className="font-pixel text-[11px] text-accent">⚡ GENERATED CODE</span>
              <button onClick={() => setShowCode(false)} className="mc-btn mc-btn--sm">✕</button>
            </div>
            <pre style={{ flex: 1, overflowY: "auto", margin: 0, padding: "10px 14px", fontSize: 10, color: "#a3e635", fontFamily: "monospace", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-all", background: "#12110e" }}>
              {genCode}
            </pre>
          </div>
        )}

        {/* スナップインジケーター */}
        {snapHint && (
          <SnapIndicator x={snapHint.pos.x} y={snapHint.pos.y} zoom={zoom} slot={snapHint.slot}
            color={snapHint.slot === "inner" ? "#6c5ce7" : snapHint.slot === "then" ? "#00b894" : snapHint.slot === "else" ? "#e17055" : "#0984e3"} />
        )}

        {/* パーティクルバースト（土煙：粒のサイズと飛距離をランダム化で派手に） */}
        {particles.map(p => (
          <div key={p.id} style={{ position: "absolute", left: p.x, top: p.y, pointerEvents: "none", zIndex: 200 }}>
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
              const size = 6 + ((i * 37) % 6);                  // 6〜11px
              const reach = 36 + ((i * 53) % 24);               // 36〜59px
              const yBias = deg > 180 ? -8 : 0;               // 上方向にバイアス（土煙っぽく）
              return (
                <div key={deg} style={{
                  position: "absolute", width: size, height: size, borderRadius: "50%",
                  background: p.color,
                  pointerEvents: "none",
                  // @ts-ignore
                  "--dx": `${Math.cos(deg * Math.PI / 180) * reach}px`,
                  // @ts-ignore
                  "--dy": `${Math.sin(deg * Math.PI / 180) * reach + yBias}px`,
                  animation: `particle ${0.28 + i * 0.012}s cubic-bezier(0.1, 0.8, 0.3, 1) forwards`,
                  boxShadow: `0 0 6px ${p.color}`,
                  opacity: 0.85,
                }} />
              );
            })}
          </div>
        ))}

        {/* 着地の衝撃リング + 光フラッシュ */}
        {impacts.map(p => (
          <div key={p.id} style={{ position: "absolute", left: p.x, top: p.y, pointerEvents: "none", zIndex: 199 }}>
            {/* 地面に広がる楕円リング（カテゴリ色） */}
            <div style={{
              position: "absolute", left: "50%", top: "50%",
              transform: "translate(-50%,-50%)",
              border: `3px solid ${p.color}`,
              borderRadius: "50%",
              animation: "impactRing 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards",
              boxShadow: `0 0 18px ${p.color}99`,
            }} />
            {/* 同時にカテゴリ色の柔らかい光フラッシュ */}
            <div style={{
              position: "absolute", left: "50%", top: "50%",
              transform: "translate(-50%,-50%)",
              borderRadius: "50%",
              background: `radial-gradient(circle, ${p.color}80 0%, ${p.color}20 50%, transparent 70%)`,
              animation: "impactFlash 0.5s ease-out forwards",
            }} />
          </div>
        ))}

        {/* 紙吹雪（co_if 専用のお祝い演出） */}
        {confetti.map(c => (
          <div key={c.id} style={{ position: "absolute", left: c.x, top: c.y, pointerEvents: "none", zIndex: 201 }}>
            {Array.from({ length: 14 }).map((_, i) => {
              const ang = (i / 14) * 360 + (i * 17) % 30;
              const reach = 60 + (i % 4) * 22;
              const colors = ["#ec4899", "#a855f7", "#06b6d4", "#fbbf24", "#10b981"];
              const col = colors[i % colors.length];
              const shapes = ["50%", "2px", "20% 80% 20% 80% / 80% 20% 80% 20%"]; // 円・四角・葉っぱ
              const shape = shapes[i % shapes.length];
              return (
                <div key={i} style={{
                  position: "absolute", width: 7, height: 11,
                  background: col,
                  borderRadius: shape,
                  // @ts-ignore
                  "--dx": `${Math.cos(ang * Math.PI / 180) * reach}px`,
                  // @ts-ignore
                  "--dy": `${Math.sin(ang * Math.PI / 180) * reach - 30}px`, // 上方向にバイアス
                  // @ts-ignore
                  "--rot": `${(i % 2 ? 1 : -1) * (180 + i * 30)}deg`,
                  animation: `confettiBurst ${0.75 + (i % 5) * 0.06}s cubic-bezier(0.1, 0.7, 0.3, 1) forwards`,
                  boxShadow: `0 0 4px ${col}88`,
                }} />
              );
            })}
          </div>
        ))}

        {/* キャンバス背景（テーマ背景レイヤー — pan/zoom 影響なし） */}
        <div ref={containerRef} onMouseDown={handleBgDown} onWheel={handleWheel}
          style={{
            position: "absolute", inset: 0, cursor: "grab", backgroundColor: "#161513",
            zIndex: 0
          }}>

          {/* インテリア背景（screen 座標固定） — workshop / cyberpunk */}
          <ThemeBackdrop theme={interiorTheme} />

          {/* 床 — pan/zoom の影響を受けない screen 座標。ブロックが1個以上ある時だけ出現。
              ロジック画面の最下端に完全固定（床がある演出）。zIndex は world transform より上。 */}
          {blocks.length > 0 && (
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 6, pointerEvents: "none" }}>
              <ToyFloor />
            </div>
          )}

          {/* ブロックコンテナ */}
          <div style={{ position: "absolute", inset: 0, transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}>

            {mounted && (
              <>
                {/* 接続シームライン */}
                {connectors.map((c, i) => (
                  <Connector key={i} x={c.x} y={c.y} color={c.color} />
                ))}

                {/* コンセントコード（ケーブル）の描画レイヤー */}
                <svg style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  pointerEvents: "none",
                  zIndex: 5,
                }}>
                  {cables.map((c, i) => (
                    <g key={i}>
                      {/* 影 */}
                      <line x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} stroke="rgba(0,0,0,0.35)" strokeWidth="8.5" strokeLinecap="round" />
                      {/* ケーブル */}
                      <line x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} stroke={c.color} strokeWidth="5.5" strokeLinecap="round" />
                      {/* プラグ */}
                      <rect x={c.x2 - 7} y={c.y2 - 7} width={7} height={14} fill="#2c2c2c" rx={1.5} stroke="#4f4f4f" strokeWidth={1} />
                      {/* プラグの丸 */}
                      <circle cx={c.x2 - 10} cy={c.y2} r={3.5} fill={c.color} />
                    </g>
                  ))}
                </svg>

                {/* ブロック */}
                {blocks.map(b => {
                  const pos = getPos(b.id, blocks);
                  const isCond = b.type === "co_if";
                  const inner = isCond && b.innerId ? blocks.find(x => x.id === b.innerId) ?? null : null;

                  return <ToyCubeBlock key={b.id} b={b} pos={pos} selected={selected === b.id}
                    snapSlot={snapHint?.targetId === b.id ? snapHint.slot : null}
                    innerBlock={inner} blocks={blocks}
                    isEating={isCond && chomping === b.id}
                    isSnapping={snapAnim === b.id}
                    isAdding={addAnim === b.id}
                    isDeleting={deleteAnim === b.id}
                    onDown={handleBlockDown} onDelete={handleDelete}
                    onEjectInner={isCond ? handleEjectInner : undefined}
                    onFieldChange={handleFieldChange}
                    focusedField={focusedField}
                    setFocusedField={setFocusedField}
                    wireDrag={wireDrag}
                    onSlotClick={handleSlotClick}
                    isShaking={shakeAnim === b.id}
                    isDragging={blockDrag.current.active && blockDrag.current.id === b.id} />;
                })}

                {/* 食べられアニメーション（ToyCubeBlock用に合わせて修正） */}
                {eating && (() => {
                  const eb = blocks.find(b => b.id === eating);
                  const condBlock = eb ? blocks.find(d => d.innerId === eating) : null;
                  if (!eb || !condBlock) return null;
                  const dp = getPos(condBlock.id, blocks);
                  return <ToyCubeBlock key={`eat-${eating}`} b={eb}
                    pos={{ x: dp.x + BW + GAP, y: dp.y }}
                    selected={false} snapSlot={null} isEating={true}
                    blocks={blocks}
                    onDown={() => { }} onDelete={() => { }} onFieldChange={() => { }}
                    wireDrag={null} onSlotClick={() => { }} />;
                })()}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

