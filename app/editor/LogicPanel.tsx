"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useEditorStore } from "./store";
import { McButton, McBadge } from "../_mc";
import { CodeRevealOverlay } from "./CodeRevealOverlay";
import LiveStage from "./LiveStage";
import * as LucideIcons from "lucide-react";
import { useThemeStore } from "./worldThemes";

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

/* ══════════════════════════════════════════════════════════
   やさしいカテゴリ（物語順）— SPROUT は非コーダー全振り。
   頭の中の「いつ → どうなる → もっと(上級)」の3つだけに集約。
   上級(条件/くりかえし/数/計算/変数)は "もっと" に畳む＝消さない。
   ══════════════════════════════════════════════════════════ */
interface FriendlyGroup { key: string; label: string; sub: string; icon: string; cats: Category[]; bg: string; top: string; side: string; text: string; }
// ドロップダウン(co_ifの「もしも」)に格上げした条件は、盤面パレットから隠す。
// ※パラメータ付き(co_tag/co_item)はv2まで従来どおり置けるよう残す。
const HIDDEN_COND_TYPES = new Set(["co_sneak", "co_night", "co_rain", "co_hp"]);

const FRIENDLY_GROUPS: FriendlyGroup[] = [
  { key: "when", label: "きっかけ", sub: "〜したとき",   icon: "Zap",      cats: ["trigger"],                                     bg: "#facc15", top: "#fef9c3", side: "#ca8a04", text: "#451a03" },
  { key: "do",   label: "すること", sub: "〜する",       icon: "Wand2",    cats: ["action", "ui"],                                bg: "#38bdf8", top: "#e0f2fe", side: "#0284c7", text: "#0c4a6e" },
  { key: "more", label: "もっと",   sub: "上級・そのほか", icon: "Sparkles", cats: ["ifelse", "loop", "value", "calc", "variable"], bg: "#a855f7", top: "#f3e8ff", side: "#9333ea", text: "#4c1d95" },
];

/* 下部キーボード：カテゴリを8つに直割り（カードを“打つ”ための入力キー） */
const KEYBOARD_CATS: { cat: Category; label: string; icon: string }[] = [
  { cat: "trigger",  label: "きっかけ",   icon: "Zap" },
  { cat: "action",   label: "すること",   icon: "Wand2" },
  { cat: "ui",       label: "みため",     icon: "LayoutGrid" },
  { cat: "ifelse",   label: "もしも",     icon: "Split" },
  { cat: "loop",     label: "くりかえし", icon: "Repeat" },
  { cat: "value",    label: "あたい",     icon: "Hash" },
  { cat: "calc",     label: "けいさん",   icon: "Plus" },
  { cat: "variable", label: "へんすう",   icon: "Package" },
];

