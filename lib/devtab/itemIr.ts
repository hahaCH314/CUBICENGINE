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

/**
 * 殴った相手に起きること。
 *
 * ⚠️ ここは JSON だけで書ける範囲に絞ってある。
 *    「炎の玉を飛ばす」のような**自分で描く演出**はスクリプトが要る。
 *    バニラの効果を借りる形なら、実験的機能をオンにしなくても動く。
 */
export interface WeaponEffect {
  /** マイクラ側の効果ID。"poison" "wither" "slowness" など */
  id: string;
  /** 効果が続く秒数 */
  seconds: number;
  /** 強さ。0 が I、1 が II。バニラの表記より1小さいので注意 */
  amplifier: number;
}

/**
 * 武器の設定。
 *
 * ツルハシや斧はまだ扱わない。あれらは「どのブロックを速く掘れるか」を
 * ブロックの種類ごとに書く必要があり、剣より一段複雑になる。
 */
export interface ItemWeapon {
  /** 与えるダメージ。素手が1、木の剣が4、ダイヤの剣が7 */
  damage: number;
  /**
   * 耐久値。木の剣が59、ダイヤの剣が1561。
   * **0 なら壊れない武器**になる（minecraft:durability を出さない）。
   */
  durability: number;
  /**
   * 殴った相手に付く効果。空なら何も起きない。
   * 複数入れれば同時に掛かる（毒＋炎 など）。
   */
  effects: WeaponEffect[];
  /** 殴った相手を燃やす秒数。0 なら燃やさない */
  fireSeconds: number;
  /**
   * 持っている間ずっと自分に掛かる効果。空なら無し。
   * 「持つと足が速くなる剣」のような、装備そのものを強くする作り。
   */
  selfEffects: WeaponEffect[];
}

/**
 * 効果の一覧。UI の選択肢と、書き出し時の検査に使う。
 * ⚠️ ここに無いIDを書くと**マイクラが黙って無視する**（エラーも出ない）ので、
 *    自由入力にせず必ずこの中から選ばせること。
 */
export const WEAPON_EFFECTS = [
  { id: "poison", label: "毒", forSelf: false },
  { id: "wither", label: "衰弱", forSelf: false },
  { id: "slowness", label: "移動が遅くなる", forSelf: false },
  { id: "weakness", label: "攻撃力が下がる", forSelf: false },
  { id: "blindness", label: "目が見えなくなる", forSelf: false },
  { id: "nausea", label: "吐き気", forSelf: false },
  { id: "levitation", label: "浮き上がる", forSelf: false },
  { id: "speed", label: "足が速くなる", forSelf: true },
  { id: "strength", label: "力が上がる", forSelf: true },
  { id: "regeneration", label: "体力が回復し続ける", forSelf: true },
  { id: "resistance", label: "受けるダメージが減る", forSelf: true },
  { id: "jump_boost", label: "高く跳べる", forSelf: true },
  { id: "fire_resistance", label: "炎で燃えない", forSelf: true },
  { id: "night_vision", label: "暗いところが見える", forSelf: true },
  { id: "haste", label: "採掘が速くなる", forSelf: true },
  { id: "absorption", label: "黄色いハートが増える", forSelf: true },
] as const;

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
   * 食べ物にするか。null なら食べ物ではない。
   * 分けているのは、食べ物にしたときだけ要る設定があるため。
   */
  food: ItemFood | null;
  /**
   * 剣にするか。null なら武器ではない。
   * ⚠️ food と両方 null でないのは許さない（validateItem で弾く）。
   *    食べられる剣は作れるが、持ち替えるたびに食べる動作が出て使い物にならない。
   */
  weapon: ItemWeapon | null;
}

export function defaultWeapon(): ItemWeapon {
  // 鉄の剣くらいの強さ。木より強く、ダイヤほどではない手頃な値。
  // 効果は空から始める。最初から毒が付いていると、外し方を探すことになる
  return { damage: 6, durability: 250, effects: [], fireSeconds: 0, selfEffects: [] };
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
    weapon: null,
  };
}

/** 出す前に確かめる。ここで止めればマイクラ側で無言の読み込み失敗を防げる */
export function validateItem(item: ItemIR): string[] {
  const problems: string[] = [];
  if (!/^[a-z0-9_]+$/.test(item.id)) problems.push(`内部名「${item.id}」に使えない文字が含まれています`);
  // 数字始まりはマイクラが受け付けない。モブと同じ理由（toIdentifier のコメント参照）
  if (/^[0-9]/.test(item.id)) problems.push(`内部名「${item.id}」は数字で始められません（名前を英字から始めてください）`);
  if (!item.iconDataUrl) problems.push("アイコンの画像がありません");
  if (item.maxStack < 1 || item.maxStack > 64) problems.push("重ねられる数は 1〜64 にしてください");
  if (item.food && item.weapon) {
    problems.push("食べ物と剣は同時にできません（持ち替えるたびに食べる動作が出てしまいます）");
  }
  if (item.weapon) {
    if (item.weapon.damage < 1) problems.push("攻撃力は1以上にしてください");
    // 0 は「壊れない武器」として通す。負の値だけ弾く
    if (item.weapon.durability < 0) problems.push("耐久値は0以上にしてください（0にすると壊れなくなります）");
    // 耐久値のある道具は重ねられない。マイクラの仕様
    if (item.maxStack !== 1) problems.push("剣は重ねられません（重ねる数を1にしてください）");
    // ⚠️ ?? を通すこと。この機能より前に保存された作品には無いフィールドで、
    //    そのまま比べると保存済みの作品が「壊れている」扱いになる
    if ((item.weapon.fireSeconds ?? 0) < 0) problems.push("燃やす秒数は0以上にしてください");

    const known = new Set<string>(WEAPON_EFFECTS.map(e => e.id));
    for (const list of [item.weapon.effects ?? [], item.weapon.selfEffects ?? []]) {
      for (const e of list) {
        // ⚠️ 知らないIDはマイクラが**黙って無視する**。エラーも出ないので、
        //    「効果が付かない」原因を探して延々悩むことになる。ここで止める
        if (!known.has(e.id)) problems.push(`「${e.id}」は使えない効果です`);
        if (e.seconds <= 0) problems.push("効果の秒数は1以上にしてください");
        // 255段階まで。それ以上はマイクラが受け付けない
        if (e.amplifier < 0 || e.amplifier > 255) problems.push("効果の強さは 0〜255 にしてください");
      }
    }
  }
  if (item.food) {
    if (item.food.nutrition < 0) problems.push("回復量は0以上にしてください");
    if (item.food.useDuration <= 0) problems.push("食べる時間は0より大きくしてください");
    // 食べ物なのに1個しか持てないと、作った本人が意図していない可能性が高い
    if (item.maxStack === 1) problems.push("食べ物なのに重ねられません（重ねる数を増やすか、そのままでよいか確認してください）");
  }
  return problems;
}
