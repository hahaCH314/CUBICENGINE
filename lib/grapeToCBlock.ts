import type { CBlock, FieldDef, Category } from "../app/editor/_types";
import { buildGroveStructure, type GroveSlot } from "./groveTree";

export interface Fruit {
  id: string;
  item: {
    type: string;
    label: string;
    emoji: string;
    cat: string;
    needsText: boolean;
    placeholder: string;
  };
  text: string;
  born: number;
  x: number;
  y: number;
  /** ドーナツ(if/loop)の中に吸い込まれている場合の親id。未設定/null = トップレベル */
  parentId?: string | null;
  /** ドーナツの穴のどのスロットか。if: then(真)/else(偽)、loop: body(中身)。詳細は lib/groveTree.ts */
  slot?: GroveSlot | null;
}

/** トリガー（きっかけ）の実 → CBlock。鎖(nextId/thenId/elseId)は後段で結線するので null。 */
function buildTriggerBlock(f: Fruit): CBlock {
  let type = "ev_join";
  let fields: FieldDef[] = [];

  if (f.item.type === "on_break") {
    type = "ev_break";
    fields = [{ id: "block", label: "ブロック", value: "minecraft:stone" }];
  } else if (f.item.type === "on_chat") {
    type = "ev_chat";
    fields = [{ id: "pat", label: "合言葉", value: f.text || "" }];
  } else if (f.item.type === "on_use") {
    type = "ev_item";
    let it = (f.text || "diamond").trim() || "diamond";
    if (!it.includes(":")) it = "minecraft:" + it;
    fields = [{ id: "item", label: "アイテム", value: it }];
  } else if (f.item.type === "on_hurt") {
    type = "ev_hurt";
  } else if (f.item.type === "on_tick") {
    type = "ev_tick";
  }

  return {
    id: f.id, type, emoji: f.item.emoji, label: f.item.label, sublabel: "",
    category: "trigger", fields, x: f.x, y: f.y,
    nextId: null, innerId: null, thenId: null, elseId: null,
  };
}

/** アクション／制御の実 → CBlock。if の条件ブロック等は extra で返す。鎖は後段で結線。 */
function buildActionBlock(f: Fruit): { block: CBlock; extra: CBlock[] } {
  let type = "ac_msg";
  let category: Category = "action";
  let fields: FieldDef[] = [];
  let innerId: string | null = null;
  const extra: CBlock[] = [];

  if (f.item.type === "say") {
    type = "ac_msg";
    category = "action";
    fields = [
      { id: "msg", label: "メッセージ", value: f.text || "こんにちは！" },
      { id: "target", label: "対象", value: "@a" },
    ];
  } else if (f.item.type === "give") {
    type = "ac_give";
    category = "action";
    let item = "minecraft:diamond";
    let count = "1";
    if (f.text) {
      const m = f.text.trim().match(/^([a-zA-Z0-9_:-]+)(?:\s*[xX×\s]\s*(\d+))?$/);
      if (m) {
        item = m[1];
        if (!item.includes(":")) item = "minecraft:" + item;
        if (m[2]) count = m[2];
      }
    }
    fields = [
      { id: "item", label: "アイテム", value: item },
      { id: "count", label: "個数", value: count },
    ];
  } else if (f.item.type === "effect") {
    type = "ac_effect";
    category = "action";
    fields = [
      { id: "eff", label: "効果", value: "minecraft:speed" },
      { id: "dur", label: "秒数", value: "10" },
    ];
  } else if (f.item.type === "tp") {
    type = "ac_tp";
    category = "action";
    const parts = (f.text || "").trim().split(/[\s,]+/).filter(Boolean);
    fields = [
      { id: "x", label: "X", value: parts[0] ?? "0" },
      { id: "y", label: "Y", value: parts[1] ?? "64" },
      { id: "z", label: "Z", value: parts[2] ?? "0" },
    ];
  } else if (f.item.type === "title") {
    type = "ac_title";
    category = "action";
    fields = [
      { id: "title", label: "タイトル", value: f.text || "クリア！" },
      { id: "sub", label: "サブ", value: "" },
    ];
  } else if (f.item.type === "sound") {
    type = "ac_sound";
    category = "action";
    fields = [
      { id: "snd", label: "音", value: (f.text || "random.levelup").trim() || "random.levelup" },
      { id: "vol", label: "音量", value: "1" },
    ];
  } else if (f.item.type === "command") {
    type = "ac_cmd";
    category = "action";
    fields = [{ id: "cmd", label: "コマンド", value: f.text || "say hi" }];
  } else if (f.item.type === "if") {
    type = "co_if";
    category = "ifelse";
    // 条件用の子ブロック（穴の中の条件）を生成して innerId に紐付け
    const condId = `${f.id}_cond`;
    let condType = "co_night";
    const txt = f.text || "";
    if (txt.includes("雨")) condType = "co_rain";
    else if (txt.includes("スニーク") || txt.includes("しゃがむ")) condType = "co_sneak";
    else if (txt.includes("夜")) condType = "co_night";
    extra.push({
      id: condId, type: condType, emoji: "🔍", label: f.text || "条件", sublabel: "",
      category: "value", fields: [], x: f.x, y: f.y - 40,
      nextId: null, innerId: null, thenId: null, elseId: null,
    });
    innerId = condId;
  } else if (f.item.type === "repeat") {
    type = "ct_rep";
    category = "loop";
    const numMatch = f.text ? f.text.match(/\d+/) : null;
    fields = [{ id: "n", label: "回数", value: numMatch ? numMatch[0] : "3" }];
  } else if (f.item.type === "number") {
    type = "va_num";
    category = "value";
    fields = [{ id: "v", label: "値", value: f.text || "10" }];
  }

  const block: CBlock = {
    id: f.id, type, emoji: f.item.emoji, label: f.item.label, sublabel: "",
    category, fields, x: f.x, y: f.y,
    nextId: null, innerId, thenId: null, elseId: null,
  };
  return { block, extra };
}

