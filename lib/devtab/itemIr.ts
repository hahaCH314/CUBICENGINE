/**
 * アイテムの中間表現。
 *
 * **MobIR とは別物にしてある。** モブは3Dモデル・ボーン・アニメを持つが、
 * アイテムは1枚の絵でしかない。無理に共通化すると、どちらにも要らない
 * フィールドが増えて分かりにくくなる。共通なのは「識別子」と「表示名」だけ。
 *
 * ここも UI を import しない。
 */

import { toIdentifier } from "./ir";

export const ITEM_IR_SCHEMA_VERSION = 1;

/** 食べたときの効果 */
export interface ItemFood {
  /** 回復する満腹度。1 = 肉半分 */
  nutrition: number;
  /**
   * 隠しステータス。満腹度の持ちの良さに効く。
   * バニラだと りんご0.3 / ステーキ0.8 くらい。
   */
  saturation: number;
  /** 食べ終わるまでの秒数。バニラはほぼ 1.6 */
  useDuration: number;
  /** 満腹でも食べられるか（金のリンゴのような扱い） */
  canAlwaysEat: boolean;
}

export interface ItemIR {
  schema: typeof ITEM_IR_SCHEMA_VERSION;
  /** 英数字と _ のみ。マイクラの識別子になる */
  id: string;
  /** 画面とゲーム内に出る名前。日本語可 */
  displayName: string;
  /** アイコン。data:image/png;base64,... 16x16 を想定するが強制はしない */
  iconDataUrl: string;
  /** 何個まで重ねられるか。1〜64 */
  maxStack: number;
  /**
   * 食べ物にするか。null なら「見た目だけのアイテム」。
   * 分けているのは、食べ物にしたときだけ要る設定があるため。
   */
  food: ItemFood | null;
}

export function defaultFood(): ItemFood {
  return { nutrition: 4, saturation: 0.3, useDuration: 1.6, canAlwaysEat: false };
}

/**
 * アイテムを1つ作る。
 *
 * ⚠️ existingIds を必ず渡すこと。日本語だけの名前は識別子に使える文字が
 *    1つも残らず、全部 custom_item に潰れる。渡さないと2個目以降が
 *    1個目を上書きし、作ったはずのアイテムが消える（実際にそうなった）。
 */
export function makeItem(displayName: string, iconDataUrl: string, existingIds: readonly string[] = []): ItemIR {
  let id = toIdentifier(displayName, "custom_item");
  if (existingIds.includes(id)) {
    let n = 2;
    while (existingIds.includes(`${id}_${n}`)) n++;
    id = `${id}_${n}`;
  }
  return {
    schema: ITEM_IR_SCHEMA_VERSION,
    id,
    displayName,
    iconDataUrl,
    maxStack: 64,
    food: null,
  };
}

/** 出す前に確かめる。ここで止めればマイクラ側で無言の読み込み失敗を防げる */
export function validateItem(item: ItemIR): string[] {
  const problems: string[] = [];
  if (!/^[a-z0-9_]+$/.test(item.id)) problems.push(`内部名「${item.id}」に使えない文字が含まれています`);
  if (!item.iconDataUrl) problems.push("アイコンの画像がありません");
  if (item.maxStack < 1 || item.maxStack > 64) problems.push("重ねられる数は 1〜64 にしてください");
  if (item.food) {
    if (item.food.nutrition < 0) problems.push("回復量は0以上にしてください");
    if (item.food.useDuration <= 0) problems.push("食べる時間は0より大きくしてください");
    // 食べ物なのに1個しか持てないと、作った本人が意図していない可能性が高い
    if (item.maxStack === 1) problems.push("食べ物なのに重ねられません（重ねる数を増やすか、そのままでよいか確認してください）");
  }
  return problems;
}