/* 条件分岐は「もしも」カテゴリでキーボード上から条件を選ぶ＝タップでその条件入りco_ifが出る */
const CO_IF_TMPL = TEMPLATES.find(t => t.type === "co_if")!;
const CO_IF_CONDS = CO_IF_TMPL?.fields.find(f => f.id === "cond")?.options ?? [];
const COND_EMOJI: Record<string, string> = { "スニーク中": "🤫", "夜間": "🌙", "雨天": "🌧️", "HPが少ない": "💔" };

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
  onDown: (e: React.PointerEvent, id: string) => void;
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
      <div key={slotKey} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
        <div
          className={isArmedThis ? "slot-btn slot-btn--armed" : "slot-btn"}
          onPointerDown={e => {
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
        {/* ノードのポート名を明示（もしも/そうなら/ちがうなら／ループは「なかみ」）＝わかりやすく */}
        <span style={{
          fontSize: 8.5, fontWeight: 900, color: badge.color, lineHeight: 1,
          whiteSpace: "nowrap", textShadow: "0 1px 2px rgba(255,255,255,0.85)"
        }}>{isLoop && slotKey === "then" ? "なかみ" : head.jp}</span>
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
  // 条件・値などスロットに挿す「部品カード」は少し小さく（co_if＝条件分岐ノードは大きいまま）
  const isSlotPiece = ["ifelse", "calc", "value", "variable"].includes(b.category) && b.type !== "co_if";
  const cardW = isSlotPiece ? 62 : 82;
  const cardH = isSlotPiece ? 86 : 112;
  const leftOffset = (w - cardW) / 2; // センタリング

  return (
    <div onPointerDown={e => onDown(e, b.id)} style={{
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
      {/* ✨キラキラカード＝ホログラム箔（ビックリマンシール風の虹プリズム＋流れる光沢）。
          ※箔のテカリ(一般的な視覚効果)のみ。特定キャラ/デザインは使わない。 */}
      {(isCond || isLoop) && (
        <>
          <style>{`
            @keyframes holoFlow { from { background-position: 0% 50%; } to { background-position: 300% 50%; } }
            @keyframes holoSheen { 0% { background-position: 140% 0; } 100% { background-position: -40% 0; } }
          `}</style>
          {/* 外周の虹リング */}
          <div style={{
            position: "absolute", left: leftOffset - 4, top: -4, width: cardW + 8, height: cardH + 8,
            borderRadius: 20,
            background: "conic-gradient(from 35deg, #ff5db1, #ffd23c, #3cff8e, #3cd0ff, #b53cff, #ff5db1)",
            boxShadow: "0 0 16px rgba(196,181,253,0.65)",
            zIndex: 1, pointerEvents: "none",
          }} />
          {/* カード面のホロ箔 */}
          <div style={{
            position: "absolute", left: leftOffset, top: 0, width: cardW, height: cardH,
            borderRadius: 16, overflow: "hidden", zIndex: 6, pointerEvents: "none",
          }}>
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(115deg, #ff3ca6, #ffd23c, #3cff8e, #3cd0ff, #b53cff, #ff3ca6)",
              backgroundSize: "300% 100%",
              mixBlendMode: "color-dodge",
              opacity: 0.5,
              animation: "holoFlow 4s linear infinite",
            }} />
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(115deg, transparent 40%, rgba(255,255,255,0.75) 50%, transparent 60%)",
              backgroundSize: "300% 100%",
              mixBlendMode: "screen",
              animation: "holoSheen 3.2s ease-in-out infinite",
            }} />
          </div>
          <div style={{ position: "absolute", left: leftOffset - 7, top: -9, fontSize: 14, zIndex: 12, pointerEvents: "none", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.25))" }}>✨</div>
        </>
      )}
      {/* くりかえしカード＝中身を上方向に「囲む」オリジナル枠（このアプリのループ色／点線／🔁）。
          ※ Scratch等のトレードドレス(オレンジ/パズル凹凸/特定の矢印)は使わない。 */}
      {isLoop && (
        <div style={{
          position: "absolute",
          left: leftOffset - 9,
          top: -(thenH + 8),
          width: cardW + 18,
          height: thenH + cardH + 14,
          borderRadius: 20,
          border: `3px dashed ${cat.bg}`,
          background: `${cat.bg}14`,
          boxShadow: `inset 0 0 0 2px rgba(255,255,255,0.45)`,
          zIndex: 0,
          pointerEvents: "none",
        }}>
          <div style={{ position: "absolute", left: 9, top: 5, fontSize: 10, fontWeight: 900, color: cat.bg, display: "flex", alignItems: "center", gap: 3 }}>
            <span>🔁</span><span>くりかえす</span>
          </div>
          <div style={{ position: "absolute", right: 10, bottom: 5, fontSize: 15, fontWeight: 900, color: cat.bg, transform: "scaleX(-1)" }}>↻</div>
        </div>
      )}
      {/* メインカードノード（ポケカ風：白ベースカード ＋ カテゴリカラーの細い外枠フチ） */}
      <div style={{
        position: "absolute",
        left: leftOffset, top: 0, width: cardW, height: cardH,
        background: "#ffffff", // 白いカードベース
        borderRadius: "16px", // 角丸の強化（画像に合わせた丸み）
        border: "3.5px solid #ffffff", // 内側の白いフチ
        boxShadow: selected
          ? `0 0 0 2.5px ${cat.bg}, 0 0 20px ${cat.bg}AA, 0 12px 24px rgba(0,0,0,0.25)`
          : hl || isAcceptable
            ? `0 0 0 2.5px ${badgeColor || cat.bg}, 0 0 20px ${badgeColor || cat.bg}AA, 0 12px 24px rgba(0,0,0,0.25)`
            : `0 0 0 2.5px ${cat.bg}ee, 0 8px 20px rgba(0,0,0,0.15)`, // 通常時でも外側に細いカテゴリカラーの線
        transition: "all 0.15s ease",
        display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
        padding: "0px",
        boxSizing: "border-box",
        zIndex: 2,
        overflow: "hidden"
      }}>


        {/* インナーデザインフレーム */}
        <div style={{
          width: "100%",
          height: "100%",
          borderRadius: "12px", // 外枠の16pxに合わせた丸み
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 2px 6px",
          boxSizing: "border-box",
          position: "relative",
          background: "radial-gradient(circle at center, #ffffff 60%, #fafafa 100%)",
        }}>
          {/* 左上のインデックス（タイプカラー背景のバッジ風） */}
          <div style={{
            position: "absolute",
            left: 3, top: 3,
            width: 18, height: 18,
            borderRadius: "50%",
            background: cat.bg,
            border: "1.5px solid #ffffff",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#ffffff",
            fontWeight: 900,
            fontSize: 9.5,
            boxShadow: "0 2px 5px rgba(0,0,0,0.15)",
            zIndex: 10
          }}>
            {cardIdx}
          </div>

          {/* 右上の小さなタイプカラー点 */}
          <div style={{
            position: "absolute",
            right: 5, top: 5,
            width: 8, height: 8,
            borderRadius: "50%",
            background: cat.bg,
            border: "1.5px solid #ffffff",
            boxShadow: `0 1px 3px rgba(0,0,0,0.1)`,
            zIndex: 10
          }} />

          {/* 中央の「白い丸枠」イラストフレーム */}
          <div style={{
            width: 46,
            height: 46,
            borderRadius: "50%",
            background: "#ffffff",
            border: `2.5px solid ${cat.bg}`,
            boxShadow: `0 4px 10px ${cat.bg}18, inset 0 1px 3px rgba(0,0,0,0.05)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 8,
          }}>
            {/* @ts-ignore */}
            <BlockIconComponent size={22} color={cat.bg} strokeWidth={2.2} />
          </div>

          {/* 下部ラベル（co_if は選んだ条件を「もしも〇〇なら」と表示＝中身が見える） */}
          {b.type === "co_if" ? (
            <span style={{
              fontSize: 8.5, fontWeight: 900, color: "#1e293b", textAlign: "center",
              lineHeight: 1.3, width: "94%", wordBreak: "break-word", display: "block",
              zIndex: 2, marginBottom: 2, marginTop: "auto",
            }}>
              もしも<br />
              <b style={{ color: cat.bg, fontSize: 10 }}>{b.fields.find(f => f.id === "cond")?.value || "？"}</b><br />
              なら
            </span>
          ) : (
            <span style={{
              fontSize: b.label.length > 7 ? 8.5 : 9.5,
              fontWeight: 900,
              color: "#1e293b",
              textAlign: "center",
              lineHeight: 1.25,
              width: "92%",
              wordBreak: "break-word",
              display: "block",
              zIndex: 2,
              marginBottom: 2,
              marginTop: "auto",
            }}>
              {b.label}
            </span>
          )}
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
          {/* もしも〜なら（co_if）は条件をカード内に仕込む方式＝inner(もしも)/else(ちがうなら)
              ポートは出さない。動作を重ねる「そうなら」だけ。 */}
          {isCond && renderSlotButton("then")}
          {isLoop && renderSlotButton("then")}
        </div>
      )}

      {/* 削除ボタン */}
      {!isEating && selected && (
        <button
          onPointerDown={e => {
            e.stopPropagation();
            e.preventDefault();
            onDelete(b.id);
          }}
          title="削除"
          style={{
            position: "absolute",
            top: -12,
            right: leftOffset - 11, // カードの右上端に合わせる（サイズ拡大に伴い微調整）
            width: 32, height: 32, borderRadius: "50%",
            background: "#e74c3c", border: `2px solid #fff`,
            color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", zIndex: 30,
            boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
            transition: "transform 0.1s",
            touchAction: "none", // タッチで確実に拾う(スクロール等に奪われない)
          }}
          onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"}
          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
        >
          <LucideIcons.X size={17} strokeWidth={3} />
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

// 世界に浮かぶ光の粒（プランクトン/光のもや）。カードと同じ世界座標に固定するので、
// パン/ズームでカードと1:1で動く＝「動きの基準」。方眼グリッドの置き換え。SSRとズレないよう
// 乱数はseed固定でモジュール読み込み時に一度だけ生成する。
const WORLD_MOTES = (() => {
  let seed = 20260708;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const arr: { x: number; y: number; r: number; o: number; dur: number; delay: number }[] = [];
  for (let i = 0; i < 60; i++) {
    arr.push({
      x: Math.round(-1200 + rnd() * 3600),
      y: Math.round(-800 + rnd() * 2400),
      r: 2 + rnd() * 5,
      o: 0.10 + rnd() * 0.20,
      dur: 6 + rnd() * 8,
      delay: -rnd() * 10,
    });
  }
  return arr;
})();

function LandBackdrop({ zoom, pan }: { zoom: number; pan: { x: number; y: number } }) {
  // 空・太陽・雲は固定（動かさない）。位置確認用の目盛りはカード側の世界グリッドが担う。
  void zoom; void pan;
  return (
    <div style={{ position: "absolute", inset: "-20%", overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      {/* 固定の背景グラデーション */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to bottom, #87CEEB 0%, #B0E0E6 40%, #E0F6FF 70%, #F0F8FF 100%)",
      }} />

      {/* 太陽・雲は固定 */}
      <div style={{ position: "absolute", inset: 0 }}>
        <style dangerouslySetInnerHTML={{
          __html: `
          @keyframes cloud-drift {
            0% { transform: translateX(-10%); }
            100% { transform: translateX(110%); }
          }
          @keyframes sun-glow {
            0% { box-shadow: 0 0 40px rgba(255,215,0,0.4), 0 0 100px rgba(255,140,0,0.2); }
            100% { box-shadow: 0 0 60px rgba(255,215,0,0.6), 0 0 140px rgba(255,140,0,0.3); }
          }
        `}} />
        <div style={{
          position: "absolute", top: "10%", left: "15%",
          width: 120, height: 120, borderRadius: "50%",
          background: "radial-gradient(circle, #FFFBEB 0%, #FFD700 60%, transparent 100%)",
          animation: "sun-glow 4s infinite alternate ease-in-out",
          zIndex: 1
        }} />
        {/* 雲 */}
        <div style={{ position: "absolute", top: "20%", left: "-20%", width: 200, height: 60, background: "rgba(255,255,255,0.8)", filter: "blur(20px)", borderRadius: "100px", animation: "cloud-drift 60s infinite linear", zIndex: 2 }} />
        <div style={{ position: "absolute", top: "40%", left: "-30%", width: 300, height: 80, background: "rgba(255,255,255,0.6)", filter: "blur(30px)", borderRadius: "100px", animation: "cloud-drift 90s infinite linear 10s", zIndex: 2 }} />
        <div style={{ position: "absolute", top: "15%", left: "-10%", width: 150, height: 50, background: "rgba(255,255,255,0.9)", filter: "blur(15px)", borderRadius: "100px", animation: "cloud-drift 45s infinite linear 25s", zIndex: 2 }} />
      </div>
    </div>
  );
}

function WorkshopBackdrop({ zoom, pan }: { zoom: number; pan: { x: number; y: number } }) {
  // 海・光・魚は固定（動かさない）。位置確認用の目盛りはカード側の世界グリッドが担う。
  void zoom; void pan;
  return (
    <div style={{ position: "absolute", inset: "-20%", overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      {/* 澄み渡る暖かい海（Warm Ocean）のグラデーションは固定 */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to bottom, #7dd3fc 0%, #0ea5e9 40%, #0284c7 70%, #075985 100%)",
      }} />
      
      {/* 周辺水圧ビネット（四隅を少し深く青くして、海の中に潜っている雰囲気を強調）は固定 */}
      <div style={{
        position: "absolute", inset: 0,
        boxShadow: "inset 0 0 180px rgba(7,89,133,0.35)",
        zIndex: 7,
      }} />

      {/* 光・魚は固定 */}
      <div style={{ position: "absolute", inset: 0 }}>
        <style dangerouslySetInnerHTML={{
          __html: `
          @keyframes water-sway {
            0% { transform: rotate(-1.5deg) translateY(0px); }
            100% { transform: rotate(1.5deg) translateY(-8px); }
          }
        @keyframes bubble-rise {
          0% { transform: translateY(110%) translateX(0) scale(0.8); opacity: 0; }
          10% { opacity: 0.7; }
          90% { opacity: 0.7; }
          100% { transform: translateY(-10%) translateX(var(--wobble)) scale(1.1); opacity: 0; }
        }
        @keyframes light-shaft-shimmer {
          0% { opacity: 0.15; transform: skewX(-15deg) scaleX(0.9); }
          100% { opacity: 0.35; transform: skewX(-10deg) scaleX(1.1); }
        }
        @keyframes lantern-glow {
          0% { box-shadow: 0 0 20px #e0f2fe, 0 0 40px rgba(224,242,254,0.4); }
          100% { box-shadow: 0 0 35px #ffffff, 0 0 70px rgba(255,255,255,0.6); }
        }
        @keyframes sea-plant-sway {
          0% { transform: skewX(-2deg); }
          100% { transform: skewX(2deg); }
        }
        @keyframes whale-swim {
          0% { transform: translate(-350px, 45vh) scale(1.6) scaleX(-1) rotate(3deg); opacity: 0; }
          5% { opacity: 1; }
          95% { opacity: 1; }
          100% { transform: translate(120vw, 35vh) scale(1.6) scaleX(-1) rotate(-3deg); opacity: 0; }
        }
        @keyframes squid-swim {
          0% { transform: translate(110vw, 65vh) scale(0.95) rotate(-10deg); opacity: 0; }
          5% { opacity: 1; }
          10% { transform: translate(95vw, 60vh) scale(0.95) rotate(-15deg); }
          15% { transform: translate(92vw, 62vh) scale(0.95) rotate(-10deg); }
          25% { transform: translate(75vw, 55vh) scale(0.95) rotate(-18deg); }
          30% { transform: translate(72vw, 57vh) scale(0.95) rotate(-12deg); }
          45% { transform: translate(50vw, 45vh) scale(0.95) rotate(-22deg); }
          50% { transform: translate(47vw, 47vh) scale(0.95) rotate(-15deg); }
          65% { transform: translate(25vw, 53vh) scale(0.95) rotate(-10deg); }
          70% { transform: translate(22vw, 55vh) scale(0.95) rotate(-5deg); }
          85% { transform: translate(0vw, 60vh) scale(0.95) rotate(-12deg); }
          95% { opacity: 1; }
          100% { transform: translate(-150px, 63vh) scale(0.95) rotate(-8deg); opacity: 0; }
        }
        @keyframes fishing-line-move {
          0%, 20% { transform: translateY(-110%); }
          30% { transform: translateY(0); }
          55% { transform: translateY(0); }
          57% { transform: translateY(-8px); }
          59% { transform: translateY(0); }
          61% { transform: translateY(-12px); }
          63% { transform: translateY(2px); }
          64.5% { transform: translateY(-150%); }
          100% { transform: translateY(-150%); }
        }
        @keyframes kasago-move {
          0% { transform: translate(110vw, 55vh) scale(0.75) scaleX(-1); opacity: 0; }
          15% { opacity: 1; }
          28% { transform: translate(65vw, 32vh) scale(0.75) scaleX(-1); }
          35% { transform: translate(56vw, 19vh) scale(0.75) scaleX(-1); }
          40% { transform: translate(51.2vw, 17.5vh) scale(0.75) scaleX(-1) rotate(12deg); }
          44% { transform: translate(51.7vw, 18vh) scale(0.75) scaleX(-1) rotate(7deg); }
          48% { transform: translate(51.2vw, 17.5vh) scale(0.75) scaleX(-1) rotate(18deg); }
          54% { transform: translate(51.7vw, 18vh) scale(0.75) scaleX(-1) rotate(7deg); }
          58% { transform: translate(51.2vw, 17.5vh) scale(0.75) scaleX(-1) rotate(20deg); }
          60% { transform: translate(51.4vw, 17.7vh) scale(0.75) scaleX(-1) rotate(24deg); }
          62% { transform: translate(51.2vw, 17.5vh) scale(0.75) scaleX(-1) rotate(-12deg) translate(2px, -2px); }
          63% { transform: translate(51.2vw, 17.5vh) scale(0.75) scaleX(-1) rotate(12deg) translate(-2px, 2px); }
          64.5% { transform: translate(50vw, -120vh) scale(0.75) scaleX(-1) rotate(-45deg); opacity: 1; }
          70%, 100% { transform: translate(50vw, -120vh) scale(0.75); opacity: 0; }
        }
        @keyframes drowned-swim {
          0% { transform: translate(110vw, 50vh) scale(0.8) rotate(15deg); opacity: 0; }
          10% { opacity: 0.18; }
          50% { transform: translate(45vw, 55vh) scale(0.8) rotate(20deg); }
          90% { opacity: 0.18; }
          100% { transform: translate(-150px, 48vh) scale(0.8) rotate(15deg); opacity: 0; }
        }
        @keyframes puffer-swim {
          0% { transform: translate(-100px, 25vh) scale(0.6) translateY(0); opacity: 0; }
          5% { opacity: 0.25; }
          25% { transform: translate(25vw, 22vh) scale(0.6) translateY(-4px); }
          50% { transform: translate(55vw, 27vh) scale(0.6) translateY(4px); }
          75% { transform: translate(85vw, 23vh) scale(0.6) translateY(-4px); }
          95% { opacity: 0.25; }
          100% { transform: translate(110vw, 26vh) scale(0.6) translateY(0); opacity: 0; }
        }
        @keyframes turtle-swim {
          0% { transform: translate(-200px, 80vh) scale(1.1) rotate(2deg); opacity: 0; }
          8% { opacity: 0.22; }
          50% { transform: translate(50vw, 78vh) scale(1.1) rotate(-2deg); }
          92% { opacity: 0.22; }
          100% { transform: translate(110vw, 82vh) scale(1.1) rotate(1deg); opacity: 0; }
        }
        @keyframes dolphin-swim {
          0% { transform: translate(110vw, 35vh) scale(0.9) scaleX(-1) rotate(5deg); opacity: 0; }
          10% { opacity: 0.25; }
          25% { transform: translate(80vw, 42vh) scale(0.9) scaleX(-1) rotate(-8deg); }
          50% { transform: translate(50vw, 32vh) scale(0.9) scaleX(-1) rotate(10deg); }
          75% { transform: translate(20vw, 40vh) scale(0.9) scaleX(-1) rotate(-6deg); }
          90% { opacity: 0.25; }
          100% { transform: translate(-180px, 35vh) scale(0.9) scaleX(-1) rotate(5deg); opacity: 0; }
        }
      `}} />



      {/* 太陽の光のカーテン（God Rays） */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(circle at 50% -20%, rgba(255,255,255,0.4) 0%, transparent 60%)",
        zIndex: 1
      }} />
      
      {/* 斜めに降り注ぐ光の筋（ライトシャフト） */}
      <div style={{
        position: "absolute", top: -100, left: "20%", width: "60%", height: "150%",
        display: "flex", gap: "20px", transform: "skewX(-12deg)",
        opacity: 0.25, zIndex: 1, pointerEvents: "none"
      }}>
        <div style={{ width: 40, height: "100%", background: "linear-gradient(to bottom, rgba(255,255,255,0.4), transparent)", animation: "light-shaft-shimmer 7s infinite alternate ease-in-out" }} />
        <div style={{ width: 120, height: "100%", background: "linear-gradient(to bottom, rgba(255,255,255,0.3), transparent)", animation: "light-shaft-shimmer 11s infinite alternate ease-in-out", animationDelay: "-2s" }} />
        <div style={{ width: 60, height: "100%", background: "linear-gradient(to bottom, rgba(255,255,255,0.35), transparent)", animation: "light-shaft-shimmer 9s infinite alternate ease-in-out", animationDelay: "-5s" }} />
        <div style={{ width: 180, height: "100%", background: "linear-gradient(to bottom, rgba(255,255,255,0.25), transparent)", animation: "light-shaft-shimmer 15s infinite alternate ease-in-out", animationDelay: "-3s" }} />
      </div>

      {/* クジラの影シルエット */}
      <div style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: 300,
        height: 150,
        fill: "rgba(0, 10, 25, 0.22)",
        filter: "blur(5px)",
        zIndex: 2,
        animation: "whale-swim 75s infinite linear"
      }}>
        <svg viewBox="0 0 200 100" style={{ width: "100%", height: "100%" }}>
          <path d="M10 40 C 30 20, 80 15, 130 30 C 150 25, 170 15, 190 5 C 185 20, 185 35, 190 50 C 170 45, 150 45, 130 40 C 110 55, 80 60, 50 55 C 30 52, 15 48, 10 40 Z" />
          <path d="M70 48 C80 65, 95 65, 90 48" />
        </svg>
      </div>

      {/* イカの影シルエット */}
      <div style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: 100,
        height: 150,
        fill: "rgba(0, 12, 28, 0.25)",
        filter: "blur(3px)",
        zIndex: 2,
        animation: "squid-swim 50s infinite linear -15s"
      }}>
        <svg viewBox="0 0 100 150" style={{ width: "100%", height: "100%" }}>
          <rect x="30" y="10" width="40" height="50" rx="2" />
          <path d="M34 60 L30 110" stroke="rgba(0, 12, 28, 0.7)" strokeWidth="4" strokeLinecap="round" />
          <path d="M40 60 L38 120" stroke="rgba(0, 12, 28, 0.7)" strokeWidth="4" strokeLinecap="round" />
          <path d="M46 60 L45 130" stroke="rgba(0, 12, 28, 0.7)" strokeWidth="4" strokeLinecap="round" />
          <path d="M52 60 L52 135" stroke="rgba(0, 12, 28, 0.7)" strokeWidth="4" strokeLinecap="round" />
          <path d="M58 60 L60 130" stroke="rgba(0, 12, 28, 0.7)" strokeWidth="4" strokeLinecap="round" />
          <path d="M64 60 L68 120" stroke="rgba(0, 12, 28, 0.7)" strokeWidth="4" strokeLinecap="round" />
          <path d="M70 60 L74 110" stroke="rgba(0, 12, 28, 0.7)" strokeWidth="4" strokeLinecap="round" />
        </svg>
      </div>

      {/* ドラウンド（溺死ゾンビ）の影シルエット */}
      <div style={{
        position: "absolute", left: 0, top: 0, width: 60, height: 100,
        fill: "rgba(0, 10, 25, 0.22)", filter: "blur(2.5px)", zIndex: 2,
        animation: "drowned-swim 60s infinite linear -20s"
      }}>
        <svg viewBox="0 0 60 100" style={{ width: "100%", height: "100%" }}>
          <rect x="20" y="8" width="20" height="20" rx="1" />
          <rect x="20" y="6" width="20" height="6" fill="rgba(0, 10, 25, 0.25)" />
          <rect x="22" y="28" width="16" height="32" rx="1" />
          <rect x="2" y="32" width="22" height="6" rx="1" />
          <rect x="6" y="38" width="20" height="5" rx="1" />
          <rect x="22" y="60" width="7" height="30" rx="1" />
          <rect x="31" y="60" width="7" height="30" rx="1" />
        </svg>
      </div>

      {/* フグの影シルエット */}
      <div style={{
        position: "absolute", left: 0, top: 0, width: 80, height: 80,
        fill: "rgba(0, 10, 25, 0.2)", filter: "blur(2px)", zIndex: 2,
        animation: "puffer-swim 40s infinite linear -10s"
      }}>
        <svg viewBox="0 0 80 80" style={{ width: "100%", height: "100%" }}>
          <rect x="20" y="20" width="40" height="40" rx="8" />
          <rect x="38" y="10" width="4" height="10" />
          <rect x="38" y="60" width="4" height="10" />
          <rect x="10" y="38" width="10" height="4" />
          <rect x="60" y="38" width="10" height="4" />
          <path d="M 22 22 L 14 14 L 17 11 Z" />
          <path d="M 58 22 L 66 14 L 63 11 Z" />
          <path d="M 22 58 L 14 66 L 11 63 Z" />
          <path d="M 58 58 L 66 66 L 69 63 Z" />
          <circle cx="50" cy="35" r="3" fill="rgba(255,255,255,0.15)" />
          <circle cx="51" cy="35" r="1.5" fill="rgba(0,0,0,0.3)" />
          <rect x="15" y="36" width="6" height="8" rx="1" />
        </svg>
      </div>

      {/* カメの影シルエット */}
      <div style={{
        position: "absolute", left: 0, top: 0, width: 120, height: 60,
        fill: "rgba(0, 10, 25, 0.2)", filter: "blur(3px)", zIndex: 2,
        animation: "turtle-swim 80s infinite linear -35s"
      }}>
        <svg viewBox="0 0 120 60" style={{ width: "100%", height: "100%" }}>
          <rect x="25" y="15" width="60" height="24" rx="6" />
          <rect x="35" y="11" width="40" height="5" rx="2" fill="rgba(0, 10, 25, 0.2)" />
          <rect x="85" y="20" width="18" height="14" rx="3" />
          <path d="M 55 35 L 35 52 L 42 55 Z" />
          <path d="M 65 35 L 50 50 L 55 53 Z" />
          <path d="M 30 35 L 18 45 L 22 47 Z" />
        </svg>
      </div>

      {/* イルカの影シルエット */}
      <div style={{
        position: "absolute", left: 0, top: 0, width: 130, height: 70,
        fill: "rgba(0, 10, 25, 0.2)", filter: "blur(2.5px)", zIndex: 2,
        animation: "dolphin-swim 30s infinite linear -5s"
      }}>
        <svg viewBox="0 0 130 70" style={{ width: "100%", height: "100%" }}>
          <rect x="35" y="24" width="65" height="22" rx="4" />
          <rect x="100" y="32" width="15" height="8" rx="1" />
          <path d="M 65 24 L 52 8 L 60 24 Z" />
          <path d="M 60 46 L 48 58 L 54 60 Z" />
          <path d="M 35 35 L 12 22 L 15 48 Z" />
        </svg>
      </div>

      {/* 釣り針＆糸（カサゴ釣りギミック） */}
      <div style={{
        position: "absolute",
        left: "50%",
        top: 0,
        width: 2,
        height: "18vh",
        background: "transparent",
        transformOrigin: "top center",
        zIndex: 3,
        animation: "fishing-line-move 45s infinite ease-in-out"
      }}>
        {/* 釣り針 */}
        <div style={{
          position: "absolute",
          bottom: -12,
          left: -5,
          width: 10,
          height: 12,
          border: "2px solid rgba(255,255,255,0.4)",
          borderTop: "none",
          borderLeft: "none",
          borderRadius: "0 0 8px 0",
          transform: "rotate(45deg)"
        }} />
      </div>

      {/* 釣られるカサゴ */}
      <div style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: 80,
        height: 50,
        fill: "rgba(0, 15, 30, 0.32)",
        filter: "blur(2.5px)",
        zIndex: 3,
        transformOrigin: "center center",
        animation: "kasago-move 45s infinite ease-in-out"
      }}>
        <svg viewBox="0 0 80 50" style={{ width: "100%", height: "100%" }}>
          <rect x="20" y="15" width="35" height="20" rx="1" />
          <path d="M20 25 L5 12 L5 38 Z" />
          <rect x="30" y="5" width="15" height="10" rx="1" />
          <rect x="35" y="35" width="12" height="8" rx="1" />
          <circle cx="45" cy="22" r="2.5" fill="rgba(255,255,255,0.2)" />
        </svg>
      </div>

      {/* ぷくぷくと上昇する空気の泡 */}
      <div style={{ position: "absolute", inset: 0, zIndex: 5, pointerEvents: "none" }}>
        {/* 泡1 */}
        <div style={{
          position: "absolute", left: "15%", bottom: 0,
          width: 8, height: 8, borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.7)", background: "rgba(255,255,255,0.1)",
          boxShadow: "inset 1px 1px 2px #fff",
          // @ts-ignore
          "--wobble": "30px",
          animation: "bubble-rise 10s infinite linear"
        }} />
        {/* 泡2 */}
        <div style={{
          position: "absolute", left: "35%", bottom: 0,
          width: 12, height: 12, borderRadius: "50%",
          border: "1.5px solid rgba(255,255,255,0.8)", background: "rgba(255,255,255,0.15)",
          boxShadow: "inset 2px 2px 3px #fff",
          // @ts-ignore
          "--wobble": "-45px",
          animation: "bubble-rise 14s infinite linear",
          animationDelay: "-3s"
        }} />
        {/* 泡3 */}
        <div style={{
          position: "absolute", left: "65%", bottom: 0,
          width: 6, height: 6, borderRadius: "50%",
          border: "0.8px solid rgba(255,255,255,0.7)", background: "rgba(255,255,255,0.05)",
          boxShadow: "inset 1px 1px 1px #fff",
          // @ts-ignore
          "--wobble": "25px",
          animation: "bubble-rise 8s infinite linear",
          animationDelay: "-1s"
        }} />
        {/* 泡4 */}
        <div style={{
          position: "absolute", left: "80%", bottom: 0,
          width: 10, height: 10, borderRadius: "50%",
          border: "1.2px solid rgba(255,255,255,0.75)", background: "rgba(255,255,255,0.1)",
          boxShadow: "inset 1px 1px 2px #fff",
          // @ts-ignore
          "--wobble": "-25px",
          animation: "bubble-rise 12s infinite linear",
          animationDelay: "-6s"
        }} />
      </div>
    </div>
  </div>
  );
}