/**
 * GROVE（Java版エディタ）の Fruit[] を、積み木（SPROUT）共通の CBlock[] へ変換する。
 *
 * 構造は lib/groveTree.ts に集約：
 *   ・トップレベル(parentId なし)の実 … トリガーから born 順の一本鎖（nextId）
 *   ・ドーナツ(if/loop)の穴の中の実 … 親の slot に応じて結線
 *       if   : slot=then→thenId(真) / slot=else→elseId(偽)   ※条件は innerId
 *       loop : slot=body→thenId(中身)                          ※回数はフィールド n
 *   ・入れ子（ドーナツの中のドーナツ）も同じ規則で再帰的に成立。
 *
 * 後方互換：どの実も parentId を持たない（穴に吸い込む UI 未実装の）間は、
 *   従来どおり「if 以降の後続を thenId に取り込む」フォールバックで現状動作を維持する。
 */
export function grapeToCBlock(fruits: Fruit[]): CBlock[] {
  const triggerFruit = fruits.find((f) => f.item.cat === "trigger");
  if (!triggerFruit) return [];

  const blocks: CBlock[] = [];
  const blockById = new Map<string, CBlock>();

  // 1. 全ブロック生成（鎖はまだ張らない）
  const triggerBlock = buildTriggerBlock(triggerFruit);
  blocks.push(triggerBlock);
  blockById.set(triggerBlock.id, triggerBlock);

  const actionFruits = fruits.filter((f) => f.item.cat !== "trigger");
  for (const f of actionFruits) {
    const { block, extra } = buildActionBlock(f);
    blocks.push(block);
    blockById.set(block.id, block);
    for (const e of extra) blocks.push(e);
  }

  // 2. 構造導出（正本）
  const structured = fruits.some((f) => !!f.parentId);
  const struct = buildGroveStructure(fruits);

  // 同一スロット内の兄弟を born 順に nextId で連結し、先頭idを返す
  const chain = (list: Fruit[]): string | null => {
    if (list.length === 0) return null;
    for (let i = 0; i < list.length; i++) {
      const b = blockById.get(list[i].id);
      if (b) b.nextId = i < list.length - 1 ? list[i + 1].id : null;
    }
    return list[0].id;
  };

  // 3. トップレベル鎖：トリガー → ルートのアクション群（born 順）
  const rootActions = struct.roots
    .filter((f) => f.item.cat !== "trigger")
    .sort((a, b) => a.born - b.born);
  triggerBlock.nextId = chain(rootActions);

  // 4. 各ドーナツの穴の中を結線
  for (const f of actionFruits) {
    const b = blockById.get(f.id);
    if (!b) continue;
    if (b.type === "co_if") {
      b.thenId = chain(struct.childrenOf(f.id, "then"));
      b.elseId = chain(struct.childrenOf(f.id, "else"));
    } else if (b.type === "ct_rep") {
      b.thenId = chain(struct.childrenOf(f.id, "body"));
    }
  }

  // 5. 後方互換フォールバック：parentId 未使用なら、従来どおり if は後続を then に取り込む
  //    （旧版は if が条件だけ持ち後続が無条件実行されていた＝条件が効かないバグの回避）
  if (!structured) {
    for (const b of blocks) {
      if (b.type === "co_if" && b.nextId && !b.thenId) {
        b.thenId = b.nextId;
        b.nextId = null;
      }
    }
  }

  return blocks;
}
