/**
 * Java版「汎用エンジン注入方式」の設計図（cubic_data.json）の仕様。
 *
 * ■ 何のためのファイルか
 *   ブラウザでは Java をコンパイルできない。そこで、あらかじめビルドしておいた
 *   base-mod.jar（＝この JSON を読んで動く万能MOD）に、作った内容を JSON として
 *   ねじ込む。.jar の実体は ZIP なので、JSZip で中身を差し替えられる。
 *   これで **サーバー不要・待ち時間ゼロ**で、mods に入れるだけの .jar が手に入る。
 *
 * ■ modId は固定
 *   modId は base-mod.jar の .class に焼かれた固定値で、注入では変えない方針
 *   （2026-08-22 の判断）。よって **MOD は常に1つ**で、その中に何個でも
 *   ブロック・アイテム・イベントを持つ形にする。
 *   ⚠️ 別の作品を遊ぶときは .jar を入れ替える。同時には入れられない。
 *      ここを変えたくなったら mods.toml と assets/ のパスを全部書き換える必要がある。
 *
 * ■ この仕様を変えるときの鉄則
 *   base-mod.jar（Java側）と、この型（TS側）は**同時に直す**こと。
 *   片方だけ変えると、MODは起動するのに何も起きない状態になり、
 *   マイクラは何も言わないので原因が分からなくなる。
 *   そのために SPEC_VERSION を持ち、エンジン側で不一致を検出して
 *   チャットに警告を出す（＝黙って壊れない）。
 */

/**
 * 設計図のバージョン。エンジン側と一致しない場合は警告を出す。
 *
 * ⚠️ **同梱の base-mod.jar と必ず一致させること。**
 *    2026-08-23、mobs 追加のつもりで 2 に上げたが、同梱エンジンは 1 のままだった。
 *    エンジンは spec を定数と比較して、不一致ならワールド参加のたびに
 *    チャットへ警告を出す。つまり**全ユーザーの .jar が毎回警告を出し、
 *    しかも mobs は無視される**状態になっていた（javap で実測して発覚）。
 *    いったん 1 に戻したあと、エンジン側の mobs 対応が入ってから 2 にした。
 *
 *    2026-08-23 時点で 2。同梱エンジンも 2 を期待している（実測で確認済み）:
 *      - DynamicRegistry に "String mobs" と "_spawn_egg" がある
 *      - ModEventHandler の spec 比較が iconst_2
 *
 *    上げるときの手順（順番を飛ばさないこと）:
 *      1) エンジン側で実装を入れて再ビルド
 *      2) public/base-mod.jar を差し替え
 *      3) javap で、増やしたキーと spec の比較値の**両方**を確認
 *      4) そのうえで、ここを上げる
 */
export const SPEC_VERSION = 2;

/** MOD の識別子。base-mod.jar の mods.toml と必ず一致させること */
// ⚠️ この値は base-mod.jar の .class に焼かれている 30文字のプレースホルダ。
//    1文字でも違うと Java 側が自分の modId を認識できず、
//    MOD は起動するのにブロックもルールも一切動かない（マイクラは何も言わない）。
//    エンジンを再ビルドして別の値にしたときは、ここも必ず同時に直すこと。
//    実測: DynamicRegistry.class 2回 / ModEventHandler.class 1回 /
//          cubicenginegenericMod.class 1回 に出現（2026-08-23）。
export const ENGINE_MOD_ID = "cubic_xxxxxxxxxxxxxxxxxxxxxxxx";

/** 値。文字列そのままか、実行時に解決する式か */
export type CEValue =
  | { kind: "text"; value: string }
  | { kind: "num"; value: number }
  /** プレイヤー名・HP・座標など、その場で取れるもの */
  | { kind: "var"; name: "playerName" | "playerHp" | "playerPos" | "score"; arg?: string }
  /** 0〜max の乱数 */
  | { kind: "rand"; max: number };

