"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useEditorStore } from "./store";
import { McButton, McBadge } from "../_mc";

import { Category, FieldDef, CBlock, Tmpl, CalcSubCat, CatDef } from "./_types";
import { BW, BH, GAP, SNAP, BASE_ZOOM } from "./_constants";
import { CAT_WORKSHOP } from "../../data/categories";
import { TEMPLATES, CALC_SUBTABS, getCalcSubCat } from "../../data/templates";
import { ITEM_NAMES } from "../../data/itemNames";
import { blockH, getStackHeight, getDepth, getPos, getFamily, detach, attach, dist, findSnap } from "../../lib/blockGraph";
import { escStr, escId, gf, sanitizeVarName, genChain, genBlock, genExpr, genCond, genTrigger } from "../../lib/codegen";
let _uid = 6000;
const uid = () => `b${Date.now().toString(36)}${Math.random().toString(36).substring(2, 6)}`;

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

function getRootBlockId(blockId: string, blocks: CBlock[]): string {
  const parent = blocks.find(x => x.nextId === blockId || x.innerId === blockId || x.thenId === blockId || x.elseId === blockId);
  if (!parent) return blockId;
  return getRootBlockId(parent.id, blocks);
}

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

/** ブロックの実描画幅（ToyCubeBlockのwと一致。落下の左右回避でも使う） */
function blockWidth(b: CBlock, blocks: CBlock[]): number {
  const titleSize = b.label.length > 10 ? 11 : b.label.length > 8 ? 12 : b.label.length > 6 ? 13 : 15;
  const titleW = b.label.length * titleSize;
  let contentW = 0;
  b.fields.forEach(f => {
    let d = f.value || "";
    if (d.startsWith("minecraft:")) { const item = ITEM_NAMES[d]; if (item) d = `${item.icon} ${item.jp}`; }
    const flen = f.label.length + d.length;
    contentW = Math.max(contentW, flen * 10 + 40);
  });
  if (b.type === "co_if" || b.type === "ct_rep") {
    (["inner", "then", "else"] as const).forEach(slot => {
      const targetId = slot === "inner" ? b.innerId : slot === "then" ? b.thenId : b.elseId;
      const tb = targetId ? blocks.find(x => x.id === targetId) : null;
      if (tb) contentW = Math.max(contentW, tb.label.length * 8 + 68);
      else contentW = Math.max(contentW, 95);
    });
  }
  return Math.max(BW, Math.max(titleW + 48, contentW + 28));
}

 function ToyCubeBlock({ b, pos, pal, cyber, selected, snapSlot, isEating, isSnapping, isAdding, isDeleting, innerBlock, blocks, onDown, onDelete, onFieldChange, onEjectInner, focusedField, setFocusedField, wireDrag, onSlotClick, isShaking, isDragging, isPopping, isRolling, rollFrom, rollRot, rollDur }: {
  b: CBlock; pos: { x: number; y: number }; pal: Record<Category, CatDef>; cyber: boolean; selected: boolean; snapSlot: string | null;
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
  isPopping?: boolean;
  isRolling?: boolean;
  rollFrom?: number;
  rollRot?: number;
  rollDur?: number;
}) {
  const cat = pal[b.category];
  const hl = snapSlot !== null;
  const isCond = b.type === "co_if";
  const isLoop = b.type === "ct_rep";
  const thenH = isCond || isLoop ? (b.thenId ? getStackHeight(b.thenId, blocks) : 27) : 0;
  const elseH = isCond ? (b.elseId ? getStackHeight(b.elseId, blocks) : 0) : 0;
  const depth = getDepth(b.id, blocks);

  const isAcceptable = wireDrag && wireDrag.armed && wireDrag.accepts.includes(b.category) && wireDrag.sourceBlockId !== b.id;
  const isDimmed = wireDrag && wireDrag.armed && !isAcceptable && wireDrag.sourceBlockId !== b.id;
  const badgeColor = wireDrag ? SLOT_BADGE[wireDrag.slot]?.color : "#ffffff";

  const anim = isEating ? "swallow 0.55s ease-in forwards"
    : isDeleting ? "blockDelete 0.6s cubic-bezier(0.36,0.07,0.19,0.97) forwards"
      : isAdding ? "blockAdd 0.34s cubic-bezier(0.2, 0.8, 0.3, 1) forwards"
        : isRolling ? `blockRoll ${rollDur || 0.5}s cubic-bezier(0.25, 0.85, 0.4, 1.1) forwards` // ぶつかって右へ転がる→正面で着地
        : isPopping ? "blockPop 0.4s cubic-bezier(0.25, 1.5, 0.5, 1)" // ポップ！
          : isSnapping ? "blockSnap 0.12s ease-out"
            : isShaking ? "blockShake 0.3s ease-in-out" // Error shake
              : isAcceptable ? "wireTargetGlow 1.2s ease-in-out infinite"
                : isDragging ? "blockDragHover 0.55s ease-in-out infinite"
                  : selected ? "wireTargetGlow 1.8s ease-in-out infinite" // 選択中はゆっくりネオングローパルス！
                    : "none";

  // 共通グローの判定：イベントブロック（trigger）から繋がっているグループなら、そのイベント色をグループカラーとする
  const rootId = getRootBlockId(b.id, blocks);
  const rootBlock = blocks.find(x => x.id === rootId);
  const hasEventRoot = rootBlock && rootBlock.category === "trigger";
  const groupColor = hasEventRoot ? pal[rootBlock.category].bg : null;

  const titleSize = b.label.length > 10 ? 11 : b.label.length > 8 ? 12 : b.label.length > 6 ? 13 : 15;
  const w = blockWidth(b, blocks);
  const h = blockH(b);
  const R = 5;

  const innerBorder = "inset 1.5px 1.5px 0 rgba(255,255,255,0.10), inset -1.5px -1.5px 0 rgba(0,0,0,0.24)";

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
          display: "flex", flexDirection: "column", alignItems: "stretch", gap: 2,
          width: "100%", minHeight: 28, padding: "3px 5px", marginTop: 3,
          background: badge.color,
          border: isArmedThis ? "1.5px solid #ffffff" : `1.5px solid rgba(0,0,0,0.28)`,
          borderRadius: 5, color: "#ffffff", fontSize: 10, fontWeight: 900,
          cursor: "pointer",
          boxShadow: isArmedThis
            ? `0 0 8px ${badge.color}, inset 0 1.5px 0 rgba(255,255,255,0.45)`
            : "inset 0 1.5px 0 rgba(255,255,255,0.35), inset 0 -2px 0 rgba(0,0,0,0.28), 0 2px 0 rgba(0,0,0,0.3), 0 3px 4px rgba(0,0,0,0.25)",
          animation: isArmedThis ? "slotPulse 1.0s ease-in-out infinite" : "none",
          fontFamily: "'M PLUS Rounded 1c', 'Nunito', sans-serif",
          textShadow: "0px -1px 1px rgba(0,0,0,0.55), 0px 1px 1px rgba(255,255,255,0.2)",
          transition: "transform 0.08s ease, box-shadow 0.08s ease, filter 0.1s ease",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 3, lineHeight: 1 }}>
          <span style={{ fontSize: 10 }}>{badge.icon}</span>
          <span>{head.jp}</span>
        </span>

        {targetBlock ? (
          <span style={{
            width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            fontSize: 9, background: "rgba(0,0,0,0.55)", padding: "2px 5px", borderRadius: 4, color: "#fff",
            textShadow: "none", textAlign: "left", lineHeight: 1.2, boxShadow: "inset 0 1px 1.5px rgba(0,0,0,0.35)"
          }}>
            {targetBlock.label}
          </span>
        ) : (
          <span style={{
            width: "100%", fontSize: 9, color: "rgba(255,255,255,0.85)",
            background: "rgba(0,0,0,0.28)",
            padding: "2px 5px", borderRadius: 4,
            textShadow: "none", textAlign: "left", lineHeight: 1.2, whiteSpace: "nowrap",
            overflow: "hidden", textOverflow: "ellipsis", boxShadow: "inset 0 1px 1.5px rgba(0,0,0,0.3)"
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
      transformOrigin: (isAdding || isRolling) ? "bottom center" : "center center",
      ...(isRolling ? { 
        ["--roll-from" as never]: `${-(rollFrom ?? 0)}px`, 
        ["--roll-rot" as never]: `${-((rollFrom ?? 0) / BW) * 360}deg`,
        ["--bounce-rot" as never]: `${rollRot ?? 6}deg`
      } : {}),
      transform: selected && !isDragging ? "translate(-3px, -3px)" : "none", // 選択中はわずかに浮き上がる
      zIndex: isDragging ? 9999 : (selected ? 1000 : 20) + depth * 10,
      opacity: isDimmed ? 0.35 : 1.0,
      filter: isDimmed 
        ? "grayscale(0.5)" 
        : isDragging 
          ? "brightness(1.08) drop-shadow(0 8px 16px rgba(0,0,0,0.45)) drop-shadow(0 3px 6px rgba(0,0,0,0.3))" 
          : selected
            ? (cyber
                ? `brightness(1.1) drop-shadow(0 0 18px ${cat.bg}) drop-shadow(0 0 7px ${cat.bg}) drop-shadow(0 6px 12px rgba(0,0,0,0.4))` // デジタル選択：強ネオン
                : `brightness(1.06) drop-shadow(0 0 10px ${cat.bg}88) drop-shadow(0 6px 12px rgba(0,0,0,0.4))`) // アナログ選択
            : (cyber
                ? `drop-shadow(0 0 14px ${cat.bg}dd) drop-shadow(0 0 5px ${cat.bg}) drop-shadow(0 2px 4px rgba(0,0,0,0.35))` // デジタル通常：強めネオン発光
                : `drop-shadow(0 0 6px ${cat.bg}66) drop-shadow(0 2px 4px rgba(0,0,0,0.3))`), // アナログ通常：控えめ発光
      transition: "opacity 0.25s ease, filter 0.15s, transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1)",
    }}>
      {/* 3D上面 - 0.68倍スケール */}
      <div style={{
        position: "absolute",
        left: 0,
        top: -14,
        width: w,
        height: 14,
        background: `linear-gradient(to right, ${cat.top}, ${cat.top})`,
        borderRadius: `${R}px ${R}px 0 0`,
        transform: "skewX(-45deg)",
        transformOrigin: "bottom left",
        borderTop: `1.8px solid ${cat.border}`,
        borderLeft: `1.8px solid ${cat.border}`,
        borderRight: `1.5px solid rgba(0,0,0,0.08)`,
        borderBottom: `1.5px solid rgba(0,0,0,0.08)`,
        boxSizing: "border-box",
        zIndex: 1,
      }} />
      {/* 3D右側面 - 0.68倍スケール */}
      <div style={{
        position: "absolute",
        left: w,
        top: 0,
        width: 14,
        height: h,
        background: `linear-gradient(to bottom, ${cat.side}, ${cat.side})`,
        borderRadius: `0 ${R}px ${R}px 0`,
        transform: "skewY(-45deg)",
        transformOrigin: "top left",
        borderTop: `1.5px solid rgba(0,0,0,0.08)`,
        borderRight: `1.8px solid ${cat.border}`,
        borderBottom: `1.8px solid ${cat.border}`,
        borderLeft: `1.5px solid rgba(0,0,0,0.08)`,
        boxSizing: "border-box",
        zIndex: 1,
      }} />
      {/* 正面 */}
      <div style={{
        position: "absolute",
        left: 0, top: 0, width: w, height: h,
        background: `linear-gradient(135deg, ${cat.top}, ${cat.bg})`,
        borderRadius: `${R}px 0 0 ${R}px`,
        borderLeft: `1.8px solid ${cat.border}`,
        borderBottom: `1.8px solid ${cat.border}`,
        borderRight: `1.5px solid transparent`,
        borderTop: `1.5px solid transparent`,
        boxShadow: selected
          ? `${innerBorder}, 0 0 0 2.5px #ffffff, 0 0 0 5px ${cat.border}, 0 0 12px rgba(255,255,255,0.6)` // 白枠＋境界枠＋グロー
          : hl
            ? `${innerBorder}, 0 0 0 2.7px #ffffff`
            : isAcceptable
              ? `${innerBorder}, 0 0 0 2.7px #ffffff, 0 0 11px ${badgeColor}`
              : groupColor
                ? `${innerBorder}, 0 2px 6px rgba(0,0,0,0.35), 0 0 10px ${groupColor}55`
                : `${innerBorder}, 0 2px 6px rgba(0,0,0,0.35)`,
        transition: "box-shadow 0.15s, transform 0.1s",
        display: "flex", flexDirection: "column", padding: "3px 10px", boxSizing: "border-box",
        overflow: "hidden",
        zIndex: 2,
        justifyContent: "center",
      }}>
        <div style={{
          display: "flex", justifyContent: "center", alignItems: "center",
          marginTop: (isCond || isLoop) ? 8 : 2,
          paddingRight: 16, // ✕ボタン(18px)の重なり回避
        }}>
          <div style={{
            fontSize: titleSize,
            fontWeight: 900,
            color: cat.text,
            lineHeight: 1.1,
            textAlign: "center",
            width: "100%",
            textShadow: cat.text === "#ffffff"
              ? "1.2px 1.2px 0 #000, -1.2px 1.2px 0 #000, 1.2px -1.2px 0 #000, -1.2px -1.2px 0 #000"
              : "1px 1px 0 rgba(255,255,255,0.7), -1px 1px 0 rgba(255,255,255,0.7), 1px -1px 0 rgba(255,255,255,0.7), -1px -1px 0 rgba(255,255,255,0.7)",
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
          }}>
            {b.label}
          </div>
        </div>
        <div style={{
          fontSize: 10,
          color: cat.text === "#ffffff" ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.7)",
          textAlign: "center",
          textShadow: cat.text === "#ffffff"
            ? "1px 1px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000, -1px -1px 0 #000"
            : "1px 1px 0 rgba(255,255,255,0.5), -1px 1px 0 rgba(255,255,255,0.5), 1px -1px 0 rgba(255,255,255,0.5), -1px -1px 0 rgba(255,255,255,0.5)",
          fontWeight: 800, marginTop: 3, letterSpacing: "0.04em"
        }}>
          {cat.icon} {cat.label}
        </div>
        {isCond && (
          <div style={{ marginTop: 2, display: "flex", flexDirection: "column", gap: 1 }}>
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
            marginTop: 4, display: "flex", flexDirection: "column", gap: 3,
            background: "rgba(0,0,0,0.12)", padding: "4px", borderRadius: 5,
            border: `1.5px solid ${cat.border}`, boxShadow: "inset 2px 2px 0 rgba(0,0,0,0.18)"
          }}>
            {b.fields.map(f => {
              const isFocused = focusedField?.blockId === b.id && focusedField?.fieldId === f.id;
              return (
                <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 4, position: "relative", minHeight: 22 }}>
                  <span style={{
                    fontSize: 10, color: cat.text, fontWeight: 900, minWidth: 22,
                    textShadow: cat.text === "#ffffff"
                      ? "1px 1px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000, -1px -1px 0 #000"
                      : "none"
                  }}>{f.label}</span>
                  {(() => {
                    // コンボボックス: 候補(datalist)から「選べる」＋「自由入力もできる」両対応
                    let disp = f.value || "";
                    if (!isFocused && disp.startsWith("minecraft:")) {
                      const item = ITEM_NAMES[disp];
                      if (item) disp = `${item.icon} ${item.jp}`;
                    }
                    const dlId = f.options ? `dl-${b.id}-${f.id}` : undefined;
                    return (
                      <>
                        <input value={isFocused ? (f.value || "") : disp} onChange={e => onFieldChange(b.id, f.id, e.target.value)}
                          list={dlId}
                          onMouseDown={e => e.stopPropagation()}
                          onFocus={() => setFocusedField?.({ blockId: b.id, fieldId: f.id })}
                          onBlur={() => setFocusedField?.(null)}
                          style={{
                            flex: isFocused ? "none" : 1,
                            position: isFocused ? "absolute" : "relative",
                            left: isFocused ? 26 : "auto",
                            width: isFocused ? 150 : "100%",
                            zIndex: isFocused ? 999 : 1,
                            transition: "width 0.25s ease, z-index 0.25s",
                            fontSize: 11, background: "#2c2c2c", border: `1.5px solid #57606f`, borderRadius: 4, color: "#fff", padding: "3px 4px", outline: "none", fontWeight: 800,
                            boxShadow: "inset 1px 1px 0 rgba(0,0,0,0.5)", fontFamily: "inherit"
                          }} />
                        {f.options && (
                          <datalist id={dlId}>
                            {f.options.map(o => {
                              let od = o;
                              if (od.startsWith("minecraft:")) { const item = ITEM_NAMES[od]; if (item) od = `${item.icon} ${item.jp}`; }
                              return <option key={o} value={o} label={od !== o ? od : undefined} />;
                            })}
                          </datalist>
                        )}
                      </>
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
          onMouseDown={e => {
            e.stopPropagation();
            e.preventDefault();
            onDelete(b.id);
          }}
          title="削除"
          style={{
            position: "absolute", top: 4, right: 6,
            width: 22, height: 22, borderRadius: 4,
            background: "rgba(0,0,0,0.25)",
            border: `1px solid ${cat.border}`,
            color: cat.text, fontSize: 12, fontWeight: 900,
            cursor: "pointer", zIndex: 30, display: "flex", alignItems: "center", justifyContent: "center",
            opacity: 0.6,
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

function WorkshopBackdrop({ zoom, pan }: { zoom: number; pan: { x: number; y: number } }) {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes workshop-sway {
          0% { transform: rotate(-3deg); }
          100% { transform: rotate(3deg); }
        }
        @keyframes bulb-glow {
          0% { box-shadow: 0 0 20px #ff9f43, 0 0 40px rgba(255,159,67,0.5), inset 0 2px 4px rgba(255,255,255,0.6); }
          100% { box-shadow: 0 0 35px #ffb84d, 0 0 70px rgba(255,184,77,0.7), inset 0 2px 4px rgba(255,255,255,0.8); }
        }
        @keyframes dust-float-1 {
          0% { transform: translate(0, 0) scale(0.8); opacity: 0; }
          50% { transform: translate(25px, -45px) scale(1.2); opacity: 0.35; }
          100% { transform: translate(45px, -90px) scale(0.8); opacity: 0; }
        }
        @keyframes dust-float-2 {
          0% { transform: translate(0, 0) scale(1.1); opacity: 0; }
          50% { transform: translate(-30px, -60px) scale(0.7); opacity: 0.40; }
          100% { transform: translate(-15px, -120px) scale(1.0); opacity: 0; }
        }
        @keyframes dust-float-3 {
          0% { transform: translate(0, 0) scale(0.9); opacity: 0; }
          50% { transform: translate(15px, -70px) scale(1.0); opacity: 0.30; }
          100% { transform: translate(-10px, -140px) scale(0.7); opacity: 0; }
        }
      `}} />
      
      {/* 暖かいおもちゃ工房的グラデーション */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(circle at center 40%, #473222 0%, #1f140e 100%)",
      }} />

      {/* 工房という"部屋"＝一点透視の空間（壁画ではなく、奥行きのある箱の中にいる） */}
      <div style={{
        position: "absolute", inset: 0, overflow: "hidden",
        transform: `translate(${pan.x * 0.12}px, ${pan.y * 0.1}px) scale(${1 + (zoom - 1) * 0.3})`,
        transformOrigin: "center center",
        zIndex: 1,
      }}>
        {/* 天井（奥へ収束） */}
        <div style={{
          position: "absolute", top: "-4%", left: "-25%", right: "-25%", height: "48%",
          transform: "perspective(440px) rotateX(-48deg)",
          transformOrigin: "top center",
          background: `
            repeating-linear-gradient(90deg, rgba(0,0,0,0.12) 0px, rgba(0,0,0,0.12) 1px, transparent 1px, transparent 48px),
            linear-gradient(to top, #36251b 0%, #1a110c 100%)
          `,
          boxShadow: "inset 0 -50px 70px rgba(0,0,0,0.4)",
        }} />

        {/* 左の壁（消失点へ収束） */}
        <div style={{
          position: "absolute", left: "-3%", top: "-25%", bottom: "-25%", width: "36%",
          transform: "perspective(440px) rotateY(48deg)",
          transformOrigin: "left center",
          background: "linear-gradient(to right, #1a110c 0%, #3a271c 100%)",
          boxShadow: "inset -40px 0 60px rgba(0,0,0,0.35)",
        }} />
        {/* 右の壁（消失点へ収束） */}
        <div style={{
          position: "absolute", right: "-3%", top: "-25%", bottom: "-25%", width: "36%",
          transform: "perspective(440px) rotateY(-48deg)",
          transformOrigin: "right center",
          background: "linear-gradient(to left, #1a110c 0%, #3a271c 100%)",
          boxShadow: "inset 40px 0 60px rgba(0,0,0,0.35)",
        }} />

        {/* 奥の壁（遠く・小さく・暗い／横張りの板） */}
        <div style={{
          position: "absolute", left: "50%", top: "33%", width: "58%", height: "34%",
          transform: "translateX(-50%)",
          background: `
            repeating-linear-gradient(to bottom, #2d1c12 0px, #2d1c12 20px, #20140c 20px, #20140c 22px),
            linear-gradient(to bottom, #3b281b, #221710)
          `,
          boxShadow: "inset 0 0 70px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,0,0,0.3)",
        }} />

        {/* 床（手前広く→奥へ収束＝立っている地面。板の継ぎ目が消失点へ） */}
        <div style={{
          position: "absolute", bottom: "-4%", left: "-25%", right: "-25%", height: "56%",
          transform: "perspective(440px) rotateX(50deg)",
          transformOrigin: "bottom center",
          background: `
            repeating-linear-gradient(90deg, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 1.5px, transparent 1.5px, transparent 56px),
            repeating-linear-gradient(to top, rgba(255,198,120,0.05) 0px, rgba(255,198,120,0.05) 1px, transparent 1px, transparent 42px),
            linear-gradient(to top, #4d3624 0%, #2f1f14 65%, #1f140d 100%)
          `,
          boxShadow: "inset 0 50px 90px rgba(0,0,0,0.3)",
        }} />
      </div>

      {/* （配管バーは一旦撤去：全幅の棒が浮いて見えるため。工房の作り込みは後日まとめて） */}

      {/* ズームに合わせてスケールする親コンテナ（天井中央起点、パララックス中） */}
      <div style={{
        position: "absolute",
        top: 0,
        left: "50%",
        transformOrigin: "top center",
        /* 奥の部屋の備品＝背景プレーン：パンもズームもブロックより小さく反応＝奥行き。常に頭上に居る */
        transform: `translateX(calc(-50% + ${pan.x * 0.18}px)) translateY(${pan.y * 0.18}px) scale(${1 + (zoom - 1) * 0.45})`,
        width: 1,
        height: 1,
        zIndex: 3,
      }}>
        {/* 揺れるランプ ＆ ついてくる光（内側で揺らす） */}
        <div style={{
          transformOrigin: "top center",
          animation: "workshop-sway 6.5s ease-in-out infinite alternate",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: 1,
          height: 1,
        }}>
          {/* 天井カバーは撤去（天井が見えると不自然なため）。コードは上の闇から降りてくる */}

          {/* プレーンな細めの吊りコード（上端は闇へ溶ける） */}
          <div style={{
            width: 3,
            height: 170,
            background: "linear-gradient(to bottom, rgba(58,45,35,0) 0%, #3e3025 22%)",
            boxShadow: "0 0 2px rgba(0,0,0,0.4)",
            flexShrink: 0,
          }} />
          
          {/* レトロな真鍮製ソケット */}
          <div style={{
            width: 16,
            height: 22,
            background: "linear-gradient(to right, #8a6f4a, #b0976d, #8a6f4a)",
            border: "1px solid #57462e",
            borderRadius: "3px 3px 0 0",
            position: "relative",
            marginTop: -1,
            flexShrink: 0,
            boxShadow: "0 3px 5px rgba(0,0,0,0.3)",
          }}>
            {/* ソケットの金属溝 */}
            <div style={{
              position: "absolute",
              bottom: 4,
              left: 0,
              right: 0,
              height: 3,
              background: "#57462e",
            }} />
          </div>

          {/* 大きなまん丸裸電球 */}
          <div style={{
            width: 36,
            height: 36,
            background: "radial-gradient(circle at 50% 30%, rgba(255,238,190,0.98) 0%, rgba(255,160,30,0.85) 65%)",
            borderRadius: "50%",
            marginTop: -2,
            position: "relative",
            zIndex: 1,
            animation: "bulb-glow 3s ease-in-out infinite alternate",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            flexShrink: 0,
          }}>
            {/* フィラメントの光る細い線 */}
            <div style={{
              width: 6,
              height: 12,
              border: "1.5px solid #ffffff",
              borderBottom: "none",
              borderRadius: "3px 3px 0 0",
              opacity: 0.95,
              boxShadow: "0 0 6px #fff, 0 0 2px #ffb84d",
            }} />
          </div>

          {/* 芯のブルーム：電球そのものが空気ににじむ（郷愁の核）。電球中心(≈207)に重ねる */}
          <div style={{
            position: "absolute",
            top: 37,
            left: -170,
            width: 340,
            height: 340,
            background: "radial-gradient(circle at center, rgba(255,206,124,0.42) 0%, rgba(255,178,90,0.22) 28%, rgba(255,150,64,0.08) 55%, transparent 78%)",
            filter: "blur(14px)",
            pointerEvents: "none",
            zIndex: -1,
          }} />
          {/* 広い光だまり：電球起点に地面方向へ長く落ち、多段グラデで境目を闇に溶かす */}
          <div style={{
            position: "absolute",
            top: 185,
            left: -560,
            width: 1120,
            height: 920,
            background: "radial-gradient(ellipse 48% 56% at center top, rgba(255,182,78,0.25) 0%, rgba(255,168,64,0.18) 16%, rgba(255,152,52,0.12) 32%, rgba(255,138,44,0.06) 52%, rgba(255,126,38,0.02) 72%, transparent 100%)",
            filter: "blur(10px)",
            pointerEvents: "none",
            zIndex: -1,
          }} />

          {/* ホコリ粒子 (光の輪の中でゆっくり漂う) */}
          <div style={{ position: "absolute", top: 190, left: -150, width: 300, height: 300, pointerEvents: "none", zIndex: 0 }}>
            <div style={{ position: "absolute", left: "45%", top: "20%", width: 3, height: 3, borderRadius: "50%", background: "#ffeaa7", filter: "blur(0.5px)", animation: "dust-float-1 8s infinite ease-in-out" }} />
            <div style={{ position: "absolute", left: "30%", top: "45%", width: 2.5, height: 2.5, borderRadius: "50%", background: "#ffb84d", filter: "blur(0.5px)", animation: "dust-float-2 11s infinite ease-in-out" }} />
            <div style={{ position: "absolute", left: "60%", top: "35%", width: 3.5, height: 3.5, borderRadius: "50%", background: "#ffeaa7", filter: "blur(0.5px)", animation: "dust-float-3 9s infinite ease-in-out" }} />
            <div style={{ position: "absolute", left: "50%", top: "60%", width: 2, height: 2, borderRadius: "50%", background: "#ffb84d", filter: "blur(0.5px)", animation: "dust-float-1 13s infinite ease-in-out" }} />
          </div>
        </div>
      </div>

      {/* レイヤー3: 手前の作業台／棚の縁 (パララックス大、画面最下部) */}
      <div style={{
        position: "absolute",
        left: "-80px",
        right: "-80px",
        bottom: "-30px",
        height: "70px",
        background: "linear-gradient(to bottom, #1d140e 0%, #0d0805 100%)",
        borderTop: "3px solid #2d1e15",
        boxShadow: "0 -8px 24px rgba(0,0,0,0.7)",
        transform: `translate(${pan.x * 0.42}px, ${pan.y * 0.35}px) scale(${1 + (zoom - 1) * 0.42})`,
        transformOrigin: "center bottom",
        zIndex: 4,
      }}>
        {/* 抽象的なツールの影は撤去（高ズームで謎の黒箱に見えるため） */}
      </div>

      {/* 周辺ビネット（やや緩めて光が闇へ滑らかに溶けるように） */}
      <div style={{
        position: "absolute", inset: 0,
        boxShadow: "inset 0 0 300px rgba(0,0,0,0.6)",
        zIndex: 5,
      }} />
    </div>
  );
}

function CyberBackdrop({ zoom, pan }: { zoom: number; pan: { x: number; y: number } }) {
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes cyber-scan {
          0% { transform: translateY(-10%); }
          100% { transform: translateY(110%); }
        }
        @keyframes cyber-pulse {
          0% { opacity: 0.04; }
          100% { opacity: 0.09; }
        }
        @keyframes cyber-rotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes cyber-sparkle-1 {
          0% { transform: translate(0, 0) scale(0.5); opacity: 0; }
          50% { transform: translate(15px, -60px) scale(1.3); opacity: 0.45; }
          100% { transform: translate(5px, -120px) scale(0.5); opacity: 0; }
        }
        @keyframes cyber-sparkle-2 {
          0% { transform: translate(0, 0) scale(0.8); opacity: 0; }
          50% { transform: translate(-20px, -80px) scale(1.0); opacity: 0.40; }
          100% { transform: translate(-40px, -160px) scale(0.8); opacity: 0; }
        }
        @keyframes holo-float {
          0% { transform: translateY(0px); }
          100% { transform: translateY(-10px); }
        }
        @keyframes holo-glow {
          0% { opacity: 0.5; }
          100% { opacity: 0.85; }
        }
      `}} />
      
      {/* 電脳グリーンをベースにした漆黒の闇背景 */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(circle at center, #010803 0%, #000201 100%)",
      }} />

      {/* スキャンライン（走査線）風ストライプ */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(rgba(0,0,0,0.25) 50%, transparent 50%)",
        backgroundSize: "100% 4px",
        zIndex: 1,
      }} />

      {/* レイヤー1: 電脳の"空間"＝一点透視の緑ワイヤーフレーム部屋（フラット床→奥へ伸びる空間に。アナログ工房と同じ奥行き構造で色だけ冷たい緑） */}
      <div style={{
        position: "absolute", inset: 0, overflow: "hidden",
        transform: `translate(${pan.x * 0.12}px, ${pan.y * 0.1}px) scale(${1 + (zoom - 1) * 0.3})`,
        transformOrigin: "center center",
        zIndex: 2,
      }}>
        {/* 天井（奥へ収束する薄い緑グリッド） */}
        <div style={{
          position: "absolute", top: "-4%", left: "-25%", right: "-25%", height: "46%",
          transform: "perspective(440px) rotateX(-48deg)",
          transformOrigin: "top center",
          backgroundImage: "linear-gradient(rgba(79,217,138,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(79,217,138,0.10) 1px, transparent 1px)",
          backgroundSize: "54px 54px",
          boxShadow: "inset 0 -50px 70px rgba(0,2,1,0.6)",
        }} />
        {/* 左の壁（消失点へ収束） */}
        <div style={{
          position: "absolute", left: "-3%", top: "-25%", bottom: "-25%", width: "36%",
          transform: "perspective(440px) rotateY(48deg)",
          transformOrigin: "left center",
          backgroundImage: "linear-gradient(rgba(79,217,138,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(79,217,138,0.08) 1px, transparent 1px)",
          backgroundSize: "54px 54px",
          boxShadow: "inset -40px 0 60px rgba(0,2,1,0.6)",
        }} />
        {/* 右の壁（消失点へ収束） */}
        <div style={{
          position: "absolute", right: "-3%", top: "-25%", bottom: "-25%", width: "36%",
          transform: "perspective(440px) rotateY(-48deg)",
          transformOrigin: "right center",
          backgroundImage: "linear-gradient(rgba(79,217,138,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(79,217,138,0.08) 1px, transparent 1px)",
          backgroundSize: "54px 54px",
          boxShadow: "inset 40px 0 60px rgba(0,2,1,0.6)",
        }} />
        {/* 奥の壁（遠く・最も薄い緑グリッド） */}
        <div style={{
          position: "absolute", left: "50%", top: "33%", width: "58%", height: "34%",
          transform: "translateX(-50%)",
          backgroundImage: "linear-gradient(rgba(79,217,138,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(79,217,138,0.07) 1px, transparent 1px)",
          backgroundSize: "30px 30px",
          boxShadow: "inset 0 0 70px rgba(0,2,1,0.85)",
        }} />
        {/* 床（手前広く→奥へ収束する緑グリッド＝立っている地面。一番明るい＝手前） */}
        <div style={{
          position: "absolute", bottom: "-4%", left: "-25%", right: "-25%", height: "56%",
          transform: "perspective(440px) rotateX(50deg)",
          transformOrigin: "bottom center",
          backgroundImage: "linear-gradient(rgba(79,217,138,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(79,217,138,0.18) 1px, transparent 1px)",
          backgroundSize: "54px 54px",
          boxShadow: "inset 0 60px 90px rgba(0,2,1,0.55)",
        }} />
      </div>

      {/* 中央の発光体は撤去（きもい/不要との判断）。デジタルは"緑の空間＋漂う光の粒"の静かな世界に。 */}




      {/* 柔らかい電脳グロー（中央、パララックス中） */}
      <div style={{
        position: "absolute", top: "15%", left: "50%", transform: `translateX(calc(-50% + ${pan.x * 0.2}px)) translateY(${pan.y * 0.15}px)`, width: 700, height: 700,
        background: "radial-gradient(circle, rgba(79, 217, 138, 0.04) 0%, transparent 70%)",
        filter: "blur(50px)",
        animation: "cyber-pulse 6s ease-in-out infinite alternate",
        zIndex: 5,
      }} />

      {/* ラメ・スパークル粒子層 (ホログラム線上をゆっくり漂う) */}
      <div style={{ position: "absolute", inset: 0, zIndex: 6 }}>
        {/* ミント色スパークル */}
        <div style={{ position: "absolute", left: "15%", bottom: "25%", width: 2, height: 2, borderRadius: "50%", background: "#cffbe4", boxShadow: "0 0 4px #cffbe4", animation: "cyber-sparkle-1 9s infinite ease-in-out" }} />
        <div style={{ position: "absolute", left: "45%", bottom: "45%", width: 2.5, height: 2.5, borderRadius: "50%", background: "#cffbe4", boxShadow: "0 0 6px #cffbe4", animation: "cyber-sparkle-2 12s infinite ease-in-out" }} />
        <div style={{ position: "absolute", left: "75%", bottom: "15%", width: 1.8, height: 1.8, borderRadius: "50%", background: "#cffbe4", boxShadow: "0 0 3px #cffbe4", animation: "cyber-sparkle-1 14s infinite ease-in-out" }} />
        <div style={{ position: "absolute", left: "30%", bottom: "60%", width: 2, height: 2, borderRadius: "50%", background: "#cffbe4", boxShadow: "0 0 4px #cffbe4", animation: "cyber-sparkle-2 8s infinite ease-in-out" }} />
        {/* ごく稀に金の微粒子を1粒だけ */}
        <div style={{ position: "absolute", left: "60%", bottom: "35%", width: 3, height: 3, borderRadius: "50%", background: "#ffd700", boxShadow: "0 0 8px #ffd700", animation: "cyber-sparkle-1 16s infinite ease-in-out" }} />
      </div>

      {/* ゆっくり上から下へ流れる水平スキャンスイープ (画面固定) */}
      <div style={{
        position: "absolute",
        left: 0,
        right: 0,
        height: 120,
        background: "linear-gradient(to bottom, transparent, rgba(79, 217, 138, 0.025) 50%, transparent)",
        animation: "cyber-scan 8s linear infinite",
        zIndex: 7,
      }} />

      {/* 周辺ビネット */}
      <div style={{
        position: "absolute", inset: 0,
        boxShadow: "inset 0 0 220px rgba(0,0,0,0.96)",
        zIndex: 8,
      }} />
    </div>
  );
}

function ThemeBackdrop({ theme, zoom, pan }: { theme: "workshop" | "cyber"; zoom: number; pan: { x: number; y: number } }) {
  return theme === "cyber" ? <CyberBackdrop zoom={zoom} pan={pan} /> : <WorkshopBackdrop zoom={zoom} pan={pan} />;
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
  activeCategory,
  pal
}: {
  filtered: Tmpl[];
  onAdd: (t: Tmpl) => void;
  searching: boolean;
  activeCategory: Category;
  pal: Record<Category, CatDef>;
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
            const c = pal[t.category];

            // キャンバスのブロックと統一した 3D キューブの内側ベベル
            const innerBorder = "inset 1.5px 1.5px 0 rgba(255,255,255,0.12), inset -1.5px -1.5px 0 rgba(0,0,0,0.24)";
            const hoverInnerBorder = "inset 2px 2px 0 rgba(255,255,255,0.45), inset -2px -2px 0 rgba(0,0,0,0.26)";
            const pressInnerBorder = "inset 2px 2px 0 rgba(0,0,0,0.32), inset -2px -2px 0 rgba(255,255,255,0.20)";
            const bw_w = 86;
            const bw_h = 58;
            const FACE_D = 11;
            const R = 5;

            return (
              <button key={t.type + t.label} onClick={() => onAdd(t)} title={t.sublabel}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
                  width: bw_w, height: bw_h, padding: "3px 2px",
                  // 融合: 正面(=このボタン)を独立カードに見せない。継ぎ目側(上/右)の角丸と縁を消す。
                  borderRadius: `${R}px 0 0 ${R}px`,
                  background: `linear-gradient(135deg, ${c.top}, ${c.bg})`,
                  borderLeft: `2.5px solid ${c.border}`,
                  borderBottom: `2.5px solid ${c.border}`,
                  borderRight: `1px solid transparent`,
                  borderTop: `1px solid transparent`,
                  cursor: "pointer",
                  transition: "transform 0.1s cubic-bezier(0.2,0.8,0.2,1), box-shadow 0.1s ease, filter 0.1s ease",
                  // ブロックの体: 浮く"ボタン影"は出さず、キャンバスブロックと同じ斜めオフセット影で地に置く
                  boxShadow: `${innerBorder}, 2px 2px 0 rgba(0,0,0,0.18)`,
                  flexShrink: 0,
                  position: "relative",
                  overflow: "visible",
                  marginTop: FACE_D, // 3D 上面分の余白を上に確保（はみ出し防止）
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget;
                  // 持ち上げない。ブロックが"光る"だけ
                  el.style.boxShadow = `${hoverInnerBorder}, 2px 2px 0 rgba(0,0,0,0.2)`;
                  el.style.filter = "brightness(1.09)";
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget;
                  el.style.transform = "";
                  el.style.boxShadow = `${innerBorder}, 2px 2px 0 rgba(0,0,0,0.18)`;
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
                  el.style.boxShadow = `${hoverInnerBorder}, 2px 2px 0 rgba(0,0,0,0.2)`;
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
                  borderTop: `2.5px solid ${c.border}`,
                  borderLeft: `2.5px solid ${c.border}`,
                  borderRight: `1px solid rgba(0,0,0,0.22)`,
                  borderBottom: `1px solid rgba(0,0,0,0.22)`,
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
                  borderTop: `1px solid rgba(0,0,0,0.22)`,
                  borderRight: `2.5px solid ${c.border}`,
                  borderBottom: `2.5px solid ${c.border}`,
                  borderLeft: `1px solid rgba(0,0,0,0.22)`,
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

  // 古い記憶（過去のセーブデータ）を最新の仕様に浄化（絵文字分離・ラベル統一）＋ ルートブロックを床に接地させる
  const migrateBlocks = (blocks: any[]): CBlock[] => {
    const migrated = blocks.map(b => {
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

    // 重複キーの削除 (過去のバグでIDが被っていた場合へのフェイルセーフ)
    const seenIds = new Set<string>();
    const deduplicated = migrated.filter(b => {
      if (seenIds.has(b.id)) return false;
      seenIds.add(b.id);
      return true;
    });

    // 既存(読み込み済み)ブロックも床に接地（最初からある root ブロックが浮くのを防ぐ）
    const rootBlocks = deduplicated.filter(bl => {
      const hasParent = deduplicated.some(p => p.nextId === bl.id || p.innerId === bl.id || p.thenId === bl.id || p.elseId === bl.id);
      return !hasParent;
    });

    return deduplicated.map(bl => {
      if (rootBlocks.includes(bl)) {
        return { ...bl, y: 408 + BH - blockH(bl) };
      }
      return bl;
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
  // 統合版(積み木)はアナログ工房に1画面で統一。配色は工房パレット固定。
  const CAT = CAT_WORKSHOP;
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
  const [reveal, setReveal] = useState<string[] | null>(null); // ✨コード誕生の演出
  const [revShown, setRevShown] = useState(0);
  useEffect(() => {
    if (!reveal) return;
    let i = 0;
    const id = setInterval(() => { i++; setRevShown(i); if (i >= reveal.length) clearInterval(id); }, 70);
    return () => clearInterval(id);
  }, [reveal]);
  const [snapHint, setSnapHint] = useState<{ targetId: string; slot: string; pos: { x: number; y: number } } | null>(null);
  const [showSnapGuide, setShowSnapGuide] = useState(true);
  const [eating, setEating] = useState<string | null>(null);
  const [chomping, setChomping] = useState<string | null>(null);
  const [snapAnim, setSnapAnim] = useState<string | null>(null);   // スナップ時バウンス
  const [addAnim, setAddAnim] = useState<string | null>(null);   // 追加時スライドイン
  const [rollAnim, setRollAnim] = useState<{ id: string; from: number; rot?: number; dur?: number } | null>(null); // ぶつかって右へ転がる
  const [deleteAnim, setDeleteAnim] = useState<string | null>(null);   // 削除時フェードアウト
  const [shakeAnim, setShakeAnim] = useState<string | null>(null);   // エラー時ブルブル
  const [popBlocks, setPopBlocks] = useState<Record<string, boolean>>({}); // 接続成立時のバウンスブロック

  // パーティクルバースト (スクリーン座標)
  const [particles, setParticles] = useState<{ id: string; x: number; y: number; color: string; type?: string }[]>([]);
  // 着地時の衝撃リング / 光フラッシュ
  const [impacts, setImpacts] = useState<{ id: string; x: number; y: number; color: string }[]>([]);
  // 紙吹雪（co_if など特別ブロック用）
  const [confetti, setConfetti] = useState<{ id: string; x: number; y: number }[]>([]);
  const [showProjects, setShowProjects] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [toast, setToast] = useState<{ message: string; level: "success" | "error" | "warning" } | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string, level: "success" | "error" | "warning" = "warning") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, level });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const triggerPop = useCallback((id1: string, id2: string) => {
    setPopBlocks(prev => ({ ...prev, [id1]: true, [id2]: true }));
    setTimeout(() => {
      setPopBlocks(prev => {
        const copy = { ...prev };
        delete copy[id1];
        delete copy[id2];
        return copy;
      });
    }, 400);
  }, []);

  // P8-juice: ロジックが妥当かどうかの判定（ trigger ブロックが存在し、且つ nextId を持つツリーが1つ以上ある ）
  const isLogicValid = blocks.some(b => b.category === "trigger" && b.nextId !== null);
  const [logicCompleteAnim, setLogicCompleteAnim] = useState(false);
  const prevValidRef = useRef(false);

  useEffect(() => {
    if (isLogicValid && !prevValidRef.current) {
      // 完成した瞬間！
      setLogicCompleteAnim(true);
      playSuccessSound();
      showToast("ロジックが完成しました！マイクラへ出力できます！", "success");
      setTimeout(() => setLogicCompleteAnim(false), 800);
    }
    prevValidRef.current = isLogicValid;
  }, [isLogicValid, showToast]);

  // ─── 床（content Y=660）を画面底辺に揃える ───
  // 数式: pan.y + 660 * zoom = rect.height  →  pan.y = rect.height - 660 * zoom
  // マウント時とウィンドウリサイズ時に再計算。X は触らない（自由パン維持）。
  useEffect(() => {
    const alignFloor = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || rect.height <= 0) return;
      const groundY = 408 + BH; // = 473（ToyFloor の content Y）
      const desiredPanY = rect.height - groundY * live.current.zoom;
      // 床合わせは Y のみ。X は中央寄せ(resetPanZoom が設定)を維持する
      setPan((p) => ({ x: p.x, y: desiredPanY }));
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
        const groundY = 408 + BH;
        setPan({ x: rect.width / 2 - 200 * BASE_ZOOM, y: rect.height - groundY * BASE_ZOOM });
      } else {
        setPan({ x: 60, y: 60 });
      }
      return;
    }
    const positions = blocks.map(b => getPos(b.id, blocks));
    const minX = Math.min(...positions.map(p => p.x));
    const maxX = Math.max(...positions.map(p => p.x + BW));
    const cx = (minX + maxX) / 2;
    if (rect) {
      // 横=画面中央 / 縦=床(groundY=473)を画面下端にピタリ合わせる(alignFloorと一致・浮かせない)
      const groundY = 408 + BH;
      setPan({ x: rect.width / 2 - cx * BASE_ZOOM, y: rect.height - groundY * BASE_ZOOM });
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
    // キャンバスのパン移動（ドラッグ）は禁止し、選択解除のみ行う
    panDrag.current = { active: false, sx: 0, sy: 0, sp: { x: 0, y: 0 } };
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
          triggerPop(id, wireDrag.sourceBlockId);

          const pos = getPos(id, blocks);
          const screenX = pos.x * zoom + pan.x;
          const screenY = pos.y * zoom + pan.y;
          burstParticles(screenX, screenY, CAT[b.category].bg);
          
          // 波紋（Ripple）を追加
          setParticles(prev => [
            ...prev,
            { id: uid() + "_ripple", x: screenX, y: screenY, color: SLOT_BADGE[wireDrag.slot].color, type: "ripple" }
          ]);

          setWireDrag(null);
          return;
        } else {
          setShakeAnim(id);
          tone(150, 0.1, "sawtooth", 0.3); // Error sound
          showToast("ここには繋げないよ！", "warning");
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
        return; // パン移動（ドラッグ）は無効化（固定表示）
      }
      if (!blockDrag.current.active) return;
      const cx = (e.clientX - rect.left) / zoom - pan.x / zoom - blockDrag.current.offX;
      const cy = (e.clientY - rect.top) / zoom - pan.y / zoom - blockDrag.current.offY;
      const id = blockDrag.current.id;

      // 磁力吸着: スナップポイントに吸い寄せる
      const b = blocks.find(x => x.id === id)!;
      const dragH = blockH(b);
      const center = { x: cx + BW / 2, y: cy + dragH / 2 };
      const snap = findSnap(id, center, blocks);

      // ドラッグ中のブロック自体は、スナップ時でも強制吸着させずマウス位置（cx, cy）に追従させる
      let finalX = cx;
      let finalY = cy;

      // ブロックの下面が床の上面（408 + BH = 473）より下に沈み込まないように制限する
      finalY = Math.min(cy, 408 + BH - dragH);

      setBlocks(prev => prev.map(bl => bl.id === id ? { ...bl, x: finalX, y: finalY } : bl));

      // スナップヒント（ガイド線）の表示位置は、合体したときの正しい吸着座標に基づいて計算する
      if (snap) {
        const target = blocks.find(bl => bl.id === snap.targetId);
        if (target) {
          const tp = getPos(snap.targetId, blocks);
          let snapX = cx;
          let snapY = cy;
          if (snap.slot === "next") {
            if (target.type === "co_if" || target.type === "ct_rep") {
              const thenH = target.thenId ? getStackHeight(target.thenId, blocks) : 40;
              const elseH = target.type === "co_if" && target.elseId ? getStackHeight(target.elseId, blocks) : 0;
              const maxArmH = Math.max(thenH, elseH);
              snapX = tp.x;
              snapY = tp.y - maxArmH - 45 - dragH - GAP;
            } else {
              snapX = tp.x;
              snapY = tp.y - dragH - GAP;
            }
          } else if (snap.slot === "inner") {
            snapX = tp.x + BW + GAP;
            snapY = tp.y;
          } else if (snap.slot === "then") {
            snapX = tp.x;
            snapY = tp.y - dragH - GAP;
          } else if (snap.slot === "else") {
            snapX = tp.x + BW + GAP + 120;
            snapY = tp.y;
          }

          const screenX = (snapX + BW / 2) * zoom + pan.x;
          const screenY = (snapY + dragH / 2) * zoom + pan.y;
          setSnapHint({ targetId: snap.targetId, slot: snap.slot, pos: { x: screenX, y: screenY } });
        }
      } else {
        setSnapHint(null);
      }
    }
    function onUp() {
      if (panDrag.current.active) { panDrag.current.active = false; return; }
      if (!blockDrag.current.active) return;
      const { blocks, pan, zoom } = live.current;
      const id = blockDrag.current.id;
      const b = blocks.find(b => b.id === id)!;
      const dragH = blockH(b);
      const center = { x: b.x + BW / 2, y: b.y + dragH / 2 };
      const snap = findSnap(id, center, blocks);
      if (snap) {
        setBlocks(prev => attach(id, snap.targetId, snap.slot, prev));
        playSnapSound();
        triggerPop(id, snap.targetId);
        setSnapAnim(snap.targetId);
        setTimeout(() => setSnapAnim(null), 150);
        const { pan, zoom } = live.current;
        const tp = getPos(snap.targetId, blocks);
        const td = BW;
        const sx = (tp.x + td / 2) * zoom + pan.x;
        const sy = (tp.y + BH / 2) * zoom + pan.y;
        const color = CAT[blocks.find(bl => bl.id === snap.targetId)?.category || "action"].bg;
        burstParticles(sx, sy, color);
        
        // 波紋（Ripple）を追加
        const slotColor = SLOT_BADGE[snap.slot]?.color || color;
        setParticles(prev => [
          ...prev,
          { id: uid() + "_ripple", x: sx, y: sy, color: slotColor, type: "ripple" }
        ]);

        if (snap.slot === "inner") {
          setEating(id);
          setChomping(snap.targetId);
          playEatSound();
          setTimeout(() => setEating(null), 580);
          setTimeout(() => setChomping(null), 580);
        }
        setSnapHint(null);
      } else {
        // スナップなしドロップ（空中浮遊を排除し、常に画面左端下 X=60 の床またはそこにあるブロックの上へ落下・着地）
        playClickSound(); // 放開直後のカチッ音
        const droppedBlock = blocks.find(bl => bl.id === id)!;
        const dragH = blockH(droppedBlock);

        // 1. 落下先の X = プレイヤーが見ている画面の「左端」（ビューポート左下に落とす）
        const _rect = containerRef.current?.getBoundingClientRect();
        const targetLandX = _rect ? Math.round((40 - pan.x) / zoom) : 60;

        // 2. 自分（と自分のファミリー）以外の親なしブロックをすべて取得
        const myFamily = getFamily(id, blocks);
        const otherRoots = blocks.filter(bl => {
          if (myFamily.includes(bl.id)) return false;
          const hasParent = blocks.some(p =>
            p.nextId === bl.id || p.innerId === bl.id || p.thenId === bl.id || p.elseId === bl.id
          );
          return !hasParent;
        });

        // 3. 床に接地: いま画面に見えてる床ライン(screen下端)にブロック下面を合わせる(pan/zoom追従＝浮かない)
        const landY = _rect
          ? (_rect.height - 8 - pan.y) / zoom - dragH
          : 408 + BH - dragH;

        // 4. 左右回避: 既存の床ブロック(親なしroot)と「実際の幅」で重ならない空きXを左→右へ
        const myW = blockWidth(droppedBlock, blocks);
        const occupied = otherRoots.map(r => ({ x: getPos(r.id, blocks).x, w: blockWidth(r, blocks) }));
        const gapX = 12;
        let landX = targetLandX;
        let guard = 0;
        while (guard++ < 300) {
          const hit = occupied.find(o => landX < o.x + o.w + gapX && landX + myW + gapX > o.x);
          if (!hit) break;
          landX = hit.x + hit.w + gapX; // ぶつかった相手の右隣へピタリ
        }

        setBlocks(prev => prev.map(bl => bl.id === id ? { ...bl, x: landX, y: landY } : bl));

        // ぶつかって右へよけた分があれば「転がって正面で着地」アニメを発火
        const rolledRight = landX - targetLandX;
        if (rolledRight > 4) {
          const bounceRot = (Math.random() > 0.5 ? 1 : -1) * (3 + Math.random() * 5); // ランダムな傾きで個体差
          const dur = 0.45 + Math.random() * 0.12; // 0.45〜0.57s の個体差
          setRollAnim({ id, from: rolledRight, rot: bounceRot, dur });
          setTimeout(() => setRollAnim(null), dur * 1000 + 20);
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

    // 落下先の基準 X = プレイヤーが見ている画面の「左端」（ビューポート左下に落とす）
    const baseX = Math.round((40 - pan.x) / zoom);

    // まず y = 0 でブロックを生成し、その高さを取得する
    const nb = spawnBlock(t, baseX, 0);
    const nbH = blockH(nb);

    // 自動積み上げ配置
    let targetX = baseX;
    let targetY = 408 + BH - nbH; // 基本の床接地位置 (下面が 408 + BH になる位置)

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
          targetY = pos.y - nbH - GAP; // current の上にピッタリ積む
        }
      } else {
        targetX = baseX;
        targetY = 408 - nbH - GAP; // トリガー用スペースの上に積む
      }
    } else {
      // トリガー（イベント）ブロックも画面左端（baseX）に落とす
      targetX = baseX;
      targetY = 408 + BH - nbH; // 床に接地
    }

    nb.x = targetX;
    nb.y = targetY;

    // トレイから追加時、指定位置と重なる親なしブロックを右へバンプ（連鎖的）
    const positions = new Map<string, number>();
    blocks.forEach(b => positions.set(b.id, b.x));

    const rootBlocks = blocks.filter(bl => {
      const hasParent = blocks.some(p =>
        p.nextId === bl.id || p.innerId === bl.id || p.thenId === bl.id || p.elseId === bl.id
      );
      return !hasParent;
    });

    let checkAgain = true;
    while (checkAgain) {
      checkAgain = false;
      for (const bl of rootBlocks) {
        const currentX = positions.get(bl.id)!;
        const bPos = getPos(bl.id, blocks);
        const actualX = currentX;
        const actualY = bPos.y;

        const overlapWithNb = (targetX < actualX + BW && targetX + BW > actualX) &&
                              (targetY < actualY + (BH - 5) && targetY + (BH - 5) > actualY);

        let overlapWithOther = false;
        for (const other of rootBlocks) {
          if (other.id === bl.id) continue;
          const otherX = positions.get(other.id)!;
          const otherPos = getPos(other.id, blocks);
          const otherY = otherPos.y;

          const overlap = (otherX < actualX + BW && otherX + BW > actualX) &&
                          (targetY < actualY + (BH - 5) && targetY + (BH - 5) > actualY);

          if (overlap && otherX <= actualX && Math.abs(otherX - actualX) < BW) {
            overlapWithOther = true;
            break;
          }
        }

        if (overlapWithNb || overlapWithOther) {
          positions.set(bl.id, actualX + BW + 20);
          checkAgain = true;
        }
      }
    }

    setBlocks(prev => [
      ...prev.map(bl => positions.has(bl.id) ? { ...bl, x: positions.get(bl.id)! } : bl),
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
        const thenH = b.thenId ? getStackHeight(b.thenId, blocks) : 27;
        const elseH = b.type === "co_if" && b.elseId ? getStackHeight(b.elseId, blocks) : 0;
        const maxArmH = Math.max(thenH, elseH);
        connectors.push({ x: pp.x + BW / 2, y: pp.y - maxArmH - 31, color: CAT[b.category].bg });
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
          y1: pp.y + 41,
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
          y1: pp.y + 54,
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
          y1: pp.y + 68,
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
      let sY = ppos.y + 27;
      if (wireDrag.slot === "inner") sY = ppos.y + 41;
      else if (wireDrag.slot === "then") sY = ppos.y + 54;
      else if (wireDrag.slot === "else") sY = ppos.y + 68;

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
          /* 落下 → スッと静止（跳ねさせない・潰さない） */
          0%   { transform: translateY(-44px); opacity: 0; }
          30%  { opacity: 1; }
          100% { transform: translateY(0); opacity: 1; }
        }
        /* ぶつかって右へ転がる → 必ず正面で着地（ヒマワリ調整：速さ/ぽよん/転がり量/個体差） */
        @keyframes blockRoll {
          0%   { transform: translateX(var(--roll-from,0px)) rotate(var(--roll-rot,0deg)); }
          55%  { transform: translateX(0) rotate(0deg); }
          70%  { transform: translateX(0) rotate(var(--bounce-rot, 6deg)) scaleY(0.92) scaleX(1.05); }
          85%  { transform: translateX(0) rotate(calc(var(--bounce-rot, 6deg) * -0.3)) scaleY(1.02) scaleX(0.98); }
          100% { transform: translateX(0) rotate(0deg) scaleY(1) scaleX(1); }
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
          0%, 100% { filter: drop-shadow(0 0 4px rgba(255,255,255,0.7)) brightness(1.02); }
          50%      { filter: drop-shadow(0 0 14px rgba(255,255,255,0.95)) brightness(1.15); }
        }
        @keyframes connectRipple {
          0% { transform: scale(0.2); opacity: 1; border-width: 6px; }
          100% { transform: scale(2.0); opacity: 0; border-width: 1px; }
        }
        @keyframes blockPop {
          0% { transform: scale(1); }
          30% { transform: scale(1.1); }
          60% { transform: scale(0.97); }
          100% { transform: scale(1); }
        }
        @keyframes wirePulse {
          from { stroke-dashoffset: 60; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes blockShine {
          0% { filter: brightness(1.0); }
          50% { filter: brightness(1.4) drop-shadow(0 0 16px rgba(255,255,255,0.85)); }
          100% { filter: brightness(1.0); }
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
          <McButton
            size="sm"
            variant="danger"
            onClick={() => {
              if (window.confirm("キャンバス上のすべてのブロックを消去しますか？")) {
                setBlocks([]);
                setSelected(null);
                playDeleteSound();
                showToast("すべてのブロックを消去しました", "warning");
              }
            }}
            title="すべてのブロックを消去する"
          >
            🗑️ クリア
          </McButton>

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
          <McButton
            size="sm"
            variant={isLogicValid ? "success" : "default"}
            disabled={!isLogicValid}
            onClick={() => {
              playSuccessSound();
              const lines = (genCode || "// まず きっかけ ブロックを置いて繋げよう").split("\n");
              setRevShown(0); setReveal(lines);
            }}
            title={isLogicValid ? "アドオンをマイクラへ出力する" : "きっかけブロックを配置して繋げてください"}
            style={{
              opacity: isLogicValid ? 1.0 : 0.45,
              cursor: isLogicValid ? "pointer" : "not-allowed",
              transition: "all 0.2s ease",
              boxShadow: isLogicValid ? "0 0 10px rgba(16,185,129,0.45)" : "none",
            }}
          >
            ▶ マイクラへ
          </McButton>

          {/* 背景テーマ切替は撤去：統合版(積み木)はアナログ工房に1画面で統一 */}

          {/* 右端：検索窓 */}
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 さがす..."
            style={{
              marginLeft: "auto", width: 180, boxSizing: "border-box", padding: "6px 12px", fontSize: 13,
              background: "#1c1b18", border: "3px solid #4a4842", borderRadius: 8, color: "#e5e3db", outline: "none", fontWeight: 800,
              boxShadow: "inset 2px 2px 0 rgba(0,0,0,0.35), 2px 2px 0 rgba(255,255,255,0.05)",
              fontFamily: "'DotGothic16', sans-serif"
            }} />
        </div>

        {/* 2行目：ブロックトレイ */}
        {showLib && (
          <BlockTray filtered={filtered} onAdd={addBlock} searching={searching} activeCategory={activeCategory} pal={CAT} />
        )}
      </div>

      {/* 2. 下部：メインキャンバス領域 */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden", backgroundColor: "#252320" }}>
        {showProjects && (
          <ProjectPanel
            blocks={blocks}
            onLoad={b => { setBlocks(migrateBlocks(b)); }}
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
          <div style={{
            position: "absolute", top: 10, right: 10, zIndex: 40, width: 244,
            background: "rgba(22, 18, 14, 0.92)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(212, 175, 110, 0.22)",
            borderRadius: 12,
            boxShadow: "0 10px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
            overflow: "hidden",
          }}>
            <div style={{
              padding: "11px 14px",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              borderBottom: "1px solid rgba(212,175,110,0.15)",
            }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", color: "#d8b46a", textTransform: "uppercase" }}>How to play</span>
              <button onClick={() => setShowHelp(false)} style={{
                width: 20, height: 20, borderRadius: 6, border: "none",
                background: "rgba(255,255,255,0.06)", color: "#a59c8a", cursor: "pointer",
                fontSize: 12, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center",
              }}>✕</button>
            </div>
            <div style={{ padding: "12px 14px 6px" }}>
              {[
                { s: "1", t: "上部トレイのブロックをクリックで追加" },
                { s: "2", t: "条件のスロット（もしも/そうなら）をタップ → つなげる相手が光る" },
                { s: "3", t: "光った相手をタップで接続（カチッ！）" },
                { s: "4", t: "ブロックを選んで Delete で削除 / Ctrl+D でコピー" },
                { s: "Esc", t: "Esc で接続をキャンセル" },
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                  <span style={{
                    flexShrink: 0, width: 22, height: 22, borderRadius: "50%",
                    background: "linear-gradient(160deg, #8a6f4a, #5b4730)",
                    border: "1px solid rgba(212,175,110,0.5)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25), 0 1px 2px rgba(0,0,0,0.4)",
                    color: "#f3e3c0", fontSize: s.s.length > 1 ? 9 : 11, fontWeight: 800,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "monospace",
                  }}>{s.s}</span>
                  <div style={{ fontSize: 11.5, color: "rgba(245,240,232,0.9)", fontWeight: 500, lineHeight: 1.45, paddingTop: 2 }}>{s.t}</div>
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
            }}>{mounted ? blocks.length : 0}<span style={{ fontSize: 9, marginLeft: 1 }}>個</span></span>
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

          {/* ガイド線トグル（🎯 ガイド線） */}
          <button onClick={() => setShowSnapGuide(!showSnapGuide)} title="スナップ時のガイド線の表示/非表示（初心者向けガイド）" style={{
            background: showSnapGuide ? "rgba(0, 184, 148, 0.15)" : "rgba(25, 25, 28, 0.82)",
            backdropFilter: "blur(4px)",
            border: showSnapGuide ? "1px solid rgba(0, 184, 148, 0.5)" : "1px solid rgba(255,255,255,0.12)",
            padding: "3px 8px",
            borderRadius: 6,
            display: "inline-flex", alignItems: "center", gap: 4,
            boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
            color: showSnapGuide ? "#55efc4" : "#888",
            fontSize: 11, fontWeight: 800, cursor: "pointer",
          }}>
            <span style={{ fontSize: 12 }}>🎯</span>
            <span style={{ letterSpacing: "0.02em" }}>ガイド線:{showSnapGuide ? "ON" : "OFF"}</span>
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

        {/* ✨ コード誕生の魔法（SPROUT＝工房の暖色／本物の出力コードが生まれる） */}
        {reveal && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 200,
            background: "radial-gradient(120% 100% at 50% 25%, #1c130a 0%, #0c0805 100%)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24,
            animation: "toastSlideDown 0.3s ease-out",
          }}>
            <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: "0.2em", color: "#ffcf8a", marginBottom: 8, textShadow: "0 0 14px #ffab4d" }}>✨ あなたが書いたコードが生まれた</div>
            <pre style={{ fontFamily: "monospace", fontSize: 13, lineHeight: 1.7, color: "#ffe2b0", textShadow: "0 0 8px rgba(255,171,77,0.4)", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,171,77,0.25)", borderRadius: 12, padding: "16px 22px", maxWidth: 720, width: "100%", overflow: "auto", maxHeight: "55%", margin: 0, whiteSpace: "pre-wrap", boxShadow: "0 0 40px rgba(255,171,77,0.12)" }}>
              {reveal.slice(0, revShown).join("\n")}{revShown < reveal.length ? " ▋" : ""}
            </pre>
            {revShown >= reveal.length && (
              <div style={{ marginTop: 18, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#fff", textShadow: "0 0 18px #ffab4d" }}>🟢 マイクラで動く — これ、<span style={{ color: "#ffd9a0" }}>あなたが創った</span>。</div>
                <button type="button" onClick={() => setReveal(null)} style={{ border: "none", cursor: "pointer", background: "linear-gradient(135deg,#f0b25a,#b8742a)", color: "#3a2405", fontWeight: 900, fontSize: 13, padding: "9px 20px", borderRadius: 11, boxShadow: "0 4px 16px rgba(240,178,90,0.4)" }}>とじる</button>
              </div>
            )}
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
        {snapHint && showSnapGuide && (
          <SnapIndicator x={snapHint.pos.x} y={snapHint.pos.y} zoom={zoom} slot={snapHint.slot}
            color={snapHint.slot === "inner" ? "#6c5ce7" : snapHint.slot === "then" ? "#00b894" : snapHint.slot === "else" ? "#e17055" : "#0984e3"} />
        )}

        {/* パーティクルバースト（土煙：粒のサイズと飛距離をランダム化で派手に） */}
        {particles.map(p => {
          if (p.type === "ripple") {
            return (
              <div key={p.id} style={{
                position: "absolute", left: p.x - 30, top: p.y - 30,
                width: 60, height: 60, borderRadius: "50%",
                border: `4px solid ${p.color}`,
                boxShadow: `0 0 12px ${p.color}, inset 0 0 12px ${p.color}`,
                pointerEvents: "none", zIndex: 201,
                animation: "connectRipple 0.5s cubic-bezier(0.1, 0.8, 0.3, 1) forwards"
              }} />
            );
          }
          return (
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
          );
        })}

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
          <ThemeBackdrop theme="workshop" zoom={zoom} pan={pan} />

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
                      <line x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} stroke="rgba(0,0,0,0.35)" strokeWidth="5.8" strokeLinecap="round" />
                      {/* ケーブル */}
                      <line x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} stroke={c.color} strokeWidth="3.8" strokeLinecap="round" />
                      {/* 電流パルス (常時流れるほのかなパルス) */}
                      <line x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} stroke="#ffffff" strokeWidth="3.8" strokeLinecap="round"
                        strokeDasharray="8 32"
                        style={{ animation: "wirePulse 1.8s linear infinite", opacity: 0.45 }} />
                      {/* プラグ */}
                      <rect x={c.x2 - 5} y={c.y2 - 5} width={5} height={10} fill="#2c2c2c" rx={1} stroke="#4f4f4f" strokeWidth={1} />
                      {/* プラグの丸 */}
                      <circle cx={c.x2 - 7} cy={c.y2} r={2.4} fill={c.color} />
                    </g>
                  ))}
                </svg>

                {/* ブロック */}
                {blocks.map(b => {
                  const pos = getPos(b.id, blocks);
                  const isCond = b.type === "co_if";
                  const inner = isCond && b.innerId ? blocks.find(x => x.id === b.innerId) ?? null : null;

                  return <ToyCubeBlock key={b.id} b={b} pos={pos} pal={CAT} cyber={false} selected={selected === b.id}
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
                    isDragging={blockDrag.current.active && blockDrag.current.id === b.id}
                    isPopping={popBlocks[b.id]}
                    isRolling={rollAnim?.id === b.id}
                    rollFrom={rollAnim?.id === b.id ? rollAnim.from : 0}
                    rollRot={rollAnim?.id === b.id ? rollAnim.rot : undefined}
                    rollDur={rollAnim?.id === b.id ? rollAnim.dur : undefined} />;
                })}

                {/* 食べられアニメーション（ToyCubeBlock用に合わせて修正） */}
                {eating && (() => {
                  const eb = blocks.find(b => b.id === eating);
                  const condBlock = eb ? blocks.find(d => d.innerId === eating) : null;
                  if (!eb || !condBlock) return null;
                  const dp = getPos(condBlock.id, blocks);
                  return <ToyCubeBlock key={`eat-${eating}`} b={eb} pal={CAT} cyber={false}
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