function CyberBackdrop({ zoom, pan }: { zoom: number; pan: { x: number; y: number } }) {
  // サイバー背景も、積み木アナログ統一に伴い、呼び出されないが記述だけ維持
  return <WorkshopBackdrop zoom={zoom} pan={pan} />;
}

function ThemeBackdrop({ theme, zoom, pan }: { theme: "workshop" | "cyber"; zoom: number; pan: { x: number; y: number } }) {
  const { themeId } = useThemeStore();
  if (themeId === "land") return <LandBackdrop zoom={zoom} pan={pan} />;
  return <WorkshopBackdrop zoom={zoom} pan={pan} />;
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

  const labelMap: Record<string, string> = {
    next: "▼ ここに置く",
    then: "▼ そうなら",
    else: "▶ ちがうなら",
    inner: "◀ ここに入れる",
  };
  const label = labelMap[slot] ?? "▼ ここに接続";

  return (
    <>
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
        boxShadow: `0 2px 0 rgba(0,0,0,0.2), 0 0 12px ${color}`,
        animation: "snapLabelBob 0.45s ease-in-out infinite alternate",
        zIndex: 102,
        pointerEvents: "none",
        whiteSpace: "nowrap",
        textShadow: "1px 1px 0 rgba(0,0,0,0.4)",
      }}>{label}</div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════
   サイドバー（おもちゃトレイ）
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
      <div style={{
        padding: "10px 16px", background: "var(--panel)", borderBottom: "2px solid var(--border-color)",
        display: "flex", justifyContent: "space-between", alignItems: "center"
      }}>
        <span className="font-pixel text-[11px]" style={{ color: "var(--accent)", letterSpacing: "0.05em" }}>📁 PROJECTS</span>
        <button onClick={onClose} className="mc-btn mc-btn--sm">✕ 閉じる</button>
      </div>

      <div style={{ padding: "16px 18px", maxHeight: 440, overflowY: "auto", background: "var(--surface)" }}>
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
   スロットリールコンポーネント（明るいTCG調）
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
    
    velocity.current += e.deltaY < 0 ? 0.35 : -0.35;
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
    const newScrollPos = dragStartScrollPos.current - diffY;
    
    const now = Date.now();
    const dt = now - lastTime.current;
    if (dt > 10) {
      const dy = e.clientY - lastY.current;
      velocity.current = -dy / dt; 
      lastY.current = e.clientY;
      lastTime.current = now;
    }

    setScrollPos(newScrollPos);

    const currentTickIdx = Math.round(newScrollPos / ITEM_HEIGHT);
    if (currentTickIdx !== lastTickIndex.current) {
      playSlotTickSound();
      lastTickIndex.current = currentTickIdx;
    }
  };

  const handleMouseUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    startAnimationLoop();
  };

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
        background: "linear-gradient(to bottom, #e0f2fe 0%, #f0f9ff 15%, #ffffff 50%, #f0f9ff 85%, #e0f2fe 100%)", // ソーダブルーグラデーション
        borderRadius: 12,
        border: "3px solid #1e293b", // 太い黒いフチに変更
        boxShadow: "0 4px 0 #1e293b, inset 0 2px 8px rgba(14,165,233,0.12)", // おもちゃ風の立体シャドウ ＋ 内側のシャドウ
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        cursor: "ns-resize",
        userSelect: "none"
      }}
    >
      {/* 選択ライン（やわらかく・主張しすぎない） */}
      <div style={{
        position: "absolute", left: 2, right: 2, top: "50%", transform: "translateY(-50%)",
        height: 46,
        borderTop: "2px solid rgba(14,165,233,0.18)",
        borderBottom: "2px solid rgba(14,165,233,0.18)",
        background: "rgba(14,165,233,0.03)",
        pointerEvents: "none", zIndex: 5,
      }} />

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
          
          const virtualPos = absoluteIndex - virtualIndex;
          const angle = virtualPos * 25; 
          const zDepth = Math.cos(angle * Math.PI / 180) * 85 - 85; 
          const yPos = Math.sin(angle * Math.PI / 180) * 85; 
          
          const isActive = Math.abs(virtualPos) < 0.5;
          const dist = Math.abs(virtualPos);
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
          background: "rgba(255,255,255,0.85)", border: "1.5px solid #7dd3fc", color: "#0284c7",
          borderRadius: "50%", width: 22, height: 22, cursor: "pointer", zIndex: 10,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11,
          outline: "none", transition: "all 0.1s",
          boxShadow: "0 2px 4px rgba(0,0,0,0.06)"
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = "#7dd3fc";
          e.currentTarget.style.color = "#ffffff";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = "rgba(255,255,255,0.85)";
          e.currentTarget.style.color = "#0284c7";
        }}
      >
        ▲
      </button>
      <button 
        onClick={(e) => { e.stopPropagation(); handleNext(); }} 
        style={{
          position: "absolute", bottom: 8, right: 8,
          background: "rgba(255,255,255,0.85)", border: "1.5px solid #7dd3fc", color: "#0284c7",
          borderRadius: "50%", width: 22, height: 22, cursor: "pointer", zIndex: 10,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11,
          outline: "none", transition: "all 0.1s",
          boxShadow: "0 2px 4px rgba(0,0,0,0.06)"
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = "#7dd3fc";
          e.currentTarget.style.color = "#ffffff";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = "rgba(255,255,255,0.85)";
          e.currentTarget.style.color = "#0284c7";
        }}
      >
        ▼
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   FieldSlot — 「テキストごとにスロット」。
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
      <div style={{ fontSize: 9, fontWeight: 900, color: "#475569", letterSpacing: "0.06em", paddingLeft: 4 }}>
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
              background: "#ffffff",
              border: "2px solid #cbd5e1", borderRadius: 8, cursor: "pointer",
              boxShadow: "inset 0 1px 3px rgba(0,0,0,0.06)",
              overflow: "hidden",
            }}>
            <span style={{ position: "absolute", left: 3, color: "#94a3b8", fontSize: 10 }}>▶</span>
            <span key={value} style={{
              color: "#334155", fontWeight: 900, fontSize: 12, padding: "0 16px",
              maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              animation: "fsFlip 0.18s ease",
            }}>{value || "—"}</span>
            <span style={{ position: "absolute", right: 3, color: "#94a3b8", fontSize: 10 }}>◀</span>
          </div>
          <button onClick={() => go(1)} style={fsArrow}>▶</button>
        </div>
      ) : (
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            height: 34, boxSizing: "border-box", width: "100%", padding: "0 10px",
            background: "#ffffff", color: "#334155",
            border: "2px solid #cbd5e1", borderRadius: 8, outline: "none",
            fontWeight: 900, fontSize: 12, textAlign: "center",
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.06)",
          }} />
      )}
    </div>
  );
}
const fsArrow: React.CSSProperties = {
  width: 30, flexShrink: 0, background: "linear-gradient(to bottom, #f8fafc, #f1f5f9)",
  color: "#64748b", border: "2px solid #cbd5e1", borderRadius: 8, cursor: "pointer",
  fontSize: 11, fontWeight: 900, boxShadow: "0 2px 0 #cbd5e1, inset 0 1px 0 rgba(255,255,255,0.8)",
};

/* ───────── たまにキーボードの上を横切るクリーパーの影（アンビエント） ─────────
   ※色つき再現はせず、ぼかした暗いシルエット“影”＝オマージュ。非公式ツール。 */
