import { create } from "zustand";
import { DEFAULT_LOCALE, type Locale } from "../../lib/i18n";
import type { MobIR } from "../../lib/devtab/ir";
import type { ItemIR } from "../../lib/devtab/itemIr";
import { DEFAULT_JAVA_TARGET, type JavaTargetId } from "../../lib/javaEngine/targets";

/** ロケール初期値: localStorage(mmc_locale) があれば復元、無ければ端末言語、それでもなければ既定(ja) */
function initLocale(): Locale {
  if (typeof window !== "undefined") {
    // 1. 保存済みの選択
    const v = window.localStorage.getItem("mmc_locale");
    if (v === "ja" || v === "en") {
      document.documentElement.lang = v;
      return v;
    }
    // 2. 端末の言語 (OS)
    const navLang = navigator.language || (navigator as any).userLanguage;
    if (navLang && navLang.startsWith("en")) {
      document.documentElement.lang = "en";
      return "en";
    }
  }
  return DEFAULT_LOCALE;
}

export interface BlockFace {
  color: string;
  texture?: string;
}

export interface Keyframe {
  time: number;
  position?: [number, number, number];
  scale?: [number, number, number];
  rotation?: [number, number, number];
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

export interface Animation {
  id: string;
  name: string;
  duration: number;
  keyframes: Keyframe[];
  loop?: boolean;
}

export interface VoxelBlock {
  id: string;
  name: string;
  position: [number, number, number];
  scale:    [number, number, number];     // 各軸のスケール（デフォルト 1,1,1）
  rotation: [number, number, number];     // 各軸の回転（度数、デフォルト 0,0,0）
  faces: {
    top: BlockFace; bottom: BlockFace;
    front: BlockFace; back: BlockFace;
    left: BlockFace; right: BlockFace;
  };
  groupId?: string;
  animations?: Animation[];
  playingAnimation?: string;
  // ── 本物のマイクラブロック設定（registered=ONで出力に反映） ──
  registered?: boolean;
  displayName?: string;   // ゲーム内表示名（日本語OK）
  hardness?: number;      // かたさ（壊れにくさ）
  lightLevel?: number;    // 発光レベル 0〜15
  /**
   * ブロックの周りに出す粒子。空なら出さない。
   * ⚠️ ブロックのJSONではなく**スクリプト**で出す。
   *    minecraft:particle_emitter の書式に確証が無く、間違えると
   *    ブロックごと読み込まれなくなるため（過去にアイテムで同じ事故を起こしている）。
   */
  particle?: string;
}

export interface VoxelItem {
  id: string;
  name: string;
  position: [number, number, number];
  scale:    [number, number, number];
  rotation: [number, number, number];
  faces: {
    top: BlockFace; bottom: BlockFace;
    front: BlockFace; back: BlockFace;
    left: BlockFace; right: BlockFace;
  };
  groupId?: string;
  animations?: Animation[];
  playingAnimation?: string;
  registered?: boolean;
  displayName?: string;
  hardness?: number;
  lightLevel?: number;
  /** ブロックと同じ UI を使うので型も揃える。アイテムでは今のところ出力に使わない */
  particle?: string;
}

export interface EditorState {
  blocks: VoxelBlock[];
  selectedBlockId: string | null;
  selectedBlockIds: string[];
  items: VoxelItem[];
  selectedItemIds: string[];
  showGrid: boolean;
  showWireframe: boolean;
  cameraPosition: [number, number, number];
  gridSnapEnabled: boolean;
  gridSnapSize: number;
  groups: Record<string, {id: string; name: string; createdAt: number}>;

  activeBlockType: string;
  activeItemType: string;
  activeBlockColor: string;

  projectName: string;
  projectDescription: string;
  targetPlatform: "bedrock" | "java";
  /**
   * Java版のモブの出し方。
   *   normal … 前提MODなし。バニラのモブを土台にする（遊ぶ人は Forge だけ）
   *   prereq … GeckoLib を前提に、作った形とアニメをそのまま出す
   *
   * ⚠️ exporter がここを見て、設計図の `render` と同梱アセット、
   *    mods.toml の GeckoLib 依存を切り替える。**3つは必ず同時に変わること。**
   *    片方だけになると、MODは起動するのにモブが出ない／
   *    GeckoLib が無くて起動しない、のどちらかになる。
   */
  javaModMode: "normal" | "prereq";
  /**
   * Java版の出し先（どのローダー・どのマイクラ向けに書き出すか）。
   * 実際の値は lib/javaEngine/targets.ts の表が持つ。ここは選んだ id だけ。
   * ⚠️ 表に無い／まだ遊べない id が入っていても、getJavaTarget が既定へ落とす。
   */
  javaTarget: JavaTargetId;
  exportFormat: "mcaddon" | "mcpack" | "zip";
  /** メインのEXPORTボタンを押して解錠したか（設定画面の出力ゲート用） */
  exportArmed: boolean;
  compress: boolean;
  /** 統合版: ベータAPI（実験的スクリプトAPI）を使うか。ON=beta指定 / OFF=安定版 */
  betaApi: boolean;
  mcVersion: "1.26.x" | "1.21.40+" | "1.21.0" | "1.20.x";
  packIconDataUrl: string;       // アドオンアイコン（data URL、空なら規定）

