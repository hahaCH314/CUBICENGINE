"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useEditorStore } from "./store";
import { McButton, McBadge } from "../_mc";

/* ══════════════════════════════════════════════════════════
   型定義
   ══════════════════════════════════════════════════════════ */

type Category = "trigger" | "action" | "ifelse" | "value" | "loop" | "calc" | "ui" | "variable";

interface FieldDef { id: string; label: string; value: string; options?: string[] }

/** ワイヤーなし・チェーン式ブロック */
interface CBlock {
  id: string; type: string; emoji: string; label: string; sublabel: string;
  category: Category; fields: FieldDef[];
  x: number; y: number;      // フリー時の位置
  nextId:  string | null;    // 下につながるブロック
  innerId: string | null;    // ドーナツの穴の中（条件ブロック）
  thenId:  string | null;    // そうなら先頭ブロック
  elseId:  string | null;    // ちがうなら先頭ブロック
}

/* ══════════════════════════════════════════════════════════
   サイズ定数
   ══════════════════════════════════════════════════════════ */

const BW   = 180;   // ブロック幅 (160から180に広げて文字領域を確保)
const BH   = 60;    // 基本高さ
const GAP  = 0;     // ブロック間ギャップ (0 = 密着積み)
const SNAP = 60;    // スナップ検知距離

/* ══════════════════════════════════════════════════════════
   カテゴリカラー (マイクラブロックテーマ)
   ══════════════════════════════════════════════════════════ */

interface CatDef {
  bg: string;
  top: string;
  side: string;
  border: string;
  text: string;
  accent: string;
  icon: string;
  label: string;
}

const CAT: Record<Category, CatDef> = {
  trigger:  { bg: "#ff4757", top: "#ff6b81", side: "#d93847", border: "#7d121c", text: "#ffffff", accent: "#ffeaa7", icon: "⚡", label: "イベント" },
  action:   { bg: "#2e86de", top: "#54a0ff", side: "#1b62ab", border: "#0b396b", text: "#ffffff", accent: "#74b9ff", icon: "🎯", label: "アクション" },
  ifelse:   { bg: "#10ac84", top: "#1dd1a1", side: "#0b7c5f", border: "#044232", text: "#ffffff", accent: "#55efc4", icon: "🔀", label: "条件" },
  value:    { bg: "#ffa502", top: "#ffc048", side: "#d98100", border: "#704200", text: "#111111", accent: "#d35400", icon: "💎", label: "値" },
  loop:     { bg: "#ff7f50", top: "#ff9f43", side: "#e15f41", border: "#8c2813", text: "#ffffff", accent: "#ffeaa7", icon: "🔄", label: "制御" },
  calc:     { bg: "#5dbb1a", top: "#7fd831", side: "#3d8a0f", border: "#1a4d04", text: "#111111", accent: "#c3f573", icon: "🧮", label: "演算" },
  ui:       { bg: "#e056fd", top: "#ff9ff3", side: "#be2edd", border: "#6c1585", text: "#ffffff", accent: "#ff7897", icon: "🪟", label: "UI作成" },
  variable: { bg: "#5f27cd", top: "#a29bfe", side: "#341f97", border: "#1b0b6b", text: "#ffffff", accent: "#a29bfe", icon: "📦", label: "変数" },
};

/* ══════════════════════════════════════════════════════════
   テンプレート
   ══════════════════════════════════════════════════════════ */

interface Tmpl { type:string; emoji:string; label:string; sublabel:string; category:Category; fields:FieldDef[] }

/** calc カテゴリのサブカテゴリ識別子 */
type CalcSubCat = "arith" | "math" | "compare" | "string" | "id";

/** calc テンプレートを type 接頭辞から自動的にサブ分類する */
function getCalcSubCat(t: Tmpl): CalcSubCat | null {
  if (t.category !== "calc") return null;
  if (t.type.startsWith("ca_id_")) return "id";
  if (["ca_add","ca_sub","ca_mul","ca_div","ca_mod","ca_pow"].includes(t.type)) return "arith";
  if (["ca_gt","ca_lt","ca_gte","ca_lte","ca_eq","ca_neq"].includes(t.type)) return "compare";
  if (["ca_concat","ca_strlen","ca_numstr","ca_strnum","ca_substr","ca_replace","ca_upper","ca_lower","ca_contains"].includes(t.type)) return "string";
  // 残り全部（ca_abs / ca_floor / ca_sqrt / ca_pi など）は math
  return "math";
}

/** サブタブの表示順 + アイコン + ラベル */
const CALC_SUBTABS: { key: CalcSubCat; icon: string; label: string }[] = [
  { key: "arith",   icon: "➕", label: "四則演算" },
  { key: "math",    icon: "🧠", label: "数学関数" },
  { key: "compare", icon: "⚖", label: "比較"     },
  { key: "string",  icon: "📝", label: "文字列"   },
  { key: "id",      icon: "📦", label: "アイテムID"},
];
const fv=(id:string,label:string,value:string,opts?:string[]):FieldDef=>({id,label,value,options:opts});

