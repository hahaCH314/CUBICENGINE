"use client";

import { useState, useRef, useCallback, useEffect, useMemo, type ComponentType } from "react";
import { GrapeIcons, type IconProps } from "./grapeIcons";
import { grapeToCBlock } from "../../lib/grapeToCBlock";
import { exportProject } from "./exporter";
import { useEditorStore } from "./store";
import { buildGroveStructure, type GroveSlot } from "../../lib/groveTree";

/* ──────────────────────────────────────────────────────────────
   GrapePanel — 🌿 GROVE（JAVA / 自然×メタバース）/ 構造は「ハブ」
   - きっかけ＝ハブの中心。すること等が放射状に実る。
   - タップした場所に候補がブワッと開く(ラジアル)→選ぶ→実がぷるん生成（カーソル移動を最小化）。
   - テキストが要る実は、その場に出る入力でinline編集。下バー/鍵盤は廃止。
   - 色は今のカテゴリ識別色を流用。LogicPanel(積み木/SPROUT)は無傷。
   ────────────────────────────────────────────────────────────── */

type Cat = "trigger" | "action" | "ifelse" | "value" | "loop";

const CAT_STYLE: Record<Cat, { label: string; color: string; glow: string }> = {
  trigger: { label: "トリガー",   color: "#d45d79", glow: "#ff8fa9" }, // 深みのあるローズルビー
  action:  { label: "アクション", color: "#3a86c8", glow: "#74b3e8" }, // 深みのあるサファイアブルー
  ifelse:  { label: "条件分岐",   color: "#229c8e", glow: "#58dbcd" }, // 深みのあるエメラルドティール
  value:   { label: "値",         color: "#d9a13c", glow: "#ffd075" }, // 深みのあるアンバーゴールド
  loop:    { label: "ループ",     color: "#c67b32", glow: "#ffb470" }, // 深みのある琥珀トパーズ
};
const CAT_ORDER: Cat[] = ["trigger", "action", "ifelse", "value", "loop"];

interface ItemDef { type: string; label: string; emoji: string; cat: Cat; needsText: boolean; placeholder: string; }

const ITEMS: ItemDef[] = [
  { type: "on_join",  label: "プレイヤー参加", emoji: "👋", cat: "trigger", needsText: false, placeholder: "" },
  { type: "on_break", label: "ブロック破壊",   emoji: "⛏️", cat: "trigger", needsText: false, placeholder: "" },
  { type: "on_chat",  label: "チャット受信",   emoji: "💬", cat: "trigger", needsText: true,  placeholder: "合言葉" },
  { type: "on_use",   label: "アイテム使用",   emoji: "🔮", cat: "trigger", needsText: true, placeholder: "diamond" },
  { type: "on_hurt",  label: "被ダメージ",     emoji: "💥", cat: "trigger", needsText: false, placeholder: "" },
  { type: "on_tick",  label: "毎ティック",     emoji: "⏰", cat: "trigger", needsText: false, placeholder: "" },
  { type: "say",      label: "メッセージ送信", emoji: "📢", cat: "action",  needsText: true,  placeholder: "こんにちは！" },
  { type: "give",     label: "アイテム付与",   emoji: "🎁", cat: "action",  needsText: true,  placeholder: "diamond ×1" },
  { type: "effect",   label: "エフェクト付与", emoji: "✨", cat: "action",  needsText: false, placeholder: "" },
  { type: "tp",       label: "テレポート",     emoji: "🌀", cat: "action",  needsText: true,  placeholder: "0 64 0" },
  { type: "title",    label: "タイトル表示",   emoji: "🎬", cat: "action", needsText: true,  placeholder: "クリア！" },
  { type: "sound",    label: "サウンド再生",   emoji: "🔊", cat: "action",  needsText: true,  placeholder: "random.levelup" },
  { type: "command",  label: "コマンド実行",   emoji: "⌨️", cat: "action",  needsText: true,  placeholder: "time set day" },
  { type: "if",       label: "条件分岐",       emoji: "🔀", cat: "ifelse",  needsText: true,  placeholder: "夜のとき" },
  { type: "repeat",   label: "繰り返し",       emoji: "🔄", cat: "loop",    needsText: true,  placeholder: "3 回" },
  { type: "number",   label: "数値",           emoji: "💎", cat: "value",   needsText: true,  placeholder: "10" },
];

// 漂う発光の粒（両脇に多め＝遊び場の息づかい）
const MOTES: { x: string; y: string; s: number; c: string; d: number; delay: number }[] = [
  { x: "6%",  y: "30%", s: 4,   c: "#5ae3f0", d: 7,  delay: 0 },
  { x: "10%", y: "62%", s: 3,   c: "#aef7fc", d: 9,  delay: 1 },
  { x: "4%",  y: "78%", s: 5,   c: "#38b9e0", d: 8,  delay: 2 },
  { x: "14%", y: "45%", s: 2.5, c: "#cff8fb", d: 11, delay: 0.5 },
  { x: "20%", y: "15%", s: 2.5, c: "#7cd7f5", d: 11, delay: 2 },
  { x: "90%", y: "35%", s: 4,   c: "#5ae3f0", d: 8,  delay: 1.5 },
  { x: "94%", y: "60%", s: 3,   c: "#aef7fc", d: 10, delay: 0 },
  { x: "88%", y: "75%", s: 5,   c: "#38b9e0", d: 9,  delay: 2.5 },
  { x: "84%", y: "50%", s: 2.5, c: "#cff8fb", d: 12, delay: 1 },
  { x: "78%", y: "18%", s: 2.5, c: "#7cd7f5", d: 12, delay: 1.2 },
  { x: "30%", y: "85%", s: 3,   c: "#aef7fc", d: 10, delay: 0.8 },
  { x: "65%", y: "82%", s: 3.5, c: "#5ae3f0", d: 9,  delay: 1.8 },
  { x: "48%", y: "20%", s: 2,   c: "#cff8fb", d: 13, delay: 0.3 },
  { x: "50%", y: "70%", s: 2,   c: "#aef7fc", d: 14, delay: 0.6 },
];

