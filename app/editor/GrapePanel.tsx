"use client";

import { useState, useRef, useCallback, useEffect, useMemo, type ComponentType } from "react";
import { GrapeIcons, type IconProps } from "./grapeIcons";
import { grapeToCBlock } from "../../lib/grapeToCBlock";
import { exportProject } from "./exporter";
import { useEditorStore } from "./store";
import { buildGroveStructure, type GroveSlot } from "../../lib/groveTree";
import { CodeRevealOverlay } from "./CodeRevealOverlay";

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

// ブロックごとの候補（ドロップダウン用）。※自由入力もそのまま可（datalist＝候補＋手入力の両対応）
const ITEM_OPTIONS: Record<string, string[]> = {
  on_chat: ["ひらけごま", "こんにちは", "スタート", "たすけて"],
  on_use:  ["diamond", "stick", "compass", "clock", "apple", "bow"],
  say:     ["こんにちは！", "ようこそ！", "クリア！", "がんばって！", "レベルアップ！"],
  give:    ["diamond ×1", "diamond ×16", "iron_ingot ×1", "golden_apple ×1", "netherite_ingot ×1", "emerald ×16", "diamond_sword ×1", "diamond_pickaxe ×1", "bread ×3", "oak_log ×16", "tnt ×1", "ender_pearl ×1"],
  tp:      ["0 64 0", "0 100 0", "100 64 100", "0 -60 0"],
  title:   ["クリア！", "スタート！", "ゲームオーバー", "ようこそ！", "ステージ1"],
  sound:   ["random.levelup", "random.orb", "random.pop", "mob.villager.yes", "random.explode", "note.pling"],
  command: ["time set day", "time set night", "weather clear", "weather rain", "gamemode creative @s", "difficulty peaceful", "give @s diamond 1"],
  if:      ["夜のとき", "雨のとき", "スニーク中"],
  repeat:  ["3 回", "5 回", "10 回", "100 回"],
  number:  ["1", "5", "10", "16", "64", "100"],
};

// 漂う発光の粒（両脇に多め＝遊び場の息づかい）
const MOTES: { x: string; y: string; s: number; c: string; d: number; delay: number }[] = [
  // 左エリア
  { x: "4%",  y: "20%", s: 2,   c: "#5ae3f0", d: 9,  delay: 0 },
  { x: "12%", y: "15%", s: 1.5, c: "#aef7fc", d: 11, delay: 2 },
  { x: "8%",  y: "40%", s: 2.5, c: "#38b9e0", d: 10, delay: 1.5 },
  { x: "18%", y: "48%", s: 1.5, c: "#5ae3f0", d: 12, delay: 3.5 },
  { x: "6%",  y: "65%", s: 3,   c: "#cff8fb", d: 13, delay: 0.5 },
  { x: "14%", y: "72%", s: 2,   c: "#7cd7f5", d: 8,  delay: 4 },
  { x: "5%",  y: "88%", s: 2.5, c: "#38b9e0", d: 11, delay: 2.5 },
  { x: "22%", y: "82%", s: 1.5, c: "#aef7fc", d: 14, delay: 1.2 },

  // 右エリア
  { x: "94%", y: "18%", s: 2,   c: "#5ae3f0", d: 10, delay: 1 },
  { x: "82%", y: "25%", s: 1.5, c: "#7cd7f5", d: 12, delay: 3 },
  { x: "88%", y: "38%", s: 3,   c: "#aef7fc", d: 9,  delay: 0.2 },
  { x: "95%", y: "52%", s: 2.5, c: "#38b9e0", d: 11, delay: 2.7 },
  { x: "84%", y: "62%", s: 1.8, c: "#cff8fb", d: 13, delay: 4.2 },
  { x: "90%", y: "78%", s: 2.2, c: "#5ae3f0", d: 8,  delay: 1.8 },
  { x: "80%", y: "85%", s: 1.5, c: "#aef7fc", d: 15, delay: 0.9 },
  { x: "92%", y: "92%", s: 2.8, c: "#38b9e0", d: 10, delay: 3.1 },

  // 中央付近 (ノードと被りすぎないよう透明度やサイズを小さめに配置)
  { x: "32%", y: "12%", s: 1.5, c: "#5ae3f0", d: 14, delay: 5 },
  { x: "42%", y: "18%", s: 2,   c: "#aef7fc", d: 12, delay: 0.8 },
  { x: "58%", y: "15%", s: 1.5, c: "#7cd7f5", d: 11, delay: 2.3 },
  { x: "68%", y: "22%", s: 2.5, c: "#cff8fb", d: 13, delay: 4.5 },
  
  { x: "35%", y: "85%", s: 2,   c: "#5ae3f0", d: 10, delay: 1.6 },
  { x: "48%", y: "78%", s: 1.5, c: "#aef7fc", d: 12, delay: 3.2 },
  { x: "62%", y: "84%", s: 2.5, c: "#38b9e0", d: 11, delay: 0.4 },
  { x: "70%", y: "89%", s: 1.5, c: "#7cd7f5", d: 14, delay: 2.9 },
  
  { x: "28%", y: "45%", s: 1.8, c: "#aef7fc", d: 13, delay: 2.1 },
  { x: "72%", y: "50%", s: 2,   c: "#5ae3f0", d: 12, delay: 0.7 },
];