const TEMPLATES: Tmpl[] = [
  // ─── イベント ───
  {type:"ev_join",  emoji:"👋",label:"参加したとき",        sublabel:"プレイヤーがワールドに参加",category:"trigger",fields:[]},
  {type:"ev_break", emoji:"⛏️",label:"ブロック破壊",        sublabel:"ブロックを壊したとき",     category:"trigger",fields:[fv("block","ブロック","minecraft:stone")]},
  {type:"ev_item",  emoji:"🔮",label:"アイテム使用",        sublabel:"アイテムを右クリック",      category:"trigger",fields:[fv("item","アイテム","minecraft:diamond")]},
  {type:"ev_tick",  emoji:"⏰",label:"毎ティック実行",      sublabel:"ゲームの毎フレーム",        category:"trigger",fields:[]},
  {type:"ev_chat",  emoji:"💬",label:"チャット入力",        sublabel:"特定のワードをチャット",    category:"trigger",fields:[fv("pat","合言葉","!こんにちは")]},
  {type:"ev_hurt",  emoji:"💥",label:"ダメージ受信",        sublabel:"プレイヤーが被ダメージ",   category:"trigger",fields:[]},
  {type:"ev_place", emoji:"🧱",label:"ブロック設置",        sublabel:"ブロックを置いたとき",     category:"trigger",fields:[]},
  // ─── アクション ───
  {type:"ac_msg",   emoji:"📢",label:"メッセージ送信",      sublabel:"全員または特定のプレイヤーへ",category:"action",fields:[fv("msg","メッセージ","こんにちは！"),fv("target","対象","@a")]},
  {type:"ac_give",  emoji:"🎁",label:"アイテム付与",        sublabel:"プレイヤーにアイテムを渡す",category:"action",fields:[fv("item","アイテム","minecraft:diamond"),fv("count","個数","1")]},
  {type:"ac_tp",    emoji:"✨",label:"テレポート",          sublabel:"指定座標へ瞬間移動",       category:"action",fields:[fv("x","X","0"),fv("y","Y","64"),fv("z","Z","0")]},
  {type:"ac_cmd",   emoji:"⚡",label:"コマンド実行",        sublabel:"/コマンドを実行",          category:"action",fields:[fv("cmd","コマンド","say こんにちは")]},
  {type:"ac_sound", emoji:"🎵",label:"サウンド再生",        sublabel:"効果音を鳴らす",           category:"action",fields:[fv("snd","サウンド","random.orb"),fv("vol","音量","1")]},
  {type:"ac_title", emoji:"📺",label:"タイトル表示",        sublabel:"画面中央に大きく表示",     category:"action",fields:[fv("title","タイトル","こんにちは"),fv("sub","サブタイトル","")]},
  {type:"ac_effect",emoji:"🌟",label:"エフェクト付与",      sublabel:"ポーション効果を与える",   category:"action",fields:[fv("eff","エフェクト","speed"),fv("dur","秒数","10")]},
  {type:"ac_score", emoji:"🏆",label:"スコア操作",          sublabel:"スコアボードの値を変更",   category:"action",fields:[fv("op","操作","加算",["加算","減算","セット","リセット"]),fv("obj","目標名","points"),fv("val","値","1")]},
  {type:"ac_tag",   emoji:"🏷️",label:"タグ操作",            sublabel:"プレイヤーにタグを付ける",category:"action",fields:[fv("op","操作","追加",["追加","削除"]),fv("tag","タグ名","vip")]},
  {type:"ac_kick",  emoji:"🚫",label:"キック",              sublabel:"プレイヤーをサーバーから追い出す",category:"action",fields:[fv("msg","理由","ルール違反")]},
  // ─── 条件 ───
  {type:"co_if",    emoji:"🔀",label:"条件分岐",            sublabel:"条件によって処理を分ける（ドーナツ）",category:"ifelse",fields:[]},
  {type:"co_tag",   emoji:"🏷️",label:"タグを持っているか",  sublabel:"指定タグの確認",           category:"ifelse",fields:[fv("tag","タグ名","vip")]},
  {type:"co_sneak", emoji:"🫣",label:"スニーク中か",        sublabel:"しゃがんでいるか確認",     category:"ifelse",fields:[]},
  {type:"co_item",  emoji:"🔍",label:"アイテム所持確認",    sublabel:"インベントリに指定アイテムがあるか",category:"ifelse",fields:[fv("item","アイテム","minecraft:diamond")]},
  {type:"co_hp",    emoji:"🩸",label:"HP不足確認",          sublabel:"HPが基準以下か",           category:"ifelse",fields:[fv("threshold","HP基準","10")]},
  {type:"co_night", emoji:"🌙",label:"夜間か",              sublabel:"現在が夜（13000〜23000）か",category:"ifelse",fields:[]},
  {type:"co_rain",  emoji:"🌧️",label:"雨天か",              sublabel:"雨または嵐が降っているか", category:"ifelse",fields:[]},
  {type:"co_and",   emoji:"🔵",label:"かつ（AND）",         sublabel:"両方の条件が成立",         category:"ifelse",fields:[]},
  {type:"co_or",    emoji:"🟡",label:"または（OR）",        sublabel:"どちらかの条件が成立",     category:"ifelse",fields:[]},
  {type:"co_not",   emoji:"❌",label:"でない（NOT）",       sublabel:"条件が成立しないとき",     category:"ifelse",fields:[]},
  // ─── 値 ───
  {type:"va_name",  emoji:"👤",label:"プレイヤー名",        sublabel:"プレイヤーの名前を取得",   category:"value",  fields:[]},
  {type:"va_rand",  emoji:"🎲",label:"乱数",                sublabel:"ランダムな整数を生成",     category:"value",  fields:[fv("min","最小値","0"),fv("max","最大値","100")]},
  {type:"va_str",   emoji:"📝",label:"文字列",              sublabel:"テキストの値",             category:"value",  fields:[fv("v","テキスト","こんにちは！")]},
  {type:"va_num",   emoji:"🔢",label:"数値",                sublabel:"数の値",                   category:"value",  fields:[fv("v","数値","0")]},
  {type:"va_hp",    emoji:"🩸",label:"プレイヤーHP",        sublabel:"現在のHP値を取得",         category:"value",  fields:[]},
  {type:"va_pos",   emoji:"📍",label:"座標",                sublabel:"X/Y/Z座標を取得",          category:"value",  fields:[fv("axis","軸","Y",["X","Y","Z"])]},
  {type:"va_score", emoji:"🏆",label:"スコア取得",          sublabel:"スコアボードの値を取得",   category:"value",  fields:[fv("obj","目標名","points")]},
  // ─── 制御 ───
  {type:"ct_rep",   emoji:"🔄",label:"繰り返し",            sublabel:"指定回数ループする",       category:"loop",   fields:[fv("n","回数","3")]},
  {type:"ct_wait",  emoji:"⏳",label:"待機",                sublabel:"指定秒数だけ待つ",         category:"loop",   fields:[fv("s","秒数","1")]},
  {type:"ct_int",   emoji:"⏲️",label:"インターバル",        sublabel:"一定間隔で繰り返す",       category:"loop",   fields:[fv("s","秒数","5")]},
  {type:"ct_log",   emoji:"📋",label:"ログ出力",            sublabel:"デバッグ情報をコンソールへ",category:"loop",  fields:[fv("v","内容","ログ")]},
  // ─── 演算：四則演算 ───
  {type:"ca_add",   emoji:"➕",label:"足し算",              sublabel:"A + B",                    category:"calc",   fields:[fv("a","A","0"),fv("b","B","0")]},
  {type:"ca_sub",   emoji:"➖",label:"引き算",              sublabel:"A − B",                    category:"calc",   fields:[fv("a","A","0"),fv("b","B","0")]},
  {type:"ca_mul",   emoji:"✖️",label:"掛け算",              sublabel:"A × B",                    category:"calc",   fields:[fv("a","A","1"),fv("b","B","1")]},
  {type:"ca_div",   emoji:"➗",label:"割り算",              sublabel:"A ÷ B",                    category:"calc",   fields:[fv("a","A","0"),fv("b","B","1")]},
  {type:"ca_mod",   emoji:"♻️",label:"余り",                sublabel:"A を B で割った余り",      category:"calc",   fields:[fv("a","A","10"),fv("b","B","3")]},
  {type:"ca_pow",   emoji:"📐",label:"累乗",                sublabel:"A の B 乗",                category:"calc",   fields:[fv("a","A","2"),fv("b","B","8")]},
  // ─── 演算：数学関数 ───
  {type:"ca_abs",   emoji:"📏",label:"絶対値",              sublabel:"|A|（負を正に変換）",      category:"calc",   fields:[fv("a","A","-5")]},
  {type:"ca_floor", emoji:"⬇️",label:"切り捨て",            sublabel:"小数点以下を切り捨て",     category:"calc",   fields:[fv("a","A","3.7")]},
  {type:"ca_ceil",  emoji:"⬆️",label:"切り上げ",            sublabel:"小数点以下を切り上げ",     category:"calc",   fields:[fv("a","A","3.2")]},
  {type:"ca_round", emoji:"🔵",label:"四捨五入",            sublabel:"小数点を丸める",           category:"calc",   fields:[fv("a","A","3.5")]},
  {type:"ca_sqrt",  emoji:"√",label:"平方根",              sublabel:"√A",                       category:"calc",   fields:[fv("a","A","9")]},
  {type:"ca_min",   emoji:"⬅️",label:"最小値",              sublabel:"A と B の小さい方",        category:"calc",   fields:[fv("a","A","3"),fv("b","B","7")]},
  {type:"ca_max",   emoji:"➡️",label:"最大値",              sublabel:"A と B の大きい方",        category:"calc",   fields:[fv("a","A","3"),fv("b","B","7")]},
  {type:"ca_clamp", emoji:"📦",label:"範囲制限",            sublabel:"値を最小〜最大に収める",   category:"calc",   fields:[fv("val","値","50"),fv("min","最小","0"),fv("max","最大","100")]},
  {type:"ca_sin",   emoji:"〜",label:"sin",                 sublabel:"サイン（ラジアン）",        category:"calc",   fields:[fv("a","角度(rad)","0")]},
  {type:"ca_cos",   emoji:"〜",label:"cos",                 sublabel:"コサイン（ラジアン）",      category:"calc",   fields:[fv("a","角度(rad)","0")]},
  {type:"ca_pi",    emoji:"π", label:"円周率 π",            sublabel:"3.14159…",                  category:"calc",   fields:[]},
  // ─── 演算：比較 ───
  {type:"ca_gt",    emoji:"▶️",label:"A > B（より大きい）", sublabel:"A が B より大きければ真",  category:"calc",   fields:[fv("a","A","5"),fv("b","B","3")]},
  {type:"ca_lt",    emoji:"◀️",label:"A < B（より小さい）", sublabel:"A が B より小さければ真",  category:"calc",   fields:[fv("a","A","3"),fv("b","B","5")]},
  {type:"ca_gte",   emoji:"▶️",label:"A ≥ B（以上）",       sublabel:"A が B 以上なら真",        category:"calc",   fields:[fv("a","A","5"),fv("b","B","5")]},
  {type:"ca_lte",   emoji:"◀️",label:"A ≤ B（以下）",       sublabel:"A が B 以下なら真",        category:"calc",   fields:[fv("a","A","3"),fv("b","B","5")]},
  {type:"ca_eq",    emoji:"🟰",label:"A = B（等しい）",     sublabel:"A と B が等しければ真",    category:"calc",   fields:[fv("a","A","1"),fv("b","B","1")]},
  {type:"ca_neq",   emoji:"≠", label:"A ≠ B（等しくない）",sublabel:"A と B が違えば真",        category:"calc",   fields:[fv("a","A","1"),fv("b","B","2")]},
  // ─── 演算：文字列 ───
  {type:"ca_concat",emoji:"🔗",label:"文字連結",            sublabel:"AとBをつなげる",           category:"calc",   fields:[fv("a","前","こんにちは"),fv("b","後","！")]},
  {type:"ca_strlen",emoji:"📏",label:"文字数",              sublabel:"テキストの文字数",         category:"calc",   fields:[fv("str","テキスト","hello")]},
  {type:"ca_numstr",emoji:"🔄",label:"数値→文字",          sublabel:"数値を文字列に変換",       category:"calc",   fields:[fv("num","数値","42")]},
  {type:"ca_strnum",emoji:"🔄",label:"文字→数値",          sublabel:"文字列を数値に変換",       category:"calc",   fields:[fv("str","テキスト","42")]},
  {type:"ca_substr",emoji:"✂️",label:"部分文字列",          sublabel:"指定範囲を切り出す",       category:"calc",   fields:[fv("str","テキスト","hello"),fv("start","開始","0"),fv("len","長さ","3")]},
  {type:"ca_replace",emoji:"✏️",label:"文字置換",           sublabel:"特定の文字を別の文字に変換",category:"calc",  fields:[fv("str","テキスト","hello world"),fv("from","検索","world"),fv("to","置換","！")]},
  {type:"ca_upper", emoji:"🔠",label:"大文字変換",          sublabel:"すべて大文字にする",       category:"calc",   fields:[fv("str","テキスト","hello")]},
  {type:"ca_lower", emoji:"🔡",label:"小文字変換",          sublabel:"すべて小文字にする",       category:"calc",   fields:[fv("str","テキスト","HELLO")]},
  {type:"ca_contains",emoji:"🔍",label:"文字列を含むか",    sublabel:"テキストに指定語が入っているか",category:"calc",fields:[fv("str","テキスト","hello world"),fv("search","検索ワード","world")]},
  // ─── アイテムID ───
  {type:"ca_id_gem",  emoji:"💎",label:"宝石・鉱石ID",      sublabel:"ダイヤ・金など鉱石のアイテムID",category:"calc",
    fields:[fv("id","アイテム","minecraft:diamond",[
      "minecraft:diamond","minecraft:emerald","minecraft:gold_ingot","minecraft:iron_ingot",
      "minecraft:netherite_ingot","minecraft:coal","minecraft:redstone","minecraft:lapis_lazuli",
      "minecraft:quartz","minecraft:amethyst_shard","minecraft:raw_gold","minecraft:raw_iron","minecraft:raw_copper",
    ])]},
  {type:"ca_id_block", emoji:"🧱",label:"ブロックID",       sublabel:"よく使うブロックのアイテムID",  category:"calc",
    fields:[fv("id","ブロック","minecraft:stone",[
      "minecraft:stone","minecraft:cobblestone","minecraft:dirt","minecraft:grass_block",
      "minecraft:sand","minecraft:gravel","minecraft:oak_log","minecraft:oak_planks",
      "minecraft:wool","minecraft:obsidian","minecraft:bedrock","minecraft:tnt",
      "minecraft:chest","minecraft:crafting_table","minecraft:furnace","minecraft:bookshelf",
      "minecraft:netherrack","minecraft:end_stone","minecraft:crying_obsidian",
    ])]},
  {type:"ca_id_tool",  emoji:"⚔️",label:"武器・ツールID",   sublabel:"剣・ツルハシなどのアイテムID",  category:"calc",
    fields:[fv("id","ツール","minecraft:diamond_sword",[
      "minecraft:diamond_sword","minecraft:iron_sword","minecraft:stone_sword","minecraft:wooden_sword","minecraft:golden_sword","minecraft:netherite_sword",
      "minecraft:diamond_pickaxe","minecraft:iron_pickaxe","minecraft:stone_pickaxe","minecraft:wooden_pickaxe","minecraft:netherite_pickaxe",
      "minecraft:diamond_axe","minecraft:iron_axe","minecraft:stone_axe","minecraft:wooden_axe",
      "minecraft:diamond_shovel","minecraft:iron_shovel",
      "minecraft:bow","minecraft:crossbow","minecraft:arrow","minecraft:trident",
      "minecraft:shield","minecraft:flint_and_steel","minecraft:shears",
    ])]},
  {type:"ca_id_armor", emoji:"🛡️",label:"防具ID",           sublabel:"ヘルメット・チェストなど防具ID",category:"calc",
    fields:[fv("id","防具","minecraft:diamond_chestplate",[
      "minecraft:diamond_helmet","minecraft:diamond_chestplate","minecraft:diamond_leggings","minecraft:diamond_boots",
      "minecraft:iron_helmet","minecraft:iron_chestplate","minecraft:iron_leggings","minecraft:iron_boots",
      "minecraft:netherite_helmet","minecraft:netherite_chestplate","minecraft:netherite_leggings","minecraft:netherite_boots",
      "minecraft:golden_helmet","minecraft:golden_chestplate","minecraft:golden_leggings","minecraft:golden_boots",
      "minecraft:leather_helmet","minecraft:leather_chestplate","minecraft:leather_leggings","minecraft:leather_boots",
      "minecraft:elytra","minecraft:turtle_helmet",
    ])]},
  {type:"ca_id_food",  emoji:"🍖",label:"食べ物ID",         sublabel:"食料アイテムのID",              category:"calc",
    fields:[fv("id","食べ物","minecraft:bread",[
      "minecraft:bread","minecraft:apple","minecraft:golden_apple","minecraft:enchanted_golden_apple",
      "minecraft:cooked_beef","minecraft:beef","minecraft:cooked_porkchop","minecraft:porkchop",
      "minecraft:cooked_chicken","minecraft:chicken","minecraft:cooked_mutton","minecraft:mutton",
      "minecraft:cooked_fish","minecraft:fish","minecraft:cooked_salmon","minecraft:salmon",
      "minecraft:cake","minecraft:cookie","minecraft:pumpkin_pie","minecraft:melon_slice",
      "minecraft:carrot","minecraft:golden_carrot","minecraft:potato","minecraft:baked_potato",
      "minecraft:beetroot","minecraft:beetroot_soup","minecraft:mushroom_stew","minecraft:rabbit_stew",
    ])]},
  {type:"ca_id_misc",  emoji:"🎒",label:"その他アイテムID", sublabel:"特殊・便利アイテムのID",        category:"calc",
    fields:[fv("id","アイテム","minecraft:ender_pearl",[
      "minecraft:ender_pearl","minecraft:eye_of_ender","minecraft:blaze_rod","minecraft:blaze_powder",
      "minecraft:experience_bottle","minecraft:totem_of_undying","minecraft:nether_star",
      "minecraft:dragon_egg","minecraft:elytra","minecraft:firework_rocket",
      "minecraft:map","minecraft:compass","minecraft:clock","minecraft:spyglass",
      "minecraft:book","minecraft:writable_book","minecraft:written_book","minecraft:name_tag",
      "minecraft:saddle","minecraft:lead","minecraft:string","minecraft:feather",
      "minecraft:gunpowder","minecraft:flint","minecraft:bone","minecraft:bone_meal",
      "minecraft:bucket","minecraft:water_bucket","minecraft:lava_bucket","minecraft:milk_bucket",
    ])]},
  {type:"ca_id_mob",   emoji:"🐾",label:"エンティティID",   sublabel:"スポーンエッグ・モブのID",      category:"calc",
    fields:[fv("id","エンティティ","minecraft:zombie",[
      "minecraft:zombie","minecraft:skeleton","minecraft:creeper","minecraft:spider","minecraft:enderman",
      "minecraft:witch","minecraft:blaze","minecraft:ghast","minecraft:wither_skeleton",
      "minecraft:pig","minecraft:cow","minecraft:sheep","minecraft:chicken","minecraft:horse",
      "minecraft:wolf","minecraft:cat","minecraft:ocelot","minecraft:parrot","minecraft:fox",
      "minecraft:villager","minecraft:wandering_trader","minecraft:iron_golem","minecraft:snow_golem",
      "minecraft:ender_dragon","minecraft:wither","minecraft:elder_guardian","minecraft:shulker",
    ])]},
  {type:"ca_id_effect",emoji:"✨",label:"エフェクトID",     sublabel:"ポーション効果のID",            category:"calc",
    fields:[fv("id","エフェクト","speed",[
      "speed","slowness","haste","mining_fatigue","strength","instant_health","instant_damage",
      "jump_boost","nausea","regeneration","resistance","fire_resistance","water_breathing",
      "invisibility","blindness","night_vision","hunger","weakness","poison","wither",
      "health_boost","absorption","saturation","glowing","levitation","luck","bad_luck",
      "slow_falling","conduit_power","dolphins_grace","bad_omen","hero_of_the_village",
    ])]},
  // ─── 変数 ───
  {type:"vv_set",  emoji:"📥",label:"変数に代入",          sublabel:"変数に値をセットする",             category:"variable",fields:[fv("name","変数名","score"),fv("val","値","0")]},
  {type:"vv_get",  emoji:"📤",label:"変数を読む",           sublabel:"変数の現在の値を取得",             category:"variable",fields:[fv("name","変数名","score")]},
  {type:"vv_add",  emoji:"➕",label:"変数に加算",           sublabel:"変数に数値を足す",                 category:"variable",fields:[fv("name","変数名","score"),fv("val","加算する値","1")]},
  {type:"vv_sub",  emoji:"➖",label:"変数から減算",         sublabel:"変数から数値を引く",               category:"variable",fields:[fv("name","変数名","score"),fv("val","減算する値","1")]},
  {type:"vv_mul",  emoji:"✖️",label:"変数に乗算",           sublabel:"変数に数値を掛ける",               category:"variable",fields:[fv("name","変数名","score"),fv("val","掛ける値","2")]},
  {type:"vv_div",  emoji:"➗",label:"変数を除算",           sublabel:"変数を数値で割る",                 category:"variable",fields:[fv("name","変数名","score"),fv("val","割る値","2")]},
  {type:"vv_inc",  emoji:"⬆️",label:"変数を1増やす",        sublabel:"変数に1を加算",                    category:"variable",fields:[fv("name","変数名","score")]},
  {type:"vv_dec",  emoji:"⬇️",label:"変数を1減らす",        sublabel:"変数から1を減算",                  category:"variable",fields:[fv("name","変数名","score")]},
  {type:"vv_reset",emoji:"🔄",label:"変数をリセット",       sublabel:"変数を0（ゼロ）に戻す",            category:"variable",fields:[fv("name","変数名","score")]},
  {type:"vv_msg",  emoji:"📢",label:"変数の値を表示",       sublabel:"変数の値をメッセージで送信",       category:"variable",fields:[fv("name","変数名","score"),fv("prefix","前の文字","スコア:")]},
  {type:"vv_eq",   emoji:"🟰",label:"変数が等しいか",       sublabel:"変数が指定値と同じなら真",         category:"variable",fields:[fv("name","変数名","score"),fv("val","比較する値","0")]},
  {type:"vv_gt",   emoji:"▶️",label:"変数が大きいか",       sublabel:"変数が指定値より大きければ真",     category:"variable",fields:[fv("name","変数名","score"),fv("val","比較する値","0")]},
  {type:"vv_lt",   emoji:"◀️",label:"変数が小さいか",       sublabel:"変数が指定値より小さければ真",     category:"variable",fields:[fv("name","変数名","score"),fv("val","比較する値","100")]},
  {type:"vv_concat",emoji:"🔗",label:"変数に文字を追加",    sublabel:"変数の末尾に文字を連結する",       category:"variable",fields:[fv("name","変数名","text"),fv("val","追加する文字","こんにちは")]},
  // ─── UI作成 ───
  {type:"ui_action",  emoji:"🔘",label:"ボタンメニュー",     sublabel:"複数ボタンを並べたメニューを表示",category:"ui",
    fields:[fv("title","タイトル","メニュー"),fv("body","説明文","選んでください"),
            fv("btn1","ボタン1","はい"),fv("btn2","ボタン2","いいえ"),fv("btn3","ボタン3（任意）",""),
            fv("msg1","ボタン1のメッセージ","はいを選んだ"),fv("msg2","ボタン2のメッセージ","いいえを選んだ"),fv("msg3","ボタン3のメッセージ","")]},
  {type:"ui_message", emoji:"💬",label:"確認ダイアログ",     sublabel:"2択の確認ウィンドウを表示",         category:"ui",
    fields:[fv("title","タイトル","確認"),fv("body","本文","よろしいですか？"),
            fv("btn1","ボタン1（左）","はい"),fv("btn2","ボタン2（右）","いいえ"),
            fv("msg1","ボタン1のメッセージ","はいを選択"),fv("msg2","ボタン2のメッセージ","いいえを選択")]},
  {type:"ui_textinput",emoji:"📝",label:"テキスト入力",      sublabel:"プレイヤーに文字を入力させる",       category:"ui",
    fields:[fv("title","タイトル","入力フォーム"),fv("label1","ラベル1","名前"),fv("hint1","ヒント1",""),fv("default1","初期値1",""),
            fv("label2","ラベル2（任意）",""),fv("hint2","ヒント2",""),fv("default2","初期値2",""),
            fv("result","結果メッセージ","入力:{0} / {1}")]},
  {type:"ui_toggle",  emoji:"🔀",label:"ON/OFFスイッチ",     sublabel:"トグルを含むフォームを表示",         category:"ui",
    fields:[fv("title","タイトル","設定"),fv("label","スイッチ名","通知をON"),fv("default","初期値","ON",["ON","OFF"]),
            fv("msgon","ONのメッセージ","通知をONにした"),fv("msgoff","OFFのメッセージ","通知をOFFにした")]},
  {type:"ui_slider",  emoji:"🎚️",label:"スライダー入力",     sublabel:"数値をスライダーで入力させる",       category:"ui",
    fields:[fv("title","タイトル","数値入力"),fv("label","ラベル","値"),fv("min","最小","0"),fv("max","最大","100"),fv("step","ステップ","1"),fv("default","初期値","50"),
            fv("result","結果メッセージ","選んだ値:{0}")]},
  {type:"ui_dropdown",emoji:"📋",label:"ドロップダウン",      sublabel:"リストから1つ選ばせるフォーム",      category:"ui",
    fields:[fv("title","タイトル","選択してください"),fv("label","ラベル","モード"),
            fv("items","選択肢（カンマ区切り）","サバイバル,クリエイティブ,アドベンチャー"),fv("default","初期インデックス","0"),
            fv("result","結果メッセージ","選択:{0}")]},
  {type:"ui_mixed",   emoji:"🪟",label:"複合フォーム",        sublabel:"テキスト・トグル・スライダーを組み合わせ",category:"ui",
    fields:[fv("title","タイトル","設定フォーム"),
            fv("el1","要素1 (text/toggle/slider)","text"),fv("lbl1","ラベル1","名前"),fv("val1","初期値1",""),
            fv("el2","要素2","toggle"),fv("lbl2","ラベル2","通知"),fv("val2","初期値2","true"),
            fv("el3","要素3","slider"),fv("lbl3","ラベル3","音量"),fv("val3","初期値3","50"),
            fv("result","結果メッセージ","{0} / {1} / {2}")]},
];

/* ══════════════════════════════════════════════════════════
   ヘルパー関数
   ══════════════════════════════════════════════════════════ */

let _uid = 6000;
const uid = () => `b${_uid++}`;

function blockH(b: CBlock): number { return BH + (b.fields.length > 0 ? b.fields.length * 26 + 6 : 0); }

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
    if (p.thenId === id)  return { x: getPos(p.id, blocks).x, y: getPos(p.id, blocks).y - blockH(b) - GAP };
    if (p.elseId === id)  return { x: getPos(p.id, blocks).x + BW + GAP + 120, y: getPos(p.id, blocks).y };
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
    nextId:  b.nextId  === id ? null : b.nextId,
    innerId: b.innerId === id ? null : b.innerId,
    thenId:  b.thenId  === id ? null : b.thenId,
    elseId:  b.elseId  === id ? null : b.elseId,
  }));
}

/** ブロックに接続する */
function attach(id: string, targetId: string, slot: string, blocks: CBlock[]): CBlock[] {
  return blocks.map(b => b.id !== targetId ? b : {
    ...b,
    nextId:  slot === "next"  ? id : b.nextId,
    innerId: slot === "inner" ? id : b.innerId,
    thenId:  slot === "then"  ? id : b.thenId,
    elseId:  slot === "else"  ? id : b.elseId,
  });
}