// アイテム種別 → 単色SVGアイコン（ヒマワリ作 grapeIcons・currentColorで色は親に追従）
const ICON_MAP: Record<string, ComponentType<IconProps>> = {
  on_join: GrapeIcons.Join, on_break: GrapeIcons.Break, on_chat: GrapeIcons.Chat,
  on_use: GrapeIcons.Item, on_hurt: GrapeIcons.Hurt, on_tick: GrapeIcons.Tick,
  say: GrapeIcons.Message, give: GrapeIcons.Item, effect: GrapeIcons.Effect,
  tp: GrapeIcons.Teleport, title: GrapeIcons.Title, sound: GrapeIcons.Sound, command: GrapeIcons.Command,
  if: GrapeIcons.If, repeat: GrapeIcons.Loop, number: GrapeIcons.Number,
};
function ItemGlyph({ type, size }: { type: string; size: number }) {
  const Ic = ICON_MAP[type];
  return Ic ? <Ic size={size} style={{ display: "block", flexShrink: 0 }} /> : null;
}


interface Fruit { id: string; item: ItemDef; text: string; born: number; x: number; y: number; parentId?: string | null; slot?: GroveSlot | null; }
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
  const [launchPhase, setLaunchPhase] = useState<null | "gather" | "coalesce" | "launch">(null);
  
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [zoom, setZoom] = useState(1.0);
  
  // 💫 生命の樹ドラッグ状態
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasSnapped = useRef(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 🌟 ドッキングホバープレビュー情報
  const [dockPreview, setDockPreview] = useState<{ parentId: string; slot: GroveSlot } | null>(null);

  // 🌟 物理表示座標の解決（再帰的に親の座標を辿って計算）
  const getDisplayCoords = useCallback((f: Fruit, visited = new Set<string>()): { x: number; y: number } => {
    if (visited.has(f.id)) return { x: f.x, y: f.y };
    visited.add(f.id);

    // ドラッグ中なら、物理的にドラッグしている座標そのもの
    if (f.id === draggingId) {
      return { x: f.x, y: f.y };
    }

    if (f.parentId) {
      const parent = fruits.find(p => p.id === f.parentId);
      if (parent) {
        // eslint-disable-next-line react-hooks/immutability -- 親座標を辿る意図的な自己再帰（実行時は宣言済みで安全）
        const parentCoords = getDisplayCoords(parent, visited);
        
        // 穴の中に配置：親の全子を実行順(cond→then→else→body / 各born順)で縦に積み、中央寄せ。
        // 増えたら穴の下へあふれる（ハイブリッド）。then/else の区別はオーブの枠色で示す。
        const SLOT_ORDER: (GroveSlot | null | undefined)[] = ["cond", "then", "else", "body"];
        const allChildren = fruits
          .filter(x => x.parentId === f.parentId)
          .sort((a, b) => {
            const sa = SLOT_ORDER.indexOf(a.slot);
            const sb = SLOT_ORDER.indexOf(b.slot);
            if (sa !== sb) return sa - sb;
            return a.born - b.born;
          });
        const gIdx = Math.max(0, allChildren.findIndex(x => x.id === f.id));
        const STEP = 36;
        return {
          x: parentCoords.x,
          y: parentCoords.y + (gIdx - (allChildren.length - 1) / 2) * STEP,
        };
      }
    }

    return { x: f.x, y: f.y };
  }, [fruits, draggingId]);

  useEffect(() => {
    if (!stageRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setStageSize({
          width: entry.contentRect.width || 800,
          height: entry.contentRect.height || 600,
        });
      }
    });
    resizeObserver.observe(stageRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // 🖱️ マウスホイールでズーム（カーソルで拡大縮小）。stage は overflow:auto のため
  //    既定スクロールを止めてズームに割り当てる（passive:false が必須）。範囲は +/- ボタンと同じ 0.5〜1.5。
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const step = e.deltaY * -0.0015; // 上スクロール=拡大 / 下=縮小
      setZoom((z) => Math.min(1.5, Math.max(0.5, Math.round((z + step) * 100) / 100)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const coords = (e: React.MouseEvent) => {
    const r = stageRef.current?.getBoundingClientRect();
    const scrollLeft = stageRef.current?.scrollLeft ?? 0;
    const scrollTop = stageRef.current?.scrollTop ?? 0;
    return {
      x: (e.clientX - (r?.left ?? 0) + scrollLeft) / zoom,
      y: (e.clientY - (r?.top ?? 0) + scrollTop) / zoom,
    };
  };

  const openPick = useCallback((e: React.MouseEvent) => {
    if (sending || draggingId) return;
    if (fruits.length === 0) return;
    setSpawn({ ...coords(e), phase: "pick" });
  }, [sending, draggingId, fruits.length, zoom]);

  const displayFruits = fruits;

  const handleDragStart = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sending) return;
    const fr = fruits.find(f => f.id === id);
    if (!fr) return;

    setDraggingId(id);
    setSelectedId(id);
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragOffset({ x: fr.x, y: fr.y });
    hasSnapped.current = false;
  }, [fruits, sending]);

  const handleStageMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingId || sending) return;
    const dx = (e.clientX - dragStart.x) / zoom;
    const dyMouse = (e.clientY - dragStart.y) / zoom;

    let newX = dragOffset.x + dx;
    const newY = dragOffset.y + dyMouse;

    // スナップ吸着ロジック（他のブロックのX座標と20px以内なら吸着）
    let snapX = newX;
    let minDiff = 20;
    fruits.forEach(f => {
      if (f.id !== draggingId) {
        const otherCoords = getDisplayCoords(f);
        const diff = Math.abs(otherCoords.x - newX);
        if (diff < minDiff) {
          minDiff = diff;
          snapX = otherCoords.x;
        }
      }
    });
    newX = snapX;

    const draggingFruit = fruits.find(f => f.id === draggingId);
    const isDraggingValue = draggingFruit?.item.cat === "value";

    // 🌟 ドッキング判定（ドラッグ中ノードが最も近いドーナツの吸引圏内にあるか）
    let activeParentId: string | null = null;
    let activeSlot: GroveSlot | null = null;
    let minDockDistance = 90; // 半径90pxの吸引圏（ドーナツでかサイズ対応）

    fruits.forEach(other => {
      if (other.id === draggingId) return;
      const isOtherDonut = other.item.cat === "ifelse" || other.item.cat === "loop";
      if (!isOtherDonut) return;

      // 循環チェック: otherがdraggingIdの子孫である場合はドッキングを避ける
      let p: Fruit | undefined = other;
      let isDescendant = false;
      while (p) {
        if (p.parentId === draggingId) {
          isDescendant = true;
          break;
        }
        p = fruits.find(x => x.id === p?.parentId);
      }
      if (isDescendant) return;

      const otherCoords = getDisplayCoords(other);
      const distDx = newX - otherCoords.x;
      const distDy = newY - otherCoords.y;
      const dist = Math.sqrt(distDx * distDx + distDy * distDy);

      if (dist < minDockDistance) {
        minDockDistance = dist;
        activeParentId = other.id;
        if (other.item.cat === "ifelse") {
          // 条件ブロック（value）かつ中心の穴（28px以内）なら cond スロット
          if (isDraggingValue && dist < 28) {
            activeSlot = "cond";
          } else {
            activeSlot = newX < otherCoords.x ? "then" : "else";
          }
        } else {
          activeSlot = "body";
        }
      }
    });

    if (activeParentId && activeSlot) {
      setDockPreview({ parentId: activeParentId, slot: activeSlot });
    } else {
      setDockPreview(null);
    }

    setFruits(prev => {
      const updated = prev.map(f => f.id === draggingId ? { ...f, x: newX, y: newY } : f);
      
      const trigger = updated.find(f => f.item.cat === "trigger");
      const actions = updated.filter(f => f.item.cat !== "trigger").sort((a, b) => a.y - b.y);
      
      const now = Date.now();
      const reorderedActions = actions.map((a, idx) => ({
        ...a,
        born: now + idx
      }));

      return trigger ? [trigger, ...reorderedActions] : reorderedActions;
    });
  }, [draggingId, dragStart, dragOffset, fruits, sending, zoom, getDisplayCoords]);

  // マウスを離した瞬間
  const handleStageMouseUp = useCallback(() => {
    if (!draggingId) return;

    // ドッキング確定処理
    setFruits(prev => prev.map(f => {
      if (f.id === draggingId) {
        if (dockPreview) {
          return { ...f, parentId: dockPreview.parentId, slot: dockPreview.slot };
        } else {
          // 吸引圏外なら親を完全にクリア
          return { ...f, parentId: null, slot: null };
        }
      }
      return f;
    }));

    playPop();
    setDraggingId(null);
    setDockPreview(null);
  }, [draggingId, dockPreview]);

  // 植えた場所に実が生る
  const doGenerate = (item: ItemDef, text: string) => {
    const id = `g${_gid++}`;
    const targetX = spawn ? spawn.x : stageSize.width / 2;
    const targetY = spawn ? spawn.y : stageSize.height / 2;
    
    setFruits((f) => {
      const newFruit = { 
        id, 
        item, 
        text, 
        born: Date.now(), 
        x: targetX, 
        y: targetY 
      };
      
      const updated = [...f, newFruit];
      const trigger = updated.find(x => x.item.cat === "trigger");
      const actions = updated.filter(x => x.item.cat !== "trigger").sort((a, b) => a.y - b.y);
      
      const now = Date.now();
      const reorderedActions = actions.map((a, idx) => ({
        ...a,
        born: now + idx
      }));
      
      return trigger ? [trigger, ...reorderedActions] : reorderedActions;
    });
    setSelectedId(id);
    playPop();
  };

  const pickItem = (item: ItemDef) => {
    if (!spawn) return;
    if (item.needsText) {
      setDraft("");
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

  // 放つ → あなたが書いた事になるコードが生まれる（魂＝創造のロマン）
  const sendToMc = useCallback(async () => {
    const h = fruits.find((x) => x.item.cat === "trigger") || null;
    if (!h) return;
    const sp = fruits.filter((x) => x !== h);

    // CBlock[] への変換
    const blocks = grapeToCBlock(fruits);
    
    // ストアに登録し、プラットフォームを Java に固定
    const store = useEditorStore.getState();
    store.setLogicGraphJson(JSON.stringify({ blocks }));
    store.setTargetPlatform("java");

    setSending(true);
    setLaunchPhase("gather");
    playSend(); // 集結開始音

    // 1. 集結アニメーション (800ms)
    await new Promise((r) => setTimeout(r, 800));
    setLaunchPhase("coalesce");
    playChargeSound(); // 結晶・チャージ音

    // 2. 結晶（チャージ）アニメーション (1000ms)
    await new Promise((r) => setTimeout(r, 1000));
    setLaunchPhase("launch");
    playReleaseSound(); // 放出音

    // 3. 放出アニメーション中のタイミングで実際のダウンロードを実行
    try {
      await exportProject(store, "");
    } catch (err) {
      console.error("Failed to export project:", err);
    }

    // 4. 放出アニメーション完了 (800ms) の後、コード表示演出へ移行
    await new Promise((r) => setTimeout(r, 800));
    setShown(0);
    setReveal(fruitsToCode(h, sp));
    setLaunchPhase(null);
    setSending(false);
  }, [fruits]);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      {/* 舞台（全面＝没入背景：アバター/パンドラの夜の森／タップで種をまく） */}
      <div
        ref={stageRef}
        onClick={openPick}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onMouseLeave={handleStageMouseUp}
        style={{
          position: "absolute",
          inset: 0,
          overflow: "auto",
          background: "radial-gradient(120% 95% at 50% 2%, #0a2530 0%, #05141b 42%, #02090d 100%)",
          cursor: sending ? "default" : draggingId ? "grabbing" : "crosshair",
        }}
      >
        {/* 上からの光芒（god rays） */}
        <div style={{ position: "absolute", top: "-12%", left: "50%", transform: "translateX(-50%)", width: "62%", height: "95%", pointerEvents: "none", filter: "blur(7px)", opacity: 0.8,
          background: "conic-gradient(from 178deg at 50% 0%, transparent 0deg, rgba(0,210,255,0.08) 10deg, transparent 20deg, rgba(0,210,255,0.06) 30deg, transparent 40deg, rgba(0,210,255,0.07) 50deg, transparent 60deg)" }} />
        {/* 両脇のバイオ発光（＝遊び場） */}
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "24%", pointerEvents: "none", background: "radial-gradient(58% 48% at 0% 58%, rgba(0,180,230,0.22), transparent 72%)" }} />
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "24%", pointerEvents: "none", background: "radial-gradient(58% 48% at 100% 46%, rgba(0,140,200,0.20), transparent 72%)" }} />
        {/* 底のもや */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "32%", pointerEvents: "none", background: "linear-gradient(to top, rgba(0,150,210,0.24), transparent)", filter: "blur(12px)" }} />
        {/* 漂う発光の粒（丸くボケ足のある美しい光の粒） */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
          {MOTES.map((m, i) => (
            <div key={i} style={{ position: "absolute", left: m.x, top: m.y, pointerEvents: "none" }}>
              {/* 外側の霧散ハロー（大きく柔らかく） */}
              <div style={{
                position: "absolute",
                width: m.s * 8 + 10,
                height: m.s * 8 + 10,
                borderRadius: "50%",
                top: "50%", left: "50%",
                transform: "translate(-50%, -50%)",
                background: `radial-gradient(circle, ${m.c}50 0%, ${m.c}18 45%, transparent 72%)`,
                filter: `blur(${m.s * 1.8 + 2}px)`,
                animation: `float-particle ${m.d}s ease-in-out ${m.delay}s infinite`,
              }} />
              {/* 内側の輝くコア */}
              <div style={{
                position: "absolute",
                width: m.s * 2 + 2,
                height: m.s * 2 + 2,
                borderRadius: "50%",
                top: "50%", left: "50%",
                transform: "translate(-50%, -50%)",
                background: `radial-gradient(circle, rgba(255,255,255,0.95) 0%, ${m.c} 35%, ${m.c}60 65%, transparent 85%)`,
                filter: `blur(${m.s * 0.3 + 0.3}px)`,
                boxShadow: `0 0 ${m.s * 4}px ${m.s}px ${m.c}60`,
                animation: `float-particle ${m.d}s ease-in-out ${m.delay}s infinite`,
              }} />
            </div>
          ))}
        </div>
        {/* 周辺ビネット（中央へ集中させる） */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", boxShadow: "inset 0 0 200px rgba(0,0,0,0.72)" }} />

        {/* タイトル＝GROVE */}
        <div style={{ position: "absolute", top: 16, left: 20, zIndex: 2, fontWeight: 900, fontSize: 15, color: "#a8eeff", letterSpacing: "0.18em", display: "flex", alignItems: "center", gap: 8, textShadow: "0 1px 6px rgba(0,180,255,0.5)", pointerEvents: "none" }}>
          <span style={{ fontSize: 18 }}>🌿</span> GROVE <span style={{ fontSize: 10, fontWeight: 800, opacity: 0.7, letterSpacing: "0.1em" }}>JAVA</span>
        </div>

        {/* 🔍 ズームコントローラー */}
        <div style={{
          position: "absolute", top: 16, right: 20, zIndex: 10,
          display: "flex", alignItems: "center", gap: 6,
          background: "rgba(5, 25, 50, 0.75)", backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          padding: "4px 8px", borderRadius: 10, border: "1px solid rgba(0, 200, 255, 0.3)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)"
        }}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setZoom(z => Math.max(0.5, z - 0.25)); }}
            style={{ border: "none", background: "none", color: "#5ae3f0", cursor: "pointer", fontSize: 13, fontWeight: 900, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", outline: "none" }}
          >
            ー
          </button>
          <span
            onClick={(e) => { e.stopPropagation(); setZoom(1.0); }}
            style={{ color: "#fff", fontSize: 10, fontWeight: 900, minWidth: 38, textAlign: "center", cursor: "pointer", userSelect: "none", fontFamily: "monospace" }}
          >
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setZoom(z => Math.min(1.5, z + 0.25)); }}
            style={{ border: "none", background: "none", color: "#5ae3f0", cursor: "pointer", fontSize: 13, fontWeight: 900, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", outline: "none" }}
          >
            ＋
          </button>
          <div style={{ width: 1, height: 16, background: "rgba(0,200,255,0.22)", margin: "0 2px" }} />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setZoom(1.0); stageRef.current?.scrollTo({ left: 0, top: 0 }); }}
            title="表示を元に戻す（100%・中央）"
            style={{ border: "none", background: "none", color: "#5ae3f0", cursor: "pointer", fontSize: 15, fontWeight: 900, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", outline: "none" }}
          >
            ⟲
          </button>
        </div>

        {/* 🌟 ズーム対象のコンテンツラッパー */}
        <div style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${zoom})`,
          transformOrigin: "0 0",
          pointerEvents: "none",
          width: `${100 / zoom}%`,
          height: `${100 / zoom}%`,
        }}>
          {/* ⚡ 光のエネルギーライン (直角折れ線/レッドストーン回路風) */}
          {(() => {
            const trigger = displayFruits.find(f => f.item.cat === "trigger");
            if (!trigger) return null;

            const groveStructure = buildGroveStructure(displayFruits);

            interface RenderPath {
              fromX: number;
              fromY: number;
              toX: number;
              toY: number;
              color: string;
              glow: string;
              fromRadius: number;
              toRadius: number;
            }
            const paths: RenderPath[] = [];

            const getRadius = (cat: string) => {
              if (cat === "trigger") return 46;
              if (cat === "ifelse" || cat === "loop") return 70;
              return 41;
            };

            // 1. 幹（roots）の接続
            // triggerを先頭にした上で物理表示座標のy順でソート
            const sortedRoots = [...groveStructure.roots].sort((a, b) => {
              if (a.item.cat === "trigger") return -1;
              if (b.item.cat === "trigger") return 1;
              return getDisplayCoords(a).y - getDisplayCoords(b).y;
            });

            for (let i = 0; i < sortedRoots.length - 1; i++) {
              const fromNode = sortedRoots[i];
              const toNode = sortedRoots[i + 1];
              const fromC = getDisplayCoords(fromNode);
              const toC = getDisplayCoords(toNode);
              paths.push({
                fromX: fromC.x,
                fromY: fromC.y,
                toX: toC.x,
                toY: toC.y,
                color: CAT_STYLE[toNode.item.cat].color,
                glow: CAT_STYLE[toNode.item.cat].glow,
                fromRadius: getRadius(fromNode.item.cat),
                toRadius: getRadius(toNode.item.cat)
              });
            }

            // 2. 枝（childrenOf）の接続
            displayFruits.forEach(parent => {
              const isDonut = parent.item.cat === "ifelse" || parent.item.cat === "loop";
              if (!isDonut) return;

              const slots: GroveSlot[] = parent.item.cat === "ifelse" ? ["then", "else"] : ["body"];
              
              slots.forEach(slot => {
                const children = groveStructure.childrenOf(parent.id, slot);
                if (children.length === 0) return;

                const sortedChildren = [...children].sort((a, b) => getDisplayCoords(a).y - getDisplayCoords(b).y);
                const parentC = getDisplayCoords(parent);

                // 親ドーナツから最初の子ノードへ接続
                const firstChild = sortedChildren[0];
                const firstChildC = getDisplayCoords(firstChild);
                paths.push({
                  fromX: parentC.x,
                  fromY: parentC.y,
                  toX: firstChildC.x,
                  toY: firstChildC.y,
                  color: CAT_STYLE[firstChild.item.cat].color,
                  glow: CAT_STYLE[firstChild.item.cat].glow,
                  fromRadius: getRadius(parent.item.cat),
                  toRadius: getRadius(firstChild.item.cat)
                });

                // 子ノード同士を直列に接続
                for (let i = 0; i < sortedChildren.length - 1; i++) {
                  const fromNode = sortedChildren[i];
                  const toNode = sortedChildren[i + 1];
                  const fromC = getDisplayCoords(fromNode);
                  const toC = getDisplayCoords(toNode);
                  paths.push({
                    fromX: fromC.x,
                    fromY: fromC.y,
                    toX: toC.x,
                    toY: toC.y,
                    color: CAT_STYLE[toNode.item.cat].color,
                    glow: CAT_STYLE[toNode.item.cat].glow,
                    fromRadius: getRadius(fromNode.item.cat),
                    toRadius: getRadius(toNode.item.cat)
                  });
                }
              });
            });

            return (
              <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 1 }}>
                {paths.map((p, idx) => {
                  const startY = p.fromY + p.fromRadius; // 接続元の底面
                  const endY = p.toY - p.toRadius;     // 接続先の天面
                  const pathD = `M ${p.fromX} ${startY} L ${p.toX} ${endY}`;

                  return (
                    <g key={idx}>
                      {/* 背景のにじむライン */}
                      <path d={pathD} fill="none" stroke={p.color} strokeWidth={3} opacity={0.25} strokeLinecap="round" />
                      {/* コアの明るいライン */}
                      <path d={pathD} fill="none" stroke={p.glow} strokeWidth={1.5} opacity={0.6} strokeLinecap="round" />
                      {/* かすかに呼吸するように明滅する光の糸 */}
                      <path
                        d={pathD}
                        fill="none"
                        stroke={p.glow}
                        strokeWidth={1.5}
                        strokeLinecap="round"
                        style={{
                          animation: "connection-glow 4s ease-in-out infinite",
                          filter: `drop-shadow(0 0 4px ${p.glow})`,
                          opacity: launchPhase === "coalesce" ? 0.95 : launchPhase === "launch" ? 0 : 0.65,
                          transition: "opacity 0.2s ease",
                        }}
                      />
                    </g>
                  );
                })}
              </svg>
            );
          })()}

          {/* 空状態：シンプルな案内 */}
          {fruits.length === 0 && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 10 }}>
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  if (sending || draggingId) return;
                  setSpawn({ ...coords(e), phase: "pick" });
                }}
                style={{
                  padding: "20px 36px",
                  borderRadius: 30,
                  border: "3px dashed #00c8ff",
                  color: "#c0eeff",
                  fontWeight: 900,
                  fontSize: 18,
                  letterSpacing: "0.2em",
                  textAlign: "center",
                  background: "rgba(5, 25, 55, 0.65)",
                  backdropFilter: "blur(4px)",
                  boxShadow: "0 8px 32px rgba(0, 30, 80, 0.5), inset 0 0 12px rgba(0, 200, 255, 0.12)",
                  animation: "tap-breathe 2.4s ease-in-out infinite",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  pointerEvents: "auto",
                  cursor: "pointer"
                }}
              >
                <span style={{ fontSize: 36, filter: "drop-shadow(0 4px 8px rgba(0,200,255,0.5))" }}>🌱</span>
                <span style={{ fontSize: 14, color: "#5ae3f0", opacity: 0.9 }}>TAP HERE TO PLANT</span>
              </div>
            </div>
          )}

          {/* 植えた場所で輝く：神秘的な光の集まり */}
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}>
            {displayFruits.map((fr) => {
              const isHub = fr.item.cat === "trigger";
              const displayCoords = getDisplayCoords(fr);
              const isDockedChild = !!fr.parentId && fr.id !== draggingId;

              const getTransformStyle = () => {
                let base = "translate(-50%, -50%)";
                if (isDockedChild) {
                  base += " scale(0.65)";
                }
                return base;
              };

              const getLaunchStyle = () => {
                if (!launchPhase) return {};
                const hub = displayFruits.find((x) => x.item.cat === "trigger");
                if (!hub) return {};

                if (launchPhase === "gather") {
                  const hubCoords = getDisplayCoords(hub);
                  const dx = hubCoords.x - displayCoords.x;
                  const dy = hubCoords.y - displayCoords.y;
                  return {
                    transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.2)`,
                    opacity: 0.1,
                    filter: "blur(4px)",
                    transition: "transform 0.8s cubic-bezier(0.6, -0.28, 0.735, 0.045), opacity 0.8s ease, filter 0.8s ease",
                  };
                }
                if (launchPhase === "coalesce" || launchPhase === "launch") {
                  return { opacity: 0, transition: "opacity 0.2s" };
                }
                return {};
              };

              return (
                <div
                  key={fr.id}
                  style={{
                    position: "absolute",
                    left: displayCoords.x,
                    top: displayCoords.y,
                    transform: getTransformStyle(),
                    zIndex: fr.id === draggingId ? 50 : (isDockedChild ? 3 : (isHub ? 4 : 2)),
                    pointerEvents: launchPhase ? "none" : "auto",
                    ...getLaunchStyle(),
                  }}
                >
                  <Grape
                    fr={fr}
                    selected={fr.id === selectedId}
                    isHub={isHub}
                    onSelect={openEdit}
                    onDelete={() => removeFruit(fr.id)}
                    onMouseDown={handleDragStart}
                    dockSlot={dockPreview?.parentId === fr.id ? dockPreview.slot : null}
                  />
                </div>
              );
            })}
          </div>

          {/* 🔮 クライマックス放出エフェクト（中央に集まって融合➔発射） */}
          {(() => {
            const hub = fruits.find((x) => x.item.cat === "trigger");
            if (!hub || !launchPhase) return null;
            const hubCoords = getDisplayCoords(hub);
            return (
              <div style={{
                position: "absolute",
                left: hubCoords.x,
                top: hubCoords.y,
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
                zIndex: 100,
              }}>
                {launchPhase === "coalesce" && (
                  /* うねる光の塊（結晶） */
                  <div style={{
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    background: "radial-gradient(circle, #fff 10%, #aef7df 40%, #2bcbba 80%, transparent 100%)",
                    boxShadow: "0 0 60px 10px #2bcbba, 0 0 120px 20px #2bcbba80, inset 0 0 25px #fff",
                    animation: "plasma-surge 1s ease-in-out infinite alternate, spin-orbit 3s linear infinite",
                    filter: "blur(1px)",
                  }}>
                    {/* 吸い込まれるチャージリング */}
                    <div style={{ position: "absolute", inset: -50, border: "2.5px dashed rgba(174,247,223,0.4)", borderRadius: "50%", animation: "charge-ring 1s linear infinite" }} />
                  </div>
                )}
                {launchPhase === "launch" && (
                  /* 放出 (launch) */
                  <div style={{
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    background: "#fff",
                    boxShadow: "0 0 90px 25px #fff, 0 0 180px 45px #aef7df",
                    animation: "plasma-launch 0.8s cubic-bezier(0.19, 1, 0.22, 1) forwards",
                  }} />
                )}
              </div>
            );
          })()}
        </div>

        {/* 閃光（フラッシュ）画面全体 */}
        {launchPhase === "launch" && (
          <div style={{
            position: "absolute",
            inset: 0,
            background: "#fff",
            zIndex: 200,
            pointerEvents: "none",
            animation: "flash-overlay 0.8s ease-out forwards",
          }} />
        )}

        {/* マイクラへ放つ（固定・右下） */}
        {fruits.length > 0 && (
          <button type="button" onClick={(e) => { e.stopPropagation(); sendToMc(); }} disabled={sending} style={{
            position: "absolute", right: 20, bottom: 20, zIndex: 10,
            padding: "10px 18px", borderRadius: 12, border: "none", cursor: sending ? "default" : "pointer",
            background: "linear-gradient(135deg, #00c8ff, #0088cc)", color: "#fff", fontWeight: 900, fontSize: 13,
            boxShadow: "0 4px 16px rgba(0,180,255,0.45), inset 0 1px 0 rgba(255,255,255,0.4)",
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
              position: "absolute", left: spawn.x * zoom, top: spawn.y * zoom, transform: "translate(-50%, 10px)", zIndex: 21,
              background: "rgba(5, 20, 45, 0.97)", border: "1px solid rgba(0, 200, 255, 0.25)", borderRadius: 14,
              padding: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.5)", animation: "pop-in 0.18s cubic-bezier(0.34,1.56,0.64,1)",
              maxWidth: 360,
            }}>
              {spawn.phase === "pick" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {CAT_ORDER
                    .filter((cat) => fruits.length === 0 ? cat === "trigger" : cat !== "trigger")
                    .map((cat) => {
                      const cs = CAT_STYLE[cat];
                      const items = ITEMS.filter((it) => it.cat === cat);
                      return (
                        <div key={cat} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <div style={{ fontSize: 9, fontWeight: 900, color: cs.color, letterSpacing: "0.08em", display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: cs.color, boxShadow: `0 0 5px ${cs.glow}` }} />
                            {cs.label.toUpperCase()}
                          </div>
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                            {items.map((it) => (
                              <button key={it.type} type="button" onClick={() => pickItem(it)} style={{
                                display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 11px", borderRadius: 11, border: "none", cursor: "pointer",
                                color: "#fff", fontWeight: 800, fontSize: 11, background: `linear-gradient(160deg, ${cs.glow}, ${cs.color})`,
                                boxShadow: `0 4px 0 ${shade(cs.color)}, 0 6px 9px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.45)`,
                                textShadow: "0 1px 1px rgba(0,0,0,0.35)",
                                transition: "transform 0.12s ease, box-shadow 0.12s ease",
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = `0 4px 0 ${shade(cs.color)}, 0 6px 9px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.45)`; }}
                              onMouseDown={(e) => { e.currentTarget.style.transform = "translateY(3px)"; e.currentTarget.style.boxShadow = `0 1px 0 ${shade(cs.color)}, 0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.35)`; }}
                              onMouseUp={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 4px 0 ${shade(cs.color)}, 0 6px 9px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.45)`; }}
                              >
                                <ItemGlyph type={it.type} size={13} />{it.label}{it.needsText && <span style={{ fontSize: 9, opacity: 0.8 }}>✎</span>}
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
function Grape({ fr, selected, isHub, onSelect, onDelete, onMouseDown, dockSlot }: {
  fr: Fruit; selected: boolean; isHub?: boolean; onSelect: (fr: Fruit, e: React.MouseEvent) => void; onDelete: () => void;
  onMouseDown: (id: string, e: React.MouseEvent) => void;
  dockSlot?: GroveSlot | null;
}) {
  const cs = CAT_STYLE[fr.item.cat];
  // eslint-disable-next-line react-hooks/purity -- 生成直後700msだけpop演出する一時判定（意図的）
  const fresh = Date.now() - fr.born < 700;
  const isDonut = fr.item.cat === "ifelse" || fr.item.cat === "loop";
  const isIf = fr.item.cat === "ifelse"; // 条件分岐は then/else 両枝を抱えるので一回り大きく
  const isDocked = !!fr.parentId; // ドーナツの穴に収まった子（枠色でスロットを示す）

  const containerSize = isHub ? 116 : (isIf ? 200 : isDonut ? 160 : 96);
  const orbSize = isHub ? 92 : (isIf ? 180 : isDonut ? 140 : 82);

  const getOrbBackground = () => {
    if (isDonut) {
      // ガラスリング: 穴は完全透明、リング自体は半透明のカラーティント
      return `radial-gradient(circle,
        transparent 41%,
        rgba(255,255,255,0.25) 42%,
        ${cs.color}40 44%,
        ${cs.color}18 60%,
        rgba(255,255,255,0.08) 74%,
        rgba(255,255,255,0.30) 88%,
        rgba(255,255,255,0.10) 100%
      )`;
    }
    // ガラス球: 完全に透明な中心 + カテゴリ色の微妙な色彩 + フレネルリム
    return `radial-gradient(circle at 35% 32%,
      rgba(255,255,255,0.15) 0%,
      ${cs.color}22 25%,
      ${cs.color}08 52%,
      transparent 68%,
      ${cs.color}08 80%,
      rgba(255,255,255,0.18) 90%,
      rgba(255,255,255,0.05) 100%
    )`;
  };

  const getDockBoxShadow = () => {
    if (!dockSlot) {
      if (selected) {
        // 選択中: 3層の強いグロー + 内部スペキュラ
        return `0 0 0 4px #5ae3f0, 0 0 26px 9px #5ae3f0cc, 0 0 55px 16px #5ae3f055, inset 0 0 18px rgba(255,255,255,0.25), inset 0 -5px 15px rgba(0,0,0,0.55)`;
      }
      // 通常: 柔らかい2層グロー + 内部深み
      return `0 0 14px 3px ${cs.glow}55, 0 0 35px 8px ${cs.color}28, 0 0 70px 14px ${cs.color}10, inset 0 0 10px rgba(255,255,255,0.15), inset 0 -3px 10px rgba(0,0,0,0.5)`;
    }
    if (dockSlot === "cond") {
      return "0 0 30px 10px #ffd075, inset 0 0 16px rgba(255,208,117,0.5)";
    }
    if (dockSlot === "then") {
      return "0 0 30px 10px #10b981, inset 0 0 16px rgba(16,185,129,0.5)";
    }
    if (dockSlot === "else") {
      return "0 0 30px 10px #ef4444, inset 0 0 16px rgba(239,68,68,0.5)";
    }
    if (dockSlot === "body") {
      return "0 0 30px 10px #f59e0b, inset 0 0 16px rgba(245,158,11,0.5)";
    }
    return "";
  };

  const getDockBorder = () => {
    if (!dockSlot) {
      if (selected) return "2.5px solid #5ae3f0"; // 選択中＝シアン枠で明確化
      if (isDocked) {
        const c = fr.slot === "then" ? "#10b981" : fr.slot === "else" ? "#ef4444" : fr.slot === "cond" ? "#ffd075" : "#f59e0b";
        return `1.5px solid ${c}90`;
      }
      // カテゴリ色の淡いリム発光（白い固定枠より自然で高級感が出る）
      return `1.5px solid ${cs.glow}50`;
    }
    if (dockSlot === "cond") return "2px solid #ffd075cc";
    if (dockSlot === "then") return "2px solid #10b981cc";
    if (dockSlot === "else") return "2px solid #ef4444cc";
    return "2px solid #f59e0bcc";
  };

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onSelect(fr, e); }}
      onMouseDown={(e) => onMouseDown(fr.id, e)}
      style={{
        position: "relative",
        animation: fresh ? "grape-pop 0.6s cubic-bezier(0.34,1.56,0.64,1)" : (selected ? "grape-jelly-breathe 2s ease-in-out infinite" : "grape-breathe 2.6s ease-in-out infinite"),
        cursor: "grab",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: containerSize,
        height: containerSize,
      }}
    >
      {/* ✕ 霧散（消滅）用ボタン */}
      <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(); }} style={{
        position: "absolute", top: 0, right: 0, zIndex: 4,
        width: 18, height: 18, borderRadius: "50%", border: "none",
        cursor: "pointer", background: "rgba(255, 107, 139, 0.6)", color: "#fff",
        fontSize: 9, fontWeight: 900, lineHeight: 1,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: `0 0 8px ${cs.glow}a0`,
        backdropFilter: "blur(2px)",
        transition: "all 0.2s ease",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "scale(1.2)"; e.currentTarget.style.background = "rgba(255, 107, 139, 0.9)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.background = "rgba(255, 107, 139, 0.6)"; }}
      >
        ✕
      </button>

      {/* 🔮 ガラスオーブ — 完全透明ベースにカテゴリ色ティント+フレネルリム */}
      <div 
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: orbSize,
          height: orbSize,
          borderRadius: "50%",
          padding: "4px 8px",
          background: getOrbBackground(),
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          border: getDockBorder(),
          boxShadow: getDockBoxShadow(),
          transition: "all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)",
          zIndex: 1,
          overflow: "hidden",
        }}
      >
        {/* ✨ ガラスに光がスーッと走る（glint sweep）。選択中は速く・強く＝魅力的に光る */}
        {!isDonut && (
          <div style={{
            position: "absolute",
            top: "-30%", left: 0,
            width: "50%", height: "160%",
            background: `linear-gradient(105deg, transparent 0%, rgba(255,255,255,0) 30%, rgba(255,255,255,${selected ? 0.75 : 0.4}) 50%, rgba(255,255,255,0) 70%, transparent 100%)`,
            pointerEvents: "none",
            zIndex: 4,
            animation: `glass-sheen ${selected ? "2.4s" : "5s"} ease-in-out infinite`,
            animationDelay: selected ? "0s" : `${(fr.born % 5) * 0.7}s`,
          }} />
        )}
        {/* ✨ スペキュラハイライト（主）— 左上に小さく鮮少な反射光 */}
        {!isDonut && (
          <div style={{
            position: "absolute",
            top: "8%", left: "14%",
            width: "44%", height: "30%",
            borderRadius: "50%",
            background: "radial-gradient(ellipse at 38% 42%, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.55) 30%, rgba(255,255,255,0.18) 60%, transparent 80%)",
            filter: "blur(2.5px)",
            pointerEvents: "none",
            zIndex: 3,
            transform: "rotate(-20deg)",
          }} />
        )}
        {/* ✨ スペキュラハイライト（副）— 右下に微妙な期届光 */}
        {!isDonut && (
          <div style={{
            position: "absolute",
            bottom: "10%", right: "10%",
            width: "22%", height: "14%",
            borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(255,255,255,0.4) 0%, transparent 70%)",
            filter: "blur(3px)",
            pointerEvents: "none",
            zIndex: 3,
          }} />
        )}
        {/* ✨ ドーナツのスペキュラ */}
        {isDonut && (
          <div style={{
            position: "absolute",
            top: "5%", left: "18%",
            width: "36%", height: "22%",
            borderRadius: "50%",
            background: "radial-gradient(ellipse at 40% 50%, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.35) 40%, transparent 72%)",
            filter: "blur(3px)",
            pointerEvents: "none",
            zIndex: 3,
            transform: "rotate(-15deg)",
          }} />
        )}
        <div style={{
          fontFamily: "'M PLUS Rounded 1c', sans-serif",
          fontSize: isHub ? 10 : isDonut ? 11 : 8.5,
          fontWeight: 900,
          color: "#fff",
          textShadow: "0 1px 2px rgba(0,0,0,0.85)",
          textAlign: "center",
          lineHeight: 1.25,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: isHub ? 80 : isDonut ? 124 : 74,
          // ドーナツは文言を穴の中央でなく上のリング上に置く（穴は中身用に空ける）
          ...(isDonut ? { position: "absolute" as const, top: 18, left: "50%", transform: "translateX(-50%)", maxWidth: 120 } : {}),
        }}>
          {fr.item.label}
          {!isHub && fr.item.needsText && (
            <span style={{ color: fr.text ? "#aef7df" : "rgba(255,255,255,0.45)", marginLeft: 3 }}>
              {fr.text ? `(${fr.text})` : "✎"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// 組んだ実 → "あなたが書いた事になる"コード（Java/GROVE 風・演出用の本物っぽい見せ方）
const TRIGGER_JAVA: Record<string, string> = {
  on_join: "onPlayerJoin", on_break: "onBlockBreak", on_chat: "onPlayerChat",
  on_use: "onUseItem", on_hurt: "onPlayerHurt", on_tick: "onServerTick",
};
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
    case "tp":     return `player.teleportTo(${t || "0, 64, 0"});`;
    case "title":  return `player.showTitle("${t || "クリア！"}");`;
    case "sound":  return `player.playSound("${t || "random.levelup"}");`;
    case "command":return `server.runCommand("${t || "time set day"}");`;
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
    o.type = "triangle"; o.frequency.setValueAtTime(400, ctx.currentTime); o.frequency.exponentialRampToValueAtTime(700, ctx.currentTime + 0.6);
    g.gain.setValueAtTime(0.18, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.65);
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.66); o.onended = () => ctx.close();
  } catch { /* noop */ }
}

function playChargeSound() {
  try {
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    const ctx = new AC(); const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(150, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(650, ctx.currentTime + 1.0);
    g.gain.setValueAtTime(0.01, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.95);
    g.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 1.0);
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 1.0); o.onended = () => ctx.close();
  } catch { /* noop */ }
}

