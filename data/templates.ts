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
  {type:"ev_join",  emoji:"UserPlus",label:"参加したとき",        sublabel:"ワールドへようこそ！冒険の始まりだ",category:"trigger",fields:[]},
  {type:"ev_break", emoji:"Pickaxe",label:"ブロック破壊",        sublabel:"ボロッと崩壊！ブロックを壊した瞬間",     category:"trigger",fields:[fv("block","ブロック","minecraft:stone",BLOCKS)]},
  {type:"ev_item",  emoji:"Wand2",label:"アイテム使用",        sublabel:"右クリックで発動！便利な道具を使おう",      category:"trigger",fields:[fv("item","アイテム","minecraft:diamond",ITEMS)]},
  {type:"ev_tick",  emoji:"Timer",label:"毎ティック実行",      sublabel:"１秒に２０回！息もつかせぬ連続発動",        category:"trigger",fields:[]},
  {type:"ev_chat",  emoji:"MessageSquare",label:"チャット入力",        sublabel:"呪文のような言葉をチャットに響かせろ",    category:"trigger",fields:[fv("pat","合言葉","!こんにちは")]},
  {type:"ev_hurt",  emoji:"Swords",label:"ダメージ受信",        sublabel:"アイタッ！ダメージを受けた瞬間に発動",   category:"trigger",fields:[]},
  {type:"ev_place", emoji:"Blocks",label:"ブロック設置",        sublabel:"ポンッと設置！ブロックを置いた瞬間に",     category:"trigger",fields:[]},
  {type:"ev_respawn", emoji:"HeartHandshake",label:"リスポーンしたとき",sublabel:"やられても負けない！復活した瞬間に発動",       category:"trigger",fields:[]},
  {type:"ev_attack",  emoji:"Swords",label:"エンティティを攻撃",   sublabel:"くらえっ！モブや相手をバシッと殴る",   category:"trigger",fields:[]},
  {type:"ev_kill",    emoji:"Skull",label:"敵をたおしたとき",      sublabel:"やったぜ完全勝利！相手を倒した瞬間",   category:"trigger",fields:[]},
  {type:"ev_useblock",emoji:"Hand",label:"ブロックを使用",        sublabel:"チェストや扉を右クリックでカチャッ",     category:"trigger",fields:[fv("block","ブロック","minecraft:chest",BLOCKS)]},
  {type:"ev_useentity",emoji:"Contact",label:"エンティティを使用",  sublabel:"モブを右クリック！触れ合いの時間だ",         category:"trigger",fields:[]},
  {type:"ev_button",  emoji:"MousePointerClick",label:"ボタンを押したとき",sublabel:"ポチッとな！ボタンを押してギミック始動",       category:"trigger",fields:[]},
  {type:"ev_lever",   emoji:"ToggleLeft",label:"レバーを操作",     sublabel:"ガチャン！レバーを引く手は止められない",    category:"trigger",fields:[]},
  {type:"ev_hitblock",emoji:"Hammer",label:"ブロックを叩いた",     sublabel:"壊れなくてもヨシ！左クリックで叩いた瞬間",category:"trigger",fields:[fv("block","ブロック","minecraft:stone",BLOCKS)]},
  // ─── アクション ───
  {type:"ac_msg",   emoji:"Megaphone",label:"メッセージ送信",      sublabel:"対象のプレイヤーへ言葉をしっかり届ける",category:"action",fields:[fv("msg","メッセージ","こんにちは！",MSGS),fv("target","対象","@a",TARGETS)]},
  {type:"ac_give",  emoji:"Gift",label:"アイテム付与",        sublabel:"ポケットにプレゼント！アイテムをお届け",category:"action",fields:[fv("item","アイテム","minecraft:diamond",ITEMS),fv("count","個数","1",COUNTS)]},
  {type:"ac_tp",    emoji:"Rocket",label:"テレポート",          sublabel:"シュバッ！一瞬で指定の座標へと大跳躍",       category:"action",fields:[fv("x","X","0",COORDS),fv("y","Y","64",COORDS),fv("z","Z","0",COORDS)]},
  {type:"ac_cmd",   emoji:"Terminal",label:"コマンド実行",        sublabel:"スラッシュからの魔法！コマンドを直執行",          category:"action",fields:[fv("cmd","コマンド","say こんにちは",CMDS)]},
  {type:"ac_sound", emoji:"Music",label:"サウンド再生",        sublabel:"ピロリ〜ン！その場を一気に盛り上げる音",           category:"action",fields:[fv("snd","サウンド","random.orb",SOUNDS),fv("vol","音量","1",VOLS)]},
  {type:"ac_title", emoji:"Tv",label:"タイトル表示",        sublabel:"どデカい文字で画面の中央を占領せよ",     category:"action",fields:[fv("title","タイトル","こんにちは",MSGS),fv("sub","サブタイトル","",MSGS)]},
  {type:"ac_effect",emoji:"Sparkles",label:"エフェクト付与",      sublabel:"身体があふれるパワー！ポーション効果付与",   category:"action",fields:[fv("eff","エフェクト","speed",EFFECTS),fv("dur","秒数","10",DURS)]},
  {type:"ac_score", emoji:"Trophy",label:"スコア操作",          sublabel:"得点がどんどん変わる！スコアを書き換える",   category:"action",fields:[fv("op","操作","加算",["加算","減算","セット","リセット"]),fv("obj","目標名","points",SCORE_OBJ),fv("val","値","1",COUNTS)]},
  {type:"ac_tag",   emoji:"Tags",label:"タグ操作",            sublabel:"見えない名札！プレイヤーのタグ管理と剥がし",category:"action",fields:[fv("op","操作","追加",["追加","削除"]),fv("tag","タグ名","vip",TAGS)]},
  {type:"ac_kick",  emoji:"Ban",label:"キック",              sublabel:"お引き取りを！プレイヤーをサーバーから退出",category:"action",fields:[fv("msg","理由","ルール違反",REASONS)]},
  {type:"ac_actionbar",emoji:"MonitorSmartphone",label:"アクションバー表示",sublabel:"視界の邪魔はさせない！画面下部にメッセージ",   category:"action",fields:[fv("msg","メッセージ","こんにちは！",MSGS)]},
  {type:"ac_summon", emoji:"Ghost",label:"エンティティ召喚",    sublabel:"呼んだからには責任を持とう",   category:"action",fields:[fv("mob","エンティティ","minecraft:zombie")]},
  {type:"ac_particle",emoji:"Sparkle",label:"パーティクル表示",  sublabel:"キラキラ輝く光の粒子！映えの世界を彩ろう",     category:"action",fields:[fv("particle","粒子","minecraft:heart_particle")]},
  {type:"ac_xp",     emoji:"Star",label:"経験値を与える",      sublabel:"チャリ〜ン！経験値をチャージして急成長だ",     category:"action",fields:[fv("amount","XP量","10",COUNTS)]},
  {type:"ac_heal",   emoji:"Cross",label:"HPを全回復",         sublabel:"痛いの飛んでけ！ハート満タンの奇跡",   category:"action",fields:[]},
  // ─── 条件 ───
  {type:"co_if",    emoji:"Split",label:"もしも〜なら",        sublabel:"運命の分かれ道！条件に合うときだけ動こう",category:"ifelse",fields:[fv("cond","もしも","スニーク中",["スニーク中","夜間","雨天","HPが少ない"])]},
  {type:"co_tag",   emoji:"Tags",label:"タグを持っているか",  sublabel:"君は仲間かな？指定のタグを持っているか確認",           category:"ifelse",fields:[fv("tag","タグ名","vip")]},
  {type:"co_sneak", emoji:"EyeOff",label:"スニーク中か",        sublabel:"抜き足差し足、こっそりしゃがんでいる状態か",     category:"ifelse",fields:[]},
  {type:"co_item",  emoji:"Search",label:"アイテム所持確認",    sublabel:"かばんの中にアレはある？アイテムの所持検査",category:"ifelse",fields:[fv("item","アイテム","minecraft:diamond",ITEMS)]},
  {type:"co_hp",    emoji:"HeartPulse",label:"HP不足確認",          sublabel:"ピンチはチャンス？ハートが減っているか確認",           category:"ifelse",fields:[fv("threshold","HP基準","10")]},
  {type:"co_night", emoji:"Moon",label:"夜間か",              sublabel:"暗闇が支配する刻、太陽が沈んだ夜間か確認",category:"ifelse",fields:[]},
  {type:"co_rain",  emoji:"CloudRain",label:"雨天か",              sublabel:"傘は無い", category:"ifelse",fields:[]},
  {type:"co_and",   emoji:"CircleDot",label:"かつ（AND）",         sublabel:"どっちも大事！両方の条件をクリアしているか",         category:"ifelse",fields:[]},
  {type:"co_or",    emoji:"Circle",label:"または（OR）",        sublabel:"どちらでもウェルカム！どちらかの条件が成立",     category:"ifelse",fields:[]},
  {type:"co_not",   emoji:"XCircle",label:"でない（NOT）",       sublabel:"あまのじゃくな運命！条件とは反対の状態",     category:"ifelse",fields:[]},
  {type:"co_sprint",emoji:"Footprints",label:"ダッシュ中か",       sublabel:"爆走してる？ダッシュで走っているか確認",         category:"ifelse",fields:[]},
  {type:"co_water", emoji:"Droplets",label:"水中にいるか",         sublabel:"お魚みたいに泳いでる？水の中なのかを判定",   category:"ifelse",fields:[]},
  {type:"co_ground",emoji:"ArrowDownToLine",label:"地面にいるか",  sublabel:"地に足を着けよう！地面をふみしめているか",       category:"ifelse",fields:[]},
  {type:"co_chance",emoji:"Dices",label:"確率で成立",             sublabel:"運命の女神よ微笑んで！指定した確率で大当り",   category:"ifelse",fields:[fv("pct","確率(%)","50")]},
  {type:"co_scoregte",emoji:"Trophy",label:"スコアが以上か",       sublabel:"実力を見せる時が来た！スコアが基準をクリア",   category:"ifelse",fields:[fv("obj","目標名","points",SCORE_OBJ),fv("val","基準","10")]},
  // ─── 値 ───
  {type:"va_name",  emoji:"User",label:"プレイヤー名",        sublabel:"名簿から呼び止めよ！あなたの名前をゲット",   category:"value",  fields:[]},
  {type:"va_rand",  emoji:"Dices",label:"乱数",                sublabel:"出るかは運次第！運命を占うランダムな数値",     category:"value",  fields:[fv("min","最小値","0"),fv("max","最大値","100")]},
  {type:"va_str",   emoji:"Quote",label:"文字列",              sublabel:"どんな言葉も刻める、自由気ままなメッセージ",             category:"value",  fields:[fv("v","テキスト","こんにちは！")]},
  {type:"va_num",   emoji:"Hash",label:"数値",                sublabel:"ゼロも千も思いのまま！シンプルな数のパワー",                   category:"value",  fields:[fv("v","数値","0")]},
  {type:"va_hp",    emoji:"Heart",label:"プレイヤーHP",        sublabel:"ハートは残ってる？現在のＨＰを取り出そう",         category:"value",  fields:[]},
  {type:"va_pos",   emoji:"MapPin",label:"座標",                sublabel:"迷路も解決！現在のＸＹＺ座標値をゲット",          category:"value",  fields:[fv("axis","軸","Y",["X","Y","Z"])]},
  {type:"va_score", emoji:"Trophy",label:"スコア取得",          sublabel:"結果はいかに！スコアボードの点数を取り出す",   category:"value",  fields:[fv("obj","目標名","points")]},
  {type:"va_rot",   emoji:"Compass",label:"向き（角度）",        sublabel:"そっち向いてないで！視線の向きと角度を計算",  category:"value",  fields:[fv("axis","軸","Yaw",["Yaw","Pitch"])]},
  {type:"va_dim",   emoji:"Globe",label:"ディメンションID",      sublabel:"ここはネザーかエンドか？今いる世界のＩＤ",     category:"value",  fields:[]},
  {type:"va_level", emoji:"Star",label:"経験値レベル",          sublabel:"日々の研鑽のしるし！今のＸＰレベルをゲット",           category:"value",  fields:[]},
  {type:"va_maxhp", emoji:"HeartPulse",label:"最大HP",           sublabel:"これぞ健康の限界線！満タンの最大体力を取得",           category:"value",  fields:[]},
  {type:"va_count", emoji:"Users",label:"オンライン人数",        sublabel:"今日は何人が遊んでる？オンライン人数を確認",     category:"value",  fields:[]},
  {type:"va_time",  emoji:"Clock",label:"ワールド時間",          sublabel:"時は金なり！今のワールドの時刻数を知ろう",   category:"value",  fields:[]},
  {type:"va_bool",  emoji:"ToggleRight",label:"真偽値",          sublabel:"白黒はっきりさせよう！真か偽の２択カード",          category:"value",  fields:[fv("v","値","true",["true","false"])]},
  {type:"va_gamemode",emoji:"Gamepad2",label:"ゲームモード",     sublabel:"遊びのオキテ！今のゲームモードを取り出そう",       category:"value",  fields:[]},
  // ─── 制御 ───
  {type:"ct_rep",   emoji:"Repeat",label:"繰り返し",            sublabel:"何度でも挑め！指定した回数だけぐるぐる回す",       category:"loop",   fields:[fv("n","回数","3")]},
  {type:"ct_wait",  emoji:"Hourglass",label:"待機",                sublabel:"果報は寝て待て！決まった秒数だけじっと我慢",         category:"loop",   fields:[fv("s","秒数","1")]},
  {type:"ct_int",   emoji:"Timer",label:"インターバル",        sublabel:"正確なリズムで刻め！一定秒数ごとに繰り返す",       category:"loop",   fields:[fv("s","秒数","5")]},
  {type:"ct_log",   emoji:"ScrollText",label:"ログ出力",            sublabel:"プログラムの裏事情！コンソールに記録を残す",category:"loop",  fields:[fv("v","内容","ログ")]},
  {type:"ct_return",emoji:"CircleStop",label:"中断",                sublabel:"ここで打ち切り！これ以上の処理を止めます",   category:"loop",   fields:[]},
  {type:"ct_delay", emoji:"Timer",label:"待機（ティック）",  sublabel:"コマ送りのお手伝い！数ティックの短い待機",     category:"loop",   fields:[fv("t","ティック","10")]},
  {type:"ct_waitrnd",emoji:"Shuffle",label:"ランダム待機",       sublabel:"いつ動くかドキドキ！ランダムな時間だけ待機", category:"loop",   fields:[fv("min","最小秒","1"),fv("max","最大秒","5")]},
  // ─── 演算：四則演算 ───
  {type:"ca_add",   emoji:"Plus",label:"足し算",              sublabel:"パワーを結合！２つの数を合わせる足し算",                    category:"calc",   fields:[fv("a","A","0"),fv("b","B","0")]},
  {type:"ca_sub",   emoji:"Minus",label:"引き算",              sublabel:"マイナスの切れ味！２つの差を求める引き算",                    category:"calc",   fields:[fv("a","A","0"),fv("b","B","0")]},
  {type:"ca_mul",   emoji:"X",label:"掛け算",              sublabel:"一気に急成長！数値を何倍にもする掛け算",                    category:"calc",   fields:[fv("a","A","1"),fv("b","B","1")]},
  {type:"ca_div",   emoji:"Divide",label:"割り算",              sublabel:"みんなで均等に山分け！数値を分割する割り算",                    category:"calc",   fields:[fv("a","A","0"),fv("b","B","1")]},
  {type:"ca_mod",   emoji:"Percent",label:"余り",                sublabel:"余り物には福がある？割り算した余りを求める",      category:"calc",   fields:[fv("a","A","10"),fv("b","B","3")]},
  {type:"ca_pow",   emoji:"ChevronUp",label:"累乗",                sublabel:"倍々ゲームの極み！Ａを何度も掛ける累乗",                category:"calc",   fields:[fv("a","A","2"),fv("b","B","8")]},
  // ─── 演算：数学関数 ───
  {type:"ca_abs",   emoji:"Ruler",label:"絶対値",              sublabel:"超ポジティブ思考！マイナスを正にする絶対値",      category:"calc",   fields:[fv("a","A","-5")]},
  {type:"ca_floor", emoji:"ArrowDownToLine",label:"切り捨て",            sublabel:"端数はバッサリとポイ！小数点の切り捨て",     category:"calc",   fields:[fv("a","A","3.7")]},
  {type:"ca_ceil",  emoji:"ArrowUpToLine",label:"切り上げ",            sublabel:"少しの端数も一歩上へ！小数を繰り上げる",     category:"calc",   fields:[fv("a","A","3.2")]},
  {type:"ca_round", emoji:"Circle",label:"四捨五入",            sublabel:"ちょうどいい頃合いへ！小数をマルっと四捨五入",           category:"calc",   fields:[fv("a","A","3.5")]},
  {type:"ca_sqrt",  emoji:"SquareRadical",label:"平方根",              sublabel:"２乗のパワーを元通りに！ルートの数を求める",                       category:"calc",   fields:[fv("a","A","9")]},
  {type:"ca_min",   emoji:"ChevronLeft",label:"最小値",              sublabel:"控え目に行こう！２つを比べて小さい方を選ぶ",        category:"calc",   fields:[fv("a","A","3"),fv("b","B","7")]},
  {type:"ca_max",   emoji:"ChevronRight",label:"最大値",              sublabel:"デカい事は正義！２つ比べて大きい方をチョイス",        category:"calc",   fields:[fv("a","A","3"),fv("b","B","7")]},
  {type:"ca_clamp", emoji:"Clamp",label:"範囲制限",            sublabel:"暴走阻止！数値を指定した最小〜最大にガード",   category:"calc",   fields:[fv("val","値","50"),fv("min","最小","0"),fv("max","最大","100")]},
  {type:"ca_sin",   emoji:"Waves",label:"sin",                 sublabel:"波打つメロディーの魔法！サイン波を作る関数",        category:"calc",   fields:[fv("a","角度(rad)","0")]},
  {type:"ca_cos",   emoji:"Waves",label:"cos",                 sublabel:"サインと対なる踊り子！コサイン関数で円を描く",      category:"calc",   fields:[fv("a","角度(rad)","0")]},
  {type:"ca_pi",    emoji:"Pi", label:"円周率 π",            sublabel:"永遠に終わらない伝説の数字、３．１４１５９…",                  category:"calc",   fields:[]},
  // ─── 演算：比較 ───
  {type:"ca_gt",    emoji:"ChevronsRight",label:"A > B（より大きい）", sublabel:"相手の上を越えて行け！ＡがＢより大きければ真",  category:"calc",   fields:[fv("a","A","5"),fv("b","B","3")]},
  {type:"ca_lt",    emoji:"ChevronsLeft",label:"A < B（より小さい）", sublabel:"潜り抜ける隙はあるか？ＡがＢより小さければ真",  category:"calc",   fields:[fv("a","A","3"),fv("b","B","5")]},
  {type:"ca_gte",   emoji:"ChevronsRight",label:"A ≥ B（以上）",       sublabel:"互角かそれ以上のパワー！ＡがＢ以上ならパス",        category:"calc",   fields:[fv("a","A","5"),fv("b","B","5")]},
  {type:"ca_lte",   emoji:"ChevronsLeft",label:"A ≤ B（以下）",       sublabel:"このラインには触れてよし！ＡがＢ以下ならパス",        category:"calc",   fields:[fv("a","A","3"),fv("b","B","5")]},
  {type:"ca_eq",    emoji:"Equal",label:"A = B（等しい）",     sublabel:"これぞ奇跡のシンクロ！ＡとＢが等しければ真",    category:"calc",   fields:[fv("a","A","1"),fv("b","B","1")]},
  {type:"ca_neq",   emoji:"EqualNot", label:"A ≠ B（等しくない）",sublabel:"人とは違う我が道を！ＡとＢが違う数字なら真",        category:"calc",   fields:[fv("a","A","1"),fv("b","B","2")]},
  // ─── 演算：文字列 ───
  {type:"ca_concat",emoji:"Link",label:"文字連結",            sublabel:"ことばのドッキング！２つのテキストを連結",           category:"calc",   fields:[fv("a","前","こんにちは"),fv("b","後","！")]},
  {type:"ca_strlen",emoji:"Ruler",label:"文字数",              sublabel:"メジャーで測定！テキストに何文字あるかを計る",         category:"calc",   fields:[fv("str","テキスト","hello")]},
  {type:"ca_numstr",emoji:"ArrowRightLeft",label:"数値→文字",          sublabel:"計算はおしまい！数をテキスト文字へと大変化",       category:"calc",   fields:[fv("num","数値","42")]},
  {type:"ca_strnum",emoji:"ArrowRightLeft",label:"文字→数値",          sublabel:"数字のふりはおしまい！文字を本物の数値へと変換",       category:"calc",   fields:[fv("str","テキスト","42")]},
  {type:"ca_substr",emoji:"Scissors",label:"部分文字列",          sublabel:"ハサミでチョキチョキ！言葉の一部分を切り抜き",       category:"calc",   fields:[fv("str","テキスト","hello"),fv("start","開始","0"),fv("len","長さ","3")]},
  {type:"ca_replace",emoji:"Replace",label:"文字置換",           sublabel:"すり替え術！テキスト中の特定の言葉を入れ替え",category:"calc",  fields:[fv("str","テキスト","hello world"),fv("from","検索","world"),fv("to","置換","！")]},
  {type:"ca_upper", emoji:"CaseSensitive",label:"大文字変換",          sublabel:"気合いは十分！英語をすべて豪快な大文字へ変える",       category:"calc",   fields:[fv("str","テキスト","hello")]},
  {type:"ca_lower", emoji:"CaseLower",label:"小文字変換",          sublabel:"ひっそりおしとやか！英語をすべて優しい小文字に",       category:"calc",   fields:[fv("str","テキスト","HELLO")]},
  {type:"ca_contains",emoji:"Search",label:"文字列を含むか",    sublabel:"見逃さない眼力！テキストにその言葉があるか",category:"calc",fields:[fv("str","テキスト","hello world"),fv("search","検索ワード","world")]},
  // ─── アイテムID ───
  {type:"ca_id_gem",  emoji:"Gem",label:"宝石・鉱石ID",      sublabel:"輝く夢とお宝の結晶！ダイヤや鉱石のアイテムＩＤ",category:"calc",
    fields:[fv("id","アイテム","minecraft:diamond",[
      "minecraft:diamond","minecraft:emerald","minecraft:gold_ingot","minecraft:iron_ingot",
      "minecraft:netherite_ingot","minecraft:coal","minecraft:redstone","minecraft:lapis_lazuli",
      "minecraft:quartz","minecraft:amethyst_shard","minecraft:raw_gold","minecraft:raw_iron","minecraft:raw_copper",
    ])]},
  {type:"ca_id_block", emoji:"Blocks",label:"ブロックID",       sublabel:"世界を築く大切な素材！定番ブロックのＩＤ集",  category:"calc",
    fields:[fv("id","ブロック","minecraft:stone",BLOCKS)]},
  {type:"ca_id_tool",  emoji:"Sword",label:"武器・ツールID",   sublabel:"戦いと冒険の頼れる相棒！剣やツルハシ等のＩＤ",  category:"calc",
    fields:[fv("id","ツール","minecraft:diamond_sword",[
      "minecraft:diamond_sword","minecraft:iron_sword","minecraft:stone_sword","minecraft:wooden_sword","minecraft:golden_sword","minecraft:netherite_sword",
      "minecraft:diamond_pickaxe","minecraft:iron_pickaxe","minecraft:stone_pickaxe","minecraft:wooden_pickaxe","minecraft:netherite_pickaxe",
      "minecraft:diamond_axe","minecraft:iron_axe","minecraft:stone_axe","minecraft:wooden_axe",
      "minecraft:diamond_shovel","minecraft:iron_shovel",
      "minecraft:bow","minecraft:crossbow","minecraft:arrow","minecraft:trident",
      "minecraft:shield","minecraft:flint_and_steel","minecraft:shears",
    ])]},
  {type:"ca_id_armor", emoji:"Shield",label:"防具ID",           sublabel:"身を守る鉄壁のよろい！ヘルメット等防具のＩＤ",category:"calc",
    fields:[fv("id","防具","minecraft:diamond_chestplate",[
      "minecraft:diamond_helmet","minecraft:diamond_chestplate","minecraft:diamond_leggings","minecraft:diamond_boots",
      "minecraft:iron_helmet","minecraft:iron_chestplate","minecraft:iron_leggings","minecraft:iron_boots",
      "minecraft:netherite_helmet","minecraft:netherite_chestplate","minecraft:netherite_leggings","minecraft:netherite_boots",
      "minecraft:golden_helmet","minecraft:golden_chestplate","minecraft:golden_leggings","minecraft:golden_boots",
      "minecraft:leather_helmet","minecraft:leather_chestplate","minecraft:leather_leggings","minecraft:leather_boots",
      "minecraft:elytra","minecraft:turtle_helmet",
    ])]},
  {type:"ca_id_food",  emoji:"Cookie",label:"食べ物ID",         sublabel:"冒険においしいお弁当！パンやお肉など食料ＩＤ",              category:"calc",
    fields:[fv("id","食べ物","minecraft:bread",[
      "minecraft:bread","minecraft:apple","minecraft:golden_apple","minecraft:enchanted_golden_apple",
      "minecraft:cooked_beef","minecraft:beef","minecraft:cooked_porkchop","minecraft:porkchop",
      "minecraft:cooked_chicken","minecraft:chicken","minecraft:cooked_mutton","minecraft:mutton",
      "minecraft:cooked_fish","minecraft:fish","minecraft:cooked_salmon","minecraft:salmon",
      "minecraft:cake","minecraft:cookie","minecraft:pumpkin_pie","minecraft:melon_slice",
      "minecraft:carrot","minecraft:golden_carrot","minecraft:potato","minecraft:baked_potato",
      "minecraft:beetroot","minecraft:beetroot_soup","minecraft:mushroom_stew","minecraft:rabbit_stew",
    ])]},
  {type:"ca_id_misc",  emoji:"Backpack",label:"その他アイテムID", sublabel:"あると超便利！時計やエリトラ等 特殊グッズＩＤ",        category:"calc",
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
  {type:"ca_id_mob",   emoji:"Bug",label:"エンティティID",   sublabel:"賑やかでやんちゃな生き物！村人やモブのＩＤ",      category:"calc",
    fields:[fv("id","エンティティ","minecraft:zombie",[
      "minecraft:zombie","minecraft:skeleton","minecraft:creeper","minecraft:spider","minecraft:enderman",
      "minecraft:witch","minecraft:blaze","minecraft:ghast","minecraft:wither_skeleton",
      "minecraft:pig","minecraft:cow","minecraft:sheep","minecraft:chicken","minecraft:horse",
      "minecraft:wolf","minecraft:cat","minecraft:ocelot","minecraft:parrot","minecraft:fox",
      "minecraft:villager","minecraft:wandering_trader","minecraft:iron_golem","minecraft:snow_golem",
      "minecraft:ender_dragon","minecraft:wither","minecraft:elder_guardian","minecraft:shulker",
    ])]},
  {type:"ca_id_effect",emoji:"Sparkles",label:"エフェクトID",     sublabel:"パワー爆発や暗闇の呪い！魔法のエフェクトＩＤ",            category:"calc",
    fields:[fv("id","エフェクト","speed",[
      "speed","slowness","haste","mining_fatigue","strength","instant_health","instant_damage",
      "jump_boost","nausea","regeneration","resistance","fire_resistance","water_breathing",
      "invisibility","blindness","night_vision","hunger","weakness","poison","wither",
      "health_boost","absorption","saturation","glowing","levitation","luck","bad_luck",
      "slow_falling","conduit_power","dolphins_grace","bad_omen","hero_of_the_village",
    ])]},
  // ─── 変数 ───
  {type:"vv_set",  emoji:"Download",label:"変数に代入",          sublabel:"記憶の箱に詰め込もう！変数へしっかり値を入れる",             category:"variable",fields:[fv("name","変数名","score"),fv("val","値","0")]},
  {type:"vv_get",  emoji:"Upload",label:"変数を読む",           sublabel:"あの箱の秘密はなあに？大切にしまった値を読む",             category:"variable",fields:[fv("name","変数名","score")]},
  {type:"vv_add",  emoji:"Plus",label:"変数に加算",           sublabel:"ボーナス追加！しまってある変数の数をもっと増やす",                 category:"variable",fields:[fv("name","変数名","score"),fv("val","加算する値","1")]},
  {type:"vv_sub",  emoji:"Minus",label:"変数から減算",         sublabel:"使いすぎにご注意！変数の貯金から数字を引き算",               category:"variable",fields:[fv("name","変数名","score"),fv("val","減算する値","1")]},
  {type:"vv_mul",  emoji:"X",label:"変数に乗算",           sublabel:"ミラクル大増殖！しまってある変数に掛け算をかざす",               category:"variable",fields:[fv("name","変数名","score"),fv("val","掛ける値","2")]},
  {type:"vv_div",  emoji:"Divide",label:"変数を除算",           sublabel:"公平なケーキシェア！変数の数字を指定の数で割る",                 category:"variable",fields:[fv("name","変数名","score"),fv("val","割る値","2")]},
  {type:"vv_inc",  emoji:"ArrowUp",label:"変数を1増やす",        sublabel:"小さな一歩の大変化！変数の数字を１つだけアップ",                    category:"variable",fields:[fv("name","変数名","score")]},
  {type:"vv_dec",  emoji:"ArrowDown",label:"変数を1減らす",        sublabel:"時計の針を進めよう！変数の数字をたった１つダウン",                  category:"variable",fields:[fv("name","変数名","score")]},
  {type:"vv_reset",emoji:"RotateCcw",label:"変数をリセット",       sublabel:"最初から作りなおし！数値をキレイにゼロへ戻す",            category:"variable",fields:[fv("name","変数名","score")]},
  {type:"vv_msg",  emoji:"Megaphone",label:"変数の値を表示",       sublabel:"運命の成績発表！今の変数の数字をメッセージ配信",       category:"variable",fields:[fv("name","変数名","score"),fv("prefix","前の文字","スコア:")]},
  {type:"vv_eq",   emoji:"Equal",label:"変数が等しいか",       sublabel:"奇跡の一致！変数の数字が狙った値とドンピシャか",         category:"variable",fields:[fv("name","変数名","score"),fv("val","比較する値","0")]},
  {type:"vv_gt",   emoji:"ChevronsRight",label:"変数が大きいか",       sublabel:"期待のハードルを越えろ！変数が指定の数よりデカイか",     category:"variable",fields:[fv("name","変数名","score"),fv("val","比較する値","0")]},
  {type:"vv_lt",   emoji:"ChevronsLeft",label:"変数が小さいか",       sublabel:"ハードルを潜り抜け！変数が指定した数字より小さいか",     category:"variable",fields:[fv("name","変数名","score"),fv("val","比較する値","100")]},
  {type:"vv_concat",emoji:"Link",label:"変数に文字を追加",    sublabel:"ペンで一筆足し直そう！変数の文末に続き言葉を追加",       category:"variable",fields:[fv("name","変数名","text"),fv("val","追加する文字","こんにちは")]},
  {type:"vv_neq",  emoji:"EqualNot",label:"変数が違うか",       sublabel:"同じレールはまっぴら！変数が狙った値と違うか",           category:"variable",fields:[fv("name","変数名","score"),fv("val","比較する値","0")]},
  {type:"vv_gte",  emoji:"ChevronsRight",label:"変数が以上か",     sublabel:"パスポートは揃った！変数の数字が狙いライン以上か",           category:"variable",fields:[fv("name","変数名","score"),fv("val","比較する値","0")]},
  {type:"vv_lte",  emoji:"ChevronsLeft",label:"変数が以下か",     sublabel:"重量超過はしません！変数の値がターゲット以下か",           category:"variable",fields:[fv("name","変数名","score"),fv("val","比較する値","100")]},
  // ─── UI作成 ───
  {type:"ui_action",  emoji:"CircleDot",label:"ボタンメニュー",     sublabel:"選べる楽しさ満開！複数ボタンをそろえた贅沢メニュー",category:"ui",
    fields:[fv("title","タイトル","メニュー"),fv("body","説明文","選んでください"),
            fv("btn1","ボタン1","はい"),fv("btn2","ボタン2","いいえ"),fv("btn3","ボタン3（任意）",""),
            fv("msg1","ボタン1のメッセージ","はいを選んだ"),fv("msg2","ボタン2のメッセージ","いいえを選んだ"),fv("msg3","ボタン3のメッセージ","")]},
  {type:"ui_message", emoji:"MessageSquare",label:"確認ダイアログ",     sublabel:"本当にそれでイイの？はいといいえの運命な２択窓",         category:"ui",
    fields:[fv("title","タイトル","確認"),fv("body","本文","よろしいですか？"),
            fv("btn1","ボタン1（左）","はい"),fv("btn2","ボタン2（右）","いいえ"),
            fv("msg1","ボタン1のメッセージ","はいを選択"),fv("msg2","ボタン2のメッセージ","いいえを選択")]},
  {type:"ui_textinput",emoji:"TextCursorInput",label:"テキスト入力",      sublabel:"君の言葉で語ってね！プレイヤーへ自由な文字入力窓",       category:"ui",
    fields:[fv("title","タイトル","入力フォーム"),fv("label1","ラベル1","名前"),fv("hint1","ヒント1",""),fv("default1","初期値1",""),
            fv("label2","ラベル2（任意）",""),fv("hint2","ヒント2",""),fv("default2","初期値2",""),
            fv("result","結果メッセージ","入力:{0} / {1}")]},
  {type:"ui_toggle",  emoji:"ToggleRight",label:"ON/OFFスイッチ",     sublabel:"パチッと軽快な切替！ＯＮとＯＦＦを選ぶスイッチの窓",         category:"ui",
    fields:[fv("title","タイトル","設定"),fv("label","スイッチ名","通知をON"),fv("default","初期値","ON",["ON","OFF"]),
            fv("msgon","ONのメッセージ","通知をONにした"),fv("msgoff","OFFのメッセージ","通知をOFFにした")]},
  {type:"ui_slider",  emoji:"SlidersHorizontal",label:"スライダー入力",     sublabel:"ツルっと動かして簡単調整！スライダーで数字を選ぶ窓",       category:"ui",
    fields:[fv("title","タイトル","数値入力"),fv("label","ラベル","値"),fv("min","最小","0"),fv("max","最大","100"),fv("step","ステップ","1"),fv("default","初期値","50"),
            fv("result","結果メッセージ","選んだ値:{0}")]},
  {type:"ui_dropdown",emoji:"ListFilter",label:"ドロップダウン",      sublabel:"クリックで開く宝箱！リストの選択肢から気に入る１つを",      category:"ui",
    fields:[fv("title","タイトル","選択してください"),fv("label","ラベル","モード"),
            fv("items","選択肢（カンマ区切り）","サバイバル,クリエイティブ,アドベンチャー"),fv("default","初期インデックス","0"),
            fv("result","結果メッセージ","選択:{0}")]},
  {type:"ui_mixed",   emoji:"LayoutGrid",label:"複合フォーム",        sublabel:"よくばりフルコース！文字やスイッチを合体させた窓",category:"ui",
    fields:[fv("title","タイトル","設定フォーム"),
            fv("el1","要素1 (text/toggle/slider)","text"),fv("lbl1","ラベル1","名前"),fv("val1","初期値1",""),
            fv("el2","要素2","toggle"),fv("lbl2","ラベル2","通知"),fv("val2","初期値2","true"),
            fv("el3","要素3","slider"),fv("lbl3","ラベル3","音量"),fv("val3","初期値3","50"),
            fv("result","結果メッセージ","{0} / {1} / {2}")]},
  {type:"ui_longtext",emoji:"BookOpen",label:"お知らせ表示",       sublabel:"じっくり読める説明書！長文をゆったり伝えるお知らせ窓",     category:"ui",
    fields:[fv("title","タイトル","おしらせ"),fv("body","本文","ここに説明を書きます。\n改行もできます。"),fv("btn","ボタン","とじる")]},
];

export { TEMPLATES, CALC_SUBTABS, getCalcSubCat };