function dist(a: {x:number;y:number}, b: {x:number;y:number}): number {
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
        if (!target.innerId && dist(center, { x: tp.x + BW + GAP + BW/2, y: tp.y + BH/2 }) < SNAP)
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

function spawnBlock(t: Tmpl, x: number, y: number): CBlock {
  return { id: uid(), type: t.type, emoji: t.emoji, label: t.label, sublabel: t.sublabel,
    category: t.category, fields: t.fields.map(f=>({...f})),
    x, y, nextId: null, innerId: null, thenId: null, elseId: null };
}

function makeInitial(): CBlock[] {
  return [];
}

/* ══════════════════════════════════════════════════════════
   Bedrockコード生成
   ══════════════════════════════════════════════════════════ */

function escStr(s:string){return s.replace(/\\/g,"\\\\").replace(/"/g,'\\"').replace(/`/g,"\\`").replace(/\$/g,"\\$").replace(/\n/g,"\\n");}
function escId(s:string){return s.replace(/[^a-z0-9_.:/-]/gi,"");}
function gf(b:CBlock,id:string,fb=""):string{return b.fields.find(f=>f.id===id)?.value??fb;}
/** 変数名を安全なJS識別子に変換（先頭が数字なら _ を付加） */
function sanitizeVarName(s:string):string{
  const clean=s.replace(/\s+/g,"_").replace(/[^a-zA-Z0-9_]/g,"");
  return(/^\d/.test(clean)?"_":"")+clean||"myVar";
}

// ★ ct_wait のある位置でチェーンを「分割」してrunTimeoutに包む
function genChain(id:string|null, blocks:CBlock[], indent:string):string{
  if(!id)return"";
  const b=blocks.find(b=>b.id===id);
  if(!b)return"";

  // wait ブロックは残りのチェーンを runTimeout の中に入れる
  if(b.type==="ct_wait"){
    const ticks=Math.round(parseFloat(gf(b,"s","1"))*20);
    const rest=genChain(b.nextId,blocks,indent+"  ");
    return`${indent}system.runTimeout(()=>{\n${rest||`${indent}  // まつ`}\n${indent}},${ticks});`;
  }

  return genBlock(b,blocks,indent)+"\n"+genChain(b.nextId,blocks,indent);
}

function genBlock(b:CBlock,blocks:CBlock[],indent:string):string{
  const f=(id:string,fb="")=>gf(b,id,fb);
  const I=indent;
  switch(b.type){
    // ★ await を全て除去 — subscribe コールバックは同期でなければならない
    case"ac_msg":
      // world.sendMessage は古いAPIバージョンで存在しないためループで代替
      return f("target","@a")==="@a"
        ? `${I}for (const _tp of world.getPlayers()) _tp.sendMessage("${escStr(f("msg","こんにちは"))}");`
        : `${I}player.sendMessage("${escStr(f("msg","こんにちは"))}");`;
    case"ac_give":   return`${I}player.runCommandAsync("give @s ${escId(f("item","minecraft:diamond"))} ${f("count","1")}");`;
    case"ac_tp":     return`${I}player.teleport({x:${f("x","0")},y:${f("y","64")},z:${f("z","0")}});`;
    case"ac_cmd":    return`${I}player.runCommandAsync("${escStr(f("cmd","say hi"))}");`;
    case"ac_sound":  return`${I}player.runCommandAsync("playsound ${escId(f("snd","random.orb"))} @s ~ ~ ~ ${f("vol","1")}");`;
    case"ac_title":  return[
      `${I}player.runCommandAsync(\`titleraw @s title {"rawtext":[{"text":"${escStr(f("title",""))}"}]}\`);`,
      `${I}player.runCommandAsync(\`titleraw @s subtitle {"rawtext":[{"text":"${escStr(f("sub",""))}"}]}\`);`,
    ].join("\n");
    case"ac_effect": return`${I}player.runCommandAsync("effect @s ${escId(f("eff","speed"))} ${f("dur","10")} 0");`;
    case"ac_score":{
      const ops:Record<string,string>={"加算":"add","減算":"remove","セット":"set","リセット":"set"};
      const cmd=ops[f("op","加算")]??"add";
      const val=f("op","加算")==="リセット"?"0":f("val","1");
      return`${I}player.runCommandAsync("scoreboard players ${cmd} @s ${escId(f("obj","points"))} ${val}");`;
    }
    case"ac_tag":
      return f("op","追加")==="追加"
        ? `${I}player.addTag("${escId(f("tag","vip"))}");`
        : `${I}player.removeTag("${escId(f("tag","vip"))}");`;
    case"ac_kick":
      return`${I}player.runCommandAsync("kick \${player.name} ${escStr(f("msg","ルール違反"))}");`;
    // 演算ブロックをアクションとして単体実行（ログ出力付き）
    case"ca_add":case"ca_sub":case"ca_mul":case"ca_div":case"ca_mod":case"ca_pow":
    case"ca_abs":case"ca_floor":case"ca_ceil":case"ca_round":case"ca_sqrt":
    case"ca_min":case"ca_max":case"ca_clamp":case"ca_sin":case"ca_cos":case"ca_pi":
    case"ca_gt":case"ca_lt":case"ca_gte":case"ca_lte":case"ca_eq":case"ca_neq":
    case"ca_concat":case"ca_strlen":case"ca_numstr":case"ca_strnum":
    case"ca_substr":case"ca_replace":case"ca_upper":case"ca_lower":case"ca_contains":
      return`${I}console.log("[MMC演算]", ${genExpr(b.id,blocks)});`;
    // 制御
    case"ct_rep":{
      const body=genChain(b.thenId,blocks,I+"  ");
      return`${I}for (let _ri = 0; _ri < ${f("n","3")}; _ri++) {\n${body}\n${I}}`;
    }
    case"ct_log":    return`${I}console.log("[MMCログ] " + ${genExpr(b.innerId,blocks)});`;
    // 変数
    case"vv_set":    return`${I}_v_${sanitizeVarName(f("name","score"))} = ${genExpr(b.innerId,blocks)||`Number(${f("val","0")})`};`;
    case"vv_add":    return`${I}_v_${sanitizeVarName(f("name","score"))} += ${genExpr(b.innerId,blocks)||`Number(${f("val","1")})`};`;
    case"vv_sub":    return`${I}_v_${sanitizeVarName(f("name","score"))} -= ${genExpr(b.innerId,blocks)||`Number(${f("val","1")})`};`;
    case"vv_mul":    return`${I}_v_${sanitizeVarName(f("name","score"))} *= ${genExpr(b.innerId,blocks)||`Number(${f("val","2")})`};`;
    case"vv_div":    return`${I}_v_${sanitizeVarName(f("name","score"))} /= ${genExpr(b.innerId,blocks)||`Number(${f("val","2")})`};`;
    case"vv_inc":    return`${I}_v_${sanitizeVarName(f("name","score"))}++;`;
    case"vv_dec":    return`${I}_v_${sanitizeVarName(f("name","score"))}--;`;
    case"vv_reset":  return`${I}_v_${sanitizeVarName(f("name","score"))} = 0;`;
    case"vv_msg":    return`${I}player.sendMessage("${escStr(f("prefix","スコア:"))}" + _v_${sanitizeVarName(f("name","score"))});`;
    case"vv_concat": return`${I}_v_${sanitizeVarName(f("name","score"))} += String(${genExpr(b.innerId,blocks)||`"${escStr(f("val",""))}"`});`;
    // UI作成
    case"ui_action":{
      const title=f("title","メニュー"), bodyText=f("body","選んでください");
      const b1=f("btn1","はい"), b2=f("btn2","いいえ"), b3=f("btn3","");
      const m1=f("msg1"), m2=f("msg2"), m3=f("msg3");
      return[
        `${I}const _form = new ActionFormData().title("${escStr(title)}").body("${escStr(bodyText)}");`,
        `${I}_form.button("${escStr(b1)}");`,
        `${I}_form.button("${escStr(b2)}");`,
        ...(b3?[`${I}_form.button("${escStr(b3)}");`]:[]),
        `${I}_form.show(player).then((res) => {`,
        `${I}  if (res.canceled) return;`,
        `${I}  if (res.selection === 0) { ${m1?`player.sendMessage("${escStr(m1)}");`:""} }`,
        `${I}  else if (res.selection === 1) { ${m2?`player.sendMessage("${escStr(m2)}");`:""} }`,
        ...(b3?[`${I}  else if (res.selection === 2) { ${m3?`player.sendMessage("${escStr(m3)}");`:""} }`]:[]),
        `${I}});`,
      ].join("\n");
    }
    case"ui_message":{
      const title=f("title","確認"), bodyText=f("body","よろしいですか？");
      const b1=f("btn1","はい"), b2=f("btn2","いいえ");
      const m1=f("msg1"), m2=f("msg2");
      return[
        `${I}const _form = new MessageFormData().title("${escStr(title)}").body("${escStr(bodyText)}").button1("${escStr(b1)}").button2("${escStr(b2)}");`,
        `${I}_form.show(player).then((res) => {`,
        `${I}  if (res.canceled) return;`,
        `${I}  if (res.selection === 1) { ${m1?`player.sendMessage("${escStr(m1)}");`:""} }`,
        `${I}  else if (res.selection === 0) { ${m2?`player.sendMessage("${escStr(m2)}");`:""} }`,
        `${I}});`,
      ].join("\n");
    }
    case"ui_textinput":{
      const title=f("title","入力フォーム"), l1=f("label1","名前"), h1=f("hint1",""), d1=f("default1","");
      const l2=f("label2",""), h2=f("hint2",""), d2=f("default2","");
      const result=f("result","入力:{0}");
      return[
        `${I}const _form = new ModalFormData().title("${escStr(title)}");`,
        `${I}_form.textField("${escStr(l1)}", "${escStr(h1)}", "${escStr(d1)}");`,
        ...(l2?[`${I}_form.textField("${escStr(l2)}", "${escStr(h2)}", "${escStr(d2)}");`]:[]),
        `${I}_form.show(player).then((res) => {`,
        `${I}  if (res.canceled || !res.formValues) return;`,
        `${I}  const _v0 = String(res.formValues[0]);`,
        `${I}  const _v1 = ${l2?"String(res.formValues[1])":'""'};`,
        `${I}  player.sendMessage(\`${escStr(result).replace(/\{0\}/g,"${_v0}").replace(/\{1\}/g,"${_v1}")}\`);`,
        `${I}});`,
      ].join("\n");
    }
    case"ui_toggle":{
      const title=f("title","設定"), label=f("label","トグル"), def=f("default","ON")==="ON";
      const mon=f("msgon"), moff=f("msgoff");
      return[
        `${I}const _form = new ModalFormData().title("${escStr(title)}").toggle("${escStr(label)}", ${def});`,
        `${I}_form.show(player).then((res) => {`,
        `${I}  if (res.canceled || !res.formValues) return;`,
        `${I}  if (res.formValues[0] === true) { ${mon?`player.sendMessage("${escStr(mon)}");`:""} }`,
        `${I}  else { ${moff?`player.sendMessage("${escStr(moff)}");`:""} }`,
        `${I}});`,
      ].join("\n");
    }
    case"ui_slider":{
      const title=f("title","数値入力"), label=f("label","値");
      const min=f("min","0"), max=f("max","100"), step=f("step","1"), def=f("default","50");
      const result=f("result","値:{0}");
      return[
        `${I}const _form = new ModalFormData().title("${escStr(title)}").slider("${escStr(label)}", ${min}, ${max}, ${step}, ${def});`,
        `${I}_form.show(player).then((res) => {`,
        `${I}  if (res.canceled || !res.formValues) return;`,
        `${I}  const _val = res.formValues[0];`,
        `${I}  player.sendMessage(\`${escStr(result).replace(/\{0\}/g,"${_val}")}\`);`,
        `${I}});`,
      ].join("\n");
    }
    case"ui_dropdown":{
      const title=f("title","選択"), label=f("label","項目");
      const items=f("items","A,B").split(",").map(s=>s.trim()).filter(Boolean);
      const defIdx=f("default","0");
      const result=f("result","選択:{0}");
      return[
        `${I}const _form = new ModalFormData().title("${escStr(title)}").dropdown("${escStr(label)}", [${items.map(s=>`"${escStr(s)}"`).join(",")}], ${defIdx});`,
        `${I}_form.show(player).then((res) => {`,
        `${I}  if (res.canceled || !res.formValues) return;`,
        `${I}  const _idx = Number(res.formValues[0]);`,
        `${I}  const _items = [${items.map(s=>`"${escStr(s)}"`).join(",")}];`,
        `${I}  const _val = _items[_idx];`,
        `${I}  player.sendMessage(\`${escStr(result).replace(/\{0\}/g,"${_val}")}\`);`,
        `${I}});`,
      ].join("\n");
    }
    case"ui_mixed":{
      const title=f("title","設定フォーム");
      const el1=f("el1","text"), lbl1=f("lbl1","名前"), val1=f("val1","");
      const el2=f("el2","toggle"), lbl2=f("lbl2","通知"), val2=f("val2","true");
      const el3=f("el3","slider"), lbl3=f("lbl3","音量"), val3=f("val3","50");
      const result=f("result","{0}/{1}/{2}");
      return[
        `${I}const _form = new ModalFormData().title("${escStr(title)}");`,
        el1==="text"?`${I}_form.textField("${escStr(lbl1)}", "", "${escStr(val1)}");`:el1==="toggle"?`${I}_form.toggle("${escStr(lbl1)}", ${val1==="true"});`:`${I}_form.slider("${escStr(lbl1)}", 0, 100, 1, ${val1});`,
        el2==="text"?`${I}_form.textField("${escStr(lbl2)}", "", "${escStr(val2)}");`:el2==="toggle"?`${I}_form.toggle("${escStr(lbl2)}", ${val2==="true"});`:`${I}_form.slider("${escStr(lbl2)}", 0, 100, 1, ${val2});`,
        el3==="text"?`${I}_form.textField("${escStr(lbl3)}", "", "${escStr(val3)}");`:el3==="toggle"?`${I}_form.toggle("${escStr(lbl3)}", ${val3==="true"});`:`${I}_form.slider("${escStr(lbl3)}", 0, 100, 1, ${val3});`,
        `${I}_form.show(player).then((res) => {`,
        `${I}  if (res.canceled || !res.formValues) return;`,
        `${I}  const _v0 = res.formValues[0];`,
        `${I}  const _v1 = res.formValues[1];`,
        `${I}  const _v2 = res.formValues[2];`,
        `${I}  player.sendMessage(\`${escStr(result).replace(/\{0\}/g,"${_v0}").replace(/\{1\}/g,"${_v1}").replace(/\{2\}/g,"${_v2}")}\`);`,
        `${I}});`,
      ].join("\n");
    }
    case"co_if":{
      const cond=genCond(b.innerId,blocks);
      const bodyThen=genChain(b.thenId,blocks,I+"  ");
      const bodyElse=genChain(b.elseId,blocks,I+"  ");
      return[
        `${I}if (${cond}) {`,
        bodyThen||`${I}  // 何もしない`,
        ...(bodyElse?[`${I}} else {`,bodyElse]:[]),
        `${I}}`,
      ].join("\n");
    }
    default: return"";
  }
}

function genExpr(id:string|null, blocks:CBlock[]):string{
  if(!id)return"";
  const b=blocks.find(b=>b.id===id);
  if(!b)return"";
  const f=(fid:string,fb="")=>gf(b,fid,fb);
  switch(b.type){
    case"va_name":  return"player.name";
    case"va_rand":  return`(Math.floor(Math.random()*(Number(${f("max","100")})-Number(${f("min","0")})+1))+Number(${f("min","0")}))`;
    case"va_str":   return`"${escStr(f("v",""))}"`;
    case"va_num":   return`Number(${f("v","0")})`;
    case"va_hp":    return`(player.getComponent("health")?.currentValue??20)`;
    case"va_pos":   return`Math.round(player.location.${f("axis","Y").toLowerCase()})`;
    case"va_score": return`(player.runCommandAsync("scoreboard players test @s ${escId(f("obj","points"))} * *").then(r=>parseInt(r.statusMessage?.match(/\\d+/)?.[0]??'0')).catch(()=>0))`;
    case"ca_add":   return`(${genExpr(b.fields[0]?.id,blocks)||f("a","0")}) + (${genExpr(b.fields[1]?.id,blocks)||f("b","0")})`;
    case"ca_sub":   return`(${genExpr(b.fields[0]?.id,blocks)||f("a","0")}) - (${genExpr(b.fields[1]?.id,blocks)||f("b","0")})`;
    case"ca_mul":   return`(${genExpr(b.fields[0]?.id,blocks)||f("a","1")}) * (${genExpr(b.fields[1]?.id,blocks)||f("b","1")})`;
    case"ca_div":   return`(${genExpr(b.fields[0]?.id,blocks)||f("a","0")}) / (${genExpr(b.fields[1]?.id,blocks)||f("b","1")})`;
    case"ca_mod":   return`(${genExpr(b.fields[0]?.id,blocks)||f("a","10")}) % (${genExpr(b.fields[1]?.id,blocks)||f("b","3")})`;
    case"ca_pow":   return`Math.pow(${genExpr(b.fields[0]?.id,blocks)||f("a","2")}, ${genExpr(b.fields[1]?.id,blocks)||f("b","8")})`;
    case"ca_abs":   return`Math.abs(${genExpr(b.fields[0]?.id,blocks)||f("a","-5")})`;
    case"ca_floor": return`Math.floor(${genExpr(b.fields[0]?.id,blocks)||f("a","3.7")})`;
    case"ca_ceil":  return`Math.ceil(${genExpr(b.fields[0]?.id,blocks)||f("a","3.2")})`;
    case"ca_round": return`Math.round(${genExpr(b.fields[0]?.id,blocks)||f("a","3.5")})`;
    case"ca_sqrt":  return`Math.sqrt(${genExpr(b.fields[0]?.id,blocks)||f("a","9")})`;
    case"ca_min":   return`Math.min(${genExpr(b.fields[0]?.id,blocks)||f("a","3")}, ${genExpr(b.fields[1]?.id,blocks)||f("b","7")})`;
    case"ca_max":   return`Math.max(${genExpr(b.fields[0]?.id,blocks)||f("a","3")}, ${genExpr(b.fields[1]?.id,blocks)||f("b","7")})`;
    case"ca_clamp": return`Math.min(Math.max(${genExpr(b.fields[0]?.id,blocks)||f("val","50")}, ${genExpr(b.fields[1]?.id,blocks)||f("min","0")}), ${genExpr(b.fields[2]?.id,blocks)||f("max","100")})`;
    case"ca_sin":   return`Math.sin(${genExpr(b.fields[0]?.id,blocks)||f("a","0")})`;
    case"ca_cos":   return`Math.cos(${genExpr(b.fields[0]?.id,blocks)||f("a","0")})`;
    case"ca_pi":    return`Math.PI`;
    case"ca_gt":    return`(${genExpr(b.fields[0]?.id,blocks)||f("a","5")} > ${genExpr(b.fields[1]?.id,blocks)||f("b","3")})`;
    case"ca_lt":    return`(${genExpr(b.fields[0]?.id,blocks)||f("a","3")} < ${genExpr(b.fields[1]?.id,blocks)||f("b","5")})`;
    case"ca_gte":   return`(${genExpr(b.fields[0]?.id,blocks)||f("a","5")} >= ${genExpr(b.fields[1]?.id,blocks)||f("b","5")})`;
    case"ca_lte":   return`(${genExpr(b.fields[0]?.id,blocks)||f("a","3")} <= ${genExpr(b.fields[1]?.id,blocks)||f("b","5")})`;
    case"ca_eq":    return`(${genExpr(b.fields[0]?.id,blocks)||f("a","1")} === ${genExpr(b.fields[1]?.id,blocks)||f("b","1")})`;
    case"ca_neq":   return`(${genExpr(b.fields[0]?.id,blocks)||f("a","1")} !== ${genExpr(b.fields[1]?.id,blocks)||f("b","2")})`;
    case"ca_concat":return`(${genExpr(b.fields[0]?.id,blocks)||`"${escStr(f("a",""))}"`}) + (${genExpr(b.fields[1]?.id,blocks)||`"${escStr(f("b",""))}"`})`;
    case"ca_strlen":return`String(${genExpr(b.fields[0]?.id,blocks)||`"${escStr(f("str",""))}"`}).length`;
    case"ca_numstr":return`String(${genExpr(b.fields[0]?.id,blocks)||f("num","42")})`;
    case"ca_strnum":return`Number(${genExpr(b.fields[0]?.id,blocks)||`"${escStr(f("str","0"))}"`})`;
    case"ca_substr":return`String(${genExpr(b.fields[0]?.id,blocks)||`"${escStr(f("str",""))}"`}).substring(${f("start","0")}, ${f("start","0")} + ${f("len","3")})`;
    case"ca_replace":return`String(${genExpr(b.fields[0]?.id,blocks)||`"${escStr(f("str",""))}"`}).replace("${escStr(f("from",""))}", "${escStr(f("to",""))}")`;
    case"ca_upper":  return`String(${genExpr(b.fields[0]?.id,blocks)||`"${escStr(f("str",""))}"`}).toUpperCase()`;
    case"ca_lower":  return`String(${genExpr(b.fields[0]?.id,blocks)||`"${escStr(f("str",""))}"`}).toLowerCase()`;
    case"ca_contains":return`String(${genExpr(b.fields[0]?.id,blocks)||`"${escStr(f("str",""))}"`}).includes("${escStr(f("search",""))}")`;
    case"ca_id_gem":   return`"${escId(f("id","diamond"))}"`;
    case"ca_id_block": return`"${escId(f("id","stone"))}"`;
    case"ca_id_tool":  return`"${escId(f("id","diamond_sword"))}"`;
    case"ca_id_armor": return`"${escId(f("id","diamond_chestplate"))}"`;
    case"ca_id_food":  return`"${escId(f("id","bread"))}"`;
    case"ca_id_misc":  return`"${escId(f("id","ender_pearl"))}"`;
    case"ca_id_mob":   return`"${escId(f("id","zombie"))}"`;
    case"ca_id_effect":return`"${escId(f("id","speed"))}"`;
    case"ca_rand_int":  return`(Math.floor(Math.random()*(Number(${f("max","6")})-Number(${f("min","1")})+1))+Number(${f("min","1")}))`;
    case"ca_rand_float":return`Math.random()`;
    case"ca_rand_bool": return`(Math.random()<0.5)`;
    case"ca_rand_range":return`(Math.random()*(Number(${f("max","1.0")})-Number(${f("min","0.0")}))+Number(${f("min","0.0")}))`;
    case"ca_rand_pct":  return`(Math.random()*100<Number(${f("pct","30")}))`;
    case"ca_rand_sign": return`(Math.random()<0.5?1:-1)`;
    case"ca_rand_gauss":{
      return`(()=>{const _u=1-Math.random(),_v=Math.random();const _n=Math.sqrt(-2*Math.log(_u))*Math.cos(2*Math.PI*_v);return Math.round(_n*Number(${f("sd","15")})+Number(${f("mean","50")}));})()`;
    }
    case"ca_rand_pick":{
      const items=f("items","A,B,C").split(",").map(s=>s.trim()).filter(Boolean);
      return`[${items.map(i=>`"${escStr(i)}"`).join(",")}][Math.floor(Math.random()*${items.length})]`;
    }
    case"ca_rand_shuffle":
      return`(()=>{const _a=Array.from({length:Number(${f("n","5")})},(_, i)=>i+1);for(let _i=_a.length-1;_i>0;_i--){const _j=Math.floor(Math.random()*(_i+1));[_a[_i],_a[_j]]=[_a[_j],_a[_i]];}return _a;})()`;
    case"ca_rand_seed":{
      const seed=f("seed","42");
      return`(()=>{let _s=${seed}|0;_s|=0;_s=_s+0x6D2B79F5|0;let _t=Math.imul(_s^(_s>>>15),1|_s);_t^=_t+Math.imul(_t^(_t>>>7),61|_t);const _r=((_t^(_t>>>14))>>>0)/4294967296;return Math.floor(_r*(Number(${f("max","100")})-Number(${f("min","0")})+1)+Number(${f("min","0")}));})()`;
    }
    case"vv_get":   return`_v_${sanitizeVarName(f("name","score"))}`;
    case"vv_eq":    return`(_v_${sanitizeVarName(f("name","score"))}===${f("val","0")})`;
    case"vv_gt":    return`(_v_${sanitizeVarName(f("name","score"))}>${f("val","0")})`;
    case"vv_lt":    return`(_v_${sanitizeVarName(f("name","score"))}<${f("val","100")})`;
    case"co_tag":     return`player.hasTag("${escId(f("tag",""))}")`;
    case"co_sneak":   return"player.isSneaking";
    case"co_hp":      return`((player.getComponent("health")?.currentValue??20)<=Number(${f("threshold","10")}))`;
    case"co_night":   return"(world.getTimeOfDay()>=13000&&world.getTimeOfDay()<23000)";
    case"co_rain":    return`(world.getDimension("overworld").weather?.precipitation==="rain"||world.getDimension("overworld").weather?.precipitation==="thunder")`;
    case"co_item":    return`(()=>{const _c=player.getComponent("inventory")?.container;if(!_c)return false;for(let _i=0;_i<_c.size;_i++)if(_c.getItem(_i)?.typeId==="${escId(f("item","minecraft:diamond"))}")return true;return false;})()`;
    case"co_and":     return`(${genExpr(b.innerId,blocks)}&&${genExpr(b.thenId,blocks)})`;
    case"co_or":      return`(${genExpr(b.innerId,blocks)}||${genExpr(b.thenId,blocks)})`;
    case"co_not":     return`(!(${genExpr(b.innerId,blocks)}))`;
    default: return"0";
  }
}

function genCond(id:string|null, blocks:CBlock[]):string{
  if(!id)return"true";
  const expr=genExpr(id,blocks);
  return(expr==="0"||expr==="")?"true":expr;
}

function genTrigger(b:CBlock,blocks:CBlock[]):string{
  const f=(id:string,fb="")=>gf(b,id,fb);
  const body=genChain(b.nextId,blocks,"  ")||"  // なにもしない";
  switch(b.type){
    case"ev_join":
      return[
        `// 👋 プレイヤーが参加したとき`,
        `world.afterEvents.playerJoin.subscribe((event) => {`,
        `  const _joinName = event.playerName;`,
        `  system.runTimeout(() => {`,
        `    const player = world.getPlayers().find(p => p.name === _joinName);`,
        `    if (!player) return;`,
        body.split("\n").map((l:string)=>"    "+l).join("\n"),
        `  }, 40);`,
        `});`,
        `// ⛏️ ブロックをこわしたとき (${f("block","stone")})`,
        `world.afterEvents.playerBreakBlock.subscribe((event) => {`,
        `  if (event.brokenBlockPermutation.type.id !== "minecraft:${escId(f("block","stone"))}") return;`,
        `  const player = event.player;`,
        `  if (!player) return;`,
        body,
        `});`,
      ].join("\n");
    case"ev_item":
      return[
        `// 🔮 アイテムをつかったとき (${f("item","diamond")})`,
        `world.afterEvents.itemUse.subscribe((event) => {`,
        `  if (event.itemStack.typeId !== "minecraft:${escId(f("item","diamond"))}") return;`,
        `  const player = event.source;`,
        `  if (!player) return;`,
        body,
        `});`,
      ].join("\n");
    case"ev_tick":
      return[
        `// ⏰ 毎ティック`,
        `system.runInterval(() => {`,
        `  for (const player of world.getPlayers()) {`,
        body.split("\n").map((l:string)=>"    "+l).join("\n"),
        `  }`,
        `}, 1);`,
      ].join("\n");
    case"ev_chat":
      return[
        `// 💬 チャットしたとき ("${f("pat","!hi")}")`,
        `world.beforeEvents.chatSend.subscribe((event) => {`,
        `  if (event.message !== "${escStr(f("pat","!hi"))}") return;`,
        `  event.cancel = true;`,
        `  const player = event.sender;`,
        `  if (!player) return;`,
        body,
        `});`,
      ].join("\n");
    case"ev_hurt":
      return[
        `// 💥 ダメージをうけたとき`,
        `world.afterEvents.entityHurt.subscribe((event) => {`,
        `  if (event.hurtEntity?.typeId !== "minecraft:player") return;`,
        `  const player = event.hurtEntity;`,
        body,
        `});`,
      ].join("\n");
    case"ev_place":
      return[
        `// 🧱 ブロックをおいたとき`,
        `world.afterEvents.playerPlaceBlock.subscribe((event) => {`,
        `  const player = event.player;`,
        `  if (!player) return;`,
        body,
        `});`,
      ].join("\n");
    default:
      return `// ⚠️ 不明なきっかけ: ${b.type}`;
  }
}

/* ══════════════════════════════════════════════════════════
   プリセットプロジェクト（テンプレート集）
   ══════════════════════════════════════════════════════════ */

function mkPreset(blocks: CBlock[]): CBlock[] {
  const idMap = new Map<string,string>();
  const newBlocks = blocks.map(b => {
    const newId = uid();
    idMap.set(b.id, newId);
    return {...b, id: newId};
  });
  return newBlocks.map(b => ({
    ...b,
    nextId:  b.nextId  ? (idMap.get(b.nextId)  ?? null) : null,
    innerId: b.innerId ? (idMap.get(b.innerId) ?? null) : null,
    thenId:  b.thenId  ? (idMap.get(b.thenId)  ?? null) : null,
    elseId:  b.elseId  ? (idMap.get(b.elseId)  ?? null) : null,
  }));
}

const T = (type: string) => TEMPLATES.find(t => t.type === type)!;
const sf = (b: CBlock, id: string, val: string): CBlock =>
  ({...b, fields: b.fields.map((f: FieldDef) => f.id === id ? {...f, value: val} : f)});

interface PresetProject {
  name: string; emoji: string; desc: string;
  create: () => CBlock[];
}

const PRESET_PROJECTS: PresetProject[] = [
  {
    name:"ウェルカムMod", emoji:"👋", desc:"参加時に歓迎メッセージを送信",
    create:() => {
      const a = spawnBlock(T("ev_join"), 100, 600);
      let b = spawnBlock(T("ac_msg"), 100, 600-BH-GAP);
      b = sf(sf(b,"msg","ようこそ！🎉 Modが動いています！"),"target","@a");
      a.nextId = b.id;
      return mkPreset([a,b]);
    },
  },
  {
    name:"HP危険警告", emoji:"🩸", desc:"HP10以下で赤いメッセージを表示",
    create:() => {
      const a = spawnBlock(T("ev_hurt"), 80, 600);
      const donut = spawnBlock(T("co_if"), 300, 600-BH-GAP);
      const cond = spawnBlock(T("co_hp"), 80, 600-BH-GAP);
      cond.fields = cond.fields.map(f => f.id==="threshold" ? {...f,value:"10"} : f);
      let msg = spawnBlock(T("ac_msg"), 600, 600-BH*2-GAP*2);
      msg = sf(sf(msg,"msg","§c§l⚠️ HPが残り少ない！回復して！"),"target","@s");
      a.nextId = donut.id;
      donut.innerId = cond.id;
      donut.thenId = msg.id;
      return mkPreset([a,donut,cond,msg]);
    }
  }
];

/* ══════════════════════════════════════════════════════════
   サウンドシステム（Web Audio API）
   ══════════════════════════════════════════════════════════ */

function tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.25, freqEnd?: number) {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new AC() as AudioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(); osc.stop(ctx.currentTime + dur);
  } catch { /* ミュート環境では無視 */ }
}

/** ブロックが接続されたとき — カチッ（2音コード） */
function playSnapSound() {
  tone(523, 0.07, "sine", 0.22);          // C5
  setTimeout(() => tone(784, 0.05, "sine", 0.12), 10); // G5
}

/** サイドバーからブロックを追加したとき — ポワン */
function playAddSound() {
  tone(330, 0.14, "sine", 0.2, 523);      // E4 → C5 rising
}

/** ブロックを削除したとき — ポン */
function playDeleteSound() {
  tone(440, 0.11, "sawtooth", 0.18, 110); // 降下
}

/** ツールバーボタン — カチッ（極短） */
function playClickSound()     { tone(1100, 0.022, "sine",     0.12); }
function playSuccessSound()   { [523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone(f,0.18,"sine",0.18),i*75)); }
function playWireDeleteSound(){ tone(600, 0.08, "sawtooth", 0.15, 200); }

