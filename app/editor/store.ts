import { create } from "zustand";

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
  exportFormat: "mcaddon" | "mcpack" | "zip";
  compress: boolean;
  mcVersion: "1.26.x" | "1.21.40+" | "1.21.0" | "1.20.x";
  packIconDataUrl: string;       // アドオンアイコン（data URL、空なら規定）

  generatedJsCode: string;
  logicGraphJson: string;

  setLogicGraphJson: (json: string) => void;
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
  setExportFormat: (f: "mcaddon" | "mcpack" | "zip") => void;
  setCompress: (v: boolean) => void;
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
  exportFormat: "mcaddon",
  compress: true,
  mcVersion: "1.26.x" as const,
  packIconDataUrl: "",

  generatedJsCode: "",
  logicGraphJson: "",

  setLogicGraphJson:  (json) => set({ logicGraphJson: json }),
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
  setExportFormat:      (f)  => set({ exportFormat: f }),
  setCompress:          (v)  => set({ compress: v }),
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
