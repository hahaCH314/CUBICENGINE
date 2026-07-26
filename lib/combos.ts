/* ══════════════════════════════════════════════════════════
   コンボ定義＆判定ロジック — lib/combos.ts
   
   特定のカード（ブロックの type）が揃ったときに成立する、
   ワクワクするコンボ技の定義データと判定処理を提供します。
   ══════════════════════════════════════════════════════════ */

export type Combo = {
  id: string;
  name: string;
  icon: string;
  hint: string;
  seq: string[];
};

/**
 * 子どもが偶然見つけて嬉しくなるコンボ定義リスト
 * ※ seq には data/templates.ts に実在する type のみを指定しています。
 */
export const COMBOS: Combo[] = [
  {
    id: "infinite_diamond",
    name: "無限ダイヤ",
    icon: "Gem",
    hint: "アイテムを使ってダイヤモンドを大量にもらい続けよう！",
    seq: ["ev_item", "ac_give", "ca_id_gem"]
  },
  {
    id: "explosive_chicken",
    name: "爆発ニワトリ",
    icon: "Skull",
    hint: "エンティティを召喚してド派手なサウンドと光を轟かせよう！",
    seq: ["ac_summon", "ac_sound", "ac_particle"]
  },
  {
    id: "god_of_thunder",
    name: "雷神降臨",
    icon: "Zap",
    hint: "雨が降り落ちる夜に、特別なコマンドを直接呼び出そう！",
    seq: ["co_rain", "co_night", "ac_cmd"]
  },
  {
    id: "speed_star",
    name: "スピードスター",
    icon: "Footprints",
    hint: "ダッシュ中に魔法のエフェクトを付与して限界を超えた移動速度へ！",
    seq: ["co_sprint", "ac_effect", "ca_id_effect"]
  },
  {
    id: "immortal_warrior",
    name: "不死身の勇者",
    icon: "HeartPulse",
    hint: "体力が残り減るピンチの状況を検出し、HPを一気にフルリカバリー！",
    seq: ["co_hp", "ac_heal", "ac_effect"]
  },
  {
    id: "teleport_master",
    name: "瞬間移動マスター",
    icon: "Rocket",
    hint: "スニーク姿勢からの座標計算＆テレポートで、瞬時に異次元の跳躍！",
    seq: ["co_sneak", "ac_tp", "va_pos"]
  },
  {
    id: "lottery_jackpot",
    name: "大富豪ガチャ",
    icon: "Dices",
    hint: "確率判定とループの力で運試し！当たりを引いたらお宝獲得だ！",
    seq: ["co_chance", "ac_give", "ct_rep"]
  },
  {
    id: "chat_magician",
    name: "チャット魔術師",
    icon: "MessageSquare",
    hint: "合言葉をチャットで唱えるだけで、魔法のように巨大タイトル表示！",
    seq: ["ev_chat", "ac_title", "va_str"]
  },
  {
    id: "level_up_festival",
    name: "超究極レベルアップ祭",
    icon: "Star",
    hint: "相手や敵をたおした瞬間に、ファンファーレと共に大量の経験値！",
    seq: ["ev_kill", "ac_xp", "ac_sound"]
  },
  {
    id: "time_manipulator",
    name: "時の支配者",
    icon: "Clock",
    hint: "インターバル実行でワールド時間を見張り、コマンドで昼夜を支配！",
    seq: ["ct_int", "va_time", "ac_cmd"]
  },
  {
    id: "invisible_ninja",
    name: "忍び隠れのステルス忍術",
    icon: "EyeOff",
    hint: "こっそりスニーク中に暗い夜が訪れると、特殊エフェクトを纏えるぞ！",
    seq: ["co_sneak", "co_night", "ac_effect"]
  },
  {
    id: "mystery_menu",
    name: "究極の選択レストラン",
    icon: "Utensils",
    hint: "ボタンメニューを開き、食べ物のアイテムIDを渡す極上レストラン！",
    seq: ["ui_action", "ca_id_food", "ac_give"]
  },
  {
    id: "treasure_hunter",
    name: "最強のトレージャーハンター",
    icon: "Pickaxe",
    hint: "ブロックを壊した瞬間、その座標の導きによって特別なアイテム発見！",
    seq: ["ev_break", "va_pos", "ac_give"]
  },
  {
    id: "party_popper",
    name: "パリピカーニバル",
    icon: "Sparkles",
    hint: "仲間がワールドに参加したら、音とメッセージと粒子で大熱気な歓迎！",
    seq: ["ev_join", "ac_msg", "ac_sound", "ac_particle"]
  },
  {
    id: "legendary_blacksmith",
    name: "伝説の鍛冶職人",
    icon: "Hammer",
    hint: "ブロックを叩き、武器や防具の力を練成し最強の装備をプレゼント！",
    seq: ["ev_hitblock", "ca_id_tool", "ca_id_armor", "ac_give"]
  },
  {
    id: "aquatic_champion",
    name: "アクアティック・ロード",
    icon: "Droplets",
    hint: "冷たい水中へ泳いでいる間、神秘的なパーティクルと力を得られる！",
    seq: ["co_water", "ac_effect", "ac_particle"]
  },
  {
    id: "miracle_respawn",
    name: "不屈のフェニックス",
    icon: "Flame",
    hint: "何度倒れても立ち上がる！リスポーンと同時にHP全快＆雄大な称号！",
    seq: ["ev_respawn", "ac_heal", "ac_effect", "ac_title"]
  },
  {
    id: "secret_button_trap",
    name: "ドッキリからくりトラップ",
    icon: "MousePointerClick",
    hint: "何気なくボタンやレバーを触るやつを、音と同時に異次元テレポート！？",
    seq: ["ev_button", "ev_lever", "ac_tp", "ac_sound"]
  }
];

/**
 * ブロックの type 配列を受け取り、成立したコンボを返す関数
 * 
 * 【判定仕様の明記】：
 * 本ロジックでは「含まれているか」（サブセット方式）にてコンボ成立を判定します。
 * 入力された `types` 配列の中に、コンボで規定された `seq` の全てのカード(type)が
 * 揃っていれば、順番の前後やカード間の距離・連続性を問わず「コンボ成立」と見なします。
 * （子どもたちが楽しく自由に組んだ際にも当たり判定が優しく発生するようにするためです）
 */
export function detectCombos(types: string[]): Combo[] {
  if (!types || types.length === 0) return [];
  
  return COMBOS.filter(combo => 
    combo.seq.every(reqType => types.includes(reqType))
  );
}