function playReleaseSound() {
  try {
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    const ctx = new AC(); const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(800, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.75);
    g.gain.setValueAtTime(0.25, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.8); o.onended = () => ctx.close();
  } catch { /* noop */ }
}

const KEYFRAMES = `
  @keyframes grape-pop { 
    0% { transform: scale(0) translateY(-12px); opacity: 0; } 
    50% { transform: scale(1.25) translateY(2px); opacity: 1; } 
    75% { transform: scale(0.9) translateY(-1px); } 
    90% { transform: scale(1.08); } 
    100% { transform: scale(1) translateY(0); } 
  }
  @keyframes grape-breathe { 
    0%, 100% { transform: scale(1) rotate(0deg); } 
    50% { transform: scale(1.025) rotate(0.5deg); } 
  }
  @keyframes grape-jelly-breathe {
    0%, 100% { transform: scale(1, 1); }
    25% { transform: scale(1.08, 0.92); }
    50% { transform: scale(0.93, 1.07); }
    75% { transform: scale(1.04, 0.96); }
  }
  @keyframes glass-sheen {
    0%   { transform: translateX(-130%) skewX(-14deg); opacity: 0; }
    10%  { opacity: 1; }
    40%  { opacity: 1; }
    52%  { transform: translateX(260%) skewX(-14deg); opacity: 0; }
    100% { transform: translateX(260%) skewX(-14deg); opacity: 0; }
  }
  @keyframes leaf-float {
    0%, 100% { transform: translateY(0) rotate(0deg) scale(1); }
    50% { transform: translateY(-1.5px) rotate(3deg) scale(1.05); }
  }
  @keyframes hub-pump { 0%{opacity:0.9;transform:scale(0.9)} 100%{opacity:0;transform:scale(1.45)} }
  @keyframes stem-pulse { 0%{transform:translateY(8px) scale(0.6);opacity:0} 30%{opacity:1} 100%{transform:translateY(-20px) scale(1.1);opacity:0} }
  @keyframes suck-to-mc { 0%{transform:translateY(0) scale(1);opacity:1} 55%{transform:translateY(40px) scale(0.55);opacity:0.85} 100%{transform:translateY(150px) scale(0.04);opacity:0;filter:blur(2px)} }
  @keyframes mc-invite { 0%,100%{box-shadow:0 4px 16px rgba(0,180,255,0.45), inset 0 1px 0 rgba(255,255,255,0.4)} 50%{box-shadow:0 4px 22px rgba(0,220,255,0.7), 0 0 0 3px rgba(0,220,255,0.25), inset 0 1px 0 rgba(255,255,255,0.4)} }
  @keyframes mc-flash { 0%{opacity:0;transform:scale(0.7)} 25%{opacity:1;transform:scale(1.05)} 70%{opacity:1;transform:scale(1)} 100%{opacity:0;transform:scale(1)} }
  @keyframes pop-in { 0%{opacity:0;transform:translate(-50%,10px) scale(0.7)} 100%{opacity:1;transform:translate(-50%,10px) scale(1)} }
  @keyframes reveal-fade { 0%{opacity:0} 100%{opacity:1} }
  @keyframes code-line-in { 0%{opacity:0;transform:translateX(-6px)} 100%{opacity:1;transform:translateX(0)} }
  @keyframes float-particle {
    0% { transform: translateY(0) scale(0.9); opacity: 0.15; }
    50% { transform: translateY(-35px) translateX(8px) scale(1.1); opacity: 0.8; }
    100% { transform: translateY(-70px) scale(0.9); opacity: 0.15; }
  }
  @keyframes connection-glow {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.75; }
  }
  @keyframes code-ascend { 0%{transform:translateY(0);opacity:1} 100%{transform:translateY(-100px);opacity:0;filter:blur(3px)} }
  @keyframes ripple-breathe {
    0%, 100% { transform: scale(0.97); opacity: 0.2; }
    50% { transform: scale(1.03); opacity: 0.6; }
  }
  @keyframes spin-orbit {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes particle-pulse {
    0%, 100% { transform: scale(1); opacity: 0.5; }
    50% { transform: scale(1.25); opacity: 0.9; }
  }
  @keyframes stroke-flow {
    0% { stroke-dashoffset: 36; }
    100% { stroke-dashoffset: 0; }
  }
  @keyframes plasma-surge {
    0% { transform: scale(0.9) rotate(0deg); opacity: 0.85; }
    100% { transform: scale(1.15) rotate(90deg); opacity: 1; }
  }
  @keyframes charge-ring {
    0% { transform: scale(1.5) rotate(0deg); opacity: 0.8; }
    100% { transform: scale(0.2) rotate(-360deg); opacity: 0; }
  }
  @keyframes plasma-launch {
    0% { transform: scale(1); opacity: 1; }
    20% { transform: scale(0.3); opacity: 0.9; }
    100% { transform: scale(20); opacity: 0; filter: blur(12px); }
  }
  @keyframes flash-overlay {
    0% { opacity: 0.95; }
    20% { opacity: 0.95; }
    100% { opacity: 0; }
  }
  @keyframes tap-breathe {
    0%, 100% { transform: scale(1); box-shadow: 0 0 12px rgba(0,200,255,0.2); }
    50% { transform: scale(1.05); box-shadow: 0 0 28px rgba(0,220,255,0.5); }
  }
`;
