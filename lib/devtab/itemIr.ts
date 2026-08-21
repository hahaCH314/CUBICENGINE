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
 * 道具の種類。
 *
 * マイクラの道具は「殴れて掘れるもの」で、違いは
 *   ① 何を速く掘れるか（destroy_speeds）
 *   ② どのブロックを「正しい道具で壊した」ことにするか
 * の2点しかない。剣もこの仲間で、クモの巣だけを速く壊せる道具として扱う。
 */
export type ToolKind = "sword" | "pickaxe" | "axe" | "shovel" | "hoe";

/**
 * 種類ごとの掘れるブロック。
 *
 * ⚠️ `tag` はブロックを1つずつ書かずに済むマイクラ側の仕組み。
 *    石を全部並べるのは現実的でないので、これを使う。
 *    ここに嘘のタグを書くと**アイテムごと読み込まれない**ので、
 *    バニラに実在するものだけを書くこと。
 */
export const TOOL_KINDS: {
  id: ToolKind;
  label: string;
  hint: string;
  /** クリエイティブのどのタブに出すか */
  category: string;
  /** エンチャント枠の名前 */
  enchantSlot: string;
  /** 速く掘れる対象（マイクラのブロックタグ） */
  tags: string[];
}[] = [
  // ⚠️ category は itemGroup.name.sword だけを使う。
  //    itemGroup.name.pickaxe のような名前が実在するか確証が無く、存在しない
  //    タブ名を書くとクリエイティブの持ち物から**探せなくなる**（過去に
  //    アイテムが見つからない事故を起こしている）。sword は実績があり、
  //    道具はどれも「装備」タブに並ぶので探すのに困らない。
  {
    id: "sword", label: "剣", hint: "戦うための道具。クモの巣を速く切れます",
    category: "itemGroup.name.sword", enchantSlot: "sword",
    tags: ["'minecraft:web'"],
  },
  {
    id: "pickaxe", label: "ツルハシ", hint: "石・鉱石を掘ります",
    category: "itemGroup.name.sword", enchantSlot: "pickaxe",
    tags: ["q.any_tag('stone', 'metal', 'diamond_pick_diggable', 'iron_pick_diggable', 'gold_pick_diggable', 'stone_pick_diggable')"],
  },
  {
    id: "axe", label: "斧", hint: "木を切ります。攻撃力も高めです",
    category: "itemGroup.name.sword", enchantSlot: "axe",
    tags: ["q.any_tag('wood', 'pumpkin', 'plant')"],
  },
  {
    id: "shovel", label: "シャベル", hint: "土・砂・雪を掘ります",
    category: "itemGroup.name.sword", enchantSlot: "shovel",
    tags: ["q.any_tag('sand', 'dirt', 'gravel', 'grass', 'snow')"],
  },
  {
    id: "hoe", label: "クワ", hint: "葉・草を刈ります。畑も作れます",
    category: "itemGroup.name.sword", enchantSlot: "hoe",
    tags: ["q.any_tag('leaves', 'plant', 'vine_damage')"],
  },
];

/**
 * 武器・道具の設定。
 *
 * 剣もツルハシも同じ型で扱う。違いは kind と、そこから決まる
 * 「何を速く掘れるか」だけなので、別の型に分けると設定がまるごと二重になる。
 */
export interface ItemWeapon {
  /**
   * 道具の種類。無いときは剣として扱う（この項目より前に保存された作品のため）。
   */
  kind?: ToolKind;
  /**
   * 掘る速さ。大きいほど速い。ダイヤのツルハシで 8 くらい。
   * 剣では使わない。
   */
  digSpeed?: number;
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
  /** 防具にするか。null なら防具ではない */
  armor: ItemArmor | null;
  /**
   * 右クリック（長押し）で出す技。null なら技を持たない。
   * 武器にも防具にも、ただのアイテムにも付けられる。
   */
  skill: ItemSkill | null;
}

/** どこに着るか。マイクラのスロット名にそのまま対応する */
export type ArmorSlot = "head" | "chest" | "legs" | "feet";

export const ARMOR_SLOTS: { id: ArmorSlot; label: string; example: string }[] = [
  { id: "head", label: "かぶと", example: "ダイヤ3" },
  { id: "chest", label: "むねあて", example: "ダイヤ8" },
  { id: "legs", label: "ズボン", example: "ダイヤ6" },
  { id: "feet", label: "くつ", example: "ダイヤ3" },
];

export interface ItemArmor {
  slot: ArmorSlot;
  /** 防御力。ダイヤ一式で20 */
  protection: number;
  /** 耐久値。0 なら壊れない */
  durability: number;
  /**
   * 着ている間ずっと掛かる効果。
   * 武器の selfEffects と同じ仕組みで、見る場所が手ではなく防具スロットになる。
   */
  wearEffects: WeaponEffect[];
}

