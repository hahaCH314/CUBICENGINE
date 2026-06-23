/* ══════════════════════════════════════════════════════════
   groveTree.ts — GROVE「ドーナツ(if/loop)」の親子構造を導出する正本
   ──────────────────────────────────────────────────────────
   ドーナツの「穴の中に吸い込まれた」状態 = その制御の支配下（parentId+slot）。
   この構造導出を 1か所に集約し、
     ・GrapePanel(ヒマワリ) … ツリーの自動レイアウト
     ・grapeToCBlock(シオン) … Javaコード生成
   の双方が同じ構造を使うことで、見た目と生成のズレを防ぐ。
   ══════════════════════════════════════════════════════════ */

/** ドーナツの穴のどのスロットに入っているか。
 *  - if  : then(真/そうなら) / else(偽/ちがうなら)
 *  - loop: body(中身/くりかえす対象)            */
export type GroveSlot = "cond" | "then" | "else" | "body";

/** 構造導出に必要な最小ノード形。GrapePanel の Fruit も grapeToCBlock の Fruit も
 *  これを満たす（構造的部分型）ので、両者ともこの関数を使える。 */
export interface GroveNode {
  id: string;
  born: number;
  /** どのドーナツの中にいるか。未設定 / null = トップレベル（どの穴にも入っていない） */
  parentId?: string | null;
  /** ドーナツの穴のどのスロットか。parentId があるときのみ意味を持つ */
  slot?: GroveSlot | null;
}

export interface GroveStructure<T extends GroveNode> {
  /** トップレベル（どのドーナツにも入っていない）ノードを born（生成順）で */
  roots: T[];
  /** 指定ドーナツの指定スロットの子を born 順で返す */
  childrenOf: (parentId: string, slot: GroveSlot) => T[];
  /** そのノードが何か子を抱えているか（=ドーナツとして中身を持つか） */
  hasChildren: (parentId: string) => boolean;
}

const keyOf = (parentId: string, slot: GroveSlot) => `${parentId}::${slot}`;

/**
 * フラットなノード配列から親子構造を導出する。
 * parentId を一切持たない（旧フラット）配列を渡した場合、roots = 全ノード、
 * childrenOf は常に空 となり、呼び出し側で旧来の一本鎖として扱える（後方互換）。
 */
export function buildGroveStructure<T extends GroveNode>(nodes: T[]): GroveStructure<T> {
  const byBorn = [...nodes].sort((a, b) => a.born - b.born);

  const roots: T[] = [];
  const childMap = new Map<string, T[]>();
  const parentSet = new Set<string>();

  for (const n of byBorn) {
    if (n.parentId) {
      const slot: GroveSlot = n.slot ?? "then";
      const k = keyOf(n.parentId, slot);
      const arr = childMap.get(k);
      if (arr) arr.push(n);
      else childMap.set(k, [n]);
      parentSet.add(n.parentId);
    } else {
      roots.push(n);
    }
  }

  return {
    roots,
    childrenOf: (parentId, slot) => childMap.get(keyOf(parentId, slot)) ?? [],
    hasChildren: (parentId) => parentSet.has(parentId),
  };
}
