"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useEditorStore } from "./store";
import { McButton, McBadge } from "../_mc";
import { CodeRevealOverlay } from "./CodeRevealOverlay";
import LiveStage from "./LiveStage";
import * as LucideIcons from "lucide-react";

import { Category, FieldDef, CBlock, Tmpl, CalcSubCat, CatDef } from "./_types";
import { BW, BH, GAP, SNAP, BASE_ZOOM } from "./_constants";
import { CAT, CAT_WORKSHOP } from "../../data/categories";
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
    name: "ウェルカムMod", emoji: "UserPlus", desc: "参加時に歓迎メッセージを送信",
    create: () => {
      const a = spawnBlock(T("ev_join"), 100, 600);
      let b = spawnBlock(T("ac_msg"), 100, 600 - BH - GAP);
      b = sf(sf(b, "msg", "ようこそ！🎉 Modが動いています！"), "target", "@a");
      a.nextId = b.id;
      return mkPreset([a, b]);
    },
  },
  {
    name: "HP危険警告", emoji: "HeartPulse", desc: "HP10以下で赤いメッセージを表示",
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

/** スロットリール回転時のカチカチ音 */
function playSlotTickSound() {
  tone(880, 0.015, "triangle", 0.08);
}

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
  return BW;
}

const CARD_INDEX: Record<Category, string> = {
  trigger: "★",
  action: "A",
  ifelse: "Q",
  loop: "L",
  value: "V",
  calc: "C",
  ui: "U",
  variable: "X",
};

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
  const cardIdx = CARD_INDEX[b.category] || "●";
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

  const w = blockWidth(b, blocks);
  const h = blockH(b);

  const renderSlotButton = (slotKey: "inner" | "then" | "else") => {
    const badge = SLOT_BADGE[slotKey];
    const head = SLOT_HEAD[slotKey];
    const targetId = slotKey === "inner" ? b.innerId : slotKey === "then" ? b.thenId : b.elseId;
    const targetBlock = targetId ? blocks.find(x => x.id === targetId) : null;
    const isArmedThis = wireDrag && wireDrag.sourceBlockId === b.id && wireDrag.slot === slotKey && wireDrag.armed;

    const isInner = slotKey === "inner";

    return (
      <div
        key={slotKey}
        className={isArmedThis ? "slot-btn slot-btn--armed" : "slot-btn"}
        onMouseDown={e => {
          e.stopPropagation();
          onSlotClick(b.id, slotKey);
        }}
        style={{
          width: 18, height: 18, borderRadius: "50%",
          background: isArmedThis ? badge.color : "rgba(0,0,0,0.6)",
          border: `2px solid ${isArmedThis ? "#fff" : badge.color}`,
          cursor: "pointer",
          boxShadow: isArmedThis ? `0 0 10px ${badge.color}` : "inset 0 2px 4px rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s ease",
          position: "relative"
        }}
        title={`${head.jp} (${targetBlock ? targetBlock.label : "Empty"})`}
        onMouseEnter={e => {
          if (!isArmedThis) e.currentTarget.style.transform = "scale(1.2)";
        }}
        onMouseLeave={e => {
          if (!isArmedThis) e.currentTarget.style.transform = "scale(1)";
        }}
      >
        {targetBlock && <div style={{ width: 8, height: 8, borderRadius: "50%", background: badge.color }} />}
      </div>
    );
  };

  // Lucideアイコンの動的取得
  // @ts-ignore
  const IconComponent = LucideIcons[cat.icon] || LucideIcons.HelpCircle;
  // 特殊なブロックの場合は独自のアイコンを使用（テンプレートに指定がある場合）
  // @ts-ignore
  const BlockIconComponent = (b.emoji && LucideIcons[b.emoji]) ? LucideIcons[b.emoji] : IconComponent;

  // カードサイズを黄金比に近く、横幅をしっかり持たせたトランプサイズに調整（幅82, 高さ112）
  const cardW = 82;
  const cardH = 112;
  const leftOffset = (w - cardW) / 2; // -9px センタリング

  return (
    <div onMouseDown={e => onDown(e, b.id)} style={{
      position: "absolute", left: pos.x, top: pos.y,
      width: w, height: h,
      cursor: isDragging ? "grabbing" : "grab", userSelect: "none",
      animation: anim,
      transformOrigin: "center center",
      ...(isRolling ? {
        ["--roll-from" as never]: `${-(rollFrom ?? 0)}px`,
        ["--roll-rot" as never]: `${-((rollFrom ?? 0) / BW) * 360}deg`,
        ["--bounce-rot" as never]: `${rollRot ?? 6}deg`
      } : {}),
      transform: isDragging
        ? "scale(1.1) translateY(-8px)"
        : selected
          ? "scale(1.05) translateY(-4px)"
          : "none",
      zIndex: isDragging ? 9999 : (selected ? 1000 : 20) + depth * 10,
      opacity: isDimmed ? 0.35 : 1.0,
      filter: isDimmed
        ? "grayscale(0.5)"
        : isDragging
          ? "brightness(1.1) drop-shadow(0 15px 25px rgba(0,0,0,0.5))"
          : selected
            ? `brightness(1.1) drop-shadow(0 0 15px ${cat.bg}AA) drop-shadow(0 8px 16px rgba(0,0,0,0.4))`
            : `drop-shadow(0 0 8px ${cat.bg}66) drop-shadow(0 4px 8px rgba(0,0,0,0.3))`,
      transition: "opacity 0.25s ease, filter 0.15s, transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1)",
    }}>
      {/* メインカードノード（カラフルなトランプカード風） */}
      <div style={{
        position: "absolute",
        left: leftOffset, top: 0, width: cardW, height: cardH,
        background: `linear-gradient(135deg, ${cat.top}, ${cat.bg})`, // 前のカラフルなグラデーション背景
        borderRadius: "8px",
        border: selected
          ? `2.5px solid #ffffff`
          : hl || isAcceptable
            ? `2.5px solid ${badgeColor || "#ffffff"}`
            : `2px solid rgba(255,255,255,0.3)`,
        boxShadow: selected
          ? `0 0 0 3px #ffffff, 0 8px 20px rgba(0,0,0,0.35)`
          : hl || isAcceptable
            ? `0 0 0 3px #ffffff, 0 0 14px ${badgeColor || "#fff"}`
            : `0 4px 10px rgba(0,0,0,0.25)`,
        transition: "all 0.15s ease",
        display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
        padding: "5px",
        boxSizing: "border-box",
        zIndex: 2,
      }}>
        {/* インナーデザインフレーム */}
        <div style={{
          width: "100%",
          height: "100%",
          border: "1.5px solid rgba(255,255,255,0.25)", // 白半透明の内枠
          borderRadius: "5px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 2px 10px", // 下部パディングを増やしてラベル位置を上げる
          boxSizing: "border-box",
          position: "relative",
        }}>
          {/* 左上のインデックス */}
          <div style={{
            position: "absolute",
            left: 5, top: 4,
            lineHeight: 1.0,
            color: "#ffffff",
            fontWeight: 900,
            fontSize: 10,
            textShadow: "1px 1px 1px rgba(0,0,0,0.3)"
          }}>
            {cardIdx}
          </div>

          {/* 右下のインデックス */}
          <div style={{
            position: "absolute",
            right: 5, bottom: 4,
            lineHeight: 1.0,
            color: "#ffffff",
            fontWeight: 900,
            fontSize: 10,
            transform: "rotate(180deg)",
            textShadow: "1px 1px 1px rgba(0,0,0,0.3)"
          }}>
            {cardIdx}
          </div>

          {/* 中央のシンボルマーク */}
          {/* @ts-ignore */}
          <BlockIconComponent size={26} color="#ffffff" strokeWidth={2.5} style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.25))" }} />

          {/* 下部ラベル */}
          <span style={{
            fontSize: b.label.length > 7 ? 8 : 9,
            fontWeight: 900,
            color: "#ffffff",
            textAlign: "center",
            lineHeight: 1.15,
            width: "85%",
            wordBreak: "break-word", // 折り返しを許可して省略記号を排除
            display: "block",
            textShadow: "1px 1px 2px rgba(0,0,0,0.5)",
            zIndex: 2,
            marginTop: "auto"
          }}>
            {b.label}
          </span>
        </div>
      </div>

      {/* スロットポート（条件分岐などの場合、下部にはみ出して表示） */}
      {(isCond || isLoop) && (
        <div style={{
          position: "absolute",
          top: cardH + 4, // カード下端のすぐ下に自動追従
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex", gap: 6, zIndex: 3
        }}>
          {isCond && <>{renderSlotButton("inner")}{renderSlotButton("then")}{renderSlotButton("else")}</>}
          {isLoop && renderSlotButton("then")}
        </div>
      )}

      {/* 削除ボタン */}
      {!isEating && selected && (
        <button
          onMouseDown={e => {
            e.stopPropagation();
            e.preventDefault();
            onDelete(b.id);
          }}
          title="削除"
          style={{
            position: "absolute",
            top: -8,
            right: leftOffset - 6, // カードの右上端に合わせる
            width: 22, height: 22, borderRadius: "50%",
            background: "#e74c3c", border: `2px solid #fff`,
            color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", zIndex: 30,
            boxShadow: "0 2px 5px rgba(0,0,0,0.3)",
            transition: "transform 0.1s",
          }}
          onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"}
          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
        >
          <LucideIcons.X size={12} strokeWidth={3} />
        </button>
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
    <div style={{ position: "absolute", inset: "-20%", overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      <style dangerouslySetInnerHTML={{
        __html: `
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

      {/* 暖かいおもちゃ工房的グラデーション（明るく開放的な陽の光差し込むイメージ） */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(circle at center 40%, #faf0e6 0%, #d8bda2 100%)",
      }} />

      {/* 工房という"部屋"＝一点透視の空間（壁画ではなく、奥行きのある箱の中にいる） */}
      <div style={{
        position: "absolute", inset: 0, overflow: "hidden",
        transform: `translate(${pan.x * 0.05}px, ${pan.y * 0.04}px) scale(${1 + (zoom - 1) * 0.15})`,
        transformOrigin: "center center",
        zIndex: 1,
      }}>
        {/* 天井（奥へ収束） */}
        <div style={{
          position: "absolute", top: "-4%", left: "-25%", right: "-25%", height: "48%",
          transform: "perspective(440px) rotateX(-48deg)",
          transformOrigin: "top center",
          background: `
            repeating-linear-gradient(90deg, rgba(0,0,0,0.05) 0px, rgba(0,0,0,0.05) 1px, transparent 1px, transparent 48px),
            linear-gradient(to top, #eddcd2 0%, #cca47c 100%)
          `,
          boxShadow: "inset 0 -30px 50px rgba(0,0,0,0.15)",
        }} />

        {/* 左の壁（消失点へ収束） */}
        <div style={{
          position: "absolute", left: "-3%", top: "-25%", bottom: "-25%", width: "36%",
          transform: "perspective(440px) rotateY(48deg)",
          transformOrigin: "left center",
          background: "linear-gradient(to right, #b08968 0%, #ddb892 100%)",
          boxShadow: "inset -30px 0 40px rgba(0,0,0,0.15)",
        }} />
        {/* 右の壁（消失点へ収束） */}
        <div style={{
          position: "absolute", right: "-3%", top: "-25%", bottom: "-25%", width: "36%",
          transform: "perspective(440px) rotateY(-48deg)",
          transformOrigin: "right center",
          background: "linear-gradient(to left, #b08968 0%, #ddb892 100%)",
          boxShadow: "inset 30px 0 40px rgba(0,0,0,0.15)",
        }} />

        {/* 奥の壁（遠く・小さく・暗い／横張りの板） */}
        <div style={{
          position: "absolute", left: "50%", top: "33%", width: "58%", height: "34%",
          transform: "translateX(-50%)",
          background: `
            repeating-linear-gradient(to bottom, #d4b290 0px, #d4b290 20px, #c39e78 20px, #c39e78 22px),
            linear-gradient(to bottom, #ddb892, #b08968)
          `,
          boxShadow: "inset 0 0 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.1)",
        }} />

        {/* 床（手前広く→奥へ収束＝立っている地面。板の継ぎ目が消失点へ） */}
        <div style={{
          position: "absolute", bottom: "-4%", left: "-25%", right: "-25%", height: "56%",
          transform: "perspective(440px) rotateX(50deg)",
          transformOrigin: "bottom center",
          background: `
            repeating-linear-gradient(90deg, rgba(0,0,0,0.08) 0px, rgba(0,0,0,0.08) 1.5px, transparent 1.5px, transparent 56px),
            repeating-linear-gradient(to top, rgba(255,255,255,0.15) 0px, rgba(255,255,255,0.15) 1px, transparent 1px, transparent 42px),
            linear-gradient(to top, #eddcd2 0%, #ddb892 65%, #b08968 100%)
          `,
          boxShadow: "inset 0 30px 50px rgba(0,0,0,0.1)",
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
        background: "linear-gradient(to bottom, #7f5539 0%, #5c3d2e 100%)",
        borderTop: "3px solid #9c6644",
        boxShadow: "0 -8px 24px rgba(0,0,0,0.25)",
        transform: `translate(${pan.x * 0.42}px, ${pan.y * 0.35}px) scale(${1 + (zoom - 1) * 0.42})`,
        transformOrigin: "center bottom",
        zIndex: 4,
      }}>
        {/* 抽象的なツールの影は撤去（高ズームで謎の黒箱に見えるため） */}
      </div>

      {/* 周辺ビネット（やや緩めて光が闇へ滑らかに溶けるように） */}
      <div style={{
        position: "absolute", inset: 0,
        boxShadow: "inset 0 0 300px rgba(0,0,0,0.18)",
        zIndex: 5,
      }} />
    </div>
  );
}

function CyberBackdrop({ zoom, pan }: { zoom: number; pan: { x: number; y: number } }) {
  return (
    <div style={{ position: "absolute", inset: "-20%", overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      <style dangerouslySetInnerHTML={{
        __html: `
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

      {/* 電脳グリーンをベースにした漆黒 of 闇背景 */}
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

      {/* レイヤー1: 電脳の"空間"＝一点透視の緑ワイヤーフレーム部屋 */}
      <div style={{
        position: "absolute", inset: 0, overflow: "hidden",
        transform: `translate(${pan.x * 0.05}px, ${pan.y * 0.04}px) scale(${1 + (zoom - 1) * 0.15})`,
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
        {/* 床（手前広く→奥へ収束する緑グリッド） */}
        <div style={{
          position: "absolute", bottom: "-4%", left: "-25%", right: "-25%", height: "56%",
          transform: "perspective(440px) rotateX(50deg)",
          transformOrigin: "bottom center",
          backgroundImage: "linear-gradient(rgba(79,217,138,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(79,217,138,0.18) 1px, transparent 1px)",
          backgroundSize: "54px 54px",
          boxShadow: "inset 0 60px 90px rgba(0,2,1,0.55)",
        }} />
      </div>

      {/* 柔らかい電脳グロー */}
      <div style={{
        position: "absolute", top: "15%", left: "50%", transform: `translateX(calc(-50% + ${pan.x * 0.2}px)) translateY(${pan.y * 0.15}px)`, width: 700, height: 700,
        background: "radial-gradient(circle, rgba(79, 217, 138, 0.04) 0%, transparent 70%)",
        filter: "blur(50px)",
        animation: "cyber-pulse 6s ease-in-out infinite alternate",
        zIndex: 5,
      }} />

      {/* ラメ・スパークル粒子層 */}
      <div style={{ position: "absolute", inset: 0, zIndex: 6 }}>
        <div style={{ position: "absolute", left: "15%", bottom: "25%", width: 2, height: 2, borderRadius: "50%", background: "#cffbe4", boxShadow: "0 0 4px #cffbe4", animation: "cyber-sparkle-1 9s infinite ease-in-out" }} />
        <div style={{ position: "absolute", left: "45%", bottom: "45%", width: 2.5, height: 2.5, borderRadius: "50%", background: "#cffbe4", boxShadow: "0 0 6px #cffbe4", animation: "cyber-sparkle-2 12s infinite ease-in-out" }} />
        <div style={{ position: "absolute", left: "75%", bottom: "15%", width: 1.8, height: 1.8, borderRadius: "50%", background: "#cffbe4", boxShadow: "0 0 3px #cffbe4", animation: "cyber-sparkle-1 14s infinite ease-in-out" }} />
        <div style={{ position: "absolute", left: "30%", bottom: "60%", width: 2, height: 2, borderRadius: "50%", background: "#cffbe4", boxShadow: "0 0 4px #cffbe4", animation: "cyber-sparkle-2 8s infinite ease-in-out" }} />
        <div style={{ position: "absolute", left: "60%", bottom: "35%", width: 3, height: 3, borderRadius: "50%", background: "#ffd700", boxShadow: "0 0 8px #ffd700", animation: "cyber-sparkle-1 16s infinite ease-in-out" }} />
      </div>

      {/* ゆっくり上から下へ流れる水平スキャンスイープ */}
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
      {/* メインのスナップゾーン */}
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
      {/* 中央の十字スナップポイント */}
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
      {/* 方向ラベル */}
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
  const [calcSub, setCalcSub] = useState<CalcSubCat>("arith");
  const showSubtabs = activeCategory === "calc" && !searching;

  const visibleTemplates = showSubtabs
    ? filtered.filter(t => getCalcSubCat(t) === calcSub)
    : filtered;

  return (
    <div className="mc-bevel" style={{
      width: "100%",
      height: showSubtabs ? 200 : 166,
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
      {/* 左端アクション */}
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

      {/* 中央 */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>
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

        {/* リスト本体 */}
        <div style={{
          flex: 1,
          overflowX: "auto",
          overflowY: "hidden",
          padding: "0 18px",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
          scrollbarWidth: "thin",
          scrollbarColor: "#4a4842 #2a2924"
        }}>
          {visibleTemplates.map(t => {
            const c = CAT[t.category];

            const innerBorder = "inset 1px 1px 0 rgba(255,255,255,0.15), inset -1px -1.5px 0 rgba(0,0,0,0.25)";
            const hoverInnerBorder = "inset 1.5px 1.5px 0 rgba(255,255,255,0.3), inset -1.5px -2px 0 rgba(0,0,0,0.28)";
            const pressInnerBorder = "inset 1.5px 1.5px 0 rgba(0,0,0,0.3), inset -1.5px -1.5px 0 rgba(255,255,255,0.15)";
            const bw_w = BW;
            const bw_h = 130;

            return (
              <button key={t.type + t.label} onClick={() => onAdd(t)} title={t.sublabel}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1,
                  width: bw_w,
                  height: bw_h,
                  padding: "4px 2px",
                  borderRadius: 8,
                  background: `linear-gradient(135deg, ${c.top}, ${c.bg})`,
                  border: `2.0px solid ${c.border}`,
                  borderBottom: `4.0px solid rgba(0,0,0,0.28)`,
                  cursor: "pointer",
                  transition: "transform 0.12s cubic-bezier(0.2,0.8,0.2,1), box-shadow 0.12s ease, filter 0.12s ease",
                  boxShadow: `${innerBorder}, 0 2px 4px rgba(0,0,0,0.25)`,
                  flexShrink: 0,
                  position: "relative",
                  overflow: "visible",
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget;
                  el.style.transform = "translateY(-5px)";
                  el.style.boxShadow = `${hoverInnerBorder}, 0 6px 12px rgba(0,0,0,0.35)`;
                  el.style.filter = "brightness(1.06)";
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget;
                  el.style.transform = "";
                  el.style.boxShadow = `${innerBorder}, 0 2px 4px rgba(0,0,0,0.25)`;
                  el.style.filter = "";
                }}
                onMouseDown={e => {
                  const el = e.currentTarget;
                  el.style.transform = "translateY(0) scale(0.96)";
                  el.style.boxShadow = `${pressInnerBorder}, 0 1px 2px rgba(0,0,0,0.2)`;
                }}
                onMouseUp={e => {
                  const el = e.currentTarget;
                  el.style.transform = "translateY(-5px)";
                  el.style.boxShadow = `${hoverInnerBorder}, 0 6px 12px rgba(0,0,0,0.35)`;
                }}
              >
                {(() => { const TrayIcon = (LucideIcons as any)[t.emoji] || LucideIcons.HelpCircle; return <TrayIcon size={t.type === "co_if" ? 22 : 20} color="#ffffff" strokeWidth={2.5} style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))", zIndex: 2, position: "relative" as const }} />; })()}
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
                    ? "1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000"
                    : "none",
                  zIndex: 2,
                  position: "relative",
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
        </div>
      </div>
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
              <div style={{ marginBottom: 6, filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.4))" }}>{(() => { const PIcon = (LucideIcons as any)[p.emoji] || LucideIcons.HelpCircle; return <PIcon size={26} color="#ffffff" strokeWidth={2} />; })()}</div>
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
   スロットリールコンポーネント（カジノ風）
   ══════════════════════════════════════════════════════════ */
function SlotReel<T>({
  items,
  value,
  onChange,
  renderItem
}: {
  items: T[];
  value: T;
  onChange: (item: T) => void;
  renderItem: (item: T, active: boolean) => React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ITEM_HEIGHT = 40; // 3D回転時の見かけの高さに合わせた仮想アイテム高さ

  // 外部からの初期値
  const currentIndex = items.indexOf(value) !== -1 ? items.indexOf(value) : 0;

  // ピクセル単位の絶対スクロール位置
  const [scrollPos, setScrollPos] = useState(currentIndex * ITEM_HEIGHT);
  
  // アニメーションループ用
  const scrollPosRef = useRef(scrollPos);
  scrollPosRef.current = scrollPos;

  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartScrollPos = useRef(0);
  const lastY = useRef(0);
  const lastTime = useRef(0);
  const velocity = useRef(0);
  const animFrameId = useRef<number | null>(null);

  // カチカチ音制御
  const lastTickIndex = useRef(Math.round(scrollPos / ITEM_HEIGHT));

  // 外部から value や items が変更された場合の同期
  useEffect(() => {
    if (!isDragging.current && animFrameId.current === null) {
      const idx = items.indexOf(value) !== -1 ? items.indexOf(value) : 0;
      setScrollPos(idx * ITEM_HEIGHT);
      lastTickIndex.current = idx;
    }
  }, [value, items]);

  // アニメーション終了時のインデックス確定処理
  const finalizeIndex = useCallback((pos: number) => {
    if (items.length === 0) return;
    const rawIdx = Math.round(pos / ITEM_HEIGHT);
    const finalIdx = (rawIdx % items.length + items.length) % items.length;
    onChange(items[finalIdx]);
  }, [items, onChange]);

  // アニメーションループ (慣性と吸着スナップ)
  const startAnimationLoop = useCallback(() => {
    const loop = () => {
      if (isDragging.current) return;

      let vel = velocity.current;
      let pos = scrollPosRef.current;

      // カチカチ音の発生条件のチェック
      const currentTickIdx = Math.round(pos / ITEM_HEIGHT);
      if (currentTickIdx !== lastTickIndex.current) {
        playSlotTickSound();
        lastTickIndex.current = currentTickIdx;
      }

      if (Math.abs(vel) > 0.15) {
        // 1. 慣性スピン中
        pos += vel * 16; // 60fps想定で16ms進む
        vel *= 0.95; // 摩擦減衰（緩急をなめらかに）
        velocity.current = vel;
        setScrollPos(pos);
        animFrameId.current = requestAnimationFrame(loop);
      } else {
        // 2. 吸着スナップ中 (最も近いアイテムの位置にバネ風に滑らかに吸着)
        velocity.current = 0;
        const targetPos = Math.round(pos / ITEM_HEIGHT) * ITEM_HEIGHT;
        const diff = targetPos - pos;

        if (Math.abs(diff) > 0.1) {
          pos += diff * 0.16; // 吸着イージング (バネのようになめらか)
          setScrollPos(pos);
          animFrameId.current = requestAnimationFrame(loop);
        } else {
          setScrollPos(targetPos);
          animFrameId.current = null;
          finalizeIndex(targetPos);
        }
      }
    };

    if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    animFrameId.current = requestAnimationFrame(loop);
  }, [items, finalizeIndex]);

  const handlePrev = useCallback(() => {
    if (items.length <= 1) return;
    if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    
    const currentIdx = Math.round(scrollPosRef.current / ITEM_HEIGHT);
    const targetPos = (currentIdx - 1) * ITEM_HEIGHT;
    
    velocity.current = 0;
    // 目的の位置まで滑らかに移動させるためにアニメーションループを起動
    const loop = () => {
      let pos = scrollPosRef.current;
      const diff = targetPos - pos;
      if (Math.abs(diff) > 0.1) {
        pos += diff * 0.22; // 若干強めのイージングでカチッと移動
        setScrollPos(pos);
        
        const currentTickIdx = Math.round(pos / ITEM_HEIGHT);
        if (currentTickIdx !== lastTickIndex.current) {
          playSlotTickSound();
          lastTickIndex.current = currentTickIdx;
        }
        
        animFrameId.current = requestAnimationFrame(loop);
      } else {
        setScrollPos(targetPos);
        animFrameId.current = null;
        finalizeIndex(targetPos);
      }
    };
    animFrameId.current = requestAnimationFrame(loop);
  }, [items, finalizeIndex]);

  const handleNext = useCallback(() => {
    if (items.length <= 1) return;
    if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    
    const currentIdx = Math.round(scrollPosRef.current / ITEM_HEIGHT);
    const targetPos = (currentIdx + 1) * ITEM_HEIGHT;
    
    velocity.current = 0;
    const loop = () => {
      let pos = scrollPosRef.current;
      const diff = targetPos - pos;
      if (Math.abs(diff) > 0.1) {
        pos += diff * 0.22;
        setScrollPos(pos);
        
        const currentTickIdx = Math.round(pos / ITEM_HEIGHT);
        if (currentTickIdx !== lastTickIndex.current) {
          playSlotTickSound();
          lastTickIndex.current = currentTickIdx;
        }
        
        animFrameId.current = requestAnimationFrame(loop);
      } else {
        setScrollPos(targetPos);
        animFrameId.current = null;
        finalizeIndex(targetPos);
      }
    };
    animFrameId.current = requestAnimationFrame(loop);
  }, [items, finalizeIndex]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (items.length <= 1) return;
    
    // ホイール入力に合わせて速度を加算
    velocity.current += e.deltaY < 0 ? 0.35 : -0.35;
    
    // 最大速度制限
    velocity.current = Math.min(2.5, Math.max(-2.5, velocity.current));
    
    startAnimationLoop();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (items.length <= 1) return;
    if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    
    isDragging.current = true;
    dragStartY.current = e.clientY;
    dragStartScrollPos.current = scrollPosRef.current;
    
    lastY.current = e.clientY;
    lastTime.current = Date.now();
    velocity.current = 0;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    
    const diffY = e.clientY - dragStartY.current;
    // 下ドラッグで上にスクロールするように、符号を調整（直感的な操作感に）
    const newScrollPos = dragStartScrollPos.current - diffY;
    
    // リアルタイムの速度計測
    const now = Date.now();
    const dt = now - lastTime.current;
    if (dt > 10) {
      const dy = e.clientY - lastY.current;
      // スクロールの符号に合わせるため -dy/dt
      velocity.current = -dy / dt; 
      lastY.current = e.clientY;
      lastTime.current = now;
    }

    setScrollPos(newScrollPos);

    // ドラッグ中もカチカチ音を鳴らす
    const currentTickIdx = Math.round(newScrollPos / ITEM_HEIGHT);
    if (currentTickIdx !== lastTickIndex.current) {
      playSlotTickSound();
      lastTickIndex.current = currentTickIdx;
    }
  };

  const handleMouseUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    
    // 慣性スピンを開始
    startAnimationLoop();
  };

  // 表示するアイテムのインデックスを決定 (現在の scrollPos から 5つ割り出す)
  const virtualIndex = scrollPos / ITEM_HEIGHT;
  const centerIndex = Math.round(virtualIndex);

  const visibleIndices = [];
  for (let i = -2; i <= 2; i++) {
    if (items.length === 0) continue;
    const itemIdx = ((centerIndex + i) % items.length + items.length) % items.length;
    visibleIndices.push({
      itemIdx,
      absoluteIndex: centerIndex + i
    });
  }

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        position: "relative",
        height: 200,
        width: 260,
        margin: "0 auto",
        background: "linear-gradient(to bottom, #111 0%, #222 15%, #383530 50%, #222 85%, #111 100%)",
        borderRadius: 12,
        border: "3px solid #d4af37", // 高級感あるゴールド枠
        boxShadow: "inset 0 0 20px rgba(0,0,0,0.85), 0 4px 12px rgba(0,0,0,0.5), 0 0 12px rgba(231,194,90,0.3)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        cursor: "ns-resize",
        userSelect: "none"
      }}
    >
      {/* カジノ筐体の装飾：マーキー電球＋当たりライン */}
      <style>{`
        @keyframes slotMarquee { 0%,100%{opacity:.4} 50%{opacity:1} }
        @keyframes slotWinline { 0%,100%{box-shadow:0 0 8px rgba(231,194,90,.3), inset 0 0 12px rgba(231,194,90,.1)} 50%{box-shadow:0 0 20px rgba(231,194,90,.65), inset 0 0 18px rgba(231,194,90,.22)} }
      `}</style>
      {/* マーキー電球（上） */}
      <div style={{
        position: "absolute", top: 3, left: 8, right: 8, height: 8, zIndex: 6, pointerEvents: "none",
        backgroundImage: "radial-gradient(circle, #ffe9a8 0 2px, transparent 2.6px)",
        backgroundSize: "15px 8px", backgroundPosition: "center",
        filter: "drop-shadow(0 0 3px #e3c25a)", animation: "slotMarquee 1.1s ease-in-out infinite",
      }} />
      {/* マーキー電球（下） */}
      <div style={{
        position: "absolute", bottom: 3, left: 8, right: 8, height: 8, zIndex: 6, pointerEvents: "none",
        backgroundImage: "radial-gradient(circle, #ffe9a8 0 2px, transparent 2.6px)",
        backgroundSize: "15px 8px", backgroundPosition: "center",
        filter: "drop-shadow(0 0 3px #e3c25a)", animation: "slotMarquee 1.1s ease-in-out infinite", animationDelay: "0.55s",
      }} />
      {/* 当たりライン（光る・脈動・▶◀マーカー） */}
      <div style={{
        position: "absolute", left: 2, right: 2, top: "50%", transform: "translateY(-50%)",
        height: 46,
        borderTop: "2.5px solid rgba(231,194,90,0.95)",
        borderBottom: "2.5px solid rgba(231,194,90,0.95)",
        background: "rgba(231,194,90,0.10)",
        animation: "slotWinline 1.8s ease-in-out infinite",
        pointerEvents: "none", zIndex: 5,
      }}>
        <span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", color: "#ffe9a8", fontSize: 12, textShadow: "0 0 6px #e3c25a" }}>▶</span>
        <span style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", color: "#ffe9a8", fontSize: 12, textShadow: "0 0 6px #e3c25a" }}>◀</span>
      </div>

      {/* アイテム描画コンテナ (3Dドラム缶効果) */}
      <div style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        perspective: "600px",
        transformStyle: "preserve-3d",
        pointerEvents: "none"
      }}>
        {visibleIndices.map(({ itemIdx, absoluteIndex }) => {
          const item = items[itemIdx];
          if (!item) return null;
          
          // 滑らかな仮想位置の算出
          const virtualPos = absoluteIndex - virtualIndex;
          
          // 3Dドラム缶の角度と深さの計算
          const angle = virtualPos * 25; // 1目盛り25度の回転
          const zDepth = Math.cos(angle * Math.PI / 180) * 85 - 85; // 奥に逃げる深さ
          const yPos = Math.sin(angle * Math.PI / 180) * 85; // 縦の歪み位置
          
          const isActive = Math.abs(virtualPos) < 0.5;
          const dist = Math.abs(virtualPos);
          // 中央の選択中アイテムをより強調し、非アクティブを極限まで薄くして見やすく！
          const scale = isActive ? 1.15 : Math.max(0.65, 1 - dist * 0.18);
          const opacity = isActive ? 1.0 : Math.max(0, 1 - dist * 0.48);

          return (
            <div key={absoluteIndex} style={{
              height: 38,
              position: "absolute",
              top: "50%",
              marginTop: -19,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `translateY(${yPos}px) translateZ(${zDepth}px) rotateX(${-angle}deg) scale(${scale})`,
              opacity: opacity,
              width: 240,
              pointerEvents: "none",
              backfaceVisibility: "hidden"
            }}>
              {renderItem(item, isActive)}
            </div>
          );
        })}
      </div>

      {/* 上下操作ボタン（補助用、タッチデバイスやホイールなし用） */}
      <button 
        onClick={(e) => { e.stopPropagation(); handlePrev(); }} 
        style={{
          position: "absolute", top: 8, right: 8,
          background: "rgba(0,0,0,0.6)", border: "1.5px solid #d4af37", color: "#d4af37",
          borderRadius: "50%", width: 22, height: 22, cursor: "pointer", zIndex: 10,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11,
          outline: "none", transition: "all 0.1s",
          boxShadow: "0 2px 4px rgba(0,0,0,0.3)"
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = "#d4af37";
          e.currentTarget.style.color = "#111";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = "rgba(0,0,0,0.6)";
          e.currentTarget.style.color = "#d4af37";
        }}
      >
        ▲
      </button>
      <button 
        onClick={(e) => { e.stopPropagation(); handleNext(); }} 
        style={{
          position: "absolute", bottom: 8, right: 8,
          background: "rgba(0,0,0,0.6)", border: "1.5px solid #d4af37", color: "#d4af37",
          borderRadius: "50%", width: 22, height: 22, cursor: "pointer", zIndex: 10,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11,
          outline: "none", transition: "all 0.1s",
          boxShadow: "0 2px 4px rgba(0,0,0,0.3)"
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = "#d4af37";
          e.currentTarget.style.color = "#111";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = "rgba(0,0,0,0.6)";
          e.currentTarget.style.color = "#d4af37";
        }}
      >
        ▼
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   FieldSlot — 「テキストごとにスロット」。選んだアイテムの
   各フィールド(=値)を、ミニ・スロットで決める。候補(options)が
   あれば◀▶で送る／無ければ入力。これでSPAWN=中身入りの完成品。
   ══════════════════════════════════════════════════════════ */
function FieldSlot({ label, value, options, onChange }: {
  label: string; value: string; options?: string[]; onChange: (v: string) => void;
}) {
  const hasOpts = !!options && options.length > 0;
  const idx = hasOpts ? Math.max(0, options!.indexOf(value)) : 0;
  const go = (d: number) => {
    if (!hasOpts) return;
    const n = (idx + d + options!.length) % options!.length;
    onChange(options![n]);
    playSlotTickSound();
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ fontSize: 9, fontWeight: 900, color: "#ffe08a", letterSpacing: "0.06em", paddingLeft: 4, textShadow: "0 0 5px rgba(231,194,90,0.6)" }}>
        {label}
      </div>
      {hasOpts ? (
        <div style={{ display: "flex", alignItems: "stretch", gap: 4, height: 34 }}>
          <button onClick={() => go(-1)} style={fsArrow}>◀</button>
          <div
            onClick={() => go(1)}
            title="タップで次の候補へ"
            style={{
              flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
              background: "linear-gradient(to bottom, #14110c, #2a2620, #14110c)",
              border: "2px solid #d4af37", borderRadius: 8, cursor: "pointer",
              boxShadow: "inset 0 0 10px rgba(0,0,0,0.8), 0 0 8px rgba(231,194,90,0.25)",
              overflow: "hidden",
            }}>
            <span style={{ position: "absolute", left: 3, color: "rgba(231,194,90,0.6)", fontSize: 10 }}>▶</span>
            <span key={value} style={{
              color: "#fff", fontWeight: 900, fontSize: 12, padding: "0 16px",
              maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              textShadow: "0 1px 2px #000", animation: "fsFlip 0.18s ease",
            }}>{value || "—"}</span>
            <span style={{ position: "absolute", right: 3, color: "rgba(231,194,90,0.6)", fontSize: 10 }}>◀</span>
          </div>
          <button onClick={() => go(1)} style={fsArrow}>▶</button>
        </div>
      ) : (
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            height: 34, boxSizing: "border-box", width: "100%", padding: "0 10px",
            background: "linear-gradient(to bottom, #14110c, #2a2620)", color: "#fff",
            border: "2px solid #d4af37", borderRadius: 8, outline: "none",
            fontWeight: 900, fontSize: 12, textAlign: "center",
            boxShadow: "inset 0 0 10px rgba(0,0,0,0.8)",
          }} />
      )}
    </div>
  );
}
const fsArrow: React.CSSProperties = {
  width: 30, flexShrink: 0, background: "linear-gradient(to bottom, #3a2f16, #241c0c)",
  color: "#ffe08a", border: "2px solid #d4af37", borderRadius: 8, cursor: "pointer",
  fontSize: 11, fontWeight: 900, boxShadow: "0 2px 0 #1a1408, inset 0 1px 0 rgba(255,255,255,0.15)",
};

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
  const [selectedTemplate, setSelectedTemplate] = useState<Tmpl | null>(null);

  useEffect(() => {
    const defaultTemplates = TEMPLATES.filter(t => t.category === activeCategory);
    if (defaultTemplates.length > 0) {
      setSelectedTemplate(defaultTemplates[0]);
    } else {
      setSelectedTemplate(null);
    }
  }, [activeCategory]);

  // テキストごとにスロット：選択アイテムの各フィールド値（SPAWN時に注入）
  const [fieldVals, setFieldVals] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!selectedTemplate) { setFieldVals({}); return; }
    const init: Record<string, string> = {};
    selectedTemplate.fields.forEach(f => (init[f.id] = f.value));
    setFieldVals(init);
  }, [selectedTemplate]);

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

  // ─── キャンバス座標の正規化 ───
  const normalizeCanvas = useCallback((currentBlocks: CBlock[]) => {
    if (currentBlocks.length === 0) return;
    const positions = currentBlocks.map(b => getPos(b.id, currentBlocks));
    const minX = Math.min(...positions.map(p => p.x));
    const diffX = minX - 60;
    if (Math.abs(diffX) < 1) return;

    // 親なしルートブロックの id 集合
    const rootBlockIds = new Set(
      currentBlocks
        .filter(bl => !currentBlocks.some(p => p.nextId === bl.id || p.innerId === bl.id || p.thenId === bl.id || p.elseId === bl.id))
        .map(bl => bl.id)
    );

    setBlocks(prev => prev.map(b => {
      if (rootBlockIds.has(b.id)) {
        return { ...b, x: b.x - diffX };
      }
      return b;
    }));

    setPan(p => ({
      ...p,
      x: p.x + diffX * live.current.zoom
    }));
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
    // キャンバスのパン移動（ドラッグ）をX方向のみ許可する
    panDrag.current = { active: true, sx: e.clientX, sy: e.clientY, sp: { ...live.current.pan } };
    setSelected(null);
    e.preventDefault();
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
        setPan(p => ({
          x: panDrag.current.sp.x + (e.clientX - panDrag.current.sx),
          y: panDrag.current.sp.y + (e.clientY - panDrag.current.sy)
        }));
        return;
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

        const nextBlocks = blocks.map(bl => bl.id === id ? { ...bl, x: landX, y: landY } : bl);
        setBlocks(nextBlocks);
        normalizeCanvas(nextBlocks);

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

  const addBlock = useCallback((t: Tmpl, fieldOverrides?: Record<string, string>) => {
    const { pan, zoom, blocks } = live.current;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // 落下先の基準 X = プレイヤーが見ている画面の「左端」（ビューポート左下に落とす）
    const baseX = Math.round((40 - pan.x) / zoom);

    // まず y = 0 でブロックを生成し、その高さを取得する
    const nb = spawnBlock(t, baseX, 0);
    if (fieldOverrides) {
      nb.fields = nb.fields.map(f => fieldOverrides[f.id] !== undefined ? { ...f, value: fieldOverrides[f.id] } : f);
    }
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

    const nextBlocks = [
      ...blocks.map(bl => positions.has(bl.id) ? { ...bl, x: positions.get(bl.id)! } : bl),
      nb
    ];
    setBlocks(nextBlocks);
    normalizeCanvas(nextBlocks);
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

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "row", overflow: "hidden", background: "#222120" }}>
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
          0%   { transform: translateY(-44px); opacity: 0; }
          30%  { opacity: 1; }
          100% { transform: translateY(0); opacity: 1; }
        }
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
        @keyframes hintAura {
          0%,100%{ opacity: 0.55; transform: scale(1);    }
          50%   { opacity: 0.95; transform: scale(1.15); }
        }
        @keyframes neonBeam {
          0%,100%{ opacity: 0.4; }
          50%   { opacity: 1;   }
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

        /* カジノ風点滅ランプエフェクト */
        @keyframes casinoLights {
          0%, 100% { border-color: #4a3f24; }
          50%      { border-color: #e3c25a; }
        }
        @keyframes fsFlip {
          0% { transform: translateY(-40%); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .casino-border {
          /* カジノ風だけどゲーム感：赤い派手な点滅→上品な金のグロー呼吸 */
          animation: casinoLights 3.8s ease-in-out infinite;
        }
      `}</style>

        {/* ========================================================
          【左】スロットリール（カテゴリ＆アイテム選択）
          ======================================================== */}
        <div className="casino-border" style={{
          width: 360,
          display: "flex",
          flexDirection: "column",
          background: "#2d2b29",
          borderRight: "4px solid #1f1e1a",
          zIndex: 30,
          flexShrink: 0,
          padding: "16px 12px",
          boxSizing: "border-box",
          gap: 12,
          overflowY: "auto",
          boxShadow: "inset -5px 0 15px rgba(0,0,0,0.6)"
        }}>
          {/* スロット看板 */}
          <div style={{
            background: "linear-gradient(135deg, #b8860b 0%, #d4af37 50%, #b8860b 100%)",
            border: "2px solid #fff",
            borderRadius: 8,
            padding: "6px 0",
            textAlign: "center",
            boxShadow: "0 4px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.4)"
          }}>
            <span style={{
              fontSize: 13, fontWeight: 900, color: "#111", letterSpacing: "0.1em",
              textShadow: "1px 1px 0px rgba(255,255,255,0.5)"
            }}>🎰 SPROUT SLOTS</span>
          </div>

          {/* 検索窓 */}
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 ブロックを検索..."
            style={{
              width: "100%", boxSizing: "border-box", padding: "6px 10px", fontSize: 11,
              background: "#1c1b18", border: "2px solid #4a4842", borderRadius: 8, color: "#e5e3db", outline: "none", fontWeight: 800,
              boxShadow: "inset 2px 2px 0 rgba(0,0,0,0.35)",
            }} />

          {/* カテゴリドラム */}
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: "#ffe08a", letterSpacing: "0.08em", paddingLeft: 4, textShadow: "0 0 6px rgba(231,194,90,0.7), 0 0 2px rgba(231,194,90,0.9)" }}>
              STEP 1: カテゴリをまわす
            </div>
            <SlotReel
              items={cats}
              value={activeCategory}
              onChange={(cat) => {
                setActiveCategory(cat);
                if (searching) setSearch("");
              }}
              renderItem={(cat, active) => {
                const c = CAT[cat];
                return (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    color: active ? (c.text === "#ffffff" ? "#ffffff" : c.top) : "#c8c4b8",
                    fontWeight: 900, fontSize: active ? 13 : 11,
                    textShadow: active ? "1px 1px 2px rgba(0,0,0,0.8)" : "none"
                  }}>
                    <span style={{ fontSize: active ? 16 : 13 }}>{c.icon}</span>
                    <span>{c.label}</span>
                  </div>
                );
              }}
            />
          </div>

          {/* アイテムドラム */}
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: "#ffe08a", letterSpacing: "0.08em", paddingLeft: 4, textShadow: "0 0 6px rgba(231,194,90,0.7), 0 0 2px rgba(231,194,90,0.9)" }}>
              STEP 2: アイテムをまわす
            </div>
            <SlotReel
              items={filtered}
              value={selectedTemplate || filtered[0]}
              onChange={(tmpl) => setSelectedTemplate(tmpl)}
              renderItem={(tmpl, active) => {
                if (!tmpl) return null;
                const c = CAT[tmpl.category];
                const TIcon = (LucideIcons as any)[tmpl.emoji] || LucideIcons.HelpCircle;
                return (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    color: active ? (c.text === "#ffffff" ? "#ffffff" : c.top) : "#c8c4b8",
                    fontWeight: 900, fontSize: active ? 12 : 10,
                    textShadow: active ? "1px 1px 2px rgba(0,0,0,0.8)" : "none",
                    width: "100%", justifyContent: "center"
                  }}>
                    <TIcon size={active ? 16 : 13} color={active ? "#ffffff" : "#c8c4b8"} strokeWidth={2.5} />
                    <span style={{
                      maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                    }}>{tmpl.label}</span>
                  </div>
                );
              }}
            />
          </div>

          {/* STEP 3：テキストごとにスロット（中身をセット）＝これでロジック成立 */}
          {selectedTemplate && selectedTemplate.fields.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <div style={{ fontSize: 10, fontWeight: 900, color: "#ffe08a", letterSpacing: "0.05em", paddingLeft: 4, textShadow: "0 0 6px rgba(231,194,90,0.7)" }}>
                STEP 3: 中身をセット
              </div>
              {selectedTemplate.fields.map(f => (
                <FieldSlot
                  key={f.id}
                  label={f.label}
                  value={fieldVals[f.id] ?? f.value}
                  options={f.options}
                  onChange={v => setFieldVals(prev => ({ ...prev, [f.id]: v }))}
                />
              ))}
            </div>
          )}

          {/* 決定・SPAWNボタン */}
          <button
            disabled={!selectedTemplate}
            onClick={() => {
              if (selectedTemplate) {
                addBlock(selectedTemplate, fieldVals);
              }
            }}
            style={{
              marginTop: "auto",
              width: "100%",
              height: 52,
              background: selectedTemplate
                ? "linear-gradient(to bottom, #ff4757, #ff6b81)"
                : "linear-gradient(to bottom, #747d8c, #a4b0be)",
              border: "3px solid #fff",
              borderRadius: 12,
              boxShadow: selectedTemplate
                ? "0 6px 0 #b33939, 0 10px 20px rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,255,255,0.4)"
                : "0 6px 0 #57606f, 0 4px 6px rgba(0,0,0,0.2)",
              color: "#fff",
              fontWeight: 900,
              fontSize: 16,
              letterSpacing: "0.15em",
              cursor: selectedTemplate ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              transition: "all 0.1s ease",
              transform: "translateY(0)"
            }}
            onMouseDown={e => {
              if (selectedTemplate) {
                const btn = e.currentTarget;
                btn.style.transform = "translateY(4px)";
                btn.style.boxShadow = "0 2px 0 #b33939, 0 2px 5px rgba(0,0,0,0.4)";
              }
            }}
            onMouseUp={e => {
              if (selectedTemplate) {
                const btn = e.currentTarget;
                btn.style.transform = "translateY(0)";
                btn.style.boxShadow = "0 6px 0 #b33939, 0 10px 20px rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,255,255,0.4)";
              }
            }}
            onMouseLeave={e => {
              if (selectedTemplate) {
                const btn = e.currentTarget;
                btn.style.transform = "translateY(0)";
                btn.style.boxShadow = "0 6px 0 #b33939, 0 10px 20px rgba(0,0,0,0.5), inset 0 2px 0 rgba(255,255,255,0.4)";
              }
            }}
          >
            <span>🎯 SPAWN!</span>
          </button>
        </div>

        {/* ========================================================
          【中央】プレイ面（ソリティア風キャンバス）
          ======================================================== */}
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
              position: "absolute", bottom: 10, right: 10, zIndex: 40, width: 244,
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
                  { s: "1", t: "左側のスロットでアイテムを選んでSPAWNで配置" },
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
            {/* ブロック数 */}
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

            {/* ズーム倍率 */}
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

            {/* ガイド線トグル */}
            <button onClick={() => setShowSnapGuide(!showSnapGuide)} title="スナップ時のガイド線の表示/非表示" style={{
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

          {/* トースト通知 */}
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

          {/* コード誕生演出 */}
          {reveal && (
            <CodeRevealOverlay
              revealCode={reveal.join("\n")}
              onClose={() => setReveal(null)}
              theme="workshop"
            />
          )}

          {/* 案A：結果が生きて動くステージ（組んだ瞬間に上演） */}
          <LiveStage blocks={blocks} />

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

          {/* パーティクル */}
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
                  const size = 6 + ((i * 37) % 6);
                  const reach = 36 + ((i * 53) % 24);
                  const yBias = deg > 180 ? -8 : 0;
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

          {/* 衝撃リング */}
          {impacts.map(p => (
            <div key={p.id} style={{ position: "absolute", left: p.x, top: p.y, pointerEvents: "none", zIndex: 199 }}>
              <div style={{
                position: "absolute", left: "50%", top: "50%",
                transform: "translate(-50%,-50%)",
                border: `3px solid ${p.color}`,
                borderRadius: "50%",
                animation: "impactRing 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                boxShadow: `0 0 18px ${p.color}99`,
              }} />
              <div style={{
                position: "absolute", left: "50%", top: "50%",
                transform: "translate(-50%,-50%)",
                borderRadius: "50%",
                background: `radial-gradient(circle, ${p.color}80 0%, ${p.color}20 50%, transparent 70%)`,
                animation: "impactFlash 0.5s ease-out forwards",
              }} />
            </div>
          ))}

          {/* 紙吹雪 */}
          {confetti.map(c => (
            <div key={c.id} style={{ position: "absolute", left: c.x, top: c.y, pointerEvents: "none", zIndex: 201 }}>
              {Array.from({ length: 14 }).map((_, i) => {
                const ang = (i / 14) * 360 + (i * 17) % 30;
                const reach = 60 + (i % 4) * 22;
                const colors = ["#ec4899", "#a855f7", "#06b6d4", "#fbbf24", "#10b981"];
                const col = colors[i % colors.length];
                const shapes = ["50%", "2px", "20% 80% 20% 80% / 80% 20% 80% 20%"];
                const shape = shapes[i % shapes.length];
                return (
                  <div key={i} style={{
                    position: "absolute", width: 7, height: 11,
                    background: col,
                    borderRadius: shape,
                    // @ts-ignore
                    "--dx": `${Math.cos(ang * Math.PI / 180) * reach}px`,
                    // @ts-ignore
                    "--dy": `${Math.sin(ang * Math.PI / 180) * reach - 30}px`,
                    // @ts-ignore
                    "--rot": `${(i % 2 ? 1 : -1) * (180 + i * 30)}deg`,
                    animation: `confettiBurst ${0.75 + (i % 5) * 0.06}s cubic-bezier(0.1, 0.7, 0.3, 1) forwards`,
                    boxShadow: `0 0 4px ${col}88`,
                  }} />
                );
              })}
            </div>
          ))}

          {/* キャンバス背景 */}
          <div ref={containerRef} onMouseDown={handleBgDown} onWheel={handleWheel}
            style={{
              position: "absolute", inset: 0, cursor: "grab", backgroundColor: "#222120",
              zIndex: 0
            }}>

            {/* インテリア背景 */}
            <ThemeBackdrop theme="workshop" zoom={zoom} pan={pan} />

            {/* 床 */}
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

                  {/* ケーブル */}
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
                        <line x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} stroke="rgba(0,0,0,0.35)" strokeWidth="5.8" strokeLinecap="round" />
                        <line x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} stroke={c.color} strokeWidth="3.8" strokeLinecap="round" />
                        <line x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} stroke="#ffffff" strokeWidth="3.8" strokeLinecap="round"
                          strokeDasharray="8 32"
                          style={{ animation: "wirePulse 1.8s linear infinite", opacity: 0.45 }} />
                        <rect x={c.x2 - 5} y={c.y2 - 5} width={5} height={10} fill="#2c2c2c" rx={1} stroke="#4f4f4f" strokeWidth={1} />
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

                  {/* 食べられアニメーション */}
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

        {/* ========================================================
          【右】操作ボタン（システムコントロール）
          ======================================================== */}
        <div className="casino-border" style={{
          width: 260,
          display: "flex",
          flexDirection: "column",
          background: "#2d2b29",
          borderLeft: "4px solid #1f1e1a",
          zIndex: 30,
          flexShrink: 0,
          padding: "16px 12px",
          boxSizing: "border-box",
          gap: 16,
          boxShadow: "inset 5px 0 15px rgba(0,0,0,0.6)",
          alignItems: "center"
        }}>
          {/* 操作看板 */}
          <div style={{
            background: "linear-gradient(135deg, #b8860b 0%, #d4af37 50%, #b8860b 100%)",
            border: "2px solid #fff",
            borderRadius: 8,
            padding: "4px 0",
            width: "100%",
            textAlign: "center",
            order: -2,
            boxShadow: "0 3px 6px rgba(0,0,0,0.3)"
          }}>
            <span style={{ fontSize: 10, fontWeight: 900, color: "#111", letterSpacing: "0.05em" }}>CONTROL</span>
          </div>

          {/* 各種アクションボタン */}
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
            style={{ width: "100%", height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            🗑️ クリア
          </McButton>

          <McButton
            size="sm"
            variant="grape"
            onClick={() => setShowProjects(v => !v)}
            active={showProjects}
            title="プロジェクトの保存・読み込み"
            style={{ width: "100%", height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            💾 保存/読込
          </McButton>

          <McButton
            size="sm"
            variant="info"
            onClick={() => setShowTemplates(v => !v)}
            active={showTemplates}
            title="テンプレートギャラリー"
            style={{ width: "100%", height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            🎮 サンプル
          </McButton>

          <McButton
            size="sm"
            variant="warning"
            onClick={() => setShowCode(v => !v)}
            active={showCode}
            title="生成コードを表示"
            style={{ width: "100%", height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            💻 コード
          </McButton>

          <McButton
            size="sm"
            variant="primary"
            onClick={() => setShowHelp(v => !v)}
            active={showHelp}
            title="操作ガイドを開く"
            style={{ width: "100%", height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            ❓ ヘルプ
          </McButton>

          {/* マイクラへ出力ボタン */}
          <button
            disabled={!isLogicValid}
            onClick={() => {
              playSuccessSound();
              const lines = (genCode || "// まず きっかけ ブロックを置いて繋げよう").split("\n");
              setReveal(lines);
            }}
            style={{
              order: -1,
              width: "100%",
              height: 60,
              background: isLogicValid
                ? "linear-gradient(to bottom, #10b981, #059669)"
                : "linear-gradient(to bottom, #747d8c, #a4b0be)",
              border: "3px solid #fff",
              borderRadius: 12,
              boxShadow: isLogicValid
                ? "0 6px 0 #047857, 0 8px 16px rgba(16,185,129,0.3), inset 0 2px 0 rgba(255,255,255,0.4)"
                : "0 6px 0 #57606f, 0 4px 6px rgba(0,0,0,0.2)",
              color: "#fff",
              fontWeight: 900,
              fontSize: 12,
              letterSpacing: "0.05em",
              cursor: isLogicValid ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              lineHeight: 1.2,
              transition: "all 0.1s ease",
              transform: "translateY(0)"
            }}
            onMouseDown={e => {
              if (isLogicValid) {
                const btn = e.currentTarget;
                btn.style.transform = "translateY(4px)";
                btn.style.boxShadow = "0 2px 0 #047857, 0 2px 5px rgba(0,0,0,0.4)";
              }
            }}
            onMouseUp={e => {
              if (isLogicValid) {
                const btn = e.currentTarget;
                btn.style.transform = "translateY(0)";
                btn.style.boxShadow = "0 6px 0 #047857, 0 8px 16px rgba(16,185,129,0.3), inset 0 2px 0 rgba(255,255,255,0.4)";
              }
            }}
            onMouseLeave={e => {
              if (isLogicValid) {
                const btn = e.currentTarget;
                btn.style.transform = "translateY(0)";
                btn.style.boxShadow = "0 6px 0 #047857, 0 8px 16px rgba(16,185,129,0.3), inset 0 2px 0 rgba(255,255,255,0.4)";
              }
            }}
          >
            <span>EXPORT<br />▶ マイクラ</span>
          </button>
        </div>
      </div>
    );
}