/**
 * 右クリックで出す技。
 *
 * ⚠️ ここは **JSON では絶対に作れない**。スクリプト専用。
 *    itemUse イベントを拾って、その場で効果を起こす。
 */
export type SkillKind =
  /** まわりの敵をまとめて殴る */
  | "shockwave"
  /** 自分を回復する */
  | "heal"
  /** 見ている方向へ飛ぶ */
  | "dash"
  /** まわりの敵を吹き飛ばす */
  | "knockback"
  /** 雷を落とす */
  | "lightning";

export const SKILL_KINDS: { id: SkillKind; label: string; hint: string; hasPower: boolean; hasRange: boolean }[] = [
  { id: "shockwave", label: "衝撃波", hint: "まわりの敵をまとめて攻撃します", hasPower: true, hasRange: true },
  { id: "lightning", label: "雷を落とす", hint: "見ている場所に雷が落ちます", hasPower: false, hasRange: true },
  { id: "knockback", label: "吹き飛ばす", hint: "まわりの敵を空へ飛ばします", hasPower: true, hasRange: true },
  { id: "heal", label: "回復する", hint: "自分の体力を回復します", hasPower: true, hasRange: false },
  { id: "dash", label: "飛ぶ", hint: "見ている方向へ勢いよく飛びます", hasPower: true, hasRange: false },
];

export interface ItemSkill {
  kind: SkillKind;
  /** 威力。技によって意味が変わる（ダメージ量／回復量／飛ぶ勢い） */
  power: number;
  /** 効く範囲（ブロック数）。範囲を持たない技では使わない */
  range: number;
  /** 次に使えるまでの秒数。0 なら連打できる */
  cooldownSeconds: number;
}

export function defaultWeapon(kind: ToolKind = "sword"): ItemWeapon {
  // 鉄の道具くらいの強さ。木より強く、ダイヤほどではない手頃な値。
  // 効果は空から始める。最初から毒が付いていると、外し方を探すことになる
  return {
    kind,
    // 剣は攻撃寄り、ツルハシ等は掘る寄りの既定値にする。
    // 種類を選んだ直後に「それらしい数字」が入っているほうが分かりやすい
    damage: kind === "sword" ? 6 : kind === "axe" ? 8 : 3,
    durability: 250,
    digSpeed: 8,
    effects: [],
    fireSeconds: 0,
    selfEffects: [],
  };
}

export function defaultFood(): ItemFood {
  return { nutrition: 4, saturation: 0.3, useDuration: 1.6, canAlwaysEat: false };
}

export function defaultArmor(): ItemArmor {
  // ダイヤのむねあてくらい。着替えの効果が分かる程度の強さ
  return { slot: "chest", protection: 8, durability: 400, wearEffects: [] };
}

export function defaultSkill(): ItemSkill {
  // 衝撃波。一番「技らしい」ので最初に出す。
  // クールダウン1秒は入れておく。0だと押しっぱなしで連発され、何が起きたか分からない
  return { kind: "shockwave", power: 10, range: 5, cooldownSeconds: 1 };
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
    armor: null,
    skill: null,
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
  // 種類はひとつだけ。組み合わせると、どれかの動作が邪魔をして使い物にならない
  const kinds = [item.food && "食べ物", item.weapon && "道具", item.armor && "防具"].filter(Boolean);
  if (kinds.length > 1) {
    problems.push(`${kinds.join("と")}は同時にできません（どれか1つにしてください）`);
  }

  if (item.armor) {
    if (item.armor.protection < 0) problems.push("防御力は0以上にしてください");
    if (item.armor.durability < 0) problems.push("耐久値は0以上にしてください（0にすると壊れなくなります）");
    if (item.maxStack !== 1) problems.push("防具は重ねられません（重ねる数を1にしてください）");
    const known = new Set<string>(WEAPON_EFFECTS.map(e => e.id));
    for (const e of item.armor.wearEffects ?? []) {
      if (!known.has(e.id)) problems.push(`「${e.id}」は使えない効果です`);
      if (e.amplifier < 0 || e.amplifier > 255) problems.push("効果の強さは 1〜256 にしてください");
    }
  }

  if (item.skill) {
    if (item.skill.power < 0) problems.push("技の威力は0以上にしてください");
    if (item.skill.range < 0) problems.push("技の範囲は0以上にしてください");
    if (item.skill.cooldownSeconds < 0) problems.push("技のクールダウンは0以上にしてください");
  }
  if (item.weapon) {
    if (item.weapon.damage < 1) problems.push("攻撃力は1以上にしてください");
    // 0 は「壊れない武器」として通す。負の値だけ弾く
    if (item.weapon.durability < 0) problems.push("耐久値は0以上にしてください（0にすると壊れなくなります）");
    // 耐久値のある道具は重ねられない。マイクラの仕様
    if (item.maxStack !== 1) problems.push("道具は重ねられません（重ねる数を1にしてください）");
    if ((item.weapon.digSpeed ?? 8) < 0) problems.push("掘る速さは0以上にしてください");
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