  generatedJsCode: string;
  logicGraphJson: string;

  /** デベロッパータブで取り込んだモブ。書き出し時に exporter がここを見る。
      ボクセル(blocks/items)とは別物なので混ぜない */
  devMobs: MobIR[];
  /** デベロッパータブで作ったアイテム。モブとは別物なので配列を分ける */
  devItems: ItemIR[];

  locale: Locale;

  setLocale: (l: Locale) => void;
  setLogicGraphJson: (json: string) => void;
  /** 同じ id のモブが居たら差し替える。取り込み直しで増殖させないため */
  upsertDevMob: (mob: MobIR) => void;
  updateDevMobBehavior: (id: string, patch: Partial<MobIR["behavior"]>) => void;
  removeDevMob: (id: string) => void;
  upsertDevItem: (item: ItemIR) => void;
  updateDevItem: (id: string, patch: Partial<ItemIR>) => void;
  removeDevItem: (id: string) => void;
  setPackIconDataUrl: (url: string) => void;
  addBlock: (block: VoxelBlock) => void;
  removeBlock: (id: string) => void;
  updateBlock: (id: string, partial: Partial<VoxelBlock>) => void;
  selectBlock: (id: string | string[] | null, append?: boolean) => void;
  duplicateBlock: (id: string) => void;
  setShowGrid: (v: boolean) => void;
  setShowWireframe: (v: boolean) => void;
  setActiveBlockType: (t: string) => void;
  setActiveItemType: (t: string) => void;
  setActiveBlockColor: (c: string) => void;
  setProjectName: (n: string) => void;
  setProjectDescription: (d: string) => void;
  setTargetPlatform: (p: "bedrock" | "java") => void;
  setJavaModMode: (m: "normal" | "prereq") => void;
  setJavaTarget: (t: JavaTargetId) => void;
  setExportFormat: (f: "mcaddon" | "mcpack" | "zip") => void;
  setExportArmed: (v: boolean) => void;
  setCompress: (v: boolean) => void;
  setBetaApi: (v: boolean) => void;
  setMcVersion: (v: "1.26.x" | "1.21.40+" | "1.21.0" | "1.20.x") => void;
  setGeneratedJsCode: (code: string) => void;
  setGridSnap: (enabled: boolean, size?: number) => void;
  createGroup: (name: string) => string;
  assignToGroup: (blockIds: string[], groupId: string) => void;
  selectGroup: (groupId: string) => void;
  deleteGroup: (groupId: string) => void;
  addAnimation: (blockId: string, animation: Omit<Animation, 'id'>) => void;
  setKeyframe: (blockId: string, animationId: string, keyframe: Keyframe) => void;
  playAnimation: (blockId: string, animationId: string) => void;
  stopAnimation: (blockId: string) => void;
  addItem: (item: VoxelItem) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, partial: Partial<VoxelItem>) => void;
  selectItem: (id: string | string[] | null, append?: boolean) => void;
  duplicateItem: (id: string) => void;
}

function defaultBlock(): VoxelBlock {
  return {
    id: "default-block",
    name: "custom_block",
    position: [0, 0.5, 0],
    scale:    [1, 1, 1],
    rotation: [0, 0, 0],
    faces: {
      top:    { color: "#4ade80" },
      bottom: { color: "#16a34a" },
      front:  { color: "#22c55e" },
      back:   { color: "#22c55e" },
      left:   { color: "#15803d" },
      right:  { color: "#15803d" },
    },
  };
}

function defaultItem(): VoxelItem {
  return {
    id: "default-item",
    name: "custom_item",
    position: [0, 0.25, 0],
    scale:    [0.5, 0.5, 0.5],
    rotation: [0, 0, 0],
    faces: {
      top:    { color: "#fbbf24" },
      bottom: { color: "#f59e0b" },
      front:  { color: "#fcd34d" },
      back:   { color: "#fcd34d" },
      left:   { color: "#f97316" },
      right:  { color: "#f97316" },
    },
  };
}

