import { CBlock } from '../app/editor/_types';
import { GAP, BW, BH, SNAP } from '../app/editor/_constants';

function blockH(b: CBlock): number {
  // 削除ボタン (top:3+22=25) を避けて label を marginTop:26 で下げる + 4px 隙間。
  // 各ブロック高さは +26 して下部のフィールド切れを防ぐ。
  if (b.type === "co_if") return 226; // 200 + 26
  if (b.fields.length === 0) return 101; // 75 + 26（フィールド無しコンパクト）
  return BH + 10 + b.fields.length * 26 + 10 + 26;
}

function getStackHeight(id: string | null, blocks: CBlock[]): number {
  if (!id) return 0;
  const b = blocks.find(x => x.id === id);
  if (!b) return 0;
  const h = blockH(b);
  if (b.type === "co_if" || b.type === "ct_rep") {
    const thenH = b.thenId ? getStackHeight(b.thenId, blocks) : 40;
    const elseH = b.type === "co_if" && b.elseId ? getStackHeight(b.elseId, blocks) : 0;
    const maxArmH = Math.max(thenH, elseH);
    return h + maxArmH + 45 + getStackHeight(b.nextId, blocks);
  }
  return h + GAP + getStackHeight(b.nextId, blocks);
}

function getDepth(id: string, blocks: CBlock[]): number {
  const b = blocks.find(x => x.id === id);
  if (!b) return 0;
  const p = blocks.find(x => x.nextId === id || x.thenId === id || x.elseId === id || x.innerId === id);
  if (!p) return 0;
  return getDepth(p.id, blocks) + 1;
}

/** ブロックのキャンバス上の位置を計算 */
function getPos(id: string, blocks: CBlock[]): { x: number; y: number } {
  const b = blocks.find(b => b.id === id);
  if (!b) return { x: 0, y: 0 };

  for (const p of blocks) {
    if (p.nextId === id) {
      if (p.type === "co_if" || p.type === "ct_rep") {
        // 条件分岐または繰り返しの親の場合、アームの最大高さ分だけ上に押し上げる
        const thenH = p.thenId ? getStackHeight(p.thenId, blocks) : 40;
        const elseH = p.type === "co_if" && p.elseId ? getStackHeight(p.elseId, blocks) : 0;
        const maxArmH = Math.max(thenH, elseH);
        return {
          x: getPos(p.id, blocks).x,
          y: getPos(p.id, blocks).y - maxArmH - 45 - blockH(b) - GAP
        };
      }
      return { x: getPos(p.id, blocks).x, y: getPos(p.id, blocks).y - blockH(b) - GAP };
    }
    if (p.innerId === id) return { x: getPos(p.id, blocks).x + BW + GAP, y: getPos(p.id, blocks).y };
    if (p.thenId === id) return { x: getPos(p.id, blocks).x, y: getPos(p.id, blocks).y - blockH(b) - GAP };
    if (p.elseId === id) return { x: getPos(p.id, blocks).x + BW + GAP + 120, y: getPos(p.id, blocks).y };
  }
  return { x: b.x, y: b.y };
}

/** このブロックを含む全子孫IDを返す */
function getFamily(id: string, blocks: CBlock[]): string[] {
  const b = blocks.find(b => b.id === id);
  if (!b) return [];
  const children = [b.nextId, b.innerId, b.thenId, b.elseId].filter(Boolean) as string[];
  return [id, ...children.flatMap(c => getFamily(c, blocks))];
}

/** 親からこのブロックを切り離す */
function detach(id: string, blocks: CBlock[]): CBlock[] {
  return blocks.map(b => ({
    ...b,
    nextId: b.nextId === id ? null : b.nextId,
    innerId: b.innerId === id ? null : b.innerId,
    thenId: b.thenId === id ? null : b.thenId,
    elseId: b.elseId === id ? null : b.elseId,
  }));
}

/** ブロックに接続する */
function attach(id: string, targetId: string, slot: string, blocks: CBlock[]): CBlock[] {
  return blocks.map(b => b.id !== targetId ? b : {
    ...b,
    nextId: slot === "next" ? id : b.nextId,
    innerId: slot === "inner" ? id : b.innerId,
    thenId: slot === "then" ? id : b.thenId,
    elseId: slot === "else" ? id : b.elseId,
  });
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** スナップ候補を探す（dragging ブロックのキャンバス中心座標から） */
function findSnap(
  draggingId: string,
  center: { x: number; y: number },
  blocks: CBlock[],
): { targetId: string; slot: string } | null {
  const family = getFamily(draggingId, blocks);
  const db = blocks.find(b => b.id === draggingId);
  const dh = db ? blockH(db) : BH;

  for (const target of blocks) {
    if (family.includes(target.id)) continue;
    const tp = getPos(target.id, blocks);

    // "next" スナップ（ターゲットの真上）
    if (!target.nextId) {
      if (target.type === "co_if" || target.type === "ct_rep") {
        const thenH = target.thenId ? getStackHeight(target.thenId, blocks) : 40;
        const elseH = target.type === "co_if" && target.elseId ? getStackHeight(target.elseId, blocks) : 0;
        const maxArmH = Math.max(thenH, elseH);
        const snap = { x: tp.x + BW / 2, y: tp.y - maxArmH - 45 - dh / 2 };
        if (dist(center, snap) < SNAP) return { targetId: target.id, slot: "next" };
      } else {
        const snap = { x: tp.x + BW / 2, y: tp.y - GAP - dh / 2 };
        if (dist(center, snap) < SNAP) return { targetId: target.id, slot: "next" };
      }
    }

    // 条件・繰り返し専用スナップ (inner, then, else)
    if (target.type === "co_if" || target.type === "ct_rep") {
      const isLoop = target.type === "ct_rep";
      if (isLoop) {
        // 繰り返しアームの中身は then スロットへ
        if (!target.thenId && dist(center, { x: tp.x + BW / 2, y: tp.y - GAP - dh / 2 }) < SNAP)
          return { targetId: target.id, slot: "then" };
      } else {
        // 条件分岐
        if (!target.innerId && dist(center, { x: tp.x + BW + GAP + BW / 2, y: tp.y + BH / 2 }) < SNAP)
          return { targetId: target.id, slot: "inner" };
        if (!target.thenId && dist(center, { x: tp.x + BW / 2, y: tp.y - GAP - dh / 2 }) < SNAP)
          return { targetId: target.id, slot: "then" };
        if (!target.elseId && dist(center, { x: tp.x + BW + GAP + 120 + BW / 2, y: tp.y - GAP - dh / 2 }) < SNAP)
          return { targetId: target.id, slot: "else" };
      }
    }
  }
  return null;
}

export { blockH, getStackHeight, getDepth, getPos, getFamily, detach, attach, dist, findSnap };
