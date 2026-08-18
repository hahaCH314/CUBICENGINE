/**
 * デベロッパータブの中間表現（IR）
 *
 * なぜ挟むのか:
 *   入力（Blockbench の .bbmodel、将来は他形式）と出力（統合版 / 教育版 / Java）を
 *   直接つなぐと、対応形式が増えるたびに 入力数 × 出力数 の変換を書くことになる。
 *   間に IR を1つ置けば 入力数 + 出力数 で済む。④の教育版対応も「IR → 出力」の
 *   分岐だけになる。
 *
 * 形の決め方:
 *   Bedrock の geometry フォーマット（bones / cubes / pivot / uv）に寄せてある。
 *   最終的な出力先がマイクラである以上、そこから遠い抽象にすると変換で情報が落ちる。
 *
 * このファイルは **UI を一切 import しない**。純粋な型と関数だけを置き、
 * Worker からもテストからも同じものを使う。
 */

export const IR_SCHEMA_VERSION = 1;

/** 座標・サイズ・回転はすべて [x, y, z]。既存の store.ts と同じタプル形式に揃えてある */
export type Vec3 = [number, number, number];

/** UV は [u, v, width, height]。面ごとに持つ */
export type UvRect = [number, number, number, number];

export type FaceName = "north" | "south" | "east" | "west" | "up" | "down";

/** 立方体1つ。Bedrock の cube に対応する */
export interface IRCube {
  /** 立方体の起点（Bedrock の origin）。bbmodel の from をそのまま入れる */
  origin: Vec3;
  /** 各辺の長さ。bbmodel の to - from */
  size: Vec3;
  /** 回転の中心。未指定なら origin + size/2 を使う側で補う */
  pivot?: Vec3;
  /** 度数。未回転なら省略 */
  rotation?: Vec3;
  /** 面ごとの UV。省略された面は描画されない（bbmodel 側で面が消されている） */
  uv: Partial<Record<FaceName, UvRect>>;
  /** 全方向に膨らませる量。当たり判定を変えずに見た目だけ太らせるのに使う */
  inflate?: number;
}

/** ボーン1本。親子関係でモデルの階層を作る */
export interface IRBone {
  name: string;
  /** 親ボーン名。ルートなら undefined */
  parent?: string;
  pivot: Vec3;
  rotation?: Vec3;
  cubes: IRCube[];
}

export interface IRTexture {
  name: string;
  width: number;
  height: number;
  /** data:image/png;base64,... の形。bbmodel は画像を中に抱えているのでそのまま持てる */
  dataUrl: string;
}

/** キーフレーム1点。時刻(秒)と、その時点の値 */
export interface IRKeyframe {
  time: number;
  value: Vec3;
}

/** ボーン1本ぶんの動き。使っていないチャンネルは持たない */
export interface IRBoneAnimation {
  /** ボーン名。geometry 側の IRBone.name と対応する */
  bone: string;
  rotation?: IRKeyframe[];
  position?: IRKeyframe[];
  scale?: IRKeyframe[];
}

export interface IRAnimation {
  /** walk / idle など。識別子に使うので英数字と _ に寄せてある */
  name: string;
  /** 秒 */
  length: number;
  /** ループするか。しないものは1回で止まる */
  loop: boolean;
  bones: IRBoneAnimation[];
}

export interface IRGeometry {
  /** geometry.foo の識別子。出力時に使う */
  identifier: string;
  /** テクスチャの論理サイズ。UV はこの座標系で書かれている */
  textureWidth: number;
  textureHeight: number;
  bones: IRBone[];
}

/** ドロップ品1件 */
export interface IRDrop {
  /** minecraft:diamond のような識別子 */
  item: string;
  min: number;
  max: number;
  /** 0〜1。1 なら必ず落とす */
  chance: number;
}

/** スポーン条件。Phase 2 で詰める。今は器だけ用意して既定値を入れておく */
export interface IRSpawn {
  enabled: boolean;
  /** overworld / nether / the_end など */
  dimension: string;
  minLightLevel: number;
  maxLightLevel: number;
  weight: number;
}

/** モブの挙動。Phase 2 の MobBuilder がここを埋める */
export interface IRBehavior {
  health: number;
  movementSpeed: number;
  /** プレイヤーを攻撃するか */
  hostile: boolean;
  attackDamage: number;
  drops: IRDrop[];
  spawn: IRSpawn;
}

/** モブ1体ぶんの完全な定義。これが変換の入口であり出口 */
export interface MobIR {
  schema: typeof IR_SCHEMA_VERSION;
  /** どこから来たか。読み込み元を後から辿れるようにしておく */
  source: "bbmodel" | "json" | "manual";
  /** 内部識別子。英数字と _ のみ。マイクラの識別子にそのまま使う */
  id: string;
  /** 画面に出す名前。日本語可 */
  displayName: string;
  geometry: IRGeometry;
  textures: IRTexture[];
  /** Blockbench で付けた動き。無ければ空配列＝棒立ちのモブになる */
  animations: IRAnimation[];
  behavior: IRBehavior;
}

/**
 * 変換結果。**例外を投げない。**
 *
 * 壊れたファイルを読ませたときに throw すると、UI 側で握り潰されて
 * 「何も起きない」になりやすい。何が駄目だったかを値として返して、
 * Diagnostics にそのまま出せるようにする。
 */
export interface IRResult<T> {
  ok: boolean;
  value?: T;
  /** 変換を中断させた致命的な問題 */
  errors: string[];
  /** 変換は通ったが、情報が落ちた・推測で埋めた箇所 */
  warnings: string[];
}

export function irOk<T>(value: T, warnings: string[] = []): IRResult<T> {
  return { ok: true, value, errors: [], warnings };
}

export function irFail<T>(errors: string[], warnings: string[] = []): IRResult<T> {
  return { ok: false, errors, warnings };
}

/** 何も設定していないモブの既定値。MobBuilder はここから編集を始める */
export function defaultBehavior(): IRBehavior {
  return {
    health: 20,
    movementSpeed: 0.25,
    hostile: false,
    attackDamage: 0,
    drops: [],
    spawn: {
      enabled: false,
      dimension: "overworld",
      minLightLevel: 0,
      maxLightLevel: 15,
      weight: 10,
    },
  };
}

/**
 * マイクラの識別子に使える形へ寄せる。
 * 日本語のモデル名をそのまま識別子にすると出力が壊れるので、ここで必ず通す。
 */
export function toIdentifier(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  // 全部落ちた場合（名前が日本語だけの場合など）は固定名にする。空の識別子は出力を壊す
  return s.length > 0 ? s : "custom_mob";
}