function playEatSound() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx: AudioContext = new Ctx();
    const master = ctx.createGain();
    master.connect(ctx.destination);

    const osc1 = ctx.createOscillator();
    osc1.type = "sawtooth";
    osc1.frequency.setValueAtTime(600, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.18);
    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.28, ctx.currentTime);
    g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc1.connect(g1); g1.connect(master);
    osc1.start(); osc1.stop(ctx.currentTime + 0.18);

    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(320, ctx.currentTime + 0.14);
    osc2.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.45);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.22, ctx.currentTime + 0.14);
    g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc2.connect(g2); g2.connect(master);
    osc2.start(ctx.currentTime + 0.14); osc2.stop(ctx.currentTime + 0.45);
  } catch { /* 音が出ない環境は無視 */ }
}

function buildCode(blocks:CBlock[]):string{
  const roots=blocks.filter(b=>{
    for(const p of blocks)
      if(p.nextId===b.id||p.innerId===b.id||p.thenId===b.id||p.elseId===b.id)return false;
    return true;
  });
  const triggers=roots.filter(b=>b.category==="trigger");
  const hasUI=blocks.some(b=>b.category==="ui");
  const varNames=new Set<string>();
  blocks.filter(b=>b.category==="variable").forEach(b=>{
    const name=b.fields.find(f=>f.id==="name")?.value||"myVar";
    varNames.add(`_v_${sanitizeVarName(name)}`);
  });
  const varDecls=[...varNames].map(n=>`let ${n} = 0; // 変数: ${n.replace("_v_","")}`).join("\n");
  const header=[
    `// ============================================================`,
    `//  CUBICENGINE Studio — 自動生成コード`,
    `//  @minecraft/server 1.6.0  (実験的機能不要 / Minecraft 1.20.30+)`,
    `// ============================================================`,
    ``,
    `import { world, system } from "@minecraft/server";`,
    ...(hasUI?[`import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";`]:[]),
    ``,
    ...(varDecls ? [varDecls, ``] : []),
    `// ★ 起動確認`,
    `let _ce_ok = false;`,
    `world.afterEvents.playerJoin.subscribe((ev) => {`,
    `  if (_ce_ok) return;`,
    `  _ce_ok = true;`,
    `  const _name = ev.playerName;`,
    `  system.runTimeout(() => {`,
    `    const _p = world.getPlayers().find(p => p.name === _name);`,
    `    if (_p) _p.sendMessage("§a§l[CUBICENGINE] §r§aアドオン起動！ イベント${triggers.length}個");`,
    `    else { for (const _ap of world.getPlayers()) _ap.sendMessage("§a§l[CUBICENGINE] §r§aアドオン起動！"); }`,
    `  }, 40);`,
    `});`,
    ``,
  ].join("\n");
  if(!triggers.length)return header+"// ⚡ きっかけブロックをキャンバスにおいてください！\n";
  return header+triggers.map(t=>genTrigger(t,blocks)).join("\n\n")+"\n";
}

/* ══════════════════════════════════════════════════════════
   ブロック描画コンポーネント
   ══════════════════════════════════════════════════════════ */

/** コロコロかわいいふっくら3Dキューブブロック */
function renderSingleArm(offsetX: number, height: number, hasBlocks: boolean, label: string, colorCat: Category) {
  const cat = CAT[colorCat];
  const armW = 16;
  const R = 8;
  const armH = height + 45;
  
  return (
    <div style={{
      position: "absolute",
      left: offsetX,
      top: -armH,
      width: BW,
      height: armH,
      pointerEvents: "none",
      zIndex: -1,
    }}>
      {/* 3D押し出し上面 (Top Face) - アームの上梁 */}
      <div style={{
        position: "absolute",
        left: -armW,
        top: -16,
        width: BW + armW,
        height: 16,
        background: `linear-gradient(to right, ${cat.top}, ${cat.top})`,
        borderRadius: `${R}px ${R}px 0 0`,
        transform: "skewX(-45deg)",
        transformOrigin: "bottom left",
        borderTop: `4px solid ${cat.border}`,
        borderLeft: `4px solid ${cat.border}`,
        boxSizing: "border-box",
        zIndex: 1,
      }} />

      {/* 縦の側壁 (Left Wall) - 正面 */}
      <div style={{
        position: "absolute",
        left: -armW,
        top: 0,
        width: armW,
        height: armH,
        background: `linear-gradient(135deg, ${cat.top}, ${cat.bg})`,
        borderLeft: `4px solid ${cat.border}`,
        borderBottom: `4px solid ${cat.border}`,
        boxSizing: "border-box",
        boxShadow: "inset 2px 2px 0 rgba(255,255,255,0.2)",
      }} />

      {/* 上部アーム梁 (Top Bar) - 正面 */}
      <div style={{
        position: "absolute",
        left: -armW,
        top: 0,
        width: BW + armW,
        height: 16,
        background: `linear-gradient(135deg, ${cat.top}, ${cat.bg})`,
        borderBottom: `4px solid ${cat.border}`,
        boxSizing: "border-box",
        boxShadow: "inset 2px 2px 0 rgba(255,255,255,0.2)",
      }} />

      {/* アームスロットガイド */}
      {!hasBlocks && (
        <div style={{
          position: "absolute",
          left: 10,
          top: 24,
          width: BW - 20,
          height: height - 12,
          border: `2px dashed ${cat.border}88`,
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: cat.text === "#ffffff" ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
          fontSize: 10,
          fontWeight: 900,
          background: "rgba(0,0,0,0.08)",
          textShadow: cat.text === "#ffffff" ? "1px 1px 0 rgba(0,0,0,0.3)" : "none",
        }}>
          {label}
        </div>
      )}
    </div>
  );
}

