import { Category, FieldDef, Tmpl, CalcSubCat } from '../app/editor/_types';



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
  { key: "arith",   icon: "Plus", label: "四則演算" },
  { key: "math",    icon: "Brain", label: "数学関数" },
  { key: "compare", icon: "Scale", label: "比較"     },
  { key: "string",  icon: "Quote", label: "文字列"   },
  { key: "id",      icon: "Package", label: "アイテムID"},
];
const fv=(id:string,label:string,value:string,opts?:string[]):FieldDef=>({id,label,value,options:opts});

// ドロップダウン共通リスト（アクション等で「選べる」フィールドに使う）
const TARGETS = ["@a","@p","@r","@s","@e"];
const DURS    = ["1","3","5","10","20","30","60","120","300"];
const COUNTS  = ["1","2","4","8","16","32","64"];
const VOLS    = ["0.25","0.5","1","1.5","2"];
const EFFECTS = ["speed","slowness","haste","mining_fatigue","strength","instant_health","instant_damage","jump_boost","nausea","regeneration","resistance","fire_resistance","water_breathing","invisibility","blindness","night_vision","hunger","weakness","poison","wither","health_boost","absorption","saturation","glowing","levitation","slow_falling","conduit_power","dolphins_grace","bad_omen","hero_of_the_village"];
const ITEMS   = ["minecraft:diamond","minecraft:gold_ingot","minecraft:iron_ingot","minecraft:emerald","minecraft:netherite_ingot","minecraft:coal","minecraft:apple","minecraft:golden_apple","minecraft:enchanted_golden_apple","minecraft:bread","minecraft:cooked_beef","minecraft:cake","minecraft:diamond_sword","minecraft:diamond_pickaxe","minecraft:diamond_axe","minecraft:bow","minecraft:arrow","minecraft:shield","minecraft:torch","minecraft:tnt","minecraft:oak_log","minecraft:stone","minecraft:dirt","minecraft:obsidian","minecraft:ender_pearl","minecraft:elytra","minecraft:totem_of_undying"];
const BLOCKS  = ["minecraft:stone","minecraft:cobblestone","minecraft:dirt","minecraft:grass_block","minecraft:sand","minecraft:gravel","minecraft:oak_log","minecraft:oak_planks","minecraft:wool","minecraft:obsidian","minecraft:bedrock","minecraft:tnt","minecraft:chest","minecraft:crafting_table","minecraft:furnace","minecraft:bookshelf","minecraft:netherrack","minecraft:end_stone","minecraft:crying_obsidian"];
const SOUNDS  = ["random.orb","random.levelup","random.pop","random.explode","random.anvil_land","random.toast","note.pling","note.harp","mob.villager.yes","mob.villager.no","ui.button.click","random.glass"];
const CMDS      = ["say こんにちは","time set day","time set night","weather clear","weather thunder","gamemode creative @s","gamemode survival @s","difficulty peaceful","tp @s 0 100 0","effect @s clear"];
const SCORE_OBJ = ["points","kills","deaths","money","level","coins","wins"];
const TAGS      = ["vip","admin","team_red","team_blue","cleared","new"];
const REASONS   = ["ルール違反","不正行為","暴言","スパム","AFK"];
const MSGS      = ["こんにちは！","ようこそ！","クリア！","がんばれ！","ゲームオーバー","スタート！"];
const COORDS    = ["0","64","100","128","256","-64"];