function CreeperShadow() {
  const { themeId } = useThemeStore();
  if (themeId !== "land") return null; // 海テーマ(隠し扉)では陸の生き物は出さない
  const col = "rgba(20,32,20,0.26)";
  const dark = "rgba(8,16,8,0.5)";
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 191, height: 0, zIndex: 3, pointerEvents: "none", overflow: "visible" }}>
      <style>{`
        @keyframes creeperWalk {
          0%   { transform: translateX(-70px); opacity: 0; }
          3%   { opacity: 1; }
          17%  { opacity: 1; }
          20%  { transform: translateX(100vw); opacity: 0; }
          100% { transform: translateX(100vw); opacity: 0; }
        }
        @keyframes creeperBob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-2.5px) } }
        @keyframes creeperLegA { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-2px) } }
        @keyframes creeperLegB { 0%,100% { transform: translateY(-2px) } 50% { transform: translateY(0) } }
      `}</style>
      <div style={{ position: "absolute", bottom: 0, left: 0, willChange: "transform", animation: "creeperWalk 38s linear infinite 7s" }}>
        <div style={{ animation: "creeperBob 0.46s ease-in-out infinite", transformOrigin: "bottom center", filter: "blur(0.6px)" }}>
          {/* 頭＋かすかな顔 */}
          <div style={{ width: 16, height: 13, margin: "0 auto", background: col, borderRadius: 2, position: "relative" }}>
            <div style={{ position: "absolute", left: 3.5, top: 4, width: 2.5, height: 3, background: dark }} />
            <div style={{ position: "absolute", right: 3.5, top: 4, width: 2.5, height: 3, background: dark }} />
            <div style={{ position: "absolute", left: "50%", top: 7, marginLeft: -2.5, width: 5, height: 5, background: dark }} />
          </div>
          {/* 胴 */}
          <div style={{ width: 14, height: 19, margin: "1px auto 0", background: col, borderRadius: 2 }} />
          {/* 脚 */}
          <div style={{ display: "flex", justifyContent: "center", gap: 3, marginTop: 1 }}>
            <div style={{ width: 5, height: 6, background: col, animation: "creeperLegA 0.46s ease-in-out infinite" }} />
            <div style={{ width: 5, height: 6, background: col, animation: "creeperLegB 0.46s ease-in-out infinite" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────── たまに上から落ちて来るエンダーマンの影（着地→テレポート消失） ─────────
   ※色つき再現はせず暗いシルエット＋紫に光る目＝オマージュ。非公式ツール。 */
function EndermanShadow() {
  const { themeId } = useThemeStore();
  if (themeId !== "land") return null; // 海テーマ(隠し扉)では陸の生き物は出さない
  const col = "rgba(12,12,20,0.34)";
  const eye = "#d8b4fe";
  return (
    <div style={{ position: "absolute", left: "57%", bottom: 191, zIndex: 3, pointerEvents: "none", overflow: "visible" }}>
      <style>{`
        @keyframes endermanDrop {
          0%   { transform: translateY(-160px); opacity: 0; }
          5%   { opacity: 0.95; }
          11%  { transform: translateY(0); opacity: 0.95; }
          13%  { transform: translateY(-3px); }
          15%  { transform: translateY(0); }
          21%  { opacity: 0.95; }
          24%  { transform: translateY(0) scaleY(1.12); opacity: 0; }
          100% { opacity: 0; }
        }
        @keyframes endermanSway { 0%,100% { transform: translateX(0) } 50% { transform: translateX(1px) } }
        @keyframes endermanEye { 0%,100% { opacity: 0.8 } 50% { opacity: 1 } }
      `}</style>
      <div style={{ animation: "endermanDrop 33s ease-in infinite 19s", willChange: "transform" }}>
        <div style={{ animation: "endermanSway 2.2s ease-in-out infinite", transformOrigin: "bottom center", filter: "blur(0.6px)" }}>
          {/* 頭＋紫に光る目 */}
          <div style={{ width: 11, height: 11, margin: "0 auto", background: col, borderRadius: 2, position: "relative" }}>
            <div style={{ position: "absolute", left: 2, top: 5, width: 2.5, height: 2, background: eye, boxShadow: `0 0 4px ${eye}`, animation: "endermanEye 1.6s ease-in-out infinite" }} />
            <div style={{ position: "absolute", right: 2, top: 5, width: 2.5, height: 2, background: eye, boxShadow: `0 0 4px ${eye}`, animation: "endermanEye 1.6s ease-in-out infinite" }} />
          </div>
          {/* 細長い胴 */}
          <div style={{ width: 8, height: 30, margin: "0 auto", background: col, borderRadius: 2 }} />
          {/* 長い脚 */}
          <div style={{ display: "flex", justifyContent: "center", gap: 4 }}>
            <div style={{ width: 3, height: 16, background: col }} />
            <div style={{ width: 3, height: 16, background: col }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LogicPanel({ onExportReady }: { onExportReady?: () => void } = {}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const setGeneratedJsCode = useEditorStore(s => s.setGeneratedJsCode);
  const setLogicGraphJson = useEditorStore(s => s.setLogicGraphJson);
  const setExportArmed = useEditorStore(s => s.setExportArmed);

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

    const seenIds = new Set<string>();
    const deduplicated = migrated.filter(b => {
      if (seenIds.has(b.id)) return false;
      seenIds.add(b.id);
      return true;
    });

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
  const getDefaultZoom = useCallback(() => {
    if (typeof window === "undefined") return BASE_ZOOM;
    const w = window.innerWidth;
    if (w < 1024) return 0.65; // タブレット等
    if (w < 1366) return 0.8;  // ノートPC等
    return BASE_ZOOM;          // デスクトップ
  }, []);
  const [zoom, setZoom] = useState(BASE_ZOOM);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showLib, setShowLib] = useState(true);
  const [activeGroup, setActiveGroup] = useState<string>("when");
  const [selectedTemplate, setSelectedTemplate] = useState<Tmpl | null>(null);

  useEffect(() => {
    const g = FRIENDLY_GROUPS.find(x => x.key === activeGroup) ?? FRIENDLY_GROUPS[0];
    const defaultTemplates = TEMPLATES.filter(t => g.cats.includes(t.category) && !HIDDEN_COND_TYPES.has(t.type));
    setSelectedTemplate(defaultTemplates.length > 0 ? defaultTemplates[0] : null);
  }, [activeGroup]);

  const [fieldVals, setFieldVals] = useState<Record<string, string>>({});
  // 手札トレイ：スポーンしたカードの一時置き場（クリックでキャンバスへ配置）
  const [tray, setTray] = useState<{ key: string; tmpl: Tmpl; vals: Record<string, string> }[]>([]);
  useEffect(() => {
    if (!selectedTemplate) { setFieldVals({}); return; }
    const init: Record<string, string> = {};
    selectedTemplate.fields.forEach(f => (init[f.id] = f.value));
    setFieldVals(init);
  }, [selectedTemplate]);

  const [focusedField, setFocusedField] = useState<{ blockId: string; fieldId: string } | null>(null);
  const CAT = CAT_WORKSHOP;
  const [wireDrag, setWireDrag] = useState<{ sourceBlockId: string; slot: string; armed: boolean; accepts: Category[] } | null>(null);
  const [mouseCanvasPos, setMouseCanvasPos] = useState({ x: 0, y: 0 });

  const searching = search.trim().length > 0;
  const currentGroup = FRIENDLY_GROUPS.find(g => g.key === activeGroup) ?? FRIENDLY_GROUPS[0];
  const filtered = (searching
    ? TEMPLATES.filter(t => t.label.includes(search) || t.sublabel.includes(search))
    : TEMPLATES.filter(t => currentGroup.cats.includes(t.category))
  ).filter(t => !HIDDEN_COND_TYPES.has(t.type));

  // 下部キーボード：8カテゴリ直割り＋計算だけサブタブ。キーを押すと即カードがキャンバスへ
  const [kbCat, setKbCat] = useState<Category>("trigger");
  const [kbCalcSub, setKbCalcSub] = useState<CalcSubCat>("arith");
  const kbItems = (kbCat === "calc"
    ? TEMPLATES.filter(t => t.category === "calc" && getCalcSubCat(t) === kbCalcSub)
    : TEMPLATES.filter(t => t.category === kbCat)
  ).filter(t => !HIDDEN_COND_TYPES.has(t.type));
  const [showCode, setShowCode] = useState(false);
  const [showHelp, setShowHelp] = useState(false); // 起動時は閉じておく（ユーザーが ? で開く）
  const [genCode, setGenCode] = useState("");
  const [reveal, setReveal] = useState<string[] | null>(null); 
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
  const [snapAnim, setSnapAnim] = useState<string | null>(null);   
  const [addAnim, setAddAnim] = useState<string | null>(null);   
  const [rollAnim, setRollAnim] = useState<{ id: string; from: number; rot?: number; dur?: number } | null>(null); 
  const [deleteAnim, setDeleteAnim] = useState<string | null>(null);   
  const [shakeAnim, setShakeAnim] = useState<string | null>(null);   
  const [popBlocks, setPopBlocks] = useState<Record<string, boolean>>({}); 

  const [particles, setParticles] = useState<{ id: string; x: number; y: number; color: string; type?: string }[]>([]);
  const [impacts, setImpacts] = useState<{ id: string; x: number; y: number; color: string }[]>([]);
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

  const isLogicValid = blocks.some(b => b.category === "trigger" && b.nextId !== null);
  const [logicCompleteAnim, setLogicCompleteAnim] = useState(false);
  const prevValidRef = useRef(false);

  useEffect(() => {
    if (isLogicValid && !prevValidRef.current) {
      setLogicCompleteAnim(true);
      playSuccessSound();
      showToast("ロジックが完成しました！マイクラへ出力できます！", "success");
      setTimeout(() => setLogicCompleteAnim(false), 800);
    }
    prevValidRef.current = isLogicValid;
  }, [isLogicValid, showToast]);

  const normalizeCanvas = useCallback((currentBlocks: CBlock[]) => {
    if (currentBlocks.length === 0) return;
    const positions = currentBlocks.map(b => getPos(b.id, currentBlocks));
    const minX = Math.min(...positions.map(p => p.x));
    const diffX = minX - 60;
    if (Math.abs(diffX) < 1) return;

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
    const defaultZoom = getDefaultZoom();
    setZoom(defaultZoom);
    const { blocks } = live.current;
    const rect = containerRef.current?.getBoundingClientRect();
    const PAD_B = 80;
    if (blocks.length === 0) {
      if (rect) {
        const groundY = 408 + BH + PAD_B;
        setPan({ x: rect.width / 2 - 200 * defaultZoom, y: rect.height - groundY * defaultZoom });
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
      const groundY = 408 + BH + PAD_B;
      setPan({ x: rect.width / 2 - cx * defaultZoom, y: rect.height - groundY * defaultZoom });
    } else {
      setPan({ x: 60, y: 60 });
    }
  }, [getDefaultZoom]);

  useEffect(() => {
    if (blocks.length === 0) {
      resetPanZoom();
    }
  }, [blocks.length, resetPanZoom]);

  useEffect(() => {
    resetPanZoom();
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const live = useRef({ pan, zoom, blocks, selected, snapHint, wireDrag });
  live.current = { pan, zoom, blocks, selected, snapHint, wireDrag };

  const panDrag = useRef({ active: false, sx: 0, sy: 0, sp: { x: 0, y: 0 } });
  const blockDrag = useRef({ active: false, id: "", offX: 0, offY: 0 });
  // タッチ対応：複数ポインター追跡＋ピンチズーム
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const startPinch = useCallback(() => {
    const pts = [...pointers.current.values()];
    if (pts.length < 2) return;
    const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    pinch.current = { dist: d || 1, zoom: live.current.zoom };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const fac = e.deltaY < 0 ? 1.05 : 1 / 1.05;
      setZoom(z => {
        const nz = Math.min(2.5, Math.max(0.2, z * fac));
        setPan(p => ({
          x: mx - (mx - p.x) * (nz / z),
          y: rect.height - (rect.height - p.y) * (nz / z),
        }));
        return nz;
      });
    };
    el.addEventListener("wheel", onWheelNative, { passive: false });
    return () => el.removeEventListener("wheel", onWheelNative);
  }, []);

  const handleBgDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.button !== 1) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2) { startPinch(); panDrag.current.active = false; blockDrag.current.active = false; return; }
    if (live.current.wireDrag) {
      setWireDrag(null);
      return;
    }
    panDrag.current = { active: true, sx: e.clientX, sy: e.clientY, sp: { ...live.current.pan } };
    setSelected(null);
    e.preventDefault();
  }, []);

  const handleBlockDown = useCallback((e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2) { startPinch(); panDrag.current.active = false; blockDrag.current.active = false; return; }
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

          setParticles(prev => [
            ...prev,
            { id: uid() + "_ripple", x: screenX, y: screenY, color: SLOT_BADGE[wireDrag.slot].color, type: "ripple" }
          ]);

          setWireDrag(null);
          return;
        } else {
          setShakeAnim(id);
          tone(150, 0.1, "sawtooth", 0.3); 
          showToast("ここには繋げないよ！", "warning");
          setTimeout(() => setShakeAnim(null), 300);
          setWireDrag(null);
          return;
        }
      }
    }

    playClickSound(); 
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
    setDraggingId(id);
    setSelected(id);
  }, []);

  const handleTrayDragStart = useCallback((e: React.MouseEvent, it: { key: string; tmpl: Tmpl; vals: Record<string, string> }) => {
    e.preventDefault();
    e.stopPropagation();
    
    const { pan, zoom, blocks } = live.current;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mx = (e.clientX - rect.left) / zoom - pan.x / zoom;
    const my = (e.clientY - rect.top) / zoom - pan.y / zoom;

    const nb = spawnBlock(it.tmpl, mx - BW / 2, my - BH / 2);
    nb.fields = nb.fields.map(f => it.vals[f.id] !== undefined ? { ...f, value: it.vals[f.id] } : f);

    setBlocks(p => [...p, nb]);
    setTray(t => t.filter(x => x.key !== it.key));

    const nbH = blockH(nb);
    blockDrag.current = { active: true, id: nb.id, offX: BW / 2, offY: nbH / 2 };
    setDraggingId(nb.id);
    setSelected(nb.id);

    playClickSound();
  }, []);

  // ⌨️ キーを押したら“即”カードをキャンバスへ（手札トレイ廃止＝直接配置）
  // overrides: 条件分岐の cond など、生成時にフィールドを仕込む（キーボードで条件を選ぶ用）
  const spawnToCanvas = useCallback((tmpl: Tmpl, overrides?: Record<string, string>) => {
    const { pan, zoom, blocks } = live.current;
    const rect = containerRef.current?.getBoundingClientRect();
    const vw = rect?.width ?? 800;
    const lr = (document.querySelector('[data-live-stage]') as HTMLElement | null)?.getBoundingClientRect();
    const previewLeft = lr ? lr.left - (rect?.left ?? 0) : vw - 575 - 20;

    // 見える範囲の上のほうに、少しずつズラして出す（重ならない・逆ソリティアで自分で並べる）
    const cascade = (blocks.length % 6) * 26;
    // プレビューの左側の空きスペースに収まるようにスクリーン座標Xを計算
    const targetSx = previewLeft > 120 ? Math.min(vw * 0.32, previewLeft - 90) : 20;
    const sx = Math.max(20, targetSx) + cascade;
    const sy = 80 + cascade;
    const nx = (sx - pan.x) / zoom - BW / 2;
    const ny = (sy - pan.y) / zoom - BH / 2;
    const nb = spawnBlock(tmpl, nx, ny);
    if (overrides) nb.fields = nb.fields.map(f => overrides[f.id] !== undefined ? { ...f, value: overrides[f.id] } : f);
    setBlocks(p => [...p, nb]);
    setSelected(nb.id);
    playAddSound();
  }, []);

  const handleSlotClick = useCallback((blockId: string, slot: string) => {
    const accepts: Category[] = slot === "inner"
      ? ["ifelse", "value", "calc", "variable"]
      : ["trigger", "action", "loop", "ui"]; 

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
    function onMove(e: PointerEvent) {
      if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      // ピンチズーム（2本指）
      if (pointers.current.size >= 2 && pinch.current) {
        const r = containerRef.current?.getBoundingClientRect(); if (!r) return;
        const pts = [...pointers.current.values()];
        const nd = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const rawRatio = nd / pinch.current.dist;
        // ズーム感度を少しマイルドに調整（感度係数 0.85）
        const ratio = 1 + (rawRatio - 1) * 0.85;
        const midX = (pts[0].x + pts[1].x) / 2 - r.left;
        const midY = (pts[0].y + pts[1].y) / 2 - r.top;
        setZoom(z => {
          const nz = Math.min(2.5, Math.max(0.2, pinch.current!.zoom * ratio));
          setPan(p => ({ x: midX - (midX - p.x) * (nz / z), y: midY - (midY - p.y) * (nz / z) }));
          return nz;
        });
        return;
      }
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

      const b = blocks.find(x => x.id === id)!;
      const dragH = blockH(b);
      const center = { x: cx + BW / 2, y: cy + dragH / 2 };
      const snap = findSnap(id, center, blocks);

      let finalX = cx;
      let finalY = cy;

      finalY = Math.min(cy, 408 + BH - dragH);

      setBlocks(prev => prev.map(bl => bl.id === id ? { ...bl, x: finalX, y: finalY } : bl));

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
    function onUp(e: PointerEvent) {
      pointers.current.delete(e.pointerId);
      if (pointers.current.size < 2) pinch.current = null;
      if (panDrag.current.active) { panDrag.current.active = false; return; }
      if (!blockDrag.current.active) return;
      setDraggingId(null);
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
        // 手動配置：スナップしなければ「離した位置」にそのまま留める（自動整列しない）。
        // 整列はユーザーが自分でドラッグ＆重ね（snap）で行う。旧ブロックの転がり/床整列はしない。
        // ただし右パネル/LIVEプレビューの“裏”に隠れて行方不明にならないよう、見える範囲にクランプ。
        playClickSound();
        const cont = containerRef.current?.getBoundingClientRect();
        const b2 = blocks.find(bl => bl.id === id);
        if (cont && b2) {
          const CW = 82, CH = 112, M = 8; // カード実寸＋余白
          const lr = (document.querySelector('[data-live-stage]') as HTMLElement | null)?.getBoundingClientRect();
          const kb = (document.querySelector('[data-keyboard]') as HTMLElement | null)?.getBoundingClientRect();
          let leftS = b2.x * zoom + pan.x;   // cont 左基準のスクリーンX
          let topS = b2.y * zoom + pan.y;    // cont 上基準のスクリーンY
          const wS = CW * zoom, hS = CH * zoom;
          // 右端：基本はコンテナ右。カード上端がLIVE下端より上ならLIVE左端まで（LIVEの裏に隠さない）。
          let maxRight = cont.width - M;
          if (lr && lr.width > 0 && topS < (lr.bottom - cont.top)) maxRight = Math.min(maxRight, (lr.left - cont.left) - M);
          if (leftS + wS > maxRight) leftS = maxRight - wS;
          if (leftS < M) leftS = M;
          // 下端：下部キーボードの上まで（キーボードの裏に隠さない）。無ければコンテナ下。
          let maxBottom = cont.height - M;
          if (kb && kb.width > 0) maxBottom = Math.min(maxBottom, (kb.top - cont.top) - M);
          if (topS + hS > maxBottom) topS = maxBottom - hS;
          if (topS < M) topS = M;
          const nx = (leftS - pan.x) / zoom;
          const ny = (topS - pan.y) / zoom;
          if (Math.abs(nx - b2.x) > 0.5 || Math.abs(ny - b2.y) > 0.5) {
            setBlocks(prev => prev.map(bl => bl.id === id ? { ...bl, x: nx, y: ny } : bl));
          }
        }
        blockDrag.current.active = false;
        setSnapHint(null);
        return;
      }
      blockDrag.current.active = false;
      setSnapHint(null);
    }
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
    return () => { document.removeEventListener("pointermove", onMove); document.removeEventListener("pointerup", onUp); document.removeEventListener("pointercancel", onUp); };
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
      { id: sparkId, x: sx, y: sy, color: "#ffffff" } 
    ]);
    setTimeout(() => setParticles(prev => prev.filter(p => p.id !== id && p.id !== sparkId)), 400); 
  }, []);

  const addBlock = useCallback((t: Tmpl, fieldOverrides?: Record<string, string>) => {
    const { pan, zoom, blocks } = live.current;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const baseX = Math.round((40 - pan.x) / zoom);

    const nb = spawnBlock(t, baseX, 0);
    if (fieldOverrides) {
      nb.fields = nb.fields.map(f => fieldOverrides[f.id] !== undefined ? { ...f, value: fieldOverrides[f.id] } : f);
    }
    const nbH = blockH(nb);

    let targetX = baseX;
    let targetY = 408 + BH - nbH; 

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
          targetY = pos.y - nbH - GAP; 
        }
      } else {
        targetX = baseX;
        targetY = 408 - nbH - GAP; 
      }
    } else {
      targetX = baseX;
      targetY = 408 + BH - nbH; 
    }

    nb.x = targetX;
    nb.y = targetY;

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

    const catColor = CAT[t.category]?.bg ?? "#ec4899";

    setTimeout(() => {
      const sx = (targetX + BW / 2) * zoom + pan.x;
      const sy = (targetY + BH) * zoom + pan.y;
      burstParticles(sx - BW / 2, sy, "#cbd5e1");
      burstParticles(sx + BW / 2, sy, "#cbd5e1");
      
      const impactId = uid();
      setImpacts(prev => [...prev, { id: impactId, x: sx, y: sy, color: catColor }]);
      setTimeout(() => setImpacts(prev => prev.filter(p => p.id !== impactId)), 700);
      
      if (t.type === "co_if") {
        const confId = uid();
        setConfetti(prev => [...prev, { id: confId, x: sx, y: sy - BH / 2 }]);
        setTimeout(() => setConfetti(prev => prev.filter(p => p.id !== confId)), 900);
      }
    }, 300);

    setTimeout(() => setAddAnim(null), 620);
  }, [burstParticles]);

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
          x1: pp.x + BW - 20, 
          y1: pp.y + 41,
          x2: tp.x + 0,       
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

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "row", overflow: "hidden", background: "#f0f9ff" }}>
        <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@800;900&family=Nunito:wght@800;900&family=M+PLUS+Rounded+1c:wght@800;900&display=swap');

        * {
          font-family: 'Outfit', 'Nunito', 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif !important;
        }

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
          0%  { transform: translateY(-14px) scaleY(0.9); filter: brightness(1.8); }
          40% { transform: translateY(4px) scaleY(0.93); filter: brightness(1.3); }
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
          16%  { transform: scale(1.20) rotate(-7deg); opacity: 1;    filter: brightness(1.5); }
          34%  { transform: scale(0.82) rotate(8deg);  opacity: 0.95; filter: brightness(1.1); }
          60%  { transform: scale(1.06) rotate(-4deg) translateY(-10px); opacity: 0.65; filter: brightness(0.95); }
          100% { transform: scale(0)    rotate(40deg)  translateY(28px); opacity: 0;    filter: brightness(0.6); }
        }
        @keyframes blockDragHover {
          0%, 100% { transform: scale(1.06) rotate(-2deg) translateY(-3px); }
          50%      { transform: scale(1.06) rotate(2deg)  translateY(-5px); }
        }
        @keyframes toastSlideDown {
          0%   { transform: translate(-50%, -22px); opacity: 0; }
          100% { transform: translate(-50%, 0);     opacity: 1; }
        }
        @keyframes slotPulse {
          0%, 100% { filter: brightness(1.0); }
          50%      { filter: brightness(1.25); }
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
        @keyframes particle {
          0%  {transform:translate(0,0)scale(1);opacity:1}
          100%{transform:translate(var(--dx),var(--dy))scale(0);opacity:0}
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
        .btn-card {
          box-shadow: 0 0 0 2.5px var(--card-color), 0 4px 10px rgba(0,0,0,0.15) !important;
          transition: transform 0.1s ease, box-shadow 0.1s ease !important;
        }
        .btn-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 0 0 2.5px var(--card-color), 0 8px 20px rgba(0,0,0,0.22) !important;
        }
        .btn-card:active {
          transform: translateY(2px);
          box-shadow: 0 0 0 2.5px var(--card-color), 0 2px 5px rgba(0,0,0,0.15) !important;
        }
        .toy-key {
          transition: transform 0.08s ease, box-shadow 0.08s ease, filter 0.1s ease !important;
        }
        .toy-key:hover { filter: brightness(1.05); }
        .toy-key:active {
          transform: translateY(4px) !important;
          box-shadow: 0 1px 0 var(--leg, #cbd5e1), 0 1px 4px rgba(0,0,0,0.15), inset 0 1px 2px rgba(0,0,0,0.1) !important;
        }
        @keyframes fsFlip {
          0% { transform: translateY(-40%); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>

        {/* ========================================================
          【左】スロットリール（カテゴリ＆アイテム選択）
          ======================================================== */}
        <div className="casino-border" style={{
          width: 360,
          display: "none", // ⌨️ 下部キーボードへ統合したため非表示
          flexDirection: "column",
          background: "#bfe8cc", // SPROUTグリーンをより強調した淡いグリーン色
          borderRight: "5px solid #9fcca9", // グリーン調の仕切り枠
          borderTop: "3px solid #fff", // 上部ハイライト
          zIndex: 30,
          flexShrink: 0,
          padding: "16px 12px",
          boxSizing: "border-box",
          gap: 12,
          overflowY: "auto",
          boxShadow: "inset -4px 0 12px rgba(0,0,0,0.03), 4px 0 10px rgba(0,0,0,0.05)"
        }}>
          {/* 検索窓 */}
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 検索…"
            style={{
              width: "100%", boxSizing: "border-box", padding: "6px 10px", fontSize: 11,
              background: "#ffffff",
              border: "3px solid #1e293b", // おもちゃの黒い太枠に合わせる
              borderRadius: 8,
              color: "#334155",
              outline: "none",
              fontWeight: 800,
              boxShadow: "0 2px 0 #cbd5e1, inset 0 2px 3px rgba(0,0,0,0.06)",
            }} />

          {/* STEP 1：やさしいカテゴリ（物語順 いつ→どうなる→もっと） */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: "#64748b", letterSpacing: "0.08em", paddingLeft: 4 }}>
              STEP 1: まず えらぶ
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {FRIENDLY_GROUPS.map(g => {
                const TIcon = (LucideIcons as any)[g.icon] || LucideIcons.HelpCircle;
                const active = !searching && activeGroup === g.key;
                const leg = active ? g.side : "#cbd5e1";
                return (
                  <button
                    key={g.key}
                    className="toy-key"
                    title={`${g.label}（${g.sub}）`}
                    onClick={() => {
                      setActiveGroup(g.key);
                      if (searching) setSearch("");
                      playClickSound();
                    }}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      minHeight: 78,
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
                      padding: "10px 4px",
                      borderRadius: 14,
                      border: "3px solid #1e293b",
                      cursor: "pointer",
                      background: active
                        ? `linear-gradient(135deg, ${g.top} 0%, ${g.bg} 100%)`
                        : "linear-gradient(135deg, #ffffff 0%, #eef1f5 100%)",
                      color: active ? g.text : "#64748b",
                      boxShadow: `0 5px 0 ${leg}, 0 4px 8px rgba(0,0,0,0.1), inset 0 3px 0 rgba(255,255,255,0.6)`,
                      filter: active ? `drop-shadow(0 0 6px ${g.bg}aa)` : "none",
                      textShadow: active ? "0 1px 1px rgba(0,0,0,0.15)" : "none",
                      ["--leg" as any]: leg,
                    }}
                  >
                    <TIcon size={24} color={active ? g.text : g.bg} strokeWidth={2.5} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, fontWeight: 900, lineHeight: 1 }}>{g.label}</span>
                    <span style={{ fontSize: 8.5, fontWeight: 800, opacity: 0.8, lineHeight: 1, whiteSpace: "nowrap" }}>{g.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* アイテム選択（スロットなし・ボタンリスト） */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: "#64748b", letterSpacing: "0.08em", paddingLeft: 4 }}>
              STEP 2: {searching ? "けんさく結果" : `${currentGroup.label} をえらぶ`} <span style={{ color: "#94a3b8", fontWeight: 700 }}>（{filtered.length}）</span>
            </div>
            <div style={{
              display: "flex", flexDirection: "column", gap: 5,
              maxHeight: 260, overflowY: "auto",
              padding: 6,
              borderRadius: 10,
              background: "#abdcb8", // さらにグリーン感を高めたリスト背景
              border: "2px solid #8bc79e",
              boxShadow: "inset 0 2px 5px rgba(0,0,0,0.06)",
            }}>
              {filtered.length === 0 && (
                <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textAlign: "center", padding: "16px 0" }}>
                  みつからなかった…
                </div>
              )}
              {filtered.map(tmpl => {
                const c = CAT[tmpl.category];
                const TIcon = (LucideIcons as any)[tmpl.emoji] || LucideIcons.HelpCircle;
                const active = selectedTemplate?.type === tmpl.type;
                const leg = active ? c.side : "#dfe4ea";
                return (
                  <button
                    key={tmpl.type}
                    className="toy-key"
                    title={tmpl.label}
                    onClick={() => { setSelectedTemplate(tmpl); playClickSound(); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      width: "100%",
                      padding: "9px 10px",
                      borderRadius: 10,
                      border: "3px solid #1e293b",
                      cursor: "pointer",
                      textAlign: "left",
                      fontWeight: 900, fontSize: 11.5,
                      background: active
                        ? `linear-gradient(135deg, ${c.top} 0%, ${c.bg} 100%)`
                        : "linear-gradient(135deg, #ffffff 0%, #eef1f5 100%)",
                      color: active ? c.text : "#475569",
                      boxShadow: `0 4px 0 ${leg}, 0 3px 7px rgba(0,0,0,0.08), inset 0 2px 0 rgba(255,255,255,0.6)`,
                      filter: active ? `drop-shadow(0 0 4px ${c.bg}99)` : "none",
                      textShadow: active ? "0 1px 1px rgba(0,0,0,0.15)" : "none",
                      ["--leg" as any]: leg,
                    }}
                  >
                    <TIcon size={16} color={active ? c.text : c.bg} strokeWidth={2.5} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tmpl.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 3：テキストごとにスロット（中身をセット） */}
          {selectedTemplate && selectedTemplate.fields.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <div style={{ fontSize: 10, fontWeight: 900, color: "#64748b", letterSpacing: "0.05em", paddingLeft: 4 }}>
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
              if (!selectedTemplate) return;
              // 手札トレイは最大2枚。いっぱいなら先にキャンバスへ出してもらう。
              if (tray.length >= 2) {
                showToast("手札は2枚まで。先にカードをキャンバスへ出してね", "warning");
                return;
              }
              // 直接キャンバスへ置かず、まず手札トレイに積む（右パネル下）。
              // トレイのカードは自分でドラッグしてキャンバスへ出す。
              setTray(t => [...t, { key: uid(), tmpl: selectedTemplate, vals: { ...fieldVals } }]);
              playAddSound();
            }}
            style={{
              marginTop: "auto",
              width: "100%",
              height: 52,
              background: selectedTemplate
                ? "linear-gradient(135deg, #fffbeb 0%, #fde047 100%)" // 上品なパステルたまご色
                : "linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)",
              border: "3px solid #1e293b",
              borderRadius: 16,
              boxShadow: selectedTemplate
                ? "0 5px 0 #eab308, 0 6px 12px rgba(234,179,8,0.2), inset 0 3px 0 rgba(255,255,255,0.6)"
                : "0 4px 0 #94a3b8, 0 2px 4px rgba(0,0,0,0.05)",
              color: selectedTemplate ? "#854d0e" : "#94a3b8",
              fontWeight: 900,
              fontSize: 15,
              letterSpacing: "0.12em",
              cursor: selectedTemplate ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              transition: "all 0.08s ease",
              transform: "translateY(0)"
            }}
            onMouseDown={e => {
              if (selectedTemplate) {
                const btn = e.currentTarget;
                btn.style.transform = "translateY(4px)";
                btn.style.boxShadow = "0 1px 0 #eab308, 0 2px 4px rgba(0,0,0,0.15), inset 0 1px 2px rgba(0,0,0,0.1)";
              }
            }}
            onMouseUp={e => {
              if (selectedTemplate) {
                const btn = e.currentTarget;
                btn.style.transform = "translateY(0)";
                btn.style.boxShadow = "0 5px 0 #eab308, 0 6px 12px rgba(234,179,8,0.2), inset 0 3px 0 rgba(255,255,255,0.6)";
              }
            }}
            onMouseLeave={e => {
              if (selectedTemplate) {
                const btn = e.currentTarget;
                btn.style.transform = "translateY(0)";
                btn.style.boxShadow = "0 5px 0 #eab308, 0 6px 12px rgba(234,179,8,0.2), inset 0 3px 0 rgba(255,255,255,0.6)";
              }
            }}
          >
            <span>🎯 SPAWN!</span>
          </button>
        </div>

        {/* ========================================================
          【中央】プレイ面（ソリティア風キャンバス）
          ======================================================== */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <ThemeBackdrop theme="workshop" zoom={zoom} pan={pan} />

          {/* 操作キャンバス復元（カード描画＋ドラッグ/接続。背景はWorkshopBackdropを透過。色はヒマワリが後で） */}
          <div ref={containerRef} onPointerDown={handleBgDown}
            style={{ position: "absolute", inset: 0, cursor: "grab", background: "transparent", zIndex: 1, touchAction: "none" }}>
            {blocks.length > 0 && (
              <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 6, pointerEvents: "none" }}>
                <ToyFloor />
              </div>
            )}
            <div style={{ position: "absolute", inset: 0, transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin: "0 0" }}>
              {/* 世界に浮かぶ光の粒：カードと同じ座標系に固定するのでズーム/パンでカードと1:1で動く（動きの基準）。方眼グリッドの置き換え、海テーマの神秘的な光と揃える。太陽/雲/魚は背景側で固定。 */}
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
                <style dangerouslySetInnerHTML={{ __html: `
                  @keyframes mote-float {
                    0% { transform: translateY(0); opacity: var(--mo); }
                    50% { transform: translateY(-14px); opacity: calc(var(--mo) * 1.7); }
                    100% { transform: translateY(0); opacity: var(--mo); }
                  }
                `}} />
                {WORLD_MOTES.map((m, i) => (
                  <div key={i} style={{
                    position: "absolute", left: m.x, top: m.y, width: m.r * 2, height: m.r * 2,
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(224,242,254,0.5) 40%, transparent 70%)",
                    // @ts-ignore CSS変数
                    "--mo": m.o,
                    opacity: m.o,
                    animation: `mote-float ${m.dur}s ease-in-out ${m.delay}s infinite`,
                  }} />
                ))}
              </div>
              {mounted && (
                <>
                  {connectors.map((c, i) => (
                    <Connector key={i} x={c.x} y={c.y} color={c.color} />
                  ))}
                  <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 5 }}>
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
                      isDragging={draggingId === b.id}
                      isPopping={popBlocks[b.id]}
                      isRolling={rollAnim?.id === b.id}
                      rollFrom={rollAnim?.id === b.id ? rollAnim.from : 0}
                      rollRot={rollAnim?.id === b.id ? rollAnim.rot : undefined}
                      rollDur={rollAnim?.id === b.id ? rollAnim.dur : undefined} />;
                  })}
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
            <div
              onClick={() => setShowHelp(false)}
              style={{
                position: "absolute", inset: 0, zIndex: 50,
                background: "rgba(15,23,42,0.5)", backdropFilter: "blur(3px)",
                display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
              }}
            >
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  width: "min(440px, 92%)", maxHeight: "86%", overflowY: "auto",
                  background: "#ffffff", borderRadius: 20,
                  boxShadow: "0 24px 70px rgba(0,0,0,0.4)",
                  border: "1px solid rgba(148,163,184,0.25)",
                }}
              >
                <div style={{
                  padding: "16px 22px",
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  borderBottom: "1px solid rgba(148,163,184,0.15)",
                }}>
                  <span style={{ fontSize: 16, fontWeight: 900, letterSpacing: "0.06em", color: "#334155" }}>🛠️ アドオンの作り方</span>
                  <button onClick={() => setShowHelp(false)} style={{
                    width: 28, height: 28, borderRadius: 8, border: "none",
                    background: "rgba(0,0,0,0.05)", color: "#64748b", cursor: "pointer",
                    fontSize: 15, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center",
                  }}>✕</button>
                </div>
                <div style={{ padding: "16px 22px 22px" }}>
                  {[
                    { icon: "🎹", title: "キーをえらぶ", t: <>画面の <b>下のキーボード</b> で、カテゴリ（<b>きっかけ・すること…</b>）をえらぶよ</> },
                    { icon: "⬇️", title: "キーを押す → カードが出る", t: <>キーを押すと、カードが <b>そのままキャンバスに出る</b>。中身は <b>カードの上で</b> なおせるよ（手札トレイはもう無いよ）</> },
                    { icon: "🃏", title: "重ねるだけ！", t: <>カードを 別のカードに <b>かさねると ピタッ！</b> と上から順番につながる。<br />これだけでプログラムになるよ ✨</> },
                    { icon: "❓", title: "「もしも」もかさねる", t: <><b>もしも</b> カードに 動きのカードを <b>かさねる</b> だけで、条件として組みこまれるよ</> },
                    { icon: "🎉", title: "アドオン完成！", t: <>右下の明るい緑の <b style={{ color: "#16a34a" }}>アドオン完成！🎉</b> キーを押すと、コードができあがる</> },
                    { icon: "🚀", title: "ダウンロードしてマイクラへ", t: <>上の <b>🚀 マイクラへ</b> タブを開いて <b style={{ color: "#16a34a" }}>⚡ ビルド＆ダウンロード</b>。<br />できた <b>.mcaddon</b> をマイクラに読みこめば完成！</> },
                  ].map((s, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 13, marginBottom: 16 }}>
                      <span style={{
                        flexShrink: 0, width: 38, height: 38, borderRadius: 12,
                        background: "linear-gradient(160deg, #f8fafc, #eef2ff)",
                        border: "1px solid rgba(148,163,184,0.3)",
                        boxShadow: "0 2px 5px rgba(15,23,42,0.08)",
                        fontSize: 20,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>{s.icon}</span>
                      <div style={{ paddingTop: 1 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 900, color: "#1e293b", marginBottom: 2 }}>{s.title}</div>
                        <div style={{ fontSize: 12.5, color: "#475569", fontWeight: 500, lineHeight: 1.55 }}>{s.t}</div>
                      </div>
                    </div>
                  ))}
                  {/* ショートカット（ちいさく） */}
                  <div style={{
                    marginTop: 4, paddingTop: 12, borderTop: "1px dashed rgba(148,163,184,0.4)",
                    fontSize: 11.5, color: "#64748b", fontWeight: 600, lineHeight: 1.8,
                  }}>
                    🗑 消す = えらんで <b>×</b> / <b>Delete</b>　　📑 コピー = <b>Ctrl+D</b>　　🚫 やめる = <b>Esc</b>
                  </div>
                </div>
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
              background: "rgba(255, 255, 255, 0.85)",
              backdropFilter: "blur(4px)",
              border: "1px solid rgba(0,0,0,0.08)",
              padding: "3px 8px",
              borderRadius: 6,
              display: "inline-flex", alignItems: "center", gap: 4,
              boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
              color: "#334155",
              fontSize: 11, fontWeight: 800,
            }}>
              <span style={{ fontSize: 12 }}>📦</span>
              <span style={{
                fontFamily: "monospace", letterSpacing: "0.02em", color: "#0ea5e9"
              }}>{mounted ? blocks.length : 0}<span style={{ fontSize: 9, marginLeft: 1 }}>個</span></span>
            </div>

            {/* ズーム倍率 */}
            <button onClick={resetPanZoom} title="クリックで 100% + 画面中央に戻る" style={{
              background: "rgba(255, 255, 255, 0.85)",
              backdropFilter: "blur(4px)",
              border: "1px solid rgba(0,0,0,0.08)",
              padding: "3px 8px",
              borderRadius: 6,
              display: "inline-flex", alignItems: "center", gap: 4,
              boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
              color: "#334155",
              fontSize: 11, fontWeight: 800, cursor: "pointer",
            }}>
              <span style={{ fontSize: 12 }}>🎯</span>
              <span style={{ fontFamily: "monospace", letterSpacing: "0.02em", color: "#eab308" }}>{Math.round(zoom / BASE_ZOOM * 100)}%</span>
            </button>

          </div>

          {/* トースト通知 */}
          {toast && (
            <div style={{
              position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
              zIndex: 100,
              padding: "10px 18px",
              borderRadius: 10,
              background: toast.level === "error" ? "rgba(239,68,68,0.96)"
                : toast.level === "warning" ? "rgba(245,158,11,0.96)"
                  : "rgba(59,130,246,0.96)",
              color: "#ffffff",
              fontSize: 13, fontWeight: 900,
              border: "2px solid rgba(255,255,255,0.4)",
              boxShadow: "0 6px 18px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.25)",
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
              onClose={() => { setReveal(null); onExportReady?.(); }}
              theme="workshop"
            />
          )}

          <LiveStage
            blocks={blocks}
            onGather={() => {
              if (!blocks.length) { showToast("まだカードがないよ 🃏", "warning"); return; }
              resetPanZoom(); playAddSound(); showToast("カードを100%で真ん中に集めたよ！ 🧲", "success");
            }}
          />

          {/* たまにキーボードの上を横切るクリーパーの影／上から落ちるエンダーマンの影 */}
          <CreeperShadow />
          <EndermanShadow />

          {/* ⌨️ 下部キーボード：カードを“打つ”入力面（左右パネルを統合） */}
          <div data-keyboard="1" style={{
            position: "absolute", left: 12, right: 12, bottom: 12, height: 178,
            display: "flex", gap: 12, padding: 12, boxSizing: "border-box",
            background: "#cfeede",
            border: "4px solid #8bc79e", borderRadius: 18,
            boxShadow: "inset 0 2px 0 rgba(255,255,255,0.6), 0 10px 24px rgba(0,0,0,0.18)",
            zIndex: 42,
          }}>
            {/* 左：プリミティブ（カテゴリ＋アイテムキー） */}
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {/* カテゴリタブ列 */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {KEYBOARD_CATS.map(kc => {
                  const c = CAT[kc.cat];
                  const TIcon = (LucideIcons as any)[kc.icon] || LucideIcons.HelpCircle;
                  const on = kbCat === kc.cat;
                  return (
                    <button key={kc.cat} className="toy-key"
                      onClick={() => { setKbCat(kc.cat); playClickSound(); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 5, height: 34, padding: "0 11px",
                        borderRadius: 9, border: "2.5px solid #1e293b", cursor: "pointer",
                        background: on ? `linear-gradient(135deg,${c.top},${c.bg})` : `linear-gradient(135deg,#ffffff,${c.top})`,
                        color: c.text,
                        boxShadow: on
                          ? `0 3px 0 ${c.side}, 0 0 9px ${c.bg}aa, 0 3px 7px rgba(0,0,0,0.14)`
                          : `0 3px 0 ${c.side}, 0 2px 5px rgba(0,0,0,0.07)`,
                        transform: on ? "translateY(-1px)" : "translateY(0)",
                        fontWeight: 900, fontSize: 12, whiteSpace: "nowrap",
                      }}>
                      <TIcon size={15} color={on ? c.text : c.bg} strokeWidth={2.6} />
                      {kc.label}
                    </button>
                  );
                })}
              </div>

              {/* 計算のサブタブ（けいさん選択時のみ・スクロール回避） */}
              {kbCat === "calc" && (
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {CALC_SUBTABS.map(s => {
                    const on = kbCalcSub === s.key;
                    const SIcon = (LucideIcons as any)[s.icon] || LucideIcons.HelpCircle;
                    return (
                      <button key={s.key} className="toy-key"
                        onClick={() => { setKbCalcSub(s.key); playClickSound(); }}
                        style={{
                          display: "flex", alignItems: "center", gap: 4, height: 26, padding: "0 9px",
                          borderRadius: 999, border: "2px solid #1e293b", cursor: "pointer",
                          background: on ? "linear-gradient(135deg,#fde68a,#fbbf24)" : "#ffffff",
                          color: on ? "#7c2d12" : "#64748b", fontWeight: 800, fontSize: 10.5, whiteSpace: "nowrap",
                          boxShadow: on ? "0 2px 0 #d97706" : "0 2px 0 #e2e8f0",
                        }}>
                        <SIcon size={12} strokeWidth={2.6} /> {s.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* アイテムキー：押すと即カードがキャンバスへ */}
              <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: 6, alignContent: "flex-start", overflowY: "auto", padding: 8, background: "rgba(255,255,255,0.5)", border: "2px solid #b9e0c8", borderRadius: 12, boxShadow: "inset 0 2px 5px rgba(0,0,0,0.05)" }}>
                {kbCat === "ifelse" ? (
                  /* 条件分岐：条件をキーボードで選ぶ＝タップでその条件入り「もしも〜なら」が出る */
                  CO_IF_CONDS.map(cond => {
                    const c = CAT["ifelse"];
                    return (
                      <button key={cond} className="toy-key" title={`もしも ${cond} なら`}
                        onClick={() => spawnToCanvas(CO_IF_TMPL, { cond })}
                        style={{
                          display: "flex", alignItems: "center", gap: 6, height: 38, padding: "0 12px",
                          borderRadius: 9, border: "2.5px solid #1e293b", cursor: "pointer",
                          background: `linear-gradient(135deg,#fde7ff,${c.top})`,
                          boxShadow: `0 3px 0 ${c.side}, 0 3px 6px rgba(0,0,0,0.1)`,
                          fontWeight: 900, fontSize: 11.5, color: c.text, whiteSpace: "nowrap",
                        }}>
                        <span style={{ fontSize: 13 }}>{COND_EMOJI[cond] || "🔀"}</span>
                        もしも<b style={{ color: c.side }}>{cond}</b>なら<span style={{ marginLeft: 1 }}>✨</span>
                      </button>
                    );
                  })
                ) : kbItems.map(tmpl => {
                  const c = CAT[tmpl.category];
                  const TIcon = (LucideIcons as any)[tmpl.emoji] || LucideIcons.HelpCircle;
                  const sparkle = tmpl.type === "co_if" || tmpl.type === "ct_rep";
                  return (
                    <button key={tmpl.type} className="toy-key" title={`${tmpl.label}：${tmpl.sublabel}`}
                      onClick={() => spawnToCanvas(tmpl)}
                      style={{
                        display: "flex", alignItems: "center", gap: 6, height: 38, padding: "0 10px 0 8px",
                        borderRadius: 9, border: "2.5px solid #1e293b", cursor: "pointer",
                        background: "linear-gradient(135deg,#ffffff,#eef1f5)",
                        boxShadow: `0 3px 0 ${c.side}99, 0 3px 6px rgba(0,0,0,0.08)`,
                        fontWeight: 900, fontSize: 11.5, color: "#1e293b", whiteSpace: "nowrap",
                      }}>
                      <span style={{ width: 22, height: 22, borderRadius: 6, background: c.bg, border: "2px solid #1e293b", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <TIcon size={13} color="#fff" strokeWidth={2.6} />
                      </span>
                      {tmpl.label}
                      {sparkle && <span style={{ marginLeft: 2 }}>✨</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 右：道具キー＋アドオン完成 */}
            <div style={{ width: 244, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, borderLeft: "2px dashed #8bc79e", paddingLeft: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
                {[
                  { emoji: "↩", label: "戻る", on: false, fn: () => undo() },
                  { emoji: "↪", label: "進む", on: false, fn: () => redo() },
                  { emoji: "🎯", label: "ガイド", on: showSnapGuide, fn: () => setShowSnapGuide(v => !v) },
                  { emoji: "🗑️", label: "クリア", on: false, fn: () => { if (window.confirm("キャンバス上のすべてのブロックを消去しますか？")) { setBlocks([]); setSelected(null); playDeleteSound(); showToast("すべてのブロックを消去しました", "warning"); } } },
                  { emoji: "💾", label: "保存", on: showProjects, fn: () => setShowProjects(v => !v) },
                  { emoji: "🎮", label: "サンプル", on: showTemplates, fn: () => setShowTemplates(v => !v) },
                  { emoji: "💻", label: "コード", on: showCode, fn: () => setShowCode(v => !v) },
                  { emoji: "❓", label: "作り方", on: showHelp, fn: () => setShowHelp(v => !v) },
                ].map(tk => (
                  <button key={tk.label} className="toy-key" title={tk.label} onClick={tk.fn}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
                      height: 42, borderRadius: 9, border: "2.5px solid #1e293b", cursor: "pointer",
                      background: tk.on ? "linear-gradient(135deg,#c7f9cc,#80ed99)" : "linear-gradient(135deg,#ffffff,#e9eef3)",
                      boxShadow: tk.on ? "0 3px 0 #38b000" : "0 3px 0 #cbd5e1",
                      color: tk.on ? "#004b23" : "#475569",
                    }}>
                    <span style={{ fontSize: 15, lineHeight: 1 }}>{tk.emoji}</span>
                    <span style={{ fontSize: 8.5, fontWeight: 900 }}>{tk.label}</span>
                  </button>
                ))}
              </div>
              {/* アドオン完成 */}
              <button disabled={!isLogicValid}
                onClick={() => { 
                  playSuccessSound(); 
                  const lines = (genCode || "// まず きっかけ ブロックを置いて繋げよう").split("\n"); 
                  setReveal(lines); 
                  setExportArmed(true);
                }}
                style={{
                  marginTop: "auto", height: 44, borderRadius: 12, border: "3px solid #1e293b",
                  cursor: isLogicValid ? "pointer" : "not-allowed",
                  background: isLogicValid
                    ? "linear-gradient(135deg,#bef264 0%, #4ade80 55%, #22c55e 100%)"
                    : "linear-gradient(135deg,#d9f99d 0%, #a3e635 100%)",
                  boxShadow: isLogicValid
                    ? "0 4px 0 #15803d, 0 5px 14px rgba(74,222,128,0.5)"
                    : "0 3px 0 #84cc16, 0 3px 8px rgba(132,204,22,0.25)",
                  color: isLogicValid ? "#052e16" : "#3f6212", fontWeight: 900, fontSize: 14, letterSpacing: "0.04em",
                  opacity: isLogicValid ? 1 : 0.85,
                }}>
                アドオン完成！🎉
              </button>
            </div>
          </div>

          {/* ✏️ 選んだカードの中身エディタ（直接配置式＝旧STEP3の代わり。条件もここで変える） */}
          {(() => {
            const sb = selected ? blocks.find(b => b.id === selected) : null;
            // co_if(条件分岐)はキーボードで条件を選ぶ方式なので中身エディタは出さない
            if (!sb || sb.fields.length === 0 || sb.type === "co_if") return null;
            const c = CAT[sb.category];
            const EIcon = (LucideIcons as any)[sb.emoji] || LucideIcons.HelpCircle;
            return (
              <div data-card-editor="1" style={{
                position: "absolute", top: 44, left: 12, zIndex: 44, width: 234, maxHeight: "52%", overflowY: "auto",
                background: "#ffffff", border: "3px solid #1e293b", borderRadius: 16,
                boxShadow: "0 12px 28px rgba(0,0,0,0.2)", padding: 12,
                display: "flex", flexDirection: "column", gap: 9,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, paddingBottom: 6, borderBottom: "2px solid #f1f5f9" }}>
                  <span style={{ width: 24, height: 24, borderRadius: 7, background: c.bg, border: "2px solid #1e293b", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <EIcon size={14} color="#fff" strokeWidth={2.6} />
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 900, color: "#1e293b" }}>{sb.label} の中身</span>
                </div>
                {sb.fields.map(f => (
                  <FieldSlot key={f.id} label={f.label} value={f.value} options={f.options}
                    onChange={v => handleFieldChange(sb.id, f.id, v)} />
                ))}
              </div>
            );
          })()}

          {/* コードプレビュー */}
          {showCode && (
            <div className="mc-panel" style={{ position: "absolute", bottom: 10, left: 8, right: 8, zIndex: 45, maxHeight: 240, background: "#ffffff", display: "flex", flexDirection: "column", border: "2px solid #cbd5e1", boxShadow: "0 8px 32px rgba(0,0,0,0.1)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", borderBottom: "2px solid #e2e8f0" }}>
                <span className="font-pixel text-[11px] text-[#0ea5e9] font-bold">⚡ GENERATED CODE</span>
                <button onClick={() => setShowCode(false)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 14, color: "#64748b" }}>✕</button>
              </div>
              <pre style={{ flex: 1, overflowY: "auto", margin: 0, padding: "10px 14px", fontSize: 10, color: "#0f766e", fontFamily: "monospace", lineHeight: 1.6, whiteSpace: "pre-wrap", wordBreak: "break-all", background: "#f8fafc" }}>
                {genCode}
              </pre>
            </div>
          )}

          {/* スナップインジケーター */}
          {snapHint && showSnapGuide && (
            <SnapIndicator x={snapHint.pos.x} y={snapHint.pos.y} zoom={zoom} slot={snapHint.slot}
              color={snapHint.slot === "inner" ? "#8b5cf6" : snapHint.slot === "then" ? "#10b981" : snapHint.slot === "else" ? "#f97316" : "#0ea5e9"} />
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

          {/* 右ペイン：コントロールパネル */}
          <div data-right-panel="1" style={{
            position: "absolute",
            top: 10,
            right: 10,
            bottom: 10,
            width: 170,
            background: "#bfeecf", // SPROUTグリーンをより強調した筐体風グリーン
            border: "4px solid #8bc79e", // おもちゃの太いグリーン枠
            borderRadius: 20,
            padding: "16px 12px",
            display: "none", // ⌨️ 下部キーボードへ統合したため非表示
            flexDirection: "column",
            justifyContent: "flex-start",
            alignItems: "center",
            gap: 16,
            boxShadow: "inset -2px -2px 6px rgba(0,0,0,0.1), 0 8px 20px rgba(0,0,0,0.15)",
            zIndex: 40,
          }}>
            {/* 🃏 手札トレイ：スポーンしたカードの置き場（白カードが映えるように明るいパステルカラーに更新） */}
            <div style={{
              width: "100%",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center", // 中揃えにして縦長カードを綺麗に配置
              gap: 12,
              minHeight: 120,
              overflowY: "auto",
              padding: "12px 6px",
              boxSizing: "border-box",
              background: "#bae6fd", // 暗くせず、白カードが映える明るいソーダブルーに変更！
              borderRadius: "16px",
              border: "3.5px solid #1e293b", // 黒いおもちゃフチでボタンと統一
              boxShadow: "inset 0 3px 8px rgba(2,132,199,0.18)", // 爽やかなインナーシャドウ
            }}>
              <div style={{
                fontSize: 10,
                fontWeight: 900,
                color: "#0369a1", // 看板と同色の濃いソーダブルー
                textAlign: "center",
                letterSpacing: "0.05em",
                marginBottom: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                width: "100%"
              }}>
                <span>🃏 手札トレイ</span>
                {tray.length > 0 && (
                  <span style={{
                    background: "#3b82f6",
                    color: "#fff",
                    padding: "1px 6px",
                    borderRadius: 999,
                    fontSize: 9
                  }}>{tray.length}</span>
                )}
              </div>

              {tray.length === 0 ? (
                // 空の時のカード枠プレースホルダー
                <div style={{
                  flex: 1,
                  width: "90%",
                  border: "2px dashed #0284c7", // 濃いソーダブルーの破線
                  borderRadius: 14,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 12,
                  color: "#0369a1", // 濃いソーダブルーの文字
                  gap: 6,
                  background: "rgba(255,255,255,0.4)"
                }}>
                  <span style={{ fontSize: 24 }}>✨</span>
                  <span style={{ fontSize: 9, fontWeight: 900, textAlign: "center", lineHeight: 1.3 }}>
                    SPAWNしたカードが<br />ここに並ぶよ
                  </span>
                </div>
              ) : (
                tray.map((it) => {
                  const c = CAT[it.tmpl.category];
                  const TIcon = (LucideIcons as any)[it.tmpl.emoji] || (LucideIcons as any)["HelpCircle"] || (LucideIcons as any)["CircleHelp"] || (() => null);
                  const cardIdx = CARD_INDEX[it.tmpl.category] || "●";
                  return (
                    <button
                      key={it.key}
                      onMouseDown={(e) => handleTrayDragStart(e, it)}
                      title="ドラッグしてキャンバスに置く"
                      className="btn-card"
                      style={{
                        width: 82,
                        height: 112,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        alignItems: "center",
                        borderRadius: "16px",
                        cursor: "pointer",
                        background: "#ffffff",
                        border: "3.5px solid #ffffff",
                        position: "relative",
                        overflow: "hidden",
                        padding: "0px",
                        boxSizing: "border-box",
                        // @ts-ignore
                        "--card-color": c?.bg ?? "#94a3b8",
                      }}
                    >
                      {/* インナーデザインフレーム */}
                      <div style={{
                        width: "100%",
                        height: "100%",
                        borderRadius: "12px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "16px 2px 6px",
                        boxSizing: "border-box",
                        position: "relative",
                        background: "radial-gradient(circle at center, #ffffff 60%, #fafafa 100%)",
                      }}>
                        {/* 左上のインデックス（タイプカラー背景のバッジ風） */}
                        <div style={{
                          position: "absolute",
                          left: 3, top: 3,
                          width: 18, height: 18,
                          borderRadius: "50%",
                          background: c?.bg ?? "#94a3b8",
                          border: "1.5px solid #ffffff",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#ffffff",
                          fontWeight: 900,
                          fontSize: 9.5,
                          boxShadow: "0 2px 5px rgba(0,0,0,0.15)",
                          zIndex: 10
                        }}>
                          {cardIdx}
                        </div>

                        {/* 右上の小さなタイプカラー点 */}
                        <div style={{
                          position: "absolute",
                          right: 5, top: 5,
                          width: 8, height: 8,
                          borderRadius: "50%",
                          background: c?.bg ?? "#94a3b8",
                          border: "1.5px solid #ffffff",
                          boxShadow: `0 1px 3px rgba(0,0,0,0.1)`,
                          zIndex: 10
                        }} />

                        {/* 中央の「白い丸枠」イラストフレーム */}
                        <div style={{
                          width: 46,
                          height: 46,
                          borderRadius: "50%",
                          background: "#ffffff",
                          border: `2.5px solid ${c?.bg ?? "#94a3b8"}`,
                          boxShadow: `0 4px 10px ${(c?.bg ?? "#94a3b8")}18, inset 0 1px 3px rgba(0,0,0,0.05)`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          marginTop: 8,
                        }}>
                          <TIcon size={22} color={c?.bg ?? "#64748b"} strokeWidth={2.2} />
                        </div>

                        {/* 下部ラベル */}
                        <span style={{
                          fontSize: it.tmpl.label.length > 7 ? 8.5 : 9.5,
                          fontWeight: 900,
                          color: "#1e293b",
                          textAlign: "center",
                          lineHeight: 1.25,
                          width: "92%",
                          wordBreak: "break-word",
                          display: "block",
                          zIndex: 2,
                          marginBottom: 2,
                          marginTop: "auto",
                        }}>
                          {it.tmpl.label}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* コントロールボタン群 (2列グリッド、ゲーム機風の丸ボタン) */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "12px 10px",
              width: "100%",
              justifyItems: "center",
              paddingTop: 12,
              borderTop: "2px solid #cbd5e1",
            }}>
              {/* 1. 戻る */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <button
                  onClick={undo}
                  title="元に戻す (Ctrl+Z)"
                  style={{
                    width: 44, height: 40, borderRadius: "9px",
                    background: "linear-gradient(135deg, #ffd1dc 0%, #ff9ebb 100%)", // いちごミルク
                    border: "3px solid #1e293b",
                    boxShadow: "0 5px 0 #e05a80, 0 4px 8px rgba(0,0,0,0.1), inset 0 3px 0 rgba(255,255,255,0.6)",
                    color: "#a31d44", fontSize: 18, fontWeight: 900, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", outline: "none",
                    transition: "all 0.08s ease", transform: "translateY(0)"
                  }}
                  onMouseDown={e => {
                    const btn = e.currentTarget;
                    btn.style.transform = "translateY(4px)";
                    btn.style.boxShadow = "0 1px 0 #e05a80, 0 1px 4px rgba(0,0,0,0.15), inset 0 1px 2px rgba(0,0,0,0.1)";
                  }}
                  onMouseUp={e => {
                    const btn = e.currentTarget;
                    btn.style.transform = "translateY(0)";
                    btn.style.boxShadow = "0 5px 0 #e05a80, 0 4px 8px rgba(0,0,0,0.1), inset 0 3px 0 rgba(255,255,255,0.6)";
                  }}
                  onMouseLeave={e => {
                    const btn = e.currentTarget;
                    btn.style.transform = "translateY(0)";
                    btn.style.boxShadow = "0 5px 0 #e05a80, 0 4px 8px rgba(0,0,0,0.1), inset 0 3px 0 rgba(255,255,255,0.6)";
                  }}
                >
                  ↩
                </button>
                <span style={{ fontSize: 10, fontWeight: 900, color: "#64748b" }}>戻る</span>
              </div>

              {/* 2. 進む */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <button
                  onClick={redo}
                  title="やり直す (Ctrl+Y)"
                  style={{
                    width: 44, height: 40, borderRadius: "9px",
                    background: "linear-gradient(135deg, #c3e0e5 0%, #8ecae6 100%)", // ラムネ
                    border: "3px solid #1e293b",
                    boxShadow: "0 5px 0 #219ebc, 0 4px 8px rgba(0,0,0,0.1), inset 0 3px 0 rgba(255,255,255,0.6)",
                    color: "#023047", fontSize: 18, fontWeight: 900, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", outline: "none",
                    transition: "all 0.08s ease", transform: "translateY(0)"
                  }}
                  onMouseDown={e => {
                    const btn = e.currentTarget;
                    btn.style.transform = "translateY(4px)";
                    btn.style.boxShadow = "0 1px 0 #219ebc, 0 1px 4px rgba(0,0,0,0.15), inset 0 1px 2px rgba(0,0,0,0.1)";
                  }}
                  onMouseUp={e => {
                    const btn = e.currentTarget;
                    btn.style.transform = "translateY(0)";
                    btn.style.boxShadow = "0 5px 0 #219ebc, 0 4px 8px rgba(0,0,0,0.1), inset 0 3px 0 rgba(255,255,255,0.6)";
                  }}
                  onMouseLeave={e => {
                    const btn = e.currentTarget;
                    btn.style.transform = "translateY(0)";
                    btn.style.boxShadow = "0 5px 0 #219ebc, 0 4px 8px rgba(0,0,0,0.1), inset 0 3px 0 rgba(255,255,255,0.6)";
                  }}
                >
                  ↪
                </button>
                <span style={{ fontSize: 10, fontWeight: 900, color: "#64748b" }}>進む</span>
              </div>

              {/* 3. ガイド線 */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <button
                  onClick={() => setShowSnapGuide(!showSnapGuide)}
                  title="スナップ時のガイド線の表示/非表示"
                  style={{
                    width: 44, height: 40, borderRadius: "9px",
                    background: showSnapGuide
                      ? "linear-gradient(135deg, #c7f9cc 0%, #80ed99 100%)" // メロン
                      : "linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 100%)", // オフホワイト
                    border: "3px solid #1e293b",
                    boxShadow: showSnapGuide
                      ? "0 5px 0 #38b000, 0 4px 8px rgba(0,0,0,0.1), inset 0 3px 0 rgba(255,255,255,0.6)"
                      : "0 5px 0 #94a3b8, 0 4px 8px rgba(0,0,0,0.1), inset 0 3px 0 rgba(255,255,255,0.6)",
                    color: showSnapGuide ? "#004b23" : "#64748b", fontSize: 20, fontWeight: 900, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", outline: "none",
                    transition: "all 0.08s ease", transform: "translateY(0)"
                  }}
                  onMouseDown={e => {
                    const btn = e.currentTarget;
                    const shadowColor = showSnapGuide ? "#38b000" : "#94a3b8";
                    btn.style.transform = "translateY(4px)";
                    btn.style.boxShadow = `0 1px 0 ${shadowColor}, 0 1px 4px rgba(0,0,0,0.15), inset 0 1px 2px rgba(0,0,0,0.1)`;
                  }}
                  onMouseUp={e => {
                    const btn = e.currentTarget;
                    const shadowColor = showSnapGuide ? "#38b000" : "#94a3b8";
                    btn.style.transform = "translateY(0)";
                    btn.style.boxShadow = `0 5px 0 ${shadowColor}, 0 4px 8px rgba(0,0,0,0.1), inset 0 3px 0 rgba(255,255,255,0.6)`;
                  }}
                  onMouseLeave={e => {
                    const btn = e.currentTarget;
                    const shadowColor = showSnapGuide ? "#38b000" : "#94a3b8";
                    btn.style.transform = "translateY(0)";
                    btn.style.boxShadow = `0 5px 0 ${shadowColor}, 0 4px 8px rgba(0,0,0,0.1), inset 0 3px 0 rgba(255,255,255,0.6)`;
                  }}
                >
                  🎯
                </button>
                <span style={{ fontSize: 10, fontWeight: 900, color: "#64748b" }}>ガイド線</span>
              </div>

              {/* 4. クリア */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <button
                  onClick={() => {
                    if (window.confirm("キャンバス上のすべてのブロックを消去しますか？")) {
                      setBlocks([]);
                      setSelected(null);
                      playDeleteSound();
                      showToast("すべてのブロックを消去しました", "warning");
                    }
                  }}
                  title="すべてのブロックを消去する"
                  style={{
                    width: 44, height: 40, borderRadius: "9px",
                    background: "linear-gradient(135deg, #ffe5d9 0%, #ffcad4 100%)", // ピーチ
                    border: "3px solid #1e293b",
                    boxShadow: "0 5px 0 #f08080, 0 4px 8px rgba(0,0,0,0.1), inset 0 3px 0 rgba(255,255,255,0.6)",
                    color: "#b23a48", fontSize: 18, fontWeight: 900, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", outline: "none",
                    transition: "all 0.08s ease", transform: "translateY(0)"
                  }}
                  onMouseDown={e => {
                    const btn = e.currentTarget;
                    btn.style.transform = "translateY(4px)";
                    btn.style.boxShadow = "0 1px 0 #f08080, 0 1px 4px rgba(0,0,0,0.15), inset 0 1px 2px rgba(0,0,0,0.1)";
                  }}
                  onMouseUp={e => {
                    const btn = e.currentTarget;
                    btn.style.transform = "translateY(0)";
                    btn.style.boxShadow = "0 5px 0 #f08080, 0 4px 8px rgba(0,0,0,0.1), inset 0 3px 0 rgba(255,255,255,0.6)";
                  }}
                  onMouseLeave={e => {
                    const btn = e.currentTarget;
                    btn.style.transform = "translateY(0)";
                    btn.style.boxShadow = "0 5px 0 #f08080, 0 4px 8px rgba(0,0,0,0.1), inset 0 3px 0 rgba(255,255,255,0.6)";
                  }}
                >
                  🗑️
                </button>
                <span style={{ fontSize: 10, fontWeight: 900, color: "#64748b" }}>クリア</span>
              </div>

              {/* 5. 保存/読込 */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <button
                  onClick={() => setShowProjects(v => !v)}
                  title="プロジェクトの保存・読み込み"
                  style={{
                    width: 44, height: 40, borderRadius: "9px",
                    background: showProjects
                      ? "linear-gradient(135deg, #e8dbfc 0%, #c3a6ff 100%)" // ラベンダー
                      : "linear-gradient(135deg, #f5f3ff 0%, #ddd6fe 100%)",
                    border: "3px solid #1e293b",
                    boxShadow: showProjects
                      ? "0 5px 0 #8a5cf5, 0 4px 8px rgba(0,0,0,0.1), inset 0 3px 0 rgba(255,255,255,0.6)"
                      : "0 5px 0 #a78bfa, 0 4px 8px rgba(0,0,0,0.1), inset 0 3px 0 rgba(255,255,255,0.6)",
                    color: "#491b9a", fontSize: 18, fontWeight: 900, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", outline: "none",
                    transition: "all 0.08s ease", transform: "translateY(0)"
                  }}
                  onMouseDown={e => {
                    const btn = e.currentTarget;
                    const shadowColor = showProjects ? "#8a5cf5" : "#a78bfa";
                    btn.style.transform = "translateY(4px)";
                    btn.style.boxShadow = `0 1px 0 ${shadowColor}, 0 1px 4px rgba(0,0,0,0.15), inset 0 1px 2px rgba(0,0,0,0.1)`;
                  }}
                  onMouseUp={e => {
                    const btn = e.currentTarget;
                    const shadowColor = showProjects ? "#8a5cf5" : "#a78bfa";
                    btn.style.transform = "translateY(0)";
                    btn.style.boxShadow = `0 5px 0 ${shadowColor}, 0 4px 8px rgba(0,0,0,0.1), inset 0 3px 0 rgba(255,255,255,0.6)`;
                  }}
                  onMouseLeave={e => {
                    const btn = e.currentTarget;
                    const shadowColor = showProjects ? "#8a5cf5" : "#a78bfa";
                    btn.style.transform = "translateY(0)";
                    btn.style.boxShadow = `0 5px 0 ${shadowColor}, 0 4px 8px rgba(0,0,0,0.1), inset 0 3px 0 rgba(255,255,255,0.6)`;
                  }}
                >
                  💾
                </button>
                <span style={{ fontSize: 10, fontWeight: 900, color: "#64748b" }}>保存/読込</span>
              </div>

              {/* 6. サンプル */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <button
                  onClick={() => setShowTemplates(v => !v)}
                  title="テンプレートギャラリー"
                  style={{
                    width: 44, height: 40, borderRadius: "9px",
                    background: showTemplates
                      ? "linear-gradient(135deg, #fef9c3 0%, #fde047 100%)" // レモン
                      : "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
                    border: "3px solid #1e293b",
                    boxShadow: showTemplates
                      ? "0 5px 0 #ca8a04, 0 4px 8px rgba(0,0,0,0.1), inset 0 3px 0 rgba(255,255,255,0.6)"
                      : "0 5px 0 #f59e0b, 0 4px 8px rgba(0,0,0,0.1), inset 0 3px 0 rgba(255,255,255,0.6)",
                    color: "#854d0e", fontSize: 18, fontWeight: 900, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", outline: "none",
                    transition: "all 0.08s ease", transform: "translateY(0)"
                  }}
                  onMouseDown={e => {
                    const btn = e.currentTarget;
                    const shadowColor = showTemplates ? "#ca8a04" : "#f59e0b";
                    btn.style.transform = "translateY(4px)";
                    btn.style.boxShadow = `0 1px 0 ${shadowColor}, 0 1px 4px rgba(0,0,0,0.15), inset 0 1px 2px rgba(0,0,0,0.1)`;
                  }}
                  onMouseUp={e => {
                    const btn = e.currentTarget;
                    const shadowColor = showTemplates ? "#ca8a04" : "#f59e0b";
                    btn.style.transform = "translateY(0)";
                    btn.style.boxShadow = `0 5px 0 ${shadowColor}, 0 4px 8px rgba(0,0,0,0.1), inset 0 3px 0 rgba(255,255,255,0.6)`;
                  }}
                  onMouseLeave={e => {
                    const btn = e.currentTarget;
                    const shadowColor = showTemplates ? "#ca8a04" : "#f59e0b";
                    btn.style.transform = "translateY(0)";
                    btn.style.boxShadow = `0 5px 0 ${shadowColor}, 0 4px 8px rgba(0,0,0,0.1), inset 0 3px 0 rgba(255,255,255,0.6)`;
                  }}
                >
                  🎮
                </button>
                <span style={{ fontSize: 10, fontWeight: 900, color: "#64748b" }}>サンプル</span>
              </div>

              {/* 7. コード */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <button
                  onClick={() => setShowCode(v => !v)}
                  title="生成コードを表示"
                  style={{
                    width: 44, height: 40, borderRadius: "9px",
                    background: showCode
                      ? "linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)" // チェリー
                      : "linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)",
                    border: "3px solid #1e293b",
                    boxShadow: showCode
                      ? "0 5px 0 #db2777, 0 4px 8px rgba(0,0,0,0.1), inset 0 3px 0 rgba(255,255,255,0.6)"
                      : "0 5px 0 #ec4899, 0 4px 8px rgba(0,0,0,0.1), inset 0 3px 0 rgba(255,255,255,0.6)",
                    color: "#9d174d", fontSize: 18, fontWeight: 900, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", outline: "none",
                    transition: "all 0.08s ease", transform: "translateY(0)"
                  }}
                  onMouseDown={e => {
                    const btn = e.currentTarget;
                    const shadowColor = showCode ? "#db2777" : "#ec4899";
                    btn.style.transform = "translateY(4px)";
                    btn.style.boxShadow = `0 1px 0 ${shadowColor}, 0 1px 4px rgba(0,0,0,0.15), inset 0 1px 2px rgba(0,0,0,0.1)`;
                  }}
                  onMouseUp={e => {
                    const btn = e.currentTarget;
                    const shadowColor = showCode ? "#db2777" : "#ec4899";
                    btn.style.transform = "translateY(0)";
                    btn.style.boxShadow = `0 5px 0 ${shadowColor}, 0 4px 8px rgba(0,0,0,0.1), inset 0 3px 0 rgba(255,255,255,0.6)`;
                  }}
                  onMouseLeave={e => {
                    const btn = e.currentTarget;
                    const shadowColor = showCode ? "#db2777" : "#ec4899";
                    btn.style.transform = "translateY(0)";
                    btn.style.boxShadow = `0 5px 0 ${shadowColor}, 0 4px 8px rgba(0,0,0,0.1), inset 0 3px 0 rgba(255,255,255,0.6)`;
                  }}
                >
                  💻
                </button>
                <span style={{ fontSize: 10, fontWeight: 900, color: "#64748b" }}>コード</span>
              </div>

              {/* 8. ヘルプ */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <button
                  onClick={() => setShowHelp(v => !v)}
                  title="操作ガイドを開く"
                  style={{
                    width: 44, height: 40, borderRadius: "9px",
                    background: showHelp
                      ? "linear-gradient(135deg, #e0f7fa 0%, #80deea 100%)" // ミント
                      : "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)",
                    border: "3px solid #1e293b",
                    boxShadow: showHelp
                      ? "0 5px 0 #00acc1, 0 4px 8px rgba(0,0,0,0.1), inset 0 3px 0 rgba(255,255,255,0.6)"
                      : "0 5px 0 #0284c7, 0 4px 8px rgba(0,0,0,0.1), inset 0 3px 0 rgba(255,255,255,0.6)",
                    color: "#006064", fontSize: 18, fontWeight: 900, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", outline: "none",
                    transition: "all 0.08s ease", transform: "translateY(0)"
                  }}
                  onMouseDown={e => {
                    const btn = e.currentTarget;
                    const shadowColor = showHelp ? "#00acc1" : "#0284c7";
                    btn.style.transform = "translateY(4px)";
                    btn.style.boxShadow = `0 1px 0 ${shadowColor}, 0 1px 4px rgba(0,0,0,0.15), inset 0 1px 2px rgba(0,0,0,0.1)`;
                  }}
                  onMouseUp={e => {
                    const btn = e.currentTarget;
                    const shadowColor = showHelp ? "#00acc1" : "#0284c7";
                    btn.style.transform = "translateY(0)";
                    btn.style.boxShadow = `0 5px 0 ${shadowColor}, 0 4px 8px rgba(0,0,0,0.1), inset 0 3px 0 rgba(255,255,255,0.6)`;
                  }}
                  onMouseLeave={e => {
                    const btn = e.currentTarget;
                    const shadowColor = showHelp ? "#00acc1" : "#0284c7";
                    btn.style.transform = "translateY(0)";
                    btn.style.boxShadow = `0 5px 0 ${shadowColor}, 0 4px 8px rgba(0,0,0,0.1), inset 0 3px 0 rgba(255,255,255,0.6)`;
                  }}
                >
                  ❓
                </button>
                <span style={{ fontSize: 10, fontWeight: 900, color: "#64748b" }}>作り方</span>
              </div>
            </div>

            {/* マイクラへ出力ボタン */}
            <button
              disabled={!isLogicValid}
              onClick={() => {
                playSuccessSound();
                const lines = (genCode || "// まず きっかけ ブロックを置いて繋げよう").split("\n");
                setReveal(lines);          // ← お祝い演出(実際のコードを見る瞬間)は必ず通す
                setExportArmed(true);      // ← このボタンを押して初めて設定画面の書き出しを解錠
              }}
              style={{
                width: "100%",
                height: 52,
                background: isLogicValid
                  ? "linear-gradient(135deg, #a7f3d0 0%, #10b981 100%)" // 爽やかなエメラルドグリーン
                  : "linear-gradient(135deg, #dcfce7 0%, #b6e7c9 100%)", // 待機中もやさしいミントグリーン
                border: "3px solid #1e293b",
                borderRadius: 24, // 可愛い完全角丸
                boxShadow: isLogicValid
                  ? "0 5px 0 #047857, 0 6px 12px rgba(16,185,129,0.15), inset 0 3px 0 rgba(255,255,255,0.6)"
                  : "0 4px 0 #a7d7bf, 0 2px 4px rgba(0,0,0,0.05), inset 0 2px 0 rgba(255,255,255,0.5)",
                color: isLogicValid ? "#064e3b" : "#5a9e80",
                fontWeight: 900,
                fontSize: 12,
                letterSpacing: "0.05em",
                cursor: isLogicValid ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textAlign: "center",
                lineHeight: 1.2,
                transition: "all 0.08s ease",
                transform: "translateY(0)"
              }}
              onMouseDown={e => {
                if (isLogicValid) {
                  const btn = e.currentTarget;
                  btn.style.transform = "translateY(4px)";
                  btn.style.boxShadow = "0 1px 0 #047857, 0 2px 4px rgba(0,0,0,0.15), inset 0 1px 2px rgba(0,0,0,0.1)";
                }
              }}
              onMouseUp={e => {
                if (isLogicValid) {
                  const btn = e.currentTarget;
                  btn.style.transform = "translateY(0)";
                  btn.style.boxShadow = "0 5px 0 #047857, 0 6px 12px rgba(16,185,129,0.15), inset 0 3px 0 rgba(255,255,255,0.6)";
                }
              }}
              onMouseLeave={e => {
                if (isLogicValid) {
                  const btn = e.currentTarget;
                  btn.style.transform = "translateY(0)";
                  btn.style.boxShadow = "0 5px 0 #047857, 0 6px 12px rgba(16,185,129,0.15), inset 0 3px 0 rgba(255,255,255,0.6)";
                }
              }}
            >
              <span>アドオン<br />完成！🎉</span>
            </button>
          </div>
        </div>
      </div>
    );
}
