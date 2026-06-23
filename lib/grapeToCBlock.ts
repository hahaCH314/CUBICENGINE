import type { CBlock, FieldDef, Category } from "../app/editor/_types";

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
}

/**
 * GROVE（Java版エディタ）の Fruit[] 構造を、積み木（SPROUT）共通の CBlock[] 構造へ変換する。
 * トリガーから始まる一本鎖（nextId 接続）を構築し、各アクションのテキスト入力を対応するフィールド値にマップする。
 */
export function grapeToCBlock(fruits: Fruit[]): CBlock[] {
  const blocks: CBlock[] = [];

  // トリガー（きっかけ）となる実を1つ取得
  const triggerFruit = fruits.find((f) => f.item.cat === "trigger");
  if (!triggerFruit) return [];

  // アクションの実（トリガー以外）を born 時間順にソートして収集
  const actionFruits = fruits
    .filter((f) => f.item.cat !== "trigger")
    .sort((a, b) => a.born - b.born);

  // 1. トリガーブロックの生成
  let triggerType = "ev_join";
  let triggerFields: FieldDef[] = [];

  if (triggerFruit.item.type === "on_break") {
    triggerType = "ev_break";
    triggerFields = [{ id: "block", label: "ブロック", value: "minecraft:stone" }];
  } else if (triggerFruit.item.type === "on_chat") {
    triggerType = "ev_chat";
    triggerFields = [{ id: "pat", label: "合言葉", value: triggerFruit.text || "" }];
  } else if (triggerFruit.item.type === "on_use") {
    triggerType = "ev_item";
    let it = (triggerFruit.text || "diamond").trim() || "diamond";
    if (!it.includes(":")) it = "minecraft:" + it;
    triggerFields = [{ id: "item", label: "アイテム", value: it }];
  } else if (triggerFruit.item.type === "on_hurt") {
    triggerType = "ev_hurt";
  } else if (triggerFruit.item.type === "on_tick") {
    triggerType = "ev_tick";
  }

  const triggerBlock: CBlock = {
    id: triggerFruit.id,
    type: triggerType,
    emoji: triggerFruit.item.emoji,
    label: triggerFruit.item.label,
    sublabel: "",
    category: "trigger",
    fields: triggerFields,
    x: triggerFruit.x,
    y: triggerFruit.y,
    nextId: actionFruits.length > 0 ? actionFruits[0].id : null,
    innerId: null,
    thenId: null,
    elseId: null,
  };
  blocks.push(triggerBlock);

  // 2. アクション・条件ブロックの生成と一本鎖接続
  actionFruits.forEach((f, index) => {
    let type = "ac_msg";
    let category: Category = "action";
    let fields: FieldDef[] = [];
    let innerId: string | null = null;

    const nextId = index < actionFruits.length - 1 ? actionFruits[index + 1].id : null;

    if (f.item.type === "say") {
      type = "ac_msg";
      category = "action";
      fields = [
        { id: "msg", label: "メッセージ", value: f.text || "こんにちは！" },
        { id: "target", label: "対象", value: "@a" }
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
          if (!item.includes(":")) {
            item = "minecraft:" + item;
          }
          if (m[2]) {
            count = m[2];
          }
        }
      }
      fields = [
        { id: "item", label: "アイテム", value: item },
        { id: "count", label: "個数", value: count }
      ];
    } else if (f.item.type === "effect") {
      type = "ac_effect";
      category = "action";
      fields = [
        { id: "eff", label: "効果", value: "minecraft:speed" },
        { id: "dur", label: "秒数", value: "10" }
      ];
    } else if (f.item.type === "tp") {
      type = "ac_tp";
      category = "action";
      const parts = (f.text || "").trim().split(/[\s,]+/).filter(Boolean);
      fields = [
        { id: "x", label: "X", value: parts[0] ?? "0" },
        { id: "y", label: "Y", value: parts[1] ?? "64" },
        { id: "z", label: "Z", value: parts[2] ?? "0" }
      ];
    } else if (f.item.type === "title") {
      type = "ac_title";
      category = "action";
      fields = [
        { id: "title", label: "タイトル", value: f.text || "クリア！" },
        { id: "sub", label: "サブ", value: "" }
      ];
    } else if (f.item.type === "sound") {
      type = "ac_sound";
      category = "action";
      fields = [
        { id: "snd", label: "音", value: (f.text || "random.levelup").trim() || "random.levelup" },
        { id: "vol", label: "音量", value: "1" }
      ];
    } else if (f.item.type === "command") {
      type = "ac_cmd";
      category = "action";
      fields = [{ id: "cmd", label: "コマンド", value: f.text || "say hi" }];
    } else if (f.item.type === "if") {
      type = "co_if";
      category = "ifelse";
      
      // 条件用の子ブロックを生成して紐付け
      const condId = `${f.id}_cond`;
      let condType = "co_night"; // デフォルト
      
      const txt = f.text || "";
      if (txt.includes("雨")) {
        condType = "co_rain";
      } else if (txt.includes("スニーク") || txt.includes("しゃがむ")) {
        condType = "co_sneak";
      } else if (txt.includes("夜")) {
        condType = "co_night";
      }

      const condBlock: CBlock = {
        id: condId,
        type: condType,
        emoji: "🔍",
        label: f.text || "条件",
        sublabel: "",
        category: "value",
        fields: [],
        x: f.x,
        y: f.y - 40,
        nextId: null,
        innerId: null,
        thenId: null,
        elseId: null,
      };
      blocks.push(condBlock);
      innerId = condId;
    } else if (f.item.type === "repeat") {
      type = "ct_rep";
      category = "loop";
      
      const numMatch = f.text ? f.text.match(/\d+/) : null;
      const count = numMatch ? numMatch[0] : "3";
      fields = [{ id: "n", label: "回数", value: count }];
    } else if (f.item.type === "number") {
      type = "va_num";
      category = "value";
      fields = [{ id: "v", label: "値", value: f.text || "10" }];
    }

    const block: CBlock = {
      id: f.id,
      type,
      emoji: f.item.emoji,
      label: f.item.label,
      sublabel: "",
      category,
      fields,
      x: f.x,
      y: f.y,
      nextId,
      innerId,
      thenId: null,
      elseId: null,
    };
    blocks.push(block);
  });

  // 「もし〜なら」修正：co_if は後続チェーンを thenId に取り込み、条件で実行される中身にする。
  // （旧版は if が innerId の条件だけ持ち、後続は nextId で無条件実行されていた＝条件が効かない）
  for (const b of blocks) {
    if (b.type === "co_if" && b.nextId && !b.thenId) {
      b.thenId = b.nextId;
      b.nextId = null;
    }
  }

  return blocks;
}