const TEMPLATES: Tmpl[] = [
  // ─── イベント ───
  {type:"ev_join",  emoji:"UserPlus",label:"参加したとき",        sublabel:"プレイヤーがワールドに参加",category:"trigger",fields:[]},
  {type:"ev_break", emoji:"Pickaxe",label:"ブロック破壊",        sublabel:"ブロックを壊したとき",     category:"trigger",fields:[fv("block","ブロック","minecraft:stone",BLOCKS)]},
  {type:"ev_item",  emoji:"Wand2",label:"アイテム使用",        sublabel:"アイテムを右クリック",      category:"trigger",fields:[fv("item","アイテム","minecraft:diamond",ITEMS)]},
  {type:"ev_tick",  emoji:"Timer",label:"毎ティック実行",      sublabel:"ゲームの毎フレーム",        category:"trigger",fields:[]},
  {type:"ev_chat",  emoji:"MessageSquare",label:"チャット入力",        sublabel:"特定のワードをチャット",    category:"trigger",fields:[fv("pat","合言葉","!こんにちは")]},
  {type:"ev_hurt",  emoji:"Swords",label:"ダメージ受信",        sublabel:"プレイヤーが被ダメージ",   category:"trigger",fields:[]},
  {type:"ev_place", emoji:"Blocks",label:"ブロック設置",        sublabel:"ブロックを置いたとき",     category:"trigger",fields:[]},
  // ─── アクション ───
  {type:"ac_msg",   emoji:"Megaphone",label:"メッセージ送信",      sublabel:"全員または特定のプレイヤーへ",category:"action",fields:[fv("msg","メッセージ","こんにちは！",MSGS),fv("target","対象","@a",TARGETS)]},
  {type:"ac_give",  emoji:"Gift",label:"アイテム付与",        sublabel:"プレイヤーにアイテムを渡す",category:"action",fields:[fv("item","アイテム","minecraft:diamond",ITEMS),fv("count","個数","1",COUNTS)]},
  {type:"ac_tp",    emoji:"Rocket",label:"テレポート",          sublabel:"指定座標へ瞬間移動",       category:"action",fields:[fv("x","X","0",COORDS),fv("y","Y","64",COORDS),fv("z","Z","0",COORDS)]},
  {type:"ac_cmd",   emoji:"Terminal",label:"コマンド実行",        sublabel:"/コマンドを実行",          category:"action",fields:[fv("cmd","コマンド","say こんにちは",CMDS)]},
  {type:"ac_sound", emoji:"Music",label:"サウンド再生",        sublabel:"効果音を鳴らす",           category:"action",fields:[fv("snd","サウンド","random.orb",SOUNDS),fv("vol","音量","1",VOLS)]},
  {type:"ac_title", emoji:"Tv",label:"タイトル表示",        sublabel:"画面中央に大きく表示",     category:"action",fields:[fv("title","タイトル","こんにちは",MSGS),fv("sub","サブタイトル","",MSGS)]},
  {type:"ac_effect",emoji:"Sparkles",label:"エフェクト付与",      sublabel:"ポーション効果を与える",   category:"action",fields:[fv("eff","エフェクト","speed",EFFECTS),fv("dur","秒数","10",DURS)]},
  {type:"ac_score", emoji:"Trophy",label:"スコア操作",          sublabel:"スコアボードの値を変更",   category:"action",fields:[fv("op","操作","加算",["加算","減算","セット","リセット"]),fv("obj","目標名","points",SCORE_OBJ),fv("val","値","1",COUNTS)]},
  {type:"ac_tag",   emoji:"Tags",label:"タグ操作",            sublabel:"プレイヤーにタグを付ける",category:"action",fields:[fv("op","操作","追加",["追加","削除"]),fv("tag","タグ名","vip",TAGS)]},
  {type:"ac_kick",  emoji:"Ban",label:"キック",              sublabel:"プレイヤーをサーバーから追い出す",category:"action",fields:[fv("msg","理由","ルール違反",REASONS)]},
  // ─── 条件 ───
  {type:"co_if",    emoji:"Split",label:"条件分岐",            sublabel:"条件によって処理を分ける（ドーナツ）",category:"ifelse",fields:[]},
  {type:"co_tag",   emoji:"Tags",label:"タグを持っているか",  sublabel:"指定タグの確認",           category:"ifelse",fields:[fv("tag","タグ名","vip")]},
  {type:"co_sneak", emoji:"EyeOff",label:"スニーク中か",        sublabel:"しゃがんでいるか確認",     category:"ifelse",fields:[]},
  {type:"co_item",  emoji:"Search",label:"アイテム所持確認",    sublabel:"インベントリに指定アイテムがあるか",category:"ifelse",fields:[fv("item","アイテム","minecraft:diamond",ITEMS)]},
  {type:"co_hp",    emoji:"HeartPulse",label:"HP不足確認",          sublabel:"HPが基準以下か",           category:"ifelse",fields:[fv("threshold","HP基準","10")]},
  {type:"co_night", emoji:"Moon",label:"夜間か",              sublabel:"現在が夜（13000〜23000）か",category:"ifelse",fields:[]},
  {type:"co_rain",  emoji:"CloudRain",label:"雨天か",              sublabel:"雨または嵐が降っているか", category:"ifelse",fields:[]},
  {type:"co_and",   emoji:"CircleDot",label:"かつ（AND）",         sublabel:"両方の条件が成立",         category:"ifelse",fields:[]},
  {type:"co_or",    emoji:"Circle",label:"または（OR）",        sublabel:"どちらかの条件が成立",     category:"ifelse",fields:[]},
  {type:"co_not",   emoji:"XCircle",label:"でない（NOT）",       sublabel:"条件が成立しないとき",     category:"ifelse",fields:[]},
  // ─── 値 ───
  {type:"va_name",  emoji:"User",label:"プレイヤー名",        sublabel:"プレイヤーの名前を取得",   category:"value",  fields:[]},
  {type:"va_rand",  emoji:"Dices",label:"乱数",                sublabel:"ランダムな整数を生成",     category:"value",  fields:[fv("min","最小値","0"),fv("max","最大値","100")]},
  {type:"va_str",   emoji:"Quote",label:"文字列",              sublabel:"テキストの値",             category:"value",  fields:[fv("v","テキスト","こんにちは！")]},
  {type:"va_num",   emoji:"Hash",label:"数値",                sublabel:"数の値",                   category:"value",  fields:[fv("v","数値","0")]},
  {type:"va_hp",    emoji:"Heart",label:"プレイヤーHP",        sublabel:"現在のHP値を取得",         category:"value",  fields:[]},
  {type:"va_pos",   emoji:"MapPin",label:"座標",                sublabel:"X/Y/Z座標を取得",          category:"value",  fields:[fv("axis","軸","Y",["X","Y","Z"])]},
  {type:"va_score", emoji:"Trophy",label:"スコア取得",          sublabel:"スコアボードの値を取得",   category:"value",  fields:[fv("obj","目標名","points")]},
  // ─── 制御 ───
  {type:"ct_rep",   emoji:"Repeat",label:"繰り返し",            sublabel:"指定回数ループする",       category:"loop",   fields:[fv("n","回数","3")]},
  {type:"ct_wait",  emoji:"Hourglass",label:"待機",                sublabel:"指定秒数だけ待つ",         category:"loop",   fields:[fv("s","秒数","1")]},
  {type:"ct_int",   emoji:"Timer",label:"インターバル",        sublabel:"一定間隔で繰り返す",       category:"loop",   fields:[fv("s","秒数","5")]},
  {type:"ct_log",   emoji:"ScrollText",label:"ログ出力",            sublabel:"デバッグ情報をコンソールへ",category:"loop",  fields:[fv("v","内容","ログ")]},
  // ─── 演算：四則演算 ───
  {type:"ca_add",   emoji:"Plus",label:"足し算",              sublabel:"A + B",                    category:"calc",   fields:[fv("a","A","0"),fv("b","B","0")]},
  {type:"ca_sub",   emoji:"Minus",label:"引き算",              sublabel:"A − B",                    category:"calc",   fields:[fv("a","A","0"),fv("b","B","0")]},
  {type:"ca_mul",   emoji:"X",label:"掛け算",              sublabel:"A × B",                    category:"calc",   fields:[fv("a","A","1"),fv("b","B","1")]},
  {type:"ca_div",   emoji:"Divide",label:"割り算",              sublabel:"A ÷ B",                    category:"calc",   fields:[fv("a","A","0"),fv("b","B","1")]},
  {type:"ca_mod",   emoji:"Percent",label:"余り",                sublabel:"A を B で割った余り",      category:"calc",   fields:[fv("a","A","10"),fv("b","B","3")]},
  {type:"ca_pow",   emoji:"ChevronUp",label:"累乗",                sublabel:"A の B 乗",                category:"calc",   fields:[fv("a","A","2"),fv("b","B","8")]},
  // ─── 演算：数学関数 ───
  {type:"ca_abs",   emoji:"Ruler",label:"絶対値",              sublabel:"|A|（負を正に変換）",      category:"calc",   fields:[fv("a","A","-5")]},
  {type:"ca_floor", emoji:"ArrowDownToLine",label:"切り捨て",            sublabel:"小数点以下を切り捨て",     category:"calc",   fields:[fv("a","A","3.7")]},
  {type:"ca_ceil",  emoji:"ArrowUpToLine",label:"切り上げ",            sublabel:"小数点以下を切り上げ",     category:"calc",   fields:[fv("a","A","3.2")]},
  {type:"ca_round", emoji:"Circle",label:"四捨五入",            sublabel:"小数点を丸める",           category:"calc",   fields:[fv("a","A","3.5")]},
  {type:"ca_sqrt",  emoji:"SquareRadical",label:"平方根",              sublabel:"√A",                       category:"calc",   fields:[fv("a","A","9")]},
  {type:"ca_min",   emoji:"ChevronLeft",label:"最小値",              sublabel:"A と B の小さい方",        category:"calc",   fields:[fv("a","A","3"),fv("b","B","7")]},
  {type:"ca_max",   emoji:"ChevronRight",label:"最大値",              sublabel:"A と B の大きい方",        category:"calc",   fields:[fv("a","A","3"),fv("b","B","7")]},
  {type:"ca_clamp", emoji:"Clamp",label:"範囲制限",            sublabel:"値を最小〜最大に収める",   category:"calc",   fields:[fv("val","値","50"),fv("min","最小","0"),fv("max","最大","100")]},
  {type:"ca_sin",   emoji:"Waves",label:"sin",                 sublabel:"サイン（ラジアン）",        category:"calc",   fields:[fv("a","角度(rad)","0")]},
  {type:"ca_cos",   emoji:"Waves",label:"cos",                 sublabel:"コサイン（ラジアン）",      category:"calc",   fields:[fv("a","角度(rad)","0")]},
  {type:"ca_pi",    emoji:"Pi", label:"円周率 π",            sublabel:"3.14159…",                  category:"calc",   fields:[]},
  // ─── 演算：比較 ───
  {type:"ca_gt",    emoji:"ChevronsRight",label:"A > B（より大きい）", sublabel:"A が B より大きければ真",  category:"calc",   fields:[fv("a","A","5"),fv("b","B","3")]},
  {type:"ca_lt",    emoji:"ChevronsLeft",label:"A < B（より小さい）", sublabel:"A が B より小さければ真",  category:"calc",   fields:[fv("a","A","3"),fv("b","B","5")]},
  {type:"ca_gte",   emoji:"ChevronsRight",label:"A ≥ B（以上）",       sublabel:"A が B 以上なら真",        category:"calc",   fields:[fv("a","A","5"),fv("b","B","5")]},
  {type:"ca_lte",   emoji:"ChevronsLeft",label:"A ≤ B（以下）",       sublabel:"A が B 以下なら真",        category:"calc",   fields:[fv("a","A","3"),fv("b","B","5")]},
  {type:"ca_eq",    emoji:"Equal",label:"A = B（等しい）",     sublabel:"A と B が等しければ真",    category:"calc",   fields:[fv("a","A","1"),fv("b","B","1")]},
  {type:"ca_neq",   emoji:"EqualNot", label:"A ≠ B（等しくない）",sublabel:"A と B が違えば真",        category:"calc",   fields:[fv("a","A","1"),fv("b","B","2")]},
  // ─── 演算：文字列 ───
  {type:"ca_concat",emoji:"Link",label:"文字連結",            sublabel:"AとBをつなげる",           category:"calc",   fields:[fv("a","前","こんにちは"),fv("b","後","！")]},
  {type:"ca_strlen",emoji:"Ruler",label:"文字数",              sublabel:"テキストの文字数",         category:"calc",   fields:[fv("str","テキスト","hello")]},
  {type:"ca_numstr",emoji:"ArrowRightLeft",label:"数値→文字",          sublabel:"数値を文字列に変換",       category:"calc",   fields:[fv("num","数値","42")]},
  {type:"ca_strnum",emoji:"ArrowRightLeft",label:"文字→数値",          sublabel:"文字列を数値に変換",       category:"calc",   fields:[fv("str","テキスト","42")]},
  {type:"ca_substr",emoji:"Scissors",label:"部分文字列",          sublabel:"指定範囲を切り出す",       category:"calc",   fields:[fv("str","テキスト","hello"),fv("start","開始","0"),fv("len","長さ","3")]},
  {type:"ca_replace",emoji:"Replace",label:"文字置換",           sublabel:"特定の文字を別の文字に変換",category:"calc",  fields:[fv("str","テキスト","hello world"),fv("from","検索","world"),fv("to","置換","！")]},
  {type:"ca_upper", emoji:"CaseSensitive",label:"大文字変換",          sublabel:"すべて大文字にする",       category:"calc",   fields:[fv("str","テキスト","hello")]},
  {type:"ca_lower", emoji:"CaseLower",label:"小文字変換",          sublabel:"すべて小文字にする",       category:"calc",   fields:[fv("str","テキスト","HELLO")]},
  {type:"ca_contains",emoji:"Search",label:"文字列を含むか",    sublabel:"テキストに指定語が入っているか",category:"calc",fields:[fv("str","テキスト","hello world"),fv("search","検索ワード","world")]},
  // ─── アイテムID ───
  {type:"ca_id_gem",  emoji:"Gem",label:"宝石・鉱石ID",      sublabel:"ダイヤ・金など鉱石のアイテムID",category:"calc",
    fields:[fv("id","アイテム","minecraft:diamond",[
      "minecraft:diamond","minecraft:emerald","minecraft:gold_ingot","minecraft:iron_ingot",
      "minecraft:netherite_ingot","minecraft:coal","minecraft:redstone","minecraft:lapis_lazuli",
      "minecraft:quartz","minecraft:amethyst_shard","minecraft:raw_gold","minecraft:raw_iron","minecraft:raw_copper",
    ])]},
  {type:"ca_id_block", emoji:"Blocks",label:"ブロックID",       sublabel:"よく使うブロックのアイテムID",  category:"calc",
    fields:[fv("id","ブロック","minecraft:stone",BLOCKS)]},
  {type:"ca_id_tool",  emoji:"Sword",label:"武器・ツールID",   sublabel:"剣・ツルハシなどのアイテムID",  category:"calc",
    fields:[fv("id","ツール","minecraft:diamond_sword",[
      "minecraft:diamond_sword","minecraft:iron_sword","minecraft:stone_sword","minecraft:wooden_sword","minecraft:golden_sword","minecraft:netherite_sword",
      "minecraft:diamond_pickaxe","minecraft:iron_pickaxe","minecraft:stone_pickaxe","minecraft:wooden_pickaxe","minecraft:netherite_pickaxe",
      "minecraft:diamond_axe","minecraft:iron_axe","minecraft:stone_axe","minecraft:wooden_axe",
      "minecraft:diamond_shovel","minecraft:iron_shovel",
      "minecraft:bow","minecraft:crossbow","minecraft:arrow","minecraft:trident",
      "minecraft:shield","minecraft:flint_and_steel","minecraft:shears",
    ])]},
  {type:"ca_id_armor", emoji:"Shield",label:"防具ID",           sublabel:"ヘルメット・チェストなど防具ID",category:"calc",
    fields:[fv("id","防具","minecraft:diamond_chestplate",[
      "minecraft:diamond_helmet","minecraft:diamond_chestplate","minecraft:diamond_leggings","minecraft:diamond_boots",
      "minecraft:iron_helmet","minecraft:iron_chestplate","minecraft:iron_leggings","minecraft:iron_boots",
      "minecraft:netherite_helmet","minecraft:netherite_chestplate","minecraft:netherite_leggings","minecraft:netherite_boots",
      "minecraft:golden_helmet","minecraft:golden_chestplate","minecraft:golden_leggings","minecraft:golden_boots",
      "minecraft:leather_helmet","minecraft:leather_chestplate","minecraft:leather_leggings","minecraft:leather_boots",
      "minecraft:elytra","minecraft:turtle_helmet",
    ])]},
  {type:"ca_id_food",  emoji:"Cookie",label:"食べ物ID",         sublabel:"食料アイテムのID",              category:"calc",
    fields:[fv("id","食べ物","minecraft:bread",[
      "minecraft:bread","minecraft:apple","minecraft:golden_apple","minecraft:enchanted_golden_apple",
      "minecraft:cooked_beef","minecraft:beef","minecraft:cooked_porkchop","minecraft:porkchop",
      "minecraft:cooked_chicken","minecraft:chicken","minecraft:cooked_mutton","minecraft:mutton",
      "minecraft:cooked_fish","minecraft:fish","minecraft:cooked_salmon","minecraft:salmon",
      "minecraft:cake","minecraft:cookie","minecraft:pumpkin_pie","minecraft:melon_slice",
      "minecraft:carrot","minecraft:golden_carrot","minecraft:potato","minecraft:baked_potato",
      "minecraft:beetroot","minecraft:beetroot_soup","minecraft:mushroom_stew","minecraft:rabbit_stew",
    ])]},
  {type:"ca_id_misc",  emoji:"Backpack",label:"その他アイテムID", sublabel:"特殊・便利アイテムのID",        category:"calc",
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
  {type:"ca_id_mob",   emoji:"Bug",label:"エンティティID",   sublabel:"スポーンエッグ・モブのID",      category:"calc",
    fields:[fv("id","エンティティ","minecraft:zombie",[
      "minecraft:zombie","minecraft:skeleton","minecraft:creeper","minecraft:spider","minecraft:enderman",
      "minecraft:witch","minecraft:blaze","minecraft:ghast","minecraft:wither_skeleton",
      "minecraft:pig","minecraft:cow","minecraft:sheep","minecraft:chicken","minecraft:horse",
      "minecraft:wolf","minecraft:cat","minecraft:ocelot","minecraft:parrot","minecraft:fox",
      "minecraft:villager","minecraft:wandering_trader","minecraft:iron_golem","minecraft:snow_golem",
      "minecraft:ender_dragon","minecraft:wither","minecraft:elder_guardian","minecraft:shulker",
    ])]},
  {type:"ca_id_effect",emoji:"Sparkles",label:"エフェクトID",     sublabel:"ポーション効果のID",            category:"calc",
    fields:[fv("id","エフェクト","speed",[
      "speed","slowness","haste","mining_fatigue","strength","instant_health","instant_damage",
      "jump_boost","nausea","regeneration","resistance","fire_resistance","water_breathing",
      "invisibility","blindness","night_vision","hunger","weakness","poison","wither",
      "health_boost","absorption","saturation","glowing","levitation","luck","bad_luck",
      "slow_falling","conduit_power","dolphins_grace","bad_omen","hero_of_the_village",
    ])]},
  // ─── 変数 ───
  {type:"vv_set",  emoji:"Download",label:"変数に代入",          sublabel:"変数に値をセットする",             category:"variable",fields:[fv("name","変数名","score"),fv("val","値","0")]},
  {type:"vv_get",  emoji:"Upload",label:"変数を読む",           sublabel:"変数の現在の値を取得",             category:"variable",fields:[fv("name","変数名","score")]},
  {type:"vv_add",  emoji:"Plus",label:"変数に加算",           sublabel:"変数に数値を足す",                 category:"variable",fields:[fv("name","変数名","score"),fv("val","加算する値","1")]},
  {type:"vv_sub",  emoji:"Minus",label:"変数から減算",         sublabel:"変数から数値を引く",               category:"variable",fields:[fv("name","変数名","score"),fv("val","減算する値","1")]},
  {type:"vv_mul",  emoji:"X",label:"変数に乗算",           sublabel:"変数に数値を掛ける",               category:"variable",fields:[fv("name","変数名","score"),fv("val","掛ける値","2")]},
  {type:"vv_div",  emoji:"Divide",label:"変数を除算",           sublabel:"変数を数値で割る",                 category:"variable",fields:[fv("name","変数名","score"),fv("val","割る値","2")]},
  {type:"vv_inc",  emoji:"ArrowUp",label:"変数を1増やす",        sublabel:"変数に1を加算",                    category:"variable",fields:[fv("name","変数名","score")]},
  {type:"vv_dec",  emoji:"ArrowDown",label:"変数を1減らす",        sublabel:"変数から1を減算",                  category:"variable",fields:[fv("name","変数名","score")]},
  {type:"vv_reset",emoji:"RotateCcw",label:"変数をリセット",       sublabel:"変数を0（ゼロ）に戻す",            category:"variable",fields:[fv("name","変数名","score")]},
  {type:"vv_msg",  emoji:"Megaphone",label:"変数の値を表示",       sublabel:"変数の値をメッセージで送信",       category:"variable",fields:[fv("name","変数名","score"),fv("prefix","前の文字","スコア:")]},
  {type:"vv_eq",   emoji:"Equal",label:"変数が等しいか",       sublabel:"変数が指定値と同じなら真",         category:"variable",fields:[fv("name","変数名","score"),fv("val","比較する値","0")]},
  {type:"vv_gt",   emoji:"ChevronsRight",label:"変数が大きいか",       sublabel:"変数が指定値より大きければ真",     category:"variable",fields:[fv("name","変数名","score"),fv("val","比較する値","0")]},
  {type:"vv_lt",   emoji:"ChevronsLeft",label:"変数が小さいか",       sublabel:"変数が指定値より小さければ真",     category:"variable",fields:[fv("name","変数名","score"),fv("val","比較する値","100")]},
  {type:"vv_concat",emoji:"Link",label:"変数に文字を追加",    sublabel:"変数の末尾に文字を連結する",       category:"variable",fields:[fv("name","変数名","text"),fv("val","追加する文字","こんにちは")]},
  // ─── UI作成 ───
  {type:"ui_action",  emoji:"CircleDot",label:"ボタンメニュー",     sublabel:"複数ボタンを並べたメニューを表示",category:"ui",
    fields:[fv("title","タイトル","メニュー"),fv("body","説明文","選んでください"),
            fv("btn1","ボタン1","はい"),fv("btn2","ボタン2","いいえ"),fv("btn3","ボタン3（任意）",""),
            fv("msg1","ボタン1のメッセージ","はいを選んだ"),fv("msg2","ボタン2のメッセージ","いいえを選んだ"),fv("msg3","ボタン3のメッセージ","")]},
  {type:"ui_message", emoji:"MessageSquare",label:"確認ダイアログ",     sublabel:"2択の確認ウィンドウを表示",         category:"ui",
    fields:[fv("title","タイトル","確認"),fv("body","本文","よろしいですか？"),
            fv("btn1","ボタン1（左）","はい"),fv("btn2","ボタン2（右）","いいえ"),
            fv("msg1","ボタン1のメッセージ","はいを選択"),fv("msg2","ボタン2のメッセージ","いいえを選択")]},
  {type:"ui_textinput",emoji:"TextCursorInput",label:"テキスト入力",      sublabel:"プレイヤーに文字を入力させる",       category:"ui",
    fields:[fv("title","タイトル","入力フォーム"),fv("label1","ラベル1","名前"),fv("hint1","ヒント1",""),fv("default1","初期値1",""),
            fv("label2","ラベル2（任意）",""),fv("hint2","ヒント2",""),fv("default2","初期値2",""),
            fv("result","結果メッセージ","入力:{0} / {1}")]},
  {type:"ui_toggle",  emoji:"ToggleRight",label:"ON/OFFスイッチ",     sublabel:"トグルを含むフォームを表示",         category:"ui",
    fields:[fv("title","タイトル","設定"),fv("label","スイッチ名","通知をON"),fv("default","初期値","ON",["ON","OFF"]),
            fv("msgon","ONのメッセージ","通知をONにした"),fv("msgoff","OFFのメッセージ","通知をOFFにした")]},
  {type:"ui_slider",  emoji:"SlidersHorizontal",label:"スライダー入力",     sublabel:"数値をスライダーで入力させる",       category:"ui",
    fields:[fv("title","タイトル","数値入力"),fv("label","ラベル","値"),fv("min","最小","0"),fv("max","最大","100"),fv("step","ステップ","1"),fv("default","初期値","50"),
            fv("result","結果メッセージ","選んだ値:{0}")]},
  {type:"ui_dropdown",emoji:"ListFilter",label:"ドロップダウン",      sublabel:"リストから1つ選ばせるフォーム",      category:"ui",
    fields:[fv("title","タイトル","選択してください"),fv("label","ラベル","モード"),
            fv("items","選択肢（カンマ区切り）","サバイバル,クリエイティブ,アドベンチャー"),fv("default","初期インデックス","0"),
            fv("result","結果メッセージ","選択:{0}")]},
  {type:"ui_mixed",   emoji:"LayoutGrid",label:"複合フォーム",        sublabel:"テキスト・トグル・スライダーを組み合わせ",category:"ui",
    fields:[fv("title","タイトル","設定フォーム"),
            fv("el1","要素1 (text/toggle/slider)","text"),fv("lbl1","ラベル1","名前"),fv("val1","初期値1",""),
            fv("el2","要素2","toggle"),fv("lbl2","ラベル2","通知"),fv("val2","初期値2","true"),
            fv("el3","要素3","slider"),fv("lbl3","ラベル3","音量"),fv("val3","初期値3","50"),
            fv("result","結果メッセージ","{0} / {1} / {2}")]},
];

export { TEMPLATES, CALC_SUBTABS, getCalcSubCat };