function ToyCubeBlock({ b, pos, selected, snapSlot, isEating, isSnapping, isAdding, isDeleting, innerBlock, blocks, onDown, onDelete, onFieldChange, onEjectInner, focusedField, setFocusedField }: {
  b:CBlock; pos:{x:number;y:number}; selected:boolean; snapSlot:string|null;
  isEating?:boolean; isSnapping?:boolean; isAdding?:boolean; isDeleting?:boolean;
  innerBlock?:CBlock|null; blocks:CBlock[];
  onDown:(e:React.MouseEvent,id:string)=>void;
  onDelete:(id:string)=>void;
  onFieldChange:(id:string,fid:string,val:string)=>void;
  onEjectInner?:(id:string)=>void;
  focusedField?: { blockId: string; fieldId: string } | null;
  setFocusedField?: (val: { blockId: string; fieldId: string } | null) => void;
}) {
  const cat = CAT[b.category];
  const hl  = snapSlot !== null;
  const isCond = b.type === "co_if";
  const isLoop = b.type === "ct_rep";
  const thenH = isCond || isLoop ? (b.thenId ? getStackHeight(b.thenId, blocks) : 40) : 0;
  const elseH = isCond ? (b.elseId ? getStackHeight(b.elseId, blocks) : 40) : 0;
  const depth = getDepth(b.id, blocks);

  const anim = isEating   ? "swallow 0.55s ease-in forwards"
             : isDeleting ? "blockDelete 0.32s cubic-bezier(0.36,0.07,0.19,0.97) forwards"
             : isAdding   ? "blockAdd 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards"
             : isSnapping ? "blockSnap 0.12s ease-out"
             : "none";

  const w = BW;
  const h = isCond ? BH : blockH(b);
  const R = 8; // コロコロ角丸サイズ（丸みを少し弱めて8pxに設定）

  // ぷっくりおもちゃ質感のインナーベベル（ガラスっぽさを抑え、マットなプラスチック感に）
  const innerBorder = "inset 4px 4px 0 rgba(255,255,255,0.22), inset -4px -4px 0 rgba(0,0,0,0.15)";

  return (
    <div onMouseDown={e=>onDown(e,b.id)} style={{
      position:"absolute", left:pos.x, top:pos.y,
      width:w, height:h,
      cursor:"grab", userSelect:"none",
      animation: anim,
      transformOrigin: isAdding ? "bottom center" : "center center",
      zIndex: (selected ? 1000 : 20) + depth * 10,
    }}>
      {/* 3D押し出し上面 (Top Face) - 角丸3D */}
      <div style={{
        position: "absolute",
        left: 0,
        top: -21,
        width: w,
        height: 21,
        background: `linear-gradient(to right, ${cat.top}, ${cat.top})`,
        borderRadius: `${R}px ${R}px 0 0`,
        transform: "skewX(-45deg)",
        transformOrigin: "bottom left",
        borderTop: `4px solid ${cat.border}`,
        borderLeft: `4px solid ${cat.border}`,
        borderRight: `2px solid rgba(0,0,0,0.22)`,
        borderBottom: `2px solid rgba(0,0,0,0.22)`,
        boxSizing: "border-box",
        zIndex: 1,
      }} />

      {/* 3D押し出し右側面 (Right Face) - 角丸3D */}
      <div style={{
        position: "absolute",
        left: w,
        top: 0,
        width: 21,
        height: h,
        background: `linear-gradient(to bottom, ${cat.side}, ${cat.side})`,
        borderRadius: `0 ${R}px ${R}px 0`,
        transform: "skewY(-45deg)",
        transformOrigin: "top left",
        borderTop: `2px solid rgba(0,0,0,0.22)`,
        borderRight: `4px solid ${cat.border}`,
        borderBottom: `4px solid ${cat.border}`,
        borderLeft: `2px solid rgba(0,0,0,0.22)`,
        boxSizing: "border-box",
        zIndex: 1,
      }} />

      {/* メインブロック本体（正面 - Front Face） */}
      <div style={{
        position:"absolute",
        left: 0, top: 0, width: w, height: h,
        background: `linear-gradient(135deg, ${cat.top}, ${cat.bg})`,
        borderRadius: R, // コロコロ丸いデザイン
        borderLeft: `4px solid ${cat.border}`,
        borderBottom: `4px solid ${cat.border}`,
        borderRight: `2px solid rgba(0,0,0,0.22)`,
        borderTop: `2px solid rgba(0,0,0,0.22)`,
        boxShadow: selected
          ? `${innerBorder}, 0 0 0 3px #ffffff, 0 0 0 7px ${cat.border}`
          : hl
            ? `${innerBorder}, 0 0 0 4px #ffffff`
            : `${innerBorder}, 4px 4px 0px rgba(0,0,0,0.15)`,
        transition:"box-shadow 0.15s, transform 0.1s",
        display:"flex", flexDirection:"column", padding: "7px 8px", boxSizing:"border-box",
        overflow:"hidden",
        zIndex: 2,
      }}>
        {/* アイコンとラベル */}
        <div style={{display:"flex", alignItems:"center", gap: 5}}>
          <span style={{
            fontSize:18, flexShrink:0, lineHeight:1,
            filter: cat.text === "#ffffff"
              ? "drop-shadow(0 2px 3px rgba(0,0,0,0.7)) drop-shadow(0 0px 1px rgba(0,0,0,0.9))"
              : "drop-shadow(0 1px 1px rgba(255,255,255,0.5))",
          }}>{b.emoji}</span>
          <div style={{
            fontSize: 12,
            fontWeight:900,
            color: cat.text,
            lineHeight:1.2,
            // ブロック表面に刺刀細工で刚り込み刺繍（エングレーブ）したかのような深度感
            textShadow: cat.text === "#ffffff"
              ? "0 1px 0 rgba(255,255,255,0.08), 0 -1px 0 rgba(0,0,0,0.55), 1px 1px 2px rgba(0,0,0,0.4), -0.5px -0.5px 0 rgba(0,0,0,0.3)"
              : "0 1px 0 rgba(255,255,255,0.8), 0 -0.5px 0 rgba(0,0,0,0.25)",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            wordBreak: "break-all",
          }}>
            {b.label}
          </div>
        </div>

        {/* サブラベル */}
        <div style={{
          fontSize:9, 
          color: cat.text === "#ffffff" ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)",
          // カテゴリ名も表面に刺繍されたように
          textShadow: cat.text === "#ffffff"
            ? "0 1px 0 rgba(0,0,0,0.5), 0 -0.5px 0 rgba(255,255,255,0.05)"
            : "0 1px 0 rgba(255,255,255,0.7)",
          fontWeight:700, marginTop: 1, paddingLeft: 1, letterSpacing: "0.04em"
        }}>
          {cat.icon} {cat.label}
        </div>

        {/* フィールド（条件ブロック以外） */}
        {!isCond && b.fields.length > 0 && (
          <div style={{
            marginTop: 6, display:"flex", flexDirection:"column", gap: 4,
            background:"rgba(0,0,0,0.12)", padding: "6px", borderRadius: 8,
            border:`2px solid ${cat.border}`, boxShadow:"inset 2.5px 2.5px 0 rgba(0,0,0,0.18)"
          }}>
            {b.fields.map(f=>{
              const isFocused = focusedField?.blockId === b.id && focusedField?.fieldId === f.id;
              return (
                <div key={f.id} style={{display:"flex",alignItems:"center",gap:6,position:"relative",minHeight:24}}>
                  <span style={{fontSize:12,color: cat.text,fontWeight:900,minWidth:32,textShadow:cat.text==="#ffffff"?"1px 1px 0 #000":"none"}}>{f.label}</span>
                  {f.options?(
                    <select value={f.value} onChange={e=>onFieldChange(b.id,f.id,e.target.value)}
                      onMouseDown={e=>e.stopPropagation()}
                      onFocus={() => setFocusedField?.({ blockId: b.id, fieldId: f.id })}
                      onBlur={() => setFocusedField?.(null)}
                      style={{
                        flex: isFocused ? "none" : 1,
                        position: isFocused ? "absolute" : "relative",
                        left: isFocused ? 38 : "auto",
                        width: isFocused ? 220 : "100%",
                        zIndex: isFocused ? 999 : 1,
                        transition: "width 0.25s ease, z-index 0.25s",
                        fontSize:12,background:"#2c2c2c",border:`2px solid #57606f`,borderRadius:6,color:"#fff",padding:"2px",outline:"none",fontWeight:800,
                        boxShadow:"inset 1.5px 1.5px 0 rgba(0,0,0,0.5)", fontFamily:"inherit"
                      }}>
                      {f.options.map(o=><option key={o} value={o}>{o}</option>)}
                    </select>
                  ):(
                    <input value={f.value} onChange={e=>onFieldChange(b.id,f.id,e.target.value)}
                      onMouseDown={e=>e.stopPropagation()}
                      onFocus={() => setFocusedField?.({ blockId: b.id, fieldId: f.id })}
                      onBlur={() => setFocusedField?.(null)}
                      style={{
                        flex: isFocused ? "none" : 1,
                        position: isFocused ? "absolute" : "relative",
                        left: isFocused ? 38 : "auto",
                        width: isFocused ? 220 : "100%",
                        zIndex: isFocused ? 999 : 1,
                        transition: "width 0.25s ease, z-index 0.25s",
                        fontSize:12,background:"#2c2c2c",border:`2px solid #57606f`,borderRadius:6,color:"#fff",padding:"2px 4px",outline:"none",fontWeight:800,
                        boxShadow:"inset 1.5px 1.5px 0 rgba(0,0,0,0.5)", fontFamily:"inherit"
                      }}/>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 条件ブロック（co_if）専用：右側の分岐アームなど */}
      {isCond && (
        <>
          {/* 条件ブロックを入れるくぼみ（スナップ先） */}
          <div style={{
            position:"absolute", top: BH/2-20, left: BW, width: 24, height: 40,
            background: "rgba(0,0,0,0.12)",
            border: `4px solid ${cat.border}`, borderLeft: "none",
            boxShadow: "inset 3px 3px 0 rgba(0,0,0,0.18)",
            borderRadius: "0 8px 8px 0",
            display:"flex", alignItems:"center", justifyContent:"center"
          }}>
            <span style={{fontSize:12, opacity:0.8, color: "#fff", textShadow:"1px 1px 0 #000"}}>▶</span>
          </div>

          {/* 上：そうなら 分岐ガイド */}
          <div style={{position:"absolute", left: BW/2-24, top: -20, zIndex:10, pointerEvents:"none"}}>
            <div style={{
              fontSize:9,fontWeight:900,color:"#fff",background:"#2ecc71",
              border:`2px solid ${cat.border}`, padding:"1px 6px", borderRadius: 8,
              boxShadow: "inset 1px 1px 0 rgba(255,255,255,0.25), 2px 2px 0 rgba(0,0,0,0.15)",
            }}>
              ✓ そうなら
            </div>
          </div>
          
          {/* 右：ちがうなら 分岐ガイド */}
          <div style={{position:"absolute", left: BW + GAP + 60, top: BH/2-10, zIndex:10, pointerEvents:"none"}}>
            <div style={{
              fontSize:9,fontWeight:900,color:"#fff",background:"#ff7f50",
              border:`2px solid ${cat.border}`, padding:"1px 6px", borderRadius: 8,
              boxShadow: "inset 1px 1px 0 rgba(255,255,255,0.25), 2px 2px 0 rgba(0,0,0,0.15)",
            }}>
              ✗ ちがうなら
            </div>
          </div>
          
          {/* innerBlockの取り出しボタン */}
          {innerBlock && onEjectInner && (
            <button
              onMouseDown={e=>{e.stopPropagation();onEjectInner(b.id);}}
              title="ブロックを取り出す"
              style={{
                position:"absolute", left: BW+GAP-10, top: BH/2-10,
                width:20, height:20, borderRadius:5, background:"#747d8c",
                border:"2px solid #2f3542", color:"#fff", fontSize:11,
                cursor:"pointer", zIndex:30, display:"flex", alignItems:"center", justifyContent:"center",
                boxShadow:"inset 1.5px 1.5px 0 rgba(255,255,255,0.25), 2px 2px 0 rgba(0,0,0,0.15)", padding:0,
                fontWeight: 900
              }}
            >↩</button>
          )}
        </>
      )}

      {/* 3Dアームの描画（条件分岐・繰り返し） */}
      {isLoop && renderSingleArm(0, thenH, !!b.thenId, "🔄 くりかえし", b.category)}
      {isCond && (
        <>
          {renderSingleArm(0, thenH, !!b.thenId, "✓ そうなら", b.category)}
          {renderSingleArm(BW + GAP + 120, elseH, !!b.elseId, "✗ ちがうなら", b.category)}
          {/* ベース接続梁 */}
          <div style={{
            position: "absolute",
            left: BW,
            top: -16,
            width: GAP + 120,
            height: 16,
            background: `linear-gradient(to bottom, ${cat.top}, ${cat.bg})`,
            borderTop: `4px solid ${cat.border}`,
            borderBottom: `4px solid ${cat.border}`,
            boxSizing: "border-box",
            zIndex: -2,
          }} />
        </>
      )}

      {/* ✕ 削除ボタン（ブロック右上のコーナーにひっそり埋め込み） */}
      {!isEating && (
        <button
          onMouseDown={e=>{e.stopPropagation();onDelete(b.id);}}
          title="削除"
          style={{
            position:"absolute", top: 3, right: 4,
            width:14, height:14, borderRadius:3,
            background:"rgba(0,0,0,0.25)",
            border:`1px solid ${cat.border}`,
            color: cat.text, fontSize:8, fontWeight:900,
            cursor:"pointer", zIndex:30, display:"flex", alignItems:"center", justifyContent:"center",
            opacity: 0.45,
            padding:0,
            lineHeight:1,
            transition:"opacity 0.15s",
          }}
          onMouseEnter={e=>(e.currentTarget.style.opacity="1")}
          onMouseLeave={e=>(e.currentTarget.style.opacity="0.45")}
        >✕</button>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   3Dトイベースプレート（地面の土台）
   ══════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════
   3Dトイスペース背景（床と壁の奥行き空間）
   ══════════════════════════════════════════════════════════ */

function ToyWall(_props: { pan: { x: number; y: number }; zoom: number }) {
  // シンプルな縦方向の "奥行き" 表現のみ。
  // - 上端：奥から差し込む光（やや明るい）
  // - 下端：床に向かって暗くなる
  // 四隅は内側シャドウで軽くビネット。
  return (
    <div style={{
      position: "absolute",
      inset: 0,
      overflow: "hidden",
      zIndex: 0,
      pointerEvents: "none",
      background: "linear-gradient(to bottom, #2a262d 0%, #1d1c20 50%, #14131a 100%)",
      boxShadow: "inset 0 0 180px rgba(0,0,0,0.55)",
    }}/>
  );
}

/**
 * 床 — シンプル・上品な接地ライン版。
 * 黄緑〜ポッチ的なおもちゃ感をやめて、深い石グレー + ランダム位置ドット3層 +
 * 上端にマゼンタのネオンエッジで上品な接地ラインを表現。
 */
function ToyFloor() {
  const width  = 24000;
  const left   = -12000;
  const groundY = 600 + BH; // = 660（接地ライン）

  return (
    <div style={{
      position: "absolute",
      left, top: groundY,
      width, height: 4000,
      pointerEvents: "none",
      zIndex: 1,
      backgroundColor: "#1d1c20",
      // 3層の極小ドット（位置を別個にずらし、規則的な格子に見えないようにする）
      backgroundImage: [
        "radial-gradient(circle, rgba(255,255,255,0.035) 0.5px, transparent 1px)",
        "radial-gradient(circle, rgba(255,255,255,0.022) 0.5px, transparent 1px)",
        "radial-gradient(circle, rgba(236,72,153,0.018) 0.5px, transparent 1px)",
      ].join(","),
      backgroundSize: "37px 37px, 53px 53px, 89px 89px",
      backgroundPosition: "0 0, 13px 21px, 31px 47px",
      // 上端ハイライト + 下方フェードで奥行き感
      boxShadow: "inset 0 20px 40px rgba(0,0,0,0.55), inset 0 -200px 200px rgba(0,0,0,0.4)",
    }}>
      {/* 上端のマゼンタネオンライン（接地エッジを際立たせる） */}
      <div style={{
        position: "absolute",
        left: 0, top: 0,
        width, height: 1.5,
        background: "linear-gradient(90deg, transparent 0%, #ec4899 20%, #f472b6 50%, #ec4899 80%, transparent 100%)",
        backgroundSize: "1200px 1.5px",
        boxShadow: "0 0 16px rgba(236,72,153,0.65), 0 0 4px rgba(236,72,153,1)",
      }} />
      {/* その直下にエッジを強調する暗線（落ち影） */}
      <div style={{
        position: "absolute",
        left: 0, top: 1.5,
        width, height: 6,
        background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)",
      }} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   接続コネクター
   ══════════════════════════════════════════════════════════ */

function Connector({ x, y, color }: { x:number; y:number; color:string }) {
  return (
    <div style={{
      position:"absolute",
      left: x - BW / 2,
      top: y - 2,
      width: BW,
      height: 3,
      background: `linear-gradient(90deg, transparent 0%, ${color} 20%, rgba(255,255,255,0.7) 50%, ${color} 80%, transparent 100%)`,
      boxShadow: `0 0 6px ${color}, 0 0 2px rgba(255,255,255,0.6)`,
      zIndex: 10,
      pointerEvents: "none",
    }}/>
  );
}

/* ══════════════════════════════════════════════════════════
   スナップインジケーター
   ══════════════════════════════════════════════════════════ */

function SnapIndicator({ x, y, color, zoom, slot }: { x:number; y:number; color:string; zoom:number; slot:string }) {
  const width = BW * zoom;
  const height = BH * zoom;
  const R = 8 * zoom;

  // 接続スロットごとに矢印 + 短い説明
  const labelMap: Record<string,string> = {
    next:  "▼ ここに積む",
    then:  "▼ そうなら",
    else:  "▶ ちがうなら",
    inner: "◀ ここに入れる",
  };
  const label = labelMap[slot] ?? "▼ ここに接続";

  return (
    <>
      {/* メインのスナップゾーン — 二重枠 + 半透明フィル + パルス */}
      <div style={{
        position:"absolute",
        left: x - width/2,
        top: y - height/2,
        width, height,
        borderRadius: R,
        border: `4px solid ${color}`,
        outline: `2px solid rgba(255,255,255,0.95)`,
        outlineOffset: `-2px`,
        background: `${color}33`,
        boxShadow: `0 0 0 3px ${color}55, 0 0 28px ${color}, inset 0 0 18px ${color}55`,
        animation: "snapPulse 0.55s ease-in-out infinite alternate",
        zIndex: 100,
        pointerEvents: "none",
      }}/>
      {/* 中央の十字スナップポイント (磁石の中心) */}
      <div style={{
        position:"absolute",
        left: x - 10, top: y - 10,
        width: 20, height: 20,
        zIndex: 101,
        pointerEvents:"none",
      }}>
        <div style={{position:"absolute", left:9, top:0, width:2, height:20, background:"#fff", boxShadow:`0 0 6px ${color}`}}/>
        <div style={{position:"absolute", left:0, top:9, width:20, height:2, background:"#fff", boxShadow:`0 0 6px ${color}`}}/>
      </div>
      {/* 方向ラベル — スロットに応じた説明 */}
      <div style={{
        position:"absolute",
        left: x - 75,
        top: y - height/2 - 32,
        width: 150,
        textAlign:"center",
        fontFamily: "var(--font-pixel), monospace",
        fontSize: 10,
        letterSpacing: "0.05em",
        color: "#fff",
        background: color,
        border: `2px solid #fff`,
        padding: "4px 6px",
        boxShadow: `0 2px 0 rgba(0,0,0,0.4), 0 0 12px ${color}`,
        animation: "snapLabelBob 0.45s ease-in-out infinite alternate",
        zIndex: 102,
        pointerEvents:"none",
        whiteSpace:"nowrap",
        textShadow:"1px 1px 0 rgba(0,0,0,0.6)",
      }}>{label}</div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════
   サイドバー
   ══════════════════════════════════════════════════════════ */

function BlockTray({
  filtered,
  onAdd,
  searching,
  activeCategory
}: {
  filtered: Tmpl[];
  onAdd: (t: Tmpl) => void;
  searching: boolean;
  activeCategory: Category;
}) {
  // 演算カテゴリ専用のサブタブ状態
  const [calcSub, setCalcSub] = useState<CalcSubCat>("arith");
  const showSubtabs = activeCategory === "calc" && !searching;

  // 演算サブタブ選択中は、その分類のテンプレートだけに更にフィルタ
  const visibleTemplates = showSubtabs
    ? filtered.filter(t => getCalcSubCat(t) === calcSub)
    : filtered;

  return (
    <div className="mc-bevel" style={{
      width: "100%",
      height: showSubtabs ? 154 : 120,
      flexShrink: 0,
      background: "#3a3833",
      display: "flex",
      flexDirection: "row",
      overflow: "hidden",
      borderTop: "3px solid #1f1e1a",
      borderBottom: "none",
      borderLeft: "none",
      borderRight: "none",
      boxSizing: "border-box"
    }}>
      {/* 左端アクション（ランダム追加ボタン） */}
      <div style={{
        width: 130,
        padding: "10px",
        borderRight: "2px solid #1f1e1a",
        background: "linear-gradient(90deg, #2a2924 0%, #1f1e1a 100%)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: 6,
        flexShrink: 0
      }}>
        <McButton
          size="sm"
          variant="primary"
          disabled={filtered.length === 0}
          title={filtered.length > 0 ? "ランダムに1個追加" : "該当ブロックなし"}
          onClick={() => {
            if (filtered.length === 0) return;
            const pick = filtered[Math.floor(Math.random() * filtered.length)];
            onAdd(pick);
          }}
          style={{ width: "100%" }}
        >
          🎲 ランダム
        </McButton>
        <span style={{ fontSize: 9, color: "#c8c4b8", fontWeight: 600, textAlign: "center" }}>
          {searching
            ? <>検索: <strong style={{ color: "#f9a8d4" }}>{filtered.length}</strong> 件</>
            : <>全 <strong style={{ color: "#f5f0e1" }}>{filtered.length}</strong> 個</>}
        </span>
      </div>

      {/* 中央：横スクロールするブロックアイテム一覧 */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* 演算カテゴリのみ：サブタブ */}
        {showSubtabs && (
          <div style={{
            display: "flex",
            flexDirection: "row",
            gap: 4,
            padding: "6px 14px 4px",
            borderBottom: "2px solid #1f1e1a",
            background: "linear-gradient(180deg, #2a2924 0%, #232220 100%)",
            flexShrink: 0,
          }}>
            {CALC_SUBTABS.map(s => {
              const active = calcSub === s.key;
              return (
                <button key={s.key}
                  onClick={() => setCalcSub(s.key)}
                  title={s.label}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "4px 10px",
                    fontSize: 11, fontWeight: 800,
                    fontFamily: "var(--font-pixel), monospace",
                    letterSpacing: "0.03em",
                    color: active ? "#111111" : "#c8c4b8",
                    background: active
                      ? "linear-gradient(135deg,#7fd831 0%,#5dbb1a 100%)"
                      : "#1f1e1a",
                    border: "2px solid",
                    borderTopColor: active ? "#a4e85a" : "#3a3833",
                    borderLeftColor: active ? "#a4e85a" : "#3a3833",
                    borderRightColor: active ? "#1a4d04" : "#0a0907",
                    borderBottomColor: active ? "#1a4d04" : "#0a0907",
                    borderRadius: 0,
                    cursor: "pointer",
                    transition: "all 0.1s ease",
                    boxShadow: active
                      ? "0 2px 0 #1a4d04, 0 0 12px rgba(125,216,49,0.4)"
                      : "0 2px 0 #0a0907",
                    textShadow: active ? "1px 1px 0 rgba(255,255,255,0.3)" : "none",
                  }}>
                  <span style={{fontSize: 13}}>{s.icon}</span>
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ブロックリスト本体（横スクロール） */}
        <div style={{
          flex: 1,
          overflowX: "auto",
          overflowY: "hidden",
          padding: "10px 16px",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          scrollbarWidth: "thin",
          scrollbarColor: "#4a4842 #2a2924"
        }}>
        {visibleTemplates.map(t => {
          const c = CAT[t.category];
          
          // ドット絵風のソリッドベベル（インナーベベル）
          const innerBorder = "inset 2px 2px 0 rgba(255,255,255,0.45), inset -2px -2px 0 rgba(0,0,0,0.3)";
          const hoverInnerBorder = "inset 2px 2px 0 rgba(255,255,255,0.6), inset -2px -2px 0 rgba(0,0,0,0.35)";
          const pressInnerBorder = "inset 2px 2px 0 rgba(0,0,0,0.45), inset -2px -2px 0 rgba(255,255,255,0.25)";
          const bw_w = 76;
          const bw_h = 68;

          return (
            <button key={t.type + t.label} onClick={() => onAdd(t)} title={t.sublabel}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
                width: bw_w, height: bw_h, padding: "4px 3px",
                borderRadius: 8, // 角丸おもちゃキューブ
                background: `linear-gradient(135deg, ${c.top}, ${c.bg})`,
                borderLeft: `3px solid ${c.border}`,
                borderBottom: `3px solid ${c.border}`,
                borderRight: `1.5px solid rgba(0,0,0,0.22)`,
                borderTop: `1.5px solid rgba(0,0,0,0.22)`,
                cursor: "pointer",
                transition: "transform 0.08s ease, box-shadow 0.08s ease, background 0.1s ease, border-color 0.1s ease",
                boxShadow: `${innerBorder}, 3px 3px 0 rgba(0,0,0,0.15)`,
                flexShrink: 0,
                position: "relative",
                overflow: "visible", // 3Dの上面・側面をはみ出させるため
              }}
              onMouseEnter={e => {
                const el = e.currentTarget;
                el.style.transform = "translate(-2px, -2px)";
                el.style.boxShadow = `${hoverInnerBorder}, 5px 5px 0 rgba(0,0,0,0.22)`;
              }}
              onMouseLeave={e => {
                const el = e.currentTarget;
                el.style.transform = "";
                el.style.boxShadow = `${innerBorder}, 3px 3px 0 rgba(0,0,0,0.15)`;
              }}
              onMouseDown={e => {
                const el = e.currentTarget;
                el.style.transform = "translate(1px, 1px)";
                el.style.boxShadow = `${pressInnerBorder}, 1px 1px 0 rgba(0,0,0,0.15)`;
              }}
              onMouseUp={e => {
                const el = e.currentTarget;
                el.style.transform = "translate(-2px, -2px)";
                el.style.boxShadow = `${hoverInnerBorder}, 5px 5px 0 rgba(0,0,0,0.22)`;
              }}
            >
              {/* ミニ上面 (Top Face) */}
              <div style={{
                position: "absolute",
                left: 0,
                top: -17,
                width: bw_w,
                height: 17,
                background: c.top,
                borderRadius: "8px 8px 0 0",
                transform: "skewX(-45deg)",
                transformOrigin: "bottom left",
                borderTop: `2.5px solid ${c.border}`,
                borderLeft: `2.5px solid ${c.border}`,
                borderRight: `1px solid rgba(0,0,0,0.22)`,
                borderBottom: `1px solid rgba(0,0,0,0.22)`,
                boxSizing: "border-box",
                pointerEvents: "none",
                zIndex: -1,
              }} />

              {/* ミニ右側面 (Right Face) */}
              <div style={{
                position: "absolute",
                left: bw_w,
                top: 0,
                width: 17,
                height: bw_h,
                background: c.side,
                borderRadius: `0 8px 8px 0`,
                transform: "skewY(-45deg)",
                transformOrigin: "top left",
                borderTop: `1px solid rgba(0,0,0,0.22)`,
                borderRight: `2.5px solid ${c.border}`,
                borderBottom: `2.5px solid ${c.border}`,
                borderLeft: `1px solid rgba(0,0,0,0.22)`,
                boxSizing: "border-box",
                pointerEvents: "none",
                zIndex: -1,
              }} />

              <span style={{ fontSize: t.type === "co_if" ? 22 : 20, filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.4))", lineHeight: 1, zIndex: 1 }}>
                {t.emoji}
              </span>
              <span style={{
                fontSize: t.label.length > 6 ? 9 : 11,
                fontWeight: 900,
                color: c.text,
                textAlign: "center",
                lineHeight: 1.1,
                width: "100%",
                wordBreak: "break-all",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                textShadow: c.text === "#ffffff"
                  ? "1.5px 1.5px 0 #000, -1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000"
                  : "none",
                zIndex: 1
              }}>
                {t.label}
              </span>
            </button>
          );
        })}
        {visibleTemplates.length === 0 && (
          <div style={{ color: "#9c9890", fontSize: 12, padding: "10px 20px" }}>
            該当するブロックなし
          </div>
        )}
        </div>{/* /inner scroll */}
      </div>{/* /outer column */}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   プロジェクト管理パネル
   ══════════════════════════════════════════════════════════ */

interface SavedProject { name: string; savedAt: string; blocks: CBlock[] }

function ProjectPanel({ blocks, onLoad, onClose }: {
  blocks: CBlock[];
  onLoad: (blocks: CBlock[]) => void;
  onClose: () => void;
}) {
  const [projects, setProjects] = useState<Omit<SavedProject,"blocks">[]>([]);
  const [saveName, setSaveName] = useState("マイプロジェクト");
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    try {
      const stored: Record<string,SavedProject> = JSON.parse(localStorage.getItem("mmc-projects")||"{}");
      setProjects(Object.values(stored).map(p => ({name:p.name, savedAt:p.savedAt})));
    } catch {}
  }, []);

  const flash = (m: string) => { setMsg(m); setTimeout(()=>setMsg(""), 2000); };

  const save = () => {
    if (!saveName.trim()) return;
    const stored: Record<string,SavedProject> = JSON.parse(localStorage.getItem("mmc-projects")||"{}");
    const project: SavedProject = { name:saveName, savedAt:new Date().toLocaleString("ja-JP"), blocks };
    stored[saveName] = project;
    localStorage.setItem("mmc-projects", JSON.stringify(stored));
    setProjects(Object.values(stored).map(p=>({name:p.name,savedAt:p.savedAt})));
    flash("💾 保存しました！");
  };

  const load = (name: string) => {
    const stored: Record<string,SavedProject> = JSON.parse(localStorage.getItem("mmc-projects")||"{}");
    if (stored[name]) { onLoad(stored[name].blocks); onClose(); }
  };

  const del = (name: string) => {
    const stored: Record<string,SavedProject> = JSON.parse(localStorage.getItem("mmc-projects")||"{}");
    delete stored[name];
    localStorage.setItem("mmc-projects", JSON.stringify(stored));
    setProjects(Object.values(stored).map(p=>({name:p.name,savedAt:p.savedAt})));
  };

  const exportJson = () => {
    const data = JSON.stringify({name:saveName, blocks, version:"2.0"}, null, 2);
    const url = URL.createObjectURL(new Blob([data],{type:"application/json"}));
    const a = document.createElement("a");
    a.href=url; a.download=`${saveName.replace(/\s+/g,"_")}.mmc.json`; a.click();
    URL.revokeObjectURL(url);
    flash("📤 ダウンロードしました！");
  };

  const importJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.blocks) { onLoad(data.blocks); onClose(); }
      } catch { flash("❌ 読み込みに失敗しました"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const P = (style: React.CSSProperties): React.CSSProperties => style;

  return (
    <div style={{position:"absolute",top:50,left:"50%",transform:"translateX(-50%)",zIndex:50,
      width:440,background:"#fff",borderRadius:18,boxShadow:"0 12px 48px rgba(0,0,0,0.22)",
      border:"2px solid #e8eaf0",overflow:"hidden"}}>
      {/* ヘッダー */}
      <div style={{padding:"12px 18px",background:"linear-gradient(135deg,#6c5ce7,#a29bfe)",
        display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:14,fontWeight:800,color:"#fff"}}>📁 プロジェクト管理</span>
        <button onClick={onClose} style={{background:"rgba(255,255,255,0.2)",border:"none",borderRadius:8,
          color:"#fff",cursor:"pointer",fontSize:12,padding:"3px 10px",fontWeight:700}}>✕ 閉じる</button>
      </div>

      <div style={{padding:"16px 18px",maxHeight:440,overflowY:"auto"}}>
        {/* 保存 */}
        <div style={{marginBottom:14}}>
          <div style={{fontSize:11,fontWeight:700,color:"#444",marginBottom:6}}>💾 現在の作業を保存</div>
          <div style={{display:"flex",gap:8}}>
            <input value={saveName} onChange={e=>setSaveName(e.target.value)}
              style={{flex:1,padding:"7px 10px",borderRadius:8,border:"1.5px solid #ddd",fontSize:12,outline:"none"}}
              placeholder="プロジェクト名" />
            <button onClick={save} style={{padding:"7px 16px",borderRadius:8,background:"#6c5ce7",
              border:"none",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>保存</button>
          </div>
          {msg && <div style={{marginTop:6,fontSize:11,color:"#00b894",fontWeight:700}}>{msg}</div>}
        </div>

        {/* 保存済みプロジェクト */}
        {projects.length > 0 && (
          <div style={{marginBottom:14}}>
            <div style={{fontSize:11,fontWeight:700,color:"#444",marginBottom:6}}>📂 保存済みプロジェクト</div>
            {projects.map(p => (
              <div key={p.name} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 10px",
                background:"#f8f9ff",borderRadius:8,marginBottom:4,border:"1px solid #e8eaf0"}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#333"}}>{p.name}</div>
                  <div style={{fontSize:10,color:"#333"}}>{p.savedAt}</div>
                </div>
                <button onClick={()=>load(p.name)} style={P({padding:"4px 10px",borderRadius:6,
                  background:"#e8f4fd",border:"1px solid #b3d9f7",color:"#0984e3",fontSize:11,
                  fontWeight:700,cursor:"pointer"})}>開く</button>
                <button onClick={()=>del(p.name)} style={P({padding:"4px 10px",borderRadius:6,
                  background:"#fde8e8",border:"1px solid #f7b3b3",color:"#d63031",fontSize:11,
                  fontWeight:700,cursor:"pointer"})}>削除</button>
              </div>
            ))}
          </div>
        )}

        {/* インポート/エクスポート */}
        <div style={{borderTop:"1px solid #e8eaf0",paddingTop:12,display:"flex",gap:8}}>
          <button onClick={exportJson} style={{flex:1,padding:"8px",borderRadius:8,
            background:"#fff3e0",border:"1.5px solid #ffcc80",color:"#e67e22",fontSize:12,
            fontWeight:700,cursor:"pointer"}}>📤 JSONをダウンロード</button>
          <button onClick={()=>fileRef.current?.click()} style={{flex:1,padding:"8px",borderRadius:8,
            background:"#e8f5e9",border:"1.5px solid #a5d6a7",color:"#2e7d32",fontSize:12,
            fontWeight:700,cursor:"pointer"}}>📥 JSONを読み込む</button>
          <input ref={fileRef} type="file" accept=".json,.mmc.json" onChange={importJson} style={{display:"none"}} />
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   テンプレートギャラリー
   ══════════════════════════════════════════════════════════ */

function TemplateGallery({ onSelect, onClose }: {
  onSelect: (blocks: CBlock[]) => void;
  onClose: () => void;
}) {
  return (
    <div style={{position:"absolute",top:50,left:"50%",transform:"translateX(-50%)",zIndex:50,
      width:520,background:"#fff",borderRadius:18,boxShadow:"0 12px 48px rgba(0,0,0,0.22)",
      border:"2px solid #e8eaf0",overflow:"hidden"}}>
      <div style={{padding:"12px 18px",background:"linear-gradient(135deg,#00b894,#55efc4)",
        display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:14,fontWeight:800,color:"#fff"}}>🎮 テンプレートギャラリー</span>
        <button onClick={onClose} style={{background:"rgba(255,255,255,0.2)",border:"none",borderRadius:8,
          color:"#fff",cursor:"pointer",fontSize:12,padding:"3px 10px",fontWeight:700}}>✕ 閉じる</button>
      </div>
      <div style={{padding:"14px 18px",maxHeight:460,overflowY:"auto"}}>
        <div style={{fontSize:11,color:"#333",marginBottom:12}}>
          クリックで今のキャンバスに追加します（既存のブロックは消えません）
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {PRESET_PROJECTS.map((p, i) => (
            <button key={i} onClick={() => { onSelect(p.create()); onClose(); }}
              style={{textAlign:"left",padding:"14px 14px",borderRadius:12,
                background:"#f8f9ff",border:"2px solid #e8eaf0",cursor:"pointer",
                transition:"all 0.12s"}}
              onMouseEnter={e=>{const el=e.currentTarget;el.style.background="#f0f4ff";el.style.borderColor="#6c5ce7";}}
              onMouseLeave={e=>{const el=e.currentTarget;el.style.background="#f8f9ff";el.style.borderColor="#e8eaf0";}}>
              <div style={{fontSize:24,marginBottom:4}}>{p.emoji}</div>
              <div style={{fontSize:12,fontWeight:800,color:"#333",marginBottom:3}}>{p.name}</div>
              <div style={{fontSize:10,color:"#444",lineHeight:1.4}}>{p.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   メインパネル
   ══════════════════════════════════════════════════════════ */

export default function LogicPanel() {
  const setGeneratedJsCode = useEditorStore(s=>s.setGeneratedJsCode);
  const setLogicGraphJson  = useEditorStore(s=>s.setLogicGraphJson);

  const [blocks, setBlocks] = useState<CBlock[]>(()=>{
    try{
      const j=useEditorStore.getState().logicGraphJson; 
      if(j) {
        const parsed = JSON.parse(j);
        return parsed.nodes??parsed.blocks??makeInitial();
      }
    }catch{}
    try{
      if(typeof window !== "undefined") {
        const local = localStorage.getItem("mmc-autosave-logic");
        if(local) {
          const parsed = JSON.parse(local);
          return parsed.blocks??parsed;
        }
      }
    }catch{}
    return makeInitial();
  });
  const [pan,       setPan]      = useState({x:60,y:60});
  const [zoom,      setZoom]     = useState(0.9);
  const [selected,  setSelected] = useState<string|null>(null);
  const [search,    setSearch]   = useState("");
  const [showLib,   setShowLib]  = useState(true);
  const [activeCategory, setActiveCategory] = useState<Category>("trigger");
  const [focusedField, setFocusedField] = useState<{ blockId: string; fieldId: string } | null>(null);

  const searching = search.trim().length > 0;
  const filtered = searching
    ? TEMPLATES.filter(t=>t.label.includes(search)||t.sublabel.includes(search))
    : TEMPLATES.filter(t=>t.category===activeCategory);
  const [showCode,  setShowCode] = useState(false);
  const [showHelp,  setShowHelp] = useState(true);
  const [genCode,   setGenCode]  = useState("");
  const [snapHint,  setSnapHint] = useState<{targetId:string;slot:string;pos:{x:number;y:number}}|null>(null);
  const [eating,       setEating]      = useState<string|null>(null);
  const [chomping,     setChomping]    = useState<string|null>(null);
  const [snapAnim,     setSnapAnim]    = useState<string|null>(null);   // スナップ時バウンス
  const [addAnim,      setAddAnim]     = useState<string|null>(null);   // 追加時スライドイン
  const [deleteAnim,   setDeleteAnim]  = useState<string|null>(null);   // 削除時フェードアウト

  // パーティクルバースト (スクリーン座標)
  const [particles, setParticles] = useState<{id:string;x:number;y:number;color:string}[]>([]);
  const [showProjects, setShowProjects]= useState(false);
  const [showTemplates,setShowTemplates]=useState(false);

  // ─── Undo / Redo ───
  const historyRef    = useRef<string[]>([JSON.stringify(blocks)]);
  const historyIdx    = useRef(0);
  const skipHistory   = useRef(false);

  useEffect(()=>{
    if(skipHistory.current){ skipHistory.current=false; return; }
    const timer=setTimeout(()=>{
      const json=JSON.stringify(blocks);
      if(json===historyRef.current[historyIdx.current])return;
      historyRef.current=historyRef.current.slice(0,historyIdx.current+1);
      historyRef.current.push(json);
      if(historyRef.current.length>60)historyRef.current.shift();
      historyIdx.current=historyRef.current.length-1;
    },350);
    return()=>clearTimeout(timer);
  },[blocks]);

  const undo=useCallback(()=>{
    if(historyIdx.current<=0)return;
    historyIdx.current--;
    skipHistory.current=true;
    setBlocks(JSON.parse(historyRef.current[historyIdx.current]));
  },[]);

  const redo=useCallback(()=>{
    if(historyIdx.current>=historyRef.current.length-1)return;
    historyIdx.current++;
    skipHistory.current=true;
    setBlocks(JSON.parse(historyRef.current[historyIdx.current]));
  },[]);

  const containerRef = useRef<HTMLDivElement>(null);
  const live = useRef({pan,zoom,blocks,selected,snapHint});
  live.current={pan,zoom,blocks,selected,snapHint};

  const panDrag  = useRef({active:false,sx:0,sy:0,sp:{x:0,y:0}});
  const blockDrag = useRef({active:false,id:"",offX:0,offY:0});

  const handleWheel=useCallback((e:React.WheelEvent)=>{
    e.preventDefault();
    const rect=containerRef.current!.getBoundingClientRect();
    const mx=e.clientX-rect.left;
    const fac=e.deltaY<0?1.1:1/1.1;
    const groundY = 600 + BH; // 地面の y 座標 (660)
    setZoom(z=>{
      const nz=Math.min(2.5,Math.max(0.2,z*fac));
      setPan(p=>({
        x:mx-(mx-p.x)*(nz/z),
        y:p.y + groundY * (z - nz) // 地面の上下位置（底辺）を画面上で固定する
      }));
      return nz;
    });
  },[]);

  const handleBgDown=useCallback((e:React.MouseEvent)=>{
    if(e.button!==0&&e.button!==1)return;
    panDrag.current={active:true,sx:e.clientX,sy:e.clientY,sp:{...live.current.pan}};
    setSelected(null);e.preventDefault();
  },[]);

  const handleBlockDown=useCallback((e:React.MouseEvent,id:string)=>{
    e.stopPropagation();
    const{pan,zoom,blocks}=live.current;
    const rect=containerRef.current!.getBoundingClientRect();
    const pos=getPos(id,blocks);
    const visX=pos.x, visY=pos.y;
    setBlocks(prev=>{
      const detached=detach(id,prev);
      return detached.map(b=>b.id===id?{...b,x:visX,y:visY}:b);
    });
    const mx=(e.clientX-rect.left)/zoom - pan.x/zoom;
    const my=(e.clientY-rect.top)/zoom  - pan.y/zoom;
    blockDrag.current={active:true,id,offX:mx-visX,offY:my-visY};
    setSelected(id);
  },[]);

  const handleFieldChange=useCallback((id:string,fid:string,val:string)=>{
    setBlocks(prev=>prev.map(b=>b.id===id?{...b,fields:b.fields.map(f=>f.id===fid?{...f,value:val}:f)}:b));
  },[]);

  const handleDelete=useCallback((id:string)=>{
    playDeleteSound();
    setDeleteAnim(id);
    setTimeout(()=>{
      setBlocks(prev=>{const d=detach(id,prev);return d.filter(b=>!getFamily(id,d).includes(b.id));});
      setSelected(null);
      setDeleteAnim(null);
    }, 320);
  },[]);

  const handleEjectInner=useCallback((donutId:string)=>{
    setBlocks(prev=>{
      const donut=prev.find(b=>b.id===donutId);
      if(!donut?.innerId)return prev;
      const innerId=donut.innerId;
      const dp=getPos(donutId,prev);
      return prev.map(b=>{
        if(b.id===donutId)return{...b,innerId:null};
        if(b.id===innerId)return{...b,x:dp.x+BW+GAP*2,y:dp.y};
        return b;
      });
    });
  },[]);

  useEffect(()=>{
    function onMove(e:MouseEvent){
      const rect=containerRef.current?.getBoundingClientRect(); if(!rect)return;
      const{pan,zoom,blocks}=live.current;
      if(panDrag.current.active){
        setPan({x:panDrag.current.sp.x+(e.clientX-panDrag.current.sx),y:panDrag.current.sp.y+(e.clientY-panDrag.current.sy)});
        return;
      }
      if(!blockDrag.current.active)return;
      const cx=(e.clientX-rect.left)/zoom - pan.x/zoom - blockDrag.current.offX;
      const cy=(e.clientY-rect.top)/zoom  - pan.y/zoom - blockDrag.current.offY;
      const id=blockDrag.current.id;
      setBlocks(prev=>prev.map(b=>b.id===id?{...b,x:cx,y:cy}:b));

      // スナップ検知
      const center={x:cx+BW/2,y:cy+BH/2};
      const snap=findSnap(id,center,blocks);
      if(snap){
        const tp=getPos(snap.targetId,blocks);
        const td=blockH(blocks.find(b=>b.id===snap.targetId)??blocks[0]);
        let hx=tp.x,hy=tp.y;
        if(snap.slot==="next"){
          const target = blocks.find(bl => bl.id === snap.targetId);
          if (target && (target.type === "co_if" || target.type === "ct_rep")) {
            const thenH = target.thenId ? getStackHeight(target.thenId, blocks) : 40;
            const elseH = target.type === "co_if" && target.elseId ? getStackHeight(target.elseId, blocks) : 0;
            const maxArmH = Math.max(thenH, elseH);
            hx=tp.x; hy=tp.y - maxArmH - 45;
          } else {
            hx=tp.x; hy=tp.y-td-GAP;
          }
        }
        else if(snap.slot==="inner"){hx=tp.x+BW+GAP;hy=tp.y;}
        else if(snap.slot==="then"){hx=tp.x;hy=tp.y-td-GAP;}
        else if(snap.slot==="else"){hx=tp.x+BW+GAP+120;hy=tp.y;}
        const screenX=(hx+BW/2)*zoom+pan.x, screenY=(hy+BH/2)*zoom+pan.y;
        setSnapHint({targetId:snap.targetId,slot:snap.slot,pos:{x:screenX,y:screenY}});
      } else {
        setSnapHint(null);
      }
    }
    function onUp(){
      if(panDrag.current.active){panDrag.current.active=false;return;}
      if(!blockDrag.current.active)return;
      const{blocks}=live.current;
      const id=blockDrag.current.id;
      const b=blocks.find(b=>b.id===id)!;
      const center={x:b.x+BW/2,y:b.y+BH/2};
      const snap=findSnap(id,center,blocks);
      if(snap){
        setBlocks(prev=>attach(id,snap.targetId,snap.slot,prev));
        playSnapSound();
        setSnapAnim(snap.targetId);
        setTimeout(()=>setSnapAnim(null), 150);
        const{pan,zoom}=live.current;
        const tp=getPos(snap.targetId,blocks);
        const td=BW;
        const sx=(tp.x+td/2)*zoom+pan.x;
        const sy=(tp.y+BH/2)*zoom+pan.y;
        const color=CAT[blocks.find(bl=>bl.id===snap.targetId)?.category||"action"].bg;
        burstParticles(sx,sy,color);
        if(snap.slot==="inner"){
          setEating(id);
          setChomping(snap.targetId);
          playEatSound();
          setTimeout(()=>setEating(null),  580);
          setTimeout(()=>setChomping(null), 580);
        }
      }
      blockDrag.current.active=false;
      setSnapHint(null);
    }
    document.addEventListener("mousemove",onMove);
    document.addEventListener("mouseup",onUp);
    return()=>{document.removeEventListener("mousemove",onMove);document.removeEventListener("mouseup",onUp);};
  },[]);

  useEffect(()=>{
    function onKey(e:KeyboardEvent){
      const tag=(e.target as HTMLElement).tagName;
      if((e.ctrlKey||e.metaKey)&&e.key==="z"&&tag!=="INPUT"){e.preventDefault();undo();return;}
      if((e.ctrlKey||e.metaKey)&&(e.key==="y"||(e.shiftKey&&e.key==="Z"))&&tag!=="INPUT"){e.preventDefault();redo();return;}
      if((e.ctrlKey||e.metaKey)&&e.key==="s"&&tag!=="INPUT"){e.preventDefault();setShowProjects(true);return;}
      if(tag==="INPUT"||!live.current.selected)return;
      if(e.key==="Delete"||e.key==="Backspace"){
        const id=live.current.selected;
        setBlocks(prev=>{const d=detach(id,prev);return d.filter(b=>!getFamily(id,d).includes(b.id));});
        setSelected(null);
      }
      if((e.ctrlKey||e.metaKey)&&e.key==="d"){
        e.preventDefault();
        const src=live.current.blocks.find(b=>b.id===live.current.selected);
        if(src){const cl={...src,id:uid(),x:src.x+20,y:src.y+20,nextId:null,innerId:null,thenId:null,elseId:null,fields:src.fields.map(f=>({...f}))};setBlocks(p=>[...p,cl]);setSelected(cl.id);}
      }
    }
    document.addEventListener("keydown",onKey);return()=>document.removeEventListener("keydown",onKey);
  },[undo,redo]);

  const burstParticles = useCallback((sx:number, sy:number, color:string) => {
    const id = uid();
    const sparkId = id + "_spark";
    setParticles(prev=>[
      ...prev,
      {id, x:sx, y:sy, color},
      {id: sparkId, x:sx, y:sy, color: "#ffffff"} // 白いカチッと衝撃火花
    ]);
    setTimeout(()=>setParticles(prev=>prev.filter(p=>p.id!==id && p.id!==sparkId)), 400); // 400ms で素早く消えるように
  },[]);

  const addBlock=useCallback((t:Tmpl)=>{
    const{pan,zoom,blocks}=live.current;
    const rect=containerRef.current?.getBoundingClientRect();
    if(!rect)return;

    // 自動積み上げ配置
    let targetX = 200;
    let targetY = 600;

    if (t.category !== "trigger") {
      const triggers = blocks.filter(b => b.category === "trigger");
      if (triggers.length > 0) {
        const firstTrigger = triggers[0];
        let current: CBlock | null = firstTrigger;
        while (current) {
          const next = blocks.find(b => b.id === current?.nextId);
          if (next) current = next;
          else break;
        }
        if (current) {
          const pos = getPos(current.id, blocks);
          targetX = pos.x;
          targetY = pos.y - BH - GAP;
        }
      } else {
        targetX = 200;
        targetY = 600 - BH - GAP;
      }
    } else {
      const triggers = blocks.filter(b => b.category === "trigger");
      targetX = 200 + triggers.length * (BW + GAP * 2);
      targetY = 600;
    }

    const nb = spawnBlock(t, targetX, targetY);
    setBlocks(prev=>[...prev,nb]);
    setAddAnim(nb.id);
    playAddSound();

    // 着地時の土煙エフェクト（バーストパーティクル）
    setTimeout(() => {
      const sx = (targetX + BW / 2) * zoom + pan.x;
      const sy = (targetY + BH) * zoom + pan.y;
      burstParticles(sx - BW/2, sy, "#c8c4b8");
      burstParticles(sx + BW/2, sy, "#c8c4b8");
    }, 220);

    setTimeout(()=>setAddAnim(null), 300);
  },[burstParticles]);

  const zoomToFit=useCallback(()=>{
    const{blocks}=live.current;const rect=containerRef.current?.getBoundingClientRect();if(!rect||!blocks.length)return;
    const pad=80;
    const positions=blocks.map(b=>{const p=getPos(b.id,blocks);const d=blockH(b);return{x1:p.x,y1:p.y,x2:p.x+BW,y2:p.y+d};});
    const minX=Math.min(...positions.map(p=>p.x1))-pad, minY=Math.min(...positions.map(p=>p.y1))-pad;
    const maxX=Math.max(...positions.map(p=>p.x2))+pad, maxY=Math.max(...positions.map(p=>p.y2))+pad;
    const nz=Math.min(2,Math.max(0.2,Math.min(rect.width/(maxX-minX),rect.height/(maxY-minY))));
    setZoom(nz);setPan({x:-minX*nz+(rect.width-(maxX-minX)*nz)/2,y:-minY*nz+(rect.height-(maxY-minY)*nz)/2});
  },[]);

  useEffect(()=>{
    const code=buildCode(blocks);
    setGenCode(code);setGeneratedJsCode(code);
    setLogicGraphJson(JSON.stringify({blocks}));
    try {
      if(typeof window !== "undefined") {
        localStorage.setItem("mmc-autosave-logic", JSON.stringify({blocks}));
      }
    } catch {}
  },[blocks,setGeneratedJsCode,setLogicGraphJson]);

  const connectors: {x:number;y:number;color:string}[] = [];
  for(const b of blocks){
    if(b.nextId){
      const pp=getPos(b.id,blocks);
      if (b.type === "co_if" || b.type === "ct_rep") {
        const thenH = b.thenId ? getStackHeight(b.thenId, blocks) : 40;
        const elseH = b.type === "co_if" && b.elseId ? getStackHeight(b.elseId, blocks) : 0;
        const maxArmH = Math.max(thenH, elseH);
        connectors.push({x:pp.x+BW/2, y:pp.y - maxArmH - 45, color: CAT[b.category].bg});
      } else {
        connectors.push({x:pp.x+BW/2, y:pp.y, color: CAT[b.category].bg});
      }
    }
    if((b.type==="co_if" || b.type==="ct_rep") && b.thenId){
      const pp=getPos(b.id,blocks);
      connectors.push({x:pp.x+BW/2, y:pp.y, color: CAT[b.category].bg});
    }
  }

  const cats: Category[] = ["trigger", "action", "ifelse", "value", "loop", "calc", "ui", "variable"];

  /* ════ レンダー ════ */
  return (
    <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",overflow:"hidden",background:"#23211e"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@800;900&family=Nunito:wght@800;900&display=swap');
        
        * {
          font-family: 'Outfit', 'Nunito', 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif !important;
        }

        @keyframes pulse   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.7;transform:scale(1.15)} }
        @keyframes swallow { 0%{transform:scale(1)rotate(0deg);opacity:1} 30%{transform:scale(1.15)rotate(6deg);opacity:1} 70%{transform:scale(0.3)rotate(-8deg);opacity:0.6} 100%{transform:scale(0)rotate(0deg);opacity:0} }
        @keyframes chomp   { 0%{transform:scale(1)} 15%{transform:scale(1.14)} 35%{transform:scale(0.93)} 55%{transform:scale(1.07)} 75%{transform:scale(0.97)} 100%{transform:scale(1)} }

        @keyframes blockSnap {
          0%  { transform: translateY(-14px) scaleY(0.9); filter: brightness(2.2); }
          40% { transform: translateY(4px) scaleY(0.93); filter: brightness(1.4); }
          70% { transform: translateY(-2px) scaleY(1.02); filter: brightness(1.1); }
          100%{ transform: translateY(0) scaleY(1); filter: brightness(1); }
        }
        @keyframes blockAdd {
          0%  { transform: translateY(-50px); opacity: 0; }
          100%{ transform: translateY(0); opacity: 1; }
        }
        @keyframes blockDelete {
          0%  {transform:scale(1)rotate(0deg);opacity:1}
          20% {transform:scale(1.1)rotate(-4deg);opacity:0.9}
          100%{transform:scale(0)rotate(12deg);opacity:0}
        }
        @keyframes particle {
          0%  {transform:translate(0,0)scale(1);opacity:1}
          100%{transform:translate(var(--dx),var(--dy))scale(0);opacity:0}
        }
        @keyframes glowPulse {
          0%,100%{filter:drop-shadow(0 0 8px var(--glow))}
          50%    {filter:drop-shadow(0 0 18px var(--glow))}
        }
        @keyframes wireAppear {
          0%  {stroke-dashoffset:1000;opacity:0}
          100%{stroke-dashoffset:0;opacity:0.9}
        }
        @keyframes bgFloat {
          0%,100%{background-position-y:0px}
          50%    {background-position-y:6px}
        }
        @keyframes hintBounce {
          0%,100% { transform: translateY(0); opacity:0.85; }
          50%     { transform: translateY(6px); opacity:1; }
        }
        @keyframes hintFloat {
          0%,100%{ transform: translateY(0)   rotate(-2deg); }
          50%   { transform: translateY(-12px) rotate(2deg); }
        }
        @keyframes hintAura {
          0%,100%{ opacity: 0.55; transform: scale(1);    }
          50%   { opacity: 0.95; transform: scale(1.15); }
        }
        @keyframes neonBeam {
          0%,100%{ opacity: 0.4; }
          50%   { opacity: 1;   }
        }
        @keyframes snapPulse {
          0%   { transform: scale(1);    opacity: 1; }
          100% { transform: scale(1.04); opacity: 0.85; }
        }
        @keyframes snapLabelBob {
          0%   { transform: translateY(0);   }
          100% { transform: translateY(-3px);}
        }
        @keyframes spectrumShift {
          0%   { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        .btn-keycap:hover {
          transform: translateY(-1px);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -2px 3px rgba(0,0,0,0.04), 0 3px 0 #c9c3b0, 0 5px 10px rgba(120,100,60,0.18) !important;
        }
        .btn-keycap:active {
          transform: translateY(2px) !important;
          box-shadow: inset 0 1px 2px rgba(0,0,0,0.08), 0 0 0 #c9c3b0, 0 1px 2px rgba(120,100,60,0.08) !important;
        }
        @keyframes hintFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(1.5deg); }
        }
        @keyframes hintAura {
          0%, 100% { transform: scale(0.9); opacity: 0.25; filter: blur(15px); }
          50% { transform: scale(1.2); opacity: 0.55; filter: blur(25px); }
        }
      `}</style>
      
      {/* 1. 最上部ヘッダー（すべての操作を1行に集約 ＆ ブロックトレイ） */}
      <div className="mc-bevel" style={{
        background: "#2a2924",
        borderBottom: "2px solid #1f1e1a",
        display: "flex",
        flexDirection: "column",
        zIndex: 30,
        flexShrink: 0
      }}>
        {/* 1行目：カテゴリ、各種機能ボタン、検索窓をすべて1列に配置 */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", padding: "6px 12px", boxSizing: "border-box" }}>
          {/* 左端：トレイ開閉 */}
          <McButton size="sm" onClick={() => setShowLib(v => !v)} active={showLib} title={showLib ? "ブロックトレイを閉じる" : "ブロックトレイを開く"}>
            {showLib ? "📂 閉じる" : "📂 開く"}
          </McButton>
          <div style={{ width: 2, height: 16, background: "#4a4842", margin: "0 2px" }} />

          {/* カテゴリ選択タブ */}
          {cats.map(cat => {
            const c = CAT[cat];
            const isActive = !searching && cat === activeCategory;
            const borderBottomSize = isActive ? "4px" : "3px";
            return (
              <button key={cat} onClick={() => { setActiveCategory(cat); if(searching) setSearch(""); }}
                style={{
                  display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 12,
                  background: isActive ? `linear-gradient(135deg, ${c.top}, ${c.bg})` : "#3a3833",
                  borderLeft: `2.5px solid ${isActive ? c.border : "#5a574e"}`,
                  borderBottom: `${borderBottomSize} solid ${isActive ? c.border : "#1f1e1a"}`,
                  borderRight: `1.5px solid ${isActive ? "rgba(0,0,0,0.2)" : "#1f1e1a"}`,
                  borderTop: `1.5px solid ${isActive ? "rgba(255,255,255,0.2)" : "#5a574e"}`,
                  boxShadow: isActive ? "inset 2px 2px 0 rgba(255,255,255,0.4), 2px 2px 0 rgba(0,0,0,0.15)" : "2px 2px 0 rgba(0,0,0,0.15)",
                  color: isActive ? "#fff" : "#c8c4b8", fontWeight: 900, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap",
                  transform: isActive ? "translateY(1px)" : "none",
                  transition: "all 0.08s ease"
                }}
                onMouseEnter={e => {
                  if(!isActive) {
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.boxShadow = "3px 3px 0 rgba(0,0,0,0.2)";
                  }
                }}
                onMouseLeave={e => {
                  if(!isActive) {
                    e.currentTarget.style.transform = "none";
                    e.currentTarget.style.boxShadow = "2px 2px 0 rgba(0,0,0,0.15)";
                  }
                }}
              >
                <span style={{ fontSize: 13 }}>{c.icon}</span><span>{c.label}</span>
              </button>
            );
          })}
          <div style={{ width: 2, height: 16, background: "#4a4842", margin: "0 2px" }} />

          {/* 各種ツールボタン */}
          <McButton size="sm" onClick={zoomToFit} title="キャンバス全体を表示">⊡</McButton>
          <McButton size="sm" onClick={() => { setPan({ x: 60, y: 60 }); setZoom(0.9); }} title="ズームと位置をリセット">⊙</McButton>
          <McButton size="sm" onClick={undo} title="元に戻す (Ctrl+Z)">↩</McButton>
          <McButton size="sm" onClick={redo} title="やり直す (Ctrl+Y)">↪</McButton>
          
          <div style={{ width: 2, height: 16, background: "#4a4842", margin: "0 2px" }} />
          
          <McButton size="sm" variant={showProjects ? "grape" : "default"} onClick={() => setShowProjects(v => !v)} active={showProjects} title="プロジェクトの保存・読み込み">
            💾 保存/読込
          </McButton>
          <McButton size="sm" variant={showTemplates ? "info" : "default"} onClick={() => setShowTemplates(v => !v)} active={showTemplates} title="テンプレートギャラリー">
            🎮 サンプル
          </McButton>
          <McButton size="sm" variant={showCode ? "warning" : "default"} onClick={() => setShowCode(v => !v)} active={showCode} title="生成コードを表示">
            💻 コード
          </McButton>
          <McButton size="sm" variant={showHelp ? "primary" : "default"} onClick={() => setShowHelp(v => !v)} active={showHelp} title="操作ガイドを開く">
            ❓ ヘルプ
          </McButton>

          {/* 右端：検索窓 */}
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 さがす..."
            style={{
              marginLeft: "auto", width: 180, boxSizing: "border-box", padding: "6px 12px", fontSize: 13,
              background: "#ffffff", border: "3px solid #1f1e1a", borderRadius: 8, color: "#1f1e1a", outline: "none", fontWeight: 800,
              boxShadow: "inset 2px 2px 0 rgba(0,0,0,0.1), 3px 3px 0 rgba(0,0,0,0.15)",
              fontFamily: "'DotGothic16', sans-serif"
            }} />
        </div>

        {/* 2行目：ブロックトレイ */}
        {showLib && (
          <BlockTray filtered={filtered} onAdd={addBlock} searching={searching} activeCategory={activeCategory} />
        )}
      </div>

      {/* 2. 下部：メインキャンバス領域 */}
      <div style={{flex:1,position:"relative",overflow:"hidden",backgroundColor:"#252320"}}>
        {showProjects&&(
          <ProjectPanel
            blocks={blocks}
            onLoad={b=>{setBlocks(b);}}
            onClose={()=>setShowProjects(false)}
          />
        )}
        {showTemplates&&(
          <TemplateGallery
            onSelect={b=>{setBlocks(prev=>[...prev,...b]);}}
            onClose={()=>setShowTemplates(false)}
          />
        )}

        {showHelp&&(
          <div className="mc-panel" style={{position:"absolute",top:10,right:10,zIndex:40,width:250,background:"var(--surface)",overflow:"hidden"}}>
            <div style={{padding:"10px 14px 8px",borderBottom:"2px solid var(--border-color)",background:"var(--panel)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span className="font-pixel text-[11px] text-accent">🎮 HOW TO PLAY</span>
              <button onClick={()=>setShowHelp(false)} className="mc-btn mc-btn--sm" style={{padding:"2px 6px"}}>✕</button>
            </div>
            <div style={{padding:"12px 14px"}}>
              {[
                {icon:"🧩",s:"1",t:"上部のトレイからブロックをクリックして追加"},
                {icon:"🔗",s:"2",t:"ブロックをドラッグして別のブロックの近くで離すとつながる"},
                {icon:"🍩",s:"3",t:"「もしも」はドーナツ！穴に条件ブロックをいれる"},
                {icon:"🗑️",s:"4",t:"ブロックを選んでDeleteキーで削除"},
                {icon:"⌨️",s:"⌨",t:"Ctrl+D でコピー"},
              ].map((s,i)=>(
                <div key={i} style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:12}}>
                  <span className="mc-bevel-inset" style={{width:24,height:24,background:"var(--panel)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>{s.icon}</span>
                  <div>
                    <span className="mc-badge mc-badge--sm" style={{marginBottom:4,fontSize:9}}>STEP {s.s}</span>
                    <div style={{fontSize:11,color:"var(--foreground)",fontWeight:600,lineHeight:1.4}}>{s.t}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 統計インジケーター */}
        <div style={{
          position: "absolute", top: 10, left: 10, zIndex: 20,
          display: "flex", gap: 8
        }}>
          {/* ブロック数 */}
          <div style={{
            background: "rgba(25, 25, 28, 0.85)",
            backdropFilter: "blur(4px)",
            border: "1.5px solid rgba(255,255,255,0.15)",
            padding: "8px 14px",
            borderRadius: 8,
            display: "flex", alignItems: "center", gap: 6,
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
            color: "#fff"
          }}>
            <span style={{ fontSize: 16 }}>📦</span>
            <span style={{ fontSize: 13, fontWeight: 900, color: "#e2dacf" }}>配置ブロック数:</span>
            <span style={{ fontSize: 15, fontWeight: 900, fontFamily: "monospace", color: "#00cec9" }}>{blocks.length}</span>
          </div>

          {/* ズーム倍率 */}
          <div style={{
            background: "rgba(25, 25, 28, 0.85)",
            backdropFilter: "blur(4px)",
            border: "1.5px solid rgba(255,255,255,0.15)",
            padding: "8px 14px",
            borderRadius: 8,
            display: "flex", alignItems: "center", gap: 6,
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
            color: "#fff"
          }}>
            <span style={{ fontSize: 16 }}>🔍</span>
            <span style={{ fontSize: 13, fontWeight: 900, color: "#e2dacf" }}>表示ズーム:</span>
            <span style={{ fontSize: 15, fontWeight: 900, fontFamily: "monospace", color: "#00b4d8" }}>{Math.round(zoom*100)}%</span>
          </div>
        </div>

        {/* 空キャンバス・ヒント */}
        {blocks.length===0 && (
          <div style={{
            position:"absolute",inset:0,display:"flex",flexDirection:"column",
            alignItems:"center",justifyContent:"center",
            pointerEvents:"none",zIndex:5,
          }}>
            {/* 黄金のオーラ効果 */}
            <div style={{
              position: "absolute",
              width: 240,
              height: 240,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(251,191,36,0.32) 0%, rgba(245,158,11,0.06) 50%, transparent 70%)",
              animation: "hintAura 4s ease-in-out infinite",
              zIndex: 1,
            }} />

            {/* 鍵とテキストのコンテナ */}
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              animation: "hintFloat 3.2s ease-in-out infinite",
              zIndex: 2,
            }}>
              {/* 黄金鍵のSVG */}
              <svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: "drop-shadow(0 6px 14px rgba(245,158,11,0.45))" }}>
                {/* 持ち手 */}
                <path d="M 32,22 H 68 V 58 H 32 Z M 44,34 H 56 V 46 H 44 Z" fill="#78350f" />
                <path d="M 35,25 H 65 V 55 H 35 Z M 44,34 H 56 V 46 H 44 Z" fill="#fbbf24" />
                <path d="M 38,28 H 62 V 52 H 38 Z M 44,34 H 56 V 46 H 44 Z" fill="#f59e0b" />
                {/* 埋め込まれたダイヤモンド */}
                <path d="M 44,34 H 56 V 46 H 44 Z" fill="#00cec9" />
                <path d="M 46,36 H 54 V 44 H 46 Z" fill="#81ecec" />
                <path d="M 46,36 H 49 V 39 H 46 Z" fill="#ffffff" />
                
                {/* 軸 */}
                <path d="M 45,58 H 55 V 88 H 45 Z" fill="#78350f" />
                <path d="M 47,58 H 53 V 86 H 47 Z" fill="#d97706" />
                <path d="M 47,58 H 50 V 86 H 47 Z" fill="#fbbf24" />
                
                {/* 鍵歯 */}
                <path d="M 55,66 H 69 V 74 H 55 Z M 55,78 H 69 V 86 H 55 Z" fill="#78350f" />
                <path d="M 55,68 H 66 V 72 H 55 Z M 55,80 H 66 V 84 H 55 Z" fill="#f59e0b" />
                <path d="M 55,68 H 60 V 70 H 55 Z M 55,80 H 60 V 82 H 55 Z" fill="#fbbf24" />
              </svg>

              {/* CRAFT YOUR COMPONENT */}
              <h2 className="font-pixel" style={{
                fontSize: 16,
                marginTop: 16,
                marginBottom: 6,
                letterSpacing: "0.15em",
                background: "linear-gradient(to bottom, #ffeaa7, #fdcb6e)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                textShadow: "0 2px 4px rgba(0,0,0,0.55), 0 0 1px #000",
                fontWeight: 900,
              }}>
                CRAFT YOUR COMPONENT
              </h2>

              <p style={{
                fontSize: 11,
                color: "#a4b0be",
                fontWeight: 800,
                textAlign: "center",
                maxWidth: 320,
                lineHeight: 1.6,
                textShadow: "0 1px 2px rgba(0,0,0,0.6)",
              }}>
                トレイからブロックを選択し、キャンバスへ置いてロジックをクラフトしましょう。
              </p>
            </div>
          </div>
        )}

        {/* コードプレビュー */}
        {showCode&&(
          <div className="mc-panel" style={{position:"absolute",bottom:10,left:8,right:8,zIndex:40,maxHeight:240,background:"var(--panel)",display:"flex",flexDirection:"column"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 14px",borderBottom:"2px solid var(--border-color)"}}>
              <span className="font-pixel text-[11px] text-accent">⚡ GENERATED CODE</span>
              <button onClick={()=>setShowCode(false)} className="mc-btn mc-btn--sm">✕</button>
            </div>
            <pre style={{flex:1,overflowY:"auto",margin:0,padding:"10px 14px",fontSize:10,color:"#a3e635",fontFamily:"monospace",lineHeight:1.6,whiteSpace:"pre-wrap",wordBreak:"break-all",background:"#12110e"}}>
              {genCode}
            </pre>
          </div>
        )}

        {/* スナップインジケーター */}
        {snapHint&&(
          <SnapIndicator x={snapHint.pos.x} y={snapHint.pos.y} zoom={zoom} slot={snapHint.slot}
            color={snapHint.slot==="inner"?"#6c5ce7":snapHint.slot==="then"?"#00b894":snapHint.slot==="else"?"#e17055":"#0984e3"}/>
        )}

        {/* パーティクルバースト */}
        {particles.map(p=>(
          <div key={p.id} style={{position:"absolute",left:p.x,top:p.y,pointerEvents:"none",zIndex:200}}>
            {[0,45,90,135,180,225,270,315].map((deg,i)=>(
              <div key={deg} style={{
                position:"absolute",width:8,height:8,borderRadius:"50%",
                background:p.color,
                pointerEvents:"none",
                // @ts-ignore
                "--dx":`${Math.cos(deg*Math.PI/180)*44}px`,
                // @ts-ignore
                "--dy":`${Math.sin(deg*Math.PI/180)*44}px`,
                animation:`particle ${0.25+i*0.01}s cubic-bezier(0.1, 0.8, 0.3, 1) forwards`,
                boxShadow:`0 0 6px ${p.color}`,
              }}/>
            ))}
          </div>
        ))}

        {/* キャンバス背景（最背面無地） */}
        <div ref={containerRef} onMouseDown={handleBgDown} onWheel={handleWheel}
          style={{position:"absolute",inset:0,cursor:"grab",backgroundColor:"#161513",
            zIndex:0}}>

          {/* ブロックコンテナ */}
          <div style={{position:"absolute",inset:0,transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`,transformOrigin:"0 0"}}>

          {/* 3Dトイスペース背景 — 床（ブロックと同じワールド座標） */}
            <ToyFloor />

            {/* 接続シームライン */}
            {connectors.map((c,i)=>(
              <Connector key={i} x={c.x} y={c.y} color={c.color}/>
            ))}

            {/* ブロック */}
            {blocks.map(b=>{
              const pos=getPos(b.id,blocks);
              const isCond = b.type==="co_if";
              const inner = isCond && b.innerId ? blocks.find(x=>x.id===b.innerId)??null : null;
              
              return <ToyCubeBlock key={b.id} b={b} pos={pos} selected={selected===b.id}
                snapSlot={snapHint?.targetId===b.id?snapHint.slot:null}
                innerBlock={inner} blocks={blocks} 
                isEating={isCond && chomping===b.id}
                isSnapping={snapAnim===b.id}
                isAdding={addAnim===b.id}
                isDeleting={deleteAnim===b.id}
                onDown={handleBlockDown} onDelete={handleDelete}
                onEjectInner={isCond ? handleEjectInner : undefined} 
                onFieldChange={handleFieldChange}
                focusedField={focusedField}
                setFocusedField={setFocusedField}/>;
            })}

            {/* 食べられアニメーション（ToyCubeBlock用に合わせて修正） */}
            {eating && (()=>{
              const eb=blocks.find(b=>b.id===eating);
              const condBlock=eb ? blocks.find(d=>d.innerId===eating) : null;
              if(!eb||!condBlock)return null;
              const dp=getPos(condBlock.id,blocks);
              return <ToyCubeBlock key={`eat-${eating}`} b={eb}
                pos={{x:dp.x+BW+GAP, y:dp.y}}
                selected={false} snapSlot={null} isEating={true}
                blocks={blocks}
                onDown={()=>{}} onDelete={()=>{}} onFieldChange={()=>{}}/>;
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