// 🌠 たまに浮き上がるマイクラ星座のデータ定義 (13歳〜20代のマイクラプレイヤーが喜ぶイースターエッグ)
const CONSTELLATIONS = [
  // クリーパーの顔
  {
    name: "creeper",
    width: 100, height: 100,
    nodes: [
      {x:15, y:15}, {x:85, y:15}, {x:85, y:85}, {x:15, y:85}, // 外枠
      {x:25, y:30}, {x:40, y:30}, {x:40, y:45}, {x:25, y:45}, // 左目
      {x:60, y:30}, {x:75, y:30}, {x:75, y:45}, {x:60, y:45}, // 右目
      {x:40, y:45}, {x:60, y:45}, {x:60, y:65}, {x:70, y:65}, {x:70, y:80}, {x:30, y:80}, {x:30, y:65}, {x:40, y:65} // 口
    ],
    edges: [
      [0,1], [1,2], [2,3], [3,0], // 外枠
      [4,5], [5,6], [6,7], [7,4], // 左目
      [8,9], [9,10], [10,11], [11,8], // 右目
      [12,13], [13,14], [14,15], [15,16], [16,17], [17,18], [18,19], [19,12] // 口
    ]
  },
  // 豚の顔
  {
    name: "pig",
    width: 100, height: 100,
    nodes: [
      {x:15, y:20}, {x:85, y:20}, {x:85, y:80}, {x:15, y:80}, // 外枠
      {x:20, y:35}, {x:35, y:35}, {x:65, y:35}, {x:80, y:35}, // 目
      {x:35, y:50}, {x:65, y:50}, {x:65, y:70}, {x:35, y:70}  // 鼻
    ],
    edges: [
      [0,1], [1,2], [2,3], [3,0],
      [4,5], [6,7],
      [8,9], [9,10], [10,11], [11,8]
    ]
  },
  // ダイヤの剣
  {
    name: "sword",
    width: 100, height: 100,
    nodes: [
      {x:85, y:15}, {x:70, y:30}, {x:55, y:45}, // 刃
      {x:45, y:35}, {x:35, y:45}, {x:45, y:55}, {x:55, y:45}, // つば左
      {x:55, y:55}, {x:65, y:65}, {x:55, y:75}, // つば右
      {x:45, y:55}, {x:35, y:65}, {x:20, y:80}  // 柄
    ],
    edges: [
      [0,1], [1,2],
      [2,3], [3,4], [4,5], [5,2],
      [2,7], [7,8], [8,9], [9,2],
      [5,11], [11,12]
    ]
  },
  // ウーパールーパーの顔
  {
    name: "axolotl",
    width: 100, height: 100,
    nodes: [
      {x:30, y:30}, {x:70, y:30}, {x:70, y:70}, {x:30, y:70}, // 0,1,2,3 (顔の輪郭)
      {x:15, y:22}, {x:15, y:35}, // 4,5 (左上エラ先)
      {x:10, y:50}, // 6 (左中エラ先)
      {x:15, y:62}, // 7 (左下エラ先)
      {x:85, y:22}, {x:85, y:35}, // 8,9 (右上エラ先)
      {x:90, y:50}, // 10 (右中エラ先)
      {x:85, y:62}, // 11 (右下エラ先)
      {x:42, y:45}, {x:58, y:45}, // 12,13 (両目)
      {x:46, y:58}, {x:54, y:58}  // 14,15 (口)
    ],
    edges: [
      [0,1], [1,2], [2,3], [3,0], // 顔の輪郭
      [0,4], [4,5], [5,0], // 左上エラ
      [0,6], // 左中エラ（顔の角から伸ばす）
      [3,7], // 左下エラ
      [1,8], [8,9], [9,1], // 右上エラ
      [1,10], // 右中エラ
      [2,11], // 右下エラ
      [14,15] // 口
    ]
  },
  // アヒルの横向き (Chicken)
  {
    name: "duck",
    width: 100, height: 100,
    nodes: [
      // 頭・クチバシ
      {x:40, y:20}, {x:25, y:20}, {x:25, y:28}, {x:15, y:28}, // 0, 1, 2, 3 (後頭部, 頭頂, クチバシ上角, クチバシ先上)
      {x:15, y:35}, {x:28, y:35}, {x:40, y:35}, // 4, 5, 6 (クチバシ先下, クチバシ付け根下, 首後ろ上)
      // 目
      {x:32, y:26}, // 7 (目)
      // 胴体
      {x:20, y:48}, {x:28, y:48}, {x:40, y:48}, {x:68, y:48}, // 8, 9, 10, 11 (胸前上, 首前下, 首後ろ下, お尻上)
      {x:68, y:70}, {x:20, y:70}, // 12, 13 (お尻下, 胸前下)
      // 羽
      {x:35, y:54}, {x:55, y:54}, {x:50, y:64}, {x:35, y:64}, // 14, 15, 16, 17 (羽の四角)
      // 足1
      {x:38, y:70}, {x:38, y:85}, {x:30, y:85}, // 18, 19, 20 (足1付け根, 足元, つまさき)
      // 足2
      {x:50, y:70}, {x:50, y:85}, {x:42, y:85}  // 21, 22, 23 (足2付け根, 足元, つまさき)
    ],
    edges: [
      // 頭とクチバシ
      [0,1], [1,2], [2,3], [3,4], [4,5], [5,6], [6,0],
      // 首
      [5,9], [6,10],
      // 胴体のアウトライン
      [8,9], [10,11], [11,12], [12,13], [13,8],
      // 羽
      [14,15], [15,16], [16,17], [17,14],
      // 足1
      [18,19], [19,20],
      // 足2
      [21,22], [22,23]
    ]
  },
  // ハチの横向き (Bee)
  {
    name: "bee",
    width: 100, height: 100,
    nodes: [
      // 体の四角 (0〜3)
      {x:25, y:30}, {x:85, y:30}, {x:85, y:70}, {x:25, y:70},
      // しま模様の縦線 (4〜7)
      {x:45, y:30}, {x:45, y:70}, {x:65, y:30}, {x:65, y:70},
      // 触角1 (8, 9)
      {x:15, y:32}, {x:15, y:22},
      // 触角2 (10, 11)
      {x:12, y:42}, {x:12, y:32},
      // 羽1 (12, 13)
      {x:40, y:15}, {x:55, y:15},
      // 羽2 (14, 15)
      {x:60, y:18}, {x:70, y:18},
      // お尻の針 (16)
      {x:93, y:50},
      // 目 (17, 18, 19, 20)
      {x:25, y:52}, {x:35, y:52}, {x:35, y:62}, {x:25, y:62},
      // 脚 (21, 22, 23)
      {x:35, y:80}, {x:55, y:80}, {x:75, y:80}
    ],
    edges: [
      // 体の輪郭
      [0,1], [1,2], [2,3], [3,0],
      // しま模様
      [4,5], [6,7],
      // 触角1
      [0,8], [8,9],
      // 触角2
      [3,10], [10,11],
      // 羽1
      [4,12], [12,13], [13,6],
      // 羽2
      [6,14], [14,15], [15,1],
      // 針
      [1,16], [2,16],
      // 目
      [17,18], [18,19], [19,20], [20,17],
      // 脚
      [3,21], [5,22], [7,23]
    ]
  }
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
// HMR(Fast Refresh)で _gid だけ 1 にリセットされても、state に残った既存IDと
// 二度と衝突しないよう、時刻(base36)＋乱数を混ぜて一意なIDを発行する。
const newGrapeId = () => `g${Date.now().toString(36)}${(_gid++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export default function GrapePanel() {
  const [fruits, setFruits] = useState<Fruit[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [spawn, setSpawn] = useState<Spawn | null>(null);
  const [draft, setDraft] = useState("");
  const [reveal, setReveal] = useState<string[] | null>(null); // コード誕生の演出
  const [launchPhase, setLaunchPhase] = useState<null | "gather" | "coalesce" | "launch">(null);

  interface ActiveConstellation {
    index: number;
    x: number; // %
    y: number; // %
    scale: number;
    id: number;
    animationName: string;
  }
  const [constellation, setConstellation] = useState<ActiveConstellation | null>(null);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const animNames = ["const-float-up", "const-float-left", "const-float-diagonal", "const-fade-depth"];
    const triggerNext = () => {
      // 10秒〜20秒の間隔で星座が出現 (ランダムなアニメーションパターンで動的に出現)
      const delay = 10000 + Math.random() * 10000;
      timer = setTimeout(() => {
        setConstellation({
          index: Math.floor(Math.random() * CONSTELLATIONS.length),
          x: 10 + Math.random() * 80, 
          y: 15 + Math.random() * 55,
          scale: 1.4 + Math.random() * 0.8, // もっと大きく表示 (1.4〜2.2倍)
          id: Date.now(),
          animationName: animNames[Math.floor(Math.random() * animNames.length)]
        });
        
        // 14秒間表示 (ゆっくりとした移動演出)
        setTimeout(() => {
          setConstellation(null);
          triggerNext();
        }, 14000);
      }, delay);
    };

    triggerNext();
    return () => clearTimeout(timer);
  }, []);
  
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const getDefaultZoom = useCallback(() => {
    if (typeof window === "undefined") return 1.0;
    const w = window.innerWidth;
    if (w < 1024) return 0.65; // タブレット等
    if (w < 1366) return 0.8;  // ノートPC等
    return 1.0;                // デスクトップ
  }, []);
  const [zoom, setZoom] = useState(1.0);

  useEffect(() => {
    setZoom(getDefaultZoom());
  }, [getDefaultZoom]);
  
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
        // eslint-disable-next-line react-hooks/immutability -- 親座標を辿る意図的な自己再帰
        const parentCoords = getDisplayCoords(parent, visited);
        
        // スロットごとに物理的な配置エリアを完全に分ける（直感的なビジュアルロジック）
        if (f.slot === "cond") {
          // 条件ブロック（値）は、親ドーナツの真ん中の「穴」にすっぽり収まる
          return {
            x: parentCoords.x,
            y: parentCoords.y,
          };
        }

        // 同一スロット内の順序を計算
        const siblings = fruits
          .filter(x => x.parentId === f.parentId && x.slot === f.slot)
          .sort((a, b) => a.born - b.born);
        const idx = Math.max(0, siblings.findIndex(x => x.id === f.id));
        const STEP_Y = 64; // 子要素同士の縦の間隔

        if (f.slot === "then") {
          // then（真のとき）: 左下にぶら下がる
          return {
            x: parentCoords.x - 70,
            y: parentCoords.y + 110 + idx * STEP_Y,
          };
        }
        if (f.slot === "else") {
          // else（偽のとき）: 右下にぶら下がる
          return {
            x: parentCoords.x + 70,
            y: parentCoords.y + 110 + idx * STEP_Y,
          };
        }
        if (f.slot === "body") {
          // loop body: 真下にぶら下がる
          return {
            x: parentCoords.x,
            y: parentCoords.y + 95 + idx * STEP_Y,
          };
        }
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
          // 中心の穴（35px以内）に近づけたら、どのブロックでも cond スロット（中）に入れるように緩和
          if (dist < 35) {
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
      const pId = activeParentId;
      const slot = activeSlot;
      setDockPreview(prev => {
        if (!prev || prev.parentId !== pId || prev.slot !== slot) {
          playDockSound();
        }
        return { parentId: pId, slot };
      });
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
    const id = newGrapeId();
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
    //    ※ 648行で掴んだ store は setLogicGraphJson/setTargetPlatform 前の“古いスナップショット”。
    //      zustand は set で新オブジェクトに差し替えるため、ここで最新 state を取り直して渡す
    //      （でないと さっき変換した blocks が入っておらず、古い/空のロジックが出力される）。
    try {
      await exportProject(useEditorStore.getState(), "");
    } catch (err) {
      console.error("Failed to export project:", err);
    }

    // 4. 放出アニメーション完了 (800ms) の後、コード表示＋写経オーバーレイへ移行
    await new Promise((r) => setTimeout(r, 800));
    setReveal(fruitsToCode(h, sp));
    setLaunchPhase(null);
    setSending(false);
  }, [fruits]);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      {/* 開発中オーバーレイ */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 9999,
        background: "rgba(0, 5, 10, 0.85)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        color: "#a8eeff"
      }}>
        <div style={{ fontSize: 64, marginBottom: 24 }}>🌿</div>
        <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: "0.1em", textShadow: "0 0 20px rgba(0, 180, 255, 0.5)" }}>
          GROVE (JAVA版)
        </div>
        <div style={{ fontSize: 20, marginTop: 16, opacity: 0.9, letterSpacing: "0.1em", background: "rgba(212, 93, 121, 0.3)", border: "2px solid #d45d79", padding: "8px 24px", borderRadius: 99, color: "#fff", fontWeight: 700 }}>
          🚧 現在開発中
        </div>
        <div style={{ marginTop: 24, fontSize: 14, opacity: 0.6 }}>
          機能のリリースまでもうしばらくお待ちください
        </div>
      </div>

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
          background: `
            radial-gradient(120% 95% at 50% 2%, #0a2530 0%, #05141b 42%, #02090d 100%),
            repeating-linear-gradient(0deg, rgba(0, 200, 255, 0.012) 0px, rgba(0, 200, 255, 0.012) 1px, transparent 1px, transparent 40px),
            repeating-linear-gradient(90deg, rgba(0, 200, 255, 0.012) 0px, rgba(0, 200, 255, 0.012) 1px, transparent 1px, transparent 40px)
          `,
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
        {/* 🌠 たまに出現するマイクラの星座イースターエッグ */}
        {constellation && (
          <div
            key={constellation.id}
            style={{
              position: "absolute",
              left: `${constellation.x}%`,
              top: `${constellation.y}%`,
              transform: `translate(-50%, -50%) scale(${constellation.scale})`,
              pointerEvents: "none",
              zIndex: 0,
            }}
          >
            <div
              style={{
                animation: `${constellation.animationName} 14s ease-in-out forwards`,
              }}
            >
              {(() => {
                const data = CONSTELLATIONS[constellation.index];
                return (
                  <svg width={data.width} height={data.height} style={{ overflow: "visible" }}>
                    {/* 星座の星（点）のみでキャラクターを描画（繋ぐ線は非表示にしてよりさりげなく上品に） */}
                    {data.nodes.map((n, idx) => (
                      <g key={idx}>
                        {/* 外枠のにじむ光 */}
                        <circle
                          cx={n.x}
                          cy={n.y}
                          r={2.2}
                          fill="#cff8fb"
                          opacity={0.3}
                        />
                        {/* コアの白い星 */}
                        <circle
                          cx={n.x}
                          cy={n.y}
                          r={0.8}
                          fill="#fff"
                          opacity={0.7}
                        />
                      </g>
                    ))}
                  </svg>
                );
              })()}
            </div>
          </div>
        )}
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
            onClick={(e) => { e.stopPropagation(); setZoom(getDefaultZoom()); }}
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
            onClick={(e) => { e.stopPropagation(); setZoom(getDefaultZoom()); stageRef.current?.scrollTo({ left: 0, top: 0 }); }}
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
              if (cat === "ifelse") return 90;
              if (cat === "loop") return 70;
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
                      {/* 背景の太いエネルギーグロー */}
                      <path d={pathD} fill="none" stroke={p.color} strokeWidth={7} opacity={0.12} strokeLinecap="round" />
                      {/* 中間のネオンライン */}
                      <path d={pathD} fill="none" stroke={p.glow} strokeWidth={3} opacity={0.4} strokeLinecap="round" />
                      {/* 中心の純白レーザーコア */}
                      <path
                        d={pathD}
                        fill="none"
                        stroke="#fff"
                        strokeWidth={1.2}
                        strokeLinecap="round"
                        style={{
                          animation: "connection-glow 3s ease-in-out infinite",
                          opacity: launchPhase === "coalesce" ? 0.95 : launchPhase === "launch" ? 0 : 0.85,
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

        {/* コード誕生＋写経（大人トーン）。GROVE=JAVA/プロ向けなので tone="adult" */}
        {reveal && (
          <CodeRevealOverlay
            revealCode={reveal.join("\n")}
            onClose={() => setReveal(null)}
            theme="grove"
            tone="adult"
          />
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
                    list={ITEM_OPTIONS[spawn.item.type] ? `grove-dl-${spawn.item.type}` : undefined}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") confirmType(); if (e.key === "Escape") setSpawn(null); }}
                    style={{ flex: 1, fontSize: 14, fontWeight: 700, color: "#fff", padding: "7px 10px", borderRadius: 9, border: `2px solid ${CAT_STYLE[spawn.item.cat].glow}`, outline: "none", background: "rgba(0,0,0,0.3)" }} />
                  {ITEM_OPTIONS[spawn.item.type] && (
                    <datalist id={`grove-dl-${spawn.item.type}`}>
                      {ITEM_OPTIONS[spawn.item.type].map((o) => <option key={o} value={o} />)}
                    </datalist>
                  )}
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
  const [hovered, setHovered] = useState(false);
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
      // ハイテク・ホログラムリング (13歳〜20代向けゲーミングSFスタイル)
      return `
        radial-gradient(circle at center, transparent 42%, ${cs.color}35 50%, transparent 92%),
        radial-gradient(circle at center, transparent 42%, ${cs.color}55 70%, ${cs.glow}cc 100%),
        repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 4px)
      `;
    }
    // ホログラム球体
    return `
      radial-gradient(circle at center,
        ${cs.color}45 0%,
        ${cs.color}25 55%,
        ${cs.color}90 85%,
        rgba(255,255,255,0.2) 94%,
        ${cs.glow}dd 98%,
        transparent 100%
      ),
      repeating-linear-gradient(0deg, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 1px, transparent 1px, transparent 4px)
    `;
  };

  const getDockBoxShadow = () => {
    if (!dockSlot) {
      if (selected) {
        return `0 0 25px 6px #5ae3f0cc, inset 0 0 15px rgba(90,227,240,0.5)`;
      }
      if (hovered) {
        return `0 0 35px 8px ${cs.glow}cc, 0 0 70px 15px ${cs.color}44, inset 0 0 18px rgba(255,255,255,0.25)`;
      }
      return `0 0 18px 3px ${cs.glow}55, 0 0 40px 8px ${cs.color}22, inset 0 0 10px rgba(255,255,255,0.12)`;
    }
    if (dockSlot === "cond") return "0 0 45px 10px #ffd075ee, inset 0 0 15px rgba(255,208,117,0.4)";
    if (dockSlot === "then") return "0 0 45px 10px #10b981ee, inset 0 0 15px rgba(16,185,129,0.4)";
    if (dockSlot === "else") return "0 0 45px 10px #ef4444ee, inset 0 0 15px rgba(239,68,68,0.4)";
    if (dockSlot === "body") return "0 0 45px 10px #f59e0bee, inset 0 0 15px rgba(245,158,11,0.4)";
    return "";
  };

  const getDockBorder = () => {
    if (!dockSlot) {
      if (selected) return "2.5px solid #5ae3f0"; 
      if (isDocked) {
        const c = fr.slot === "then" ? "#10b981" : fr.slot === "else" ? "#ef4444" : fr.slot === "cond" ? "#ffd075" : "#f59e0b";
        return `1.5px solid ${c}bb`; 
      }
      return `1.5px solid ${cs.glow}60`; 
    }
    if (dockSlot === "cond") return "2px solid #ffd075ee";
    if (dockSlot === "then") return "2px solid #10b981ee";
    if (dockSlot === "else") return "2px solid #ef4444ee";
    return "2px solid #f59e0bee";
  };

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onSelect(fr, e); }}
      onMouseDown={(e) => onMouseDown(fr.id, e)}
      onMouseEnter={() => {
        setHovered(true);
        playHoverWater();
      }}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        animation: fresh ? "grape-pop 0.6s cubic-bezier(0.34,1.56,0.64,1)" : (selected ? "grape-pulse-selected 2s ease-in-out infinite" : "grape-breathe 4s ease-in-out infinite"),
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

      {/* 🔮 深海3D円形・ドーナツ発光体 */}
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
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          border: getDockBorder(),
          boxShadow: getDockBoxShadow(),
          transform: hovered ? "scale(1.08)" : "scale(1)",
          transition: "all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)",
          zIndex: 1,
          overflow: "hidden",
        }}
      >





        {/* 🌟 ゲーミング・ホログラムアイコン (13歳〜20代のゲーマーが喜ぶSFテック表現) */}
        <div style={{ 
          color: cs.glow, 
          filter: `drop-shadow(0 0 5px ${cs.glow}) drop-shadow(0 0 2px rgba(255,255,255,0.5))`, 
          marginBottom: isHub ? 6 : isDonut ? 12 : 3,
          opacity: hovered ? 1 : 0.85,
          transition: "all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1)",
          transform: hovered ? "scale(1.12)" : "scale(1)",
          zIndex: 2,
          // ドーナツ（条件分岐、ループ）はアイコンを中央に大きく表示（ラベルが上部にあるため）
          ...(isDonut ? { marginTop: 12 } : {})
        }}>
          <ItemGlyph type={fr.item.type} size={isHub ? 28 : isDonut ? 36 : 20} />
        </div>

        <div style={{
          fontFamily: "'M PLUS Rounded 1c', sans-serif",
          fontSize: isHub ? 9.5 : isDonut ? 10.5 : 8,
          fontWeight: 900,
          color: "#fff",
          textShadow: `0 0 6px ${cs.glow}bb, 0 1px 3px rgba(0,0,0,0.9)`,
          textAlign: "center",
          lineHeight: 1.25,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: isHub ? 80 : isDonut ? 124 : 74,
          zIndex: 2,
          // ドーナツは文言を穴の中央でなく上のリング上に置く
          ...(isDonut ? { position: "absolute" as const, top: 15, left: "50%", transform: "translateX(-50%)", maxWidth: 120 } : {}),
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

function playHoverWater() {
  try {
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    const ctx = new AC();
    const now = ctx.currentTime;
    
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    
    o.type = "sine";
    o.frequency.setValueAtTime(850, now);
    o.frequency.exponentialRampToValueAtTime(140, now + 0.16);
    
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.06, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    
    o.connect(g);
    g.connect(ctx.destination);
    o.start(now);
    o.stop(now + 0.2);
    
    setTimeout(() => ctx.close(), 250);
  } catch { /* noop */ }
}

function playDockSound() {
  try {
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    const ctx = new AC();
    const now = ctx.currentTime;
    
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    
    o1.type = "sine";
    o1.frequency.setValueAtTime(600, now);
    o1.frequency.exponentialRampToValueAtTime(180, now + 0.22);
    
    o2.type = "sine";
    o2.frequency.setValueAtTime(1200, now);
    o2.frequency.exponentialRampToValueAtTime(300, now + 0.12);
    
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.12, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    
    o1.connect(g);
    o2.connect(g);
    g.connect(ctx.destination);
    
    o1.start();
    o2.start();
    o1.stop(now + 0.35);
    o2.stop(now + 0.35);
    setTimeout(() => ctx.close(), 400);
  } catch { /* noop */ }
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
    0%, 100% { transform: scale(1); } 
    50% { transform: scale(1.015); } 
  }
  @keyframes grape-pulse-selected {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.045); }
  }
  @keyframes leaf-float {
    0%, 100% { transform: translateY(0) rotate(0deg) scale(1); }
    50% { transform: translateY(-1px) scale(1.02); }
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
    0% {
      transform: translate(0, 0) scale(0.4);
      opacity: 0;
    }
    30%, 70% {
      opacity: 0.65;
    }
    100% {
      transform: translate(12px, -50px) scale(0.4);
      opacity: 0;
    }
  }
  @keyframes connection-glow {
    0%, 100% { opacity: 0.35; }
    50% { opacity: 0.7; }
  }
  @keyframes code-ascend { 0%{transform:translateY(0);opacity:1} 100%{transform:translateY(-100px);opacity:0;filter:blur(3px)} }
  @keyframes ripple-breathe {
    0%, 100% { transform: scale(0.98); opacity: 0.35; }
    50% { transform: scale(1.02); opacity: 0.55; }
  }
  @keyframes spin-orbit {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes particle-pulse {
    0%, 100% { transform: scale(1); opacity: 0.5; }
    50% { transform: scale(1.2) opacity: 0.8; }
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
    50% { transform: scale(1.03); box-shadow: 0 0 24px rgba(0,220,255,0.4); }
  }
  @keyframes deepsea-jelly {
    0%, 100% { transform: scale(1); }
  }
  @keyframes marine-snow {
    0%, 100% { transform: translateY(0px) scale(0.98); opacity: 0.45; }
    50% { transform: translateY(-2px) scale(1.02); opacity: 0.75; }
  }
  @keyframes const-float-up {
    0% { opacity: 0; transform: translateY(30px); filter: blur(1.5px); }
    20%, 80% { opacity: 0.22; filter: blur(0px); }
    100% { opacity: 0; transform: translateY(-40px); filter: blur(1.5px); }
  }
  @keyframes const-float-left {
    0% { opacity: 0; transform: translateX(40px); filter: blur(1.5px); }
    20%, 80% { opacity: 0.22; filter: blur(0px); }
    100% { opacity: 0; transform: translateX(-50px); filter: blur(1.5px); }
  }
  @keyframes const-float-diagonal {
    0% { opacity: 0; transform: translate(-30px, 30px); filter: blur(1.5px); }
    20%, 80% { opacity: 0.22; filter: blur(0px); }
    100% { opacity: 0; transform: translate(40px, -40px); filter: blur(1.5px); }
  }
  @keyframes const-fade-depth {
    0% { opacity: 0; transform: scale(1.3); filter: blur(0.5px); }
    20%, 75% { opacity: 0.22; filter: blur(0px); }
    100% { opacity: 0; transform: scale(0.65); filter: blur(2px); }
  }
`;