export const useEditorStore = create<EditorState>((set) => ({
  blocks: [defaultBlock()],
  selectedBlockId: "default-block",
  selectedBlockIds: ["default-block"],
  items: [defaultItem()],
  selectedItemIds: ["default-item"],
  showGrid: true,
  showWireframe: false,
  cameraPosition: [3, 2.5, 3],
  gridSnapEnabled: false,
  gridSnapSize: 1.0,
  groups: {},

  activeBlockType: "minecraft:stone",
  activeItemType: "minecraft:diamond",
  activeBlockColor: "#4ade80",

  projectName: "My Awesome Mod",
  projectDescription: "An amazing Minecraft mod",
  targetPlatform: "bedrock",
  // 既定は「ふつう」。前提MODを要求するのは、利用者が選んだときだけにする
  javaModMode: "normal",
  javaTarget: DEFAULT_JAVA_TARGET,
  exportFormat: "mcaddon",
  exportArmed: false,
  compress: true,
  betaApi: false,
  mcVersion: "1.26.x" as const,
  packIconDataUrl: "",

  generatedJsCode: "",
  logicGraphJson: "",
  devMobs: [],
  devItems: [],

  locale: initLocale(),

  setLocale: (l) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("mmc_locale", l);
      document.documentElement.lang = l;
    }
    set({ locale: l });
  },
  setLogicGraphJson:  (json) => set({ logicGraphJson: json }),

  upsertDevMob: (mob) =>
    set((s) => {
      const i = s.devMobs.findIndex((m) => m.id === mob.id);
      if (i < 0) return { devMobs: [...s.devMobs, mob] };
      // 同じモデルを読み直したときに、設定済みの挙動を巻き戻さない。
      // 見た目だけ差し替えるのが期待される動きなので behavior は残す
      const next = [...s.devMobs];
      next[i] = { ...mob, behavior: next[i].behavior };
      return { devMobs: next };
    }),

  updateDevMobBehavior: (id, patch) =>
    set((s) => ({
      devMobs: s.devMobs.map((m) => (m.id === id ? { ...m, behavior: { ...m.behavior, ...patch } } : m)),
    })),

  removeDevMob: (id) => set((s) => ({ devMobs: s.devMobs.filter((m) => m.id !== id) })),

  upsertDevItem: (item) =>
    set((s) => {
      const i = s.devItems.findIndex((x) => x.id === item.id);
      if (i < 0) return { devItems: [...s.devItems, item] };
      const next = [...s.devItems];
      next[i] = item;
      return { devItems: next };
    }),

  updateDevItem: (id, patch) =>
    set((s) => ({ devItems: s.devItems.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),

  removeDevItem: (id) => set((s) => ({ devItems: s.devItems.filter((x) => x.id !== id) })),
  setPackIconDataUrl: (url)  => set({ packIconDataUrl: url }),
  addBlock:    (block)        => set((s) => ({ blocks: [...s.blocks, block] })),
  removeBlock: (id)           => set((s) => ({
    blocks: s.blocks.filter((b) => b.id !== id),
    selectedBlockId: s.selectedBlockId === id ? null : s.selectedBlockId,
    selectedBlockIds: s.selectedBlockIds.filter((bid) => bid !== id),
  })),
  updateBlock: (id, partial)  => set((s) => ({
    blocks: s.blocks.map((b) => b.id === id ? { ...b, ...partial } : b),
  })),
  selectBlock: (id, append) => set((s) => {
    if (id === null) return { selectedBlockId: null, selectedBlockIds: [] };
    const ids = Array.isArray(id) ? id : [id];
    if (append) {
      const newIds = Array.from(new Set([...s.selectedBlockIds, ...ids]));
      return { selectedBlockIds: newIds, selectedBlockId: newIds[newIds.length - 1] };
    } else {
      return { selectedBlockIds: ids, selectedBlockId: ids[0] || null };
    }
  }),
  duplicateBlock: (id) => set((s) => {
    const block = s.blocks.find((b) => b.id === id);
    if (!block) return s;
    const newBlock: VoxelBlock = {
      ...block,
      id: `block-${Date.now()}`,
      name: `${block.name}_copy`,
      position: [block.position[0] + 1, block.position[1], block.position[2]],
    };
    return {
      blocks: [...s.blocks, newBlock],
      selectedBlockIds: [newBlock.id],
      selectedBlockId: newBlock.id,
    };
  }),
  setShowGrid:          (v)  => set({ showGrid: v }),
  setShowWireframe:     (v)  => set({ showWireframe: v }),
  setActiveBlockType:   (t)  => set({ activeBlockType: t }),
  setActiveItemType:    (t)  => set({ activeItemType: t }),
  setActiveBlockColor:  (c)  => set({ activeBlockColor: c }),
  setProjectName:       (n)  => set({ projectName: n }),
  setProjectDescription:(d)  => set({ projectDescription: d }),
  setTargetPlatform:    (p)  => set({ targetPlatform: p }),
  setJavaModMode:       (m)  => set({ javaModMode: m }),
  setJavaTarget:        (t)  => set({ javaTarget: t }),
  setExportFormat:      (f)  => set({ exportFormat: f }),
  setExportArmed:       (v)  => set({ exportArmed: v }),
  setCompress:          (v)  => set({ compress: v }),
  setBetaApi:           (v)  => set({ betaApi: v }),
  setMcVersion:         (v)  => set({ mcVersion: v }),
  setGeneratedJsCode:   (code) => set({ generatedJsCode: code }),
  setGridSnap: (enabled, size) => set({ gridSnapEnabled: enabled, gridSnapSize: size ?? 1.0 }),
  createGroup: (name) => {
    const groupId = `group-${Date.now()}`;
    set((s) => ({
      groups: {
        ...s.groups,
        [groupId]: { id: groupId, name, createdAt: Date.now() },
      },
    }));
    return groupId;
  },
  assignToGroup: (blockIds, groupId) => set((s) => ({
    blocks: s.blocks.map((b) => blockIds.includes(b.id) ? {...b, groupId} : b),
  })),
  selectGroup: (groupId) => set((s) => {
    const blockIds = s.blocks.filter((b) => b.groupId === groupId).map((b) => b.id);
    return {
      selectedBlockIds: blockIds,
      selectedBlockId: blockIds[0] || null,
    };
  }),
  deleteGroup: (groupId) => set((s) => ({
    blocks: s.blocks.map((b) => b.groupId === groupId ? {...b, groupId: undefined} : b),
    groups: Object.fromEntries(Object.entries(s.groups).filter(([k]) => k !== groupId)),
  })),
  addAnimation: (blockId, animation) => set((s) => ({
    blocks: s.blocks.map((b) =>
      b.id === blockId
        ? {...b, animations: [...(b.animations || []), {...animation, id: `anim-${Date.now()}`}]}
        : b
    ),
  })),
  setKeyframe: (blockId, animationId, keyframe) => set((s) => ({
    blocks: s.blocks.map((b) =>
      b.id === blockId
        ? {
            ...b,
            animations: b.animations?.map((a) =>
              a.id === animationId
                ? {
                    ...a,
                    keyframes: [
                      ...a.keyframes.filter((k) => k.time !== keyframe.time),
                      keyframe,
                    ].sort((a, b) => a.time - b.time),
                  }
                : a
            ),
          }
        : b
    ),
  })),
  playAnimation: (blockId, animationId) => set((s) => ({
    blocks: s.blocks.map((b) =>
      b.id === blockId ? {...b, playingAnimation: animationId} : b
    ),
  })),
  stopAnimation: (blockId) => set((s) => ({
    blocks: s.blocks.map((b) =>
      b.id === blockId ? {...b, playingAnimation: undefined} : b
    ),
  })),
  addItem: (item) => set((s) => ({ items: [...s.items, item] })),
  removeItem: (id) => set((s) => ({
    items: s.items.filter((i) => i.id !== id),
    selectedItemIds: s.selectedItemIds.filter((iid) => iid !== id),
  })),
  updateItem: (id, partial) => set((s) => ({
    items: s.items.map((i) => i.id === id ? { ...i, ...partial } : i),
  })),
  selectItem: (id, append) => set((s) => {
    if (id === null) return { selectedItemIds: [] };
    const ids = Array.isArray(id) ? id : [id];
    if (append) {
      const newIds = Array.from(new Set([...s.selectedItemIds, ...ids]));
      return { selectedItemIds: newIds };
    } else {
      return { selectedItemIds: ids };
    }
  }),
  duplicateItem: (id) => set((s) => {
    const item = s.items.find((i) => i.id === id);
    if (!item) return s;
    const newItem: VoxelItem = {
      ...item,
      id: `item-${Date.now()}`,
      name: `${item.name}_copy`,
      position: [item.position[0] + 1, item.position[1], item.position[2]],
    };
    return {
      items: [...s.items, newItem],
      selectedItemIds: [newItem.id],
    };
  }),
}));