/** きっかけ。既存の ev_* に対応する */
export type CETrigger =
  | { type: "join" }
  | { type: "tick" }
  | { type: "break"; block?: string }
  | { type: "place"; block?: string }
  | { type: "useItem"; item?: string }
  | { type: "hurt" }
  | { type: "chat"; pattern: string };

/** 条件。co_* に対応。ネストできる */
export type CECondition =
  | { type: "hasTag"; tag: string }
  | { type: "hasItem"; item: string }
  | { type: "hpBelow"; value: number }
  | { type: "isSneaking" }
  | { type: "isNight" }
  | { type: "isRaining" }
  | { type: "and"; all: CECondition[] }
  | { type: "or"; any: CECondition[] }
  | { type: "not"; of: CECondition };

/** すること。ac_* に対応 */
export type CEAction =
  | { type: "message"; text: CEValue; target: "self" | "all" }
  | { type: "give"; item: string; count: number }
  | { type: "effect"; effect: string; seconds: number; amplifier: number }
  | { type: "sound"; sound: string; volume: number }
  | { type: "title"; title: string; sub: string }
  | { type: "teleport"; x: number; y: number; z: number }
  | { type: "command"; command: string }
  | { type: "tag"; tag: string; add: boolean }
  | { type: "score"; objective: string; op: "set" | "add" | "remove"; value: number }
  | { type: "kick"; reason: string };

/** ルール1つ。「〜したとき、（条件を満たせば）〜する」 */
export interface CERule {
  trigger: CETrigger;
  /** 空なら無条件 */
  conditions: CECondition[];
  actions: CEAction[];
}

/** 追加するブロック。テクスチャは PNG を同梱し、ここでは名前だけ持つ */
export interface CEBlock {
  /** 英数字と _ のみ。cubicengine:<id> になる */
  id: string;
  /** ゲーム内表示名。日本語可 */
  displayName: string;
  /** 壊れにくさ。バニラの石が 1.5 */
  hardness: number;
  /** 発光 0〜15。⚠️ マイクラの上限。16以上は受け付けない */
  lightLevel: number;
}

/** 追加するアイテム */
export interface CEItem {
  id: string;
  displayName: string;
  /** 何個まで重ねられるか。⚠️ 1〜64。65以上はマイクラが受け付けない */
  maxStack: number;
}

/**
 * 追加するモブ。
 *
 * ⚠️ 統合版と違い、**3Dモデルは持てない**。
 *    Bedrock は geometry の JSON をそのまま読むが、Forge のエンティティモデルは
 *    Java のコードで書くもので、JSONから動的に作れない。
 *    そこで Java版では「バニラのモブを土台にして、強さと見た目の色を変える」形にする。
 *    作った形をそのまま出したい人は統合版を使ってもらう。
 */
export interface CEMob {
  /** 英数字と _ のみ */
  id: string;
  displayName: string;
  /**
   * 土台にするバニラのモブ。"minecraft:zombie" など。
   * ⚠️ ここに存在しない ID を書くと、エンティティごと登録に失敗する。
   */
  base: string;
  /** 体力。バニラのゾンビが 20 */
  health: number;
  /** 攻撃力。ハート半分＝1 */
  attackDamage: number;
  /** 移動速度。バニラのゾンビが 0.23 */
  movementSpeed: number;
  /** 倒したときに落とすもの。空なら何も落とさない */
  drops: { item: string; min: number; max: number }[];
}

/** 設計図ぜんぶ。これが cubic_data.json になる */
export interface CubicData {
  spec: typeof SPEC_VERSION;
  /** 作品名。MOD一覧の表示に使う */
  projectName: string;
  blocks: CEBlock[];
  items: CEItem[];
  /**
   * モブ。spec 2 から。
   * ⚠️ エンジンが spec 1 のままだと、この配列は黙って無視される。
   *    エンジン側で spec の不一致を検出して警告を出してもらうこと。
   */
  mobs: CEMob[];
  rules: CERule[];
}

/** 空の設計図。エンジンは中身が空でも落ちてはいけない */
export function emptyData(projectName: string): CubicData {
  return { spec: SPEC_VERSION, projectName, blocks: [], items: [], mobs: [], rules: [] };
}
