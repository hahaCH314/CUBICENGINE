/**
 * モデルタブのボクセル（色の付いた立方体の集まり）を、モブの IR に変換する。
 *
 * これで Blockbench を持っていない人でもモブが作れる。積み木で形を作って、
 * そのままデベロッパータブへ渡せる。
 *
 * ボクセルと bbmodel の一番の違い:
 *   ボクセルは**面ごとに色**を持ち、テクスチャ画像を持たない。
 *   モブは1枚のテクスチャに UV で貼る作りなので、**色からテクスチャを合成する**必要がある。
 *   ここでは「1色 = 1マス」のパレット画像を作り、各面をその1マスに向ける。
 *   ドット絵として拡大されるので、1マスでも面全体が単色で塗られる。
 *
 * 座標系の違いにも注意:
 *   モデルタブは1ブロック=1.0 の世界、Bedrock のモデルは 1ブロック=16単位。
 *   16倍しないと極小のモブになる。
 *
 * ここも UI を import しない。
 */

import {
  IR_SCHEMA_VERSION,
  defaultBehavior,
  toIdentifier,
  type FaceName,
  type IRBone,
  type IRAnimation,
  type IRCube,
  type MobIR,
  type UvRect,
  type Vec3,
} from "./ir";

/** 1ブロック = 16単位。Bedrock のモデル座標に合わせる */
const UNITS_PER_BLOCK = 16;

/**
 * 選べる動きのパターン。
 *
 * ボクセルは1本のボーン(root)に全部の立方体が入っているので、
 * **体ぜんぶが同じ動きをする**。腕だけ振るような分割はできない。
 * その制約の中で「見て分かる」動きに絞ってある。
 *
 * ⚠️ 時刻のキーは toBedrock 側で t.toFixed(1) される。
 *    整数に見えるキー("0")はJSONオブジェクト内で先に並び替えられてしまうため。
 */
export type MobMotion = "none" | "float" | "spin" | "bounce" | "wobble";

export const MOB_MOTIONS: { id: MobMotion; label: string; hint: string }[] = [
  { id: "none",   label: "動かない",     hint: "その場に立っているだけ" },
  { id: "float",  label: "ふわふわ浮く", hint: "上下にゆっくり揺れます" },
  { id: "spin",   label: "くるくる回る", hint: "その場で回転し続けます" },
  { id: "bounce", label: "ぴょんぴょん", hint: "跳ねるように上下します" },
  { id: "wobble", label: "ゆらゆら",     hint: "左右に傾いて揺れます" },
];

/** パターン名 → 実際のキーフレーム。root ボーン1本ぶん */
function buildMotion(kind: MobMotion): IRAnimation[] {
  if (kind === "none") return [];

  // ループする動きは「始点と終点を同じ値」にしないと、
  // 一周したときにガクッと戻る
  const anim = (
    name: string,
    length: number,
    channel: "position" | "rotation",
    frames: [number, Vec3][],
  ): IRAnimation => ({
    name,
    length,
    loop: true,
    bones: [{ bone: "root", [channel]: frames.map(([time, value]) => ({ time, value })) }],
  });

  switch (kind) {
    case "float":
      // 上下2単位ぶん。ゆっくりめの3秒周期
      return [anim("float", 3, "position", [
        [0, [0, 0, 0]], [1.5, [0, 2, 0]], [3, [0, 0, 0]],
      ])];
    case "spin":
      // Y軸まわりに1周。360度を一度に書くと補間が効かないので半周ずつ
      return [anim("spin", 2, "rotation", [
        [0, [0, 0, 0]], [1, [0, 180, 0]], [2, [0, 360, 0]],
      ])];
    case "bounce":
      // 跳ねる。上がる時間より落ちる時間を短くすると跳ねて見える
      return [anim("bounce", 1, "position", [
        [0, [0, 0, 0]], [0.6, [0, 5, 0]], [1, [0, 0, 0]],
      ])];
    case "wobble":
      // Z軸まわりに左右へ傾ける
      return [anim("wobble", 2, "rotation", [
        [0, [0, 0, -8]], [1, [0, 0, 8]], [2, [0, 0, -8]],
      ])];
    default:
      return [];
  }
}

/** パレット1マスの大きさ（px）。小さすぎると隣の色がにじむ */
const CELL = 4;

/** 変換元。store の VoxelBlock / VoxelItem のうち、ここで要る部分だけ */
export interface VoxelSource {
  name: string;
  position: [number, number, number];
  scale: [number, number, number];
  rotation: [number, number, number];
  faces: {
    top: { color: string };
    bottom: { color: string };
    front: { color: string };
    back: { color: string };
    left: { color: string };
    right: { color: string };
  };
}

/**
 * ボクセルの面名 → Bedrock の面名。
 * front を north にしている。モデルタブで「手前」に見えている面が、
 * ゲーム内でモブの正面になるほうが直感に合う。
 */
const FACE_MAP: Record<keyof VoxelSource["faces"], FaceName> = {
  top: "up",
  bottom: "down",
  front: "north",
  back: "south",
  left: "west",
  right: "east",
};

/** #rgb / #rrggbb を [r,g,b] に。読めなければ灰色 */
function parseHex(hex: string): [number, number, number] {
  const s = hex.replace("#", "").trim();
  const full = s.length === 3 ? s.split("").map(c => c + c).join("") : s;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return [176, 176, 176];
  const n = parseInt(full, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/**
 * 色の一覧から、1色1マスのパレットPNGを作る。
 *
 * canvas を使う。**ブラウザ限定**なので、呼び出し側（UI）から使うこと。
 * Worker からは OffscreenCanvas が要るが、今は使う場面がない。
 */
function buildPaletteTexture(colors: string[], size: number): string {
  const cols = Math.ceil(Math.sqrt(colors.length)) || 1;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  // 余白は透明のまま。塗ってしまうと、面を消したつもりの箇所に色が出る
  colors.forEach((c, i) => {
    const [r, g, b] = parseHex(c);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect((i % cols) * CELL, Math.floor(i / cols) * CELL, CELL, CELL);
  });
  return canvas.toDataURL("image/png");
}

/**
 * ボクセル群を MobIR に変換する。
 *
 * @param voxels モデルタブの blocks（または items）
 * @param displayName モブの名前。識別子はここから作る
 */
export function voxelsToMobIR(
  voxels: readonly VoxelSource[],
  displayName: string,
  motion: MobMotion = "none",
): MobIR | null {
  if (voxels.length === 0) return null;

  // 使われている色を集めて、色 → パレット上の位置 を決める。
  // 同じ色は1マスにまとめる（面ごとに1マス作ると無駄に大きくなる）
  const colorIndex = new Map<string, number>();
  for (const v of voxels) {
    for (const f of Object.values(v.faces)) {
      if (!colorIndex.has(f.color)) colorIndex.set(f.color, colorIndex.size);
    }
  }

  const cols = Math.ceil(Math.sqrt(colorIndex.size)) || 1;
  const rows = Math.ceil(colorIndex.size / cols);
  // 2の冪にしておく。マイクラは非2冪でも動くが、端末によっては表示が乱れる
  const texSize = Math.max(16, 2 ** Math.ceil(Math.log2(Math.max(cols, rows) * CELL)));

  /** 色 → その色のマスを指す UV。1マスまるごとを指す */
  const uvOf = (color: string): UvRect => {
    const i = colorIndex.get(color) ?? 0;
    return [(i % cols) * CELL, Math.floor(i / cols) * CELL, CELL, CELL];
  };

  const cubes: IRCube[] = voxels.map(v => {
    // モデルタブの position は立方体の**中心**。IR の origin は角なので寄せる
    const size: Vec3 = [
      v.scale[0] * UNITS_PER_BLOCK,
      v.scale[1] * UNITS_PER_BLOCK,
      v.scale[2] * UNITS_PER_BLOCK,
    ];
    const center: Vec3 = [
      v.position[0] * UNITS_PER_BLOCK,
      v.position[1] * UNITS_PER_BLOCK,
      v.position[2] * UNITS_PER_BLOCK,
    ];
    const origin: Vec3 = [center[0] - size[0] / 2, center[1] - size[1] / 2, center[2] - size[2] / 2];

    const uv: IRCube["uv"] = {};
    for (const [voxelFace, bedrockFace] of Object.entries(FACE_MAP)) {
      const color = v.faces[voxelFace as keyof VoxelSource["faces"]].color;
      uv[bedrockFace] = uvOf(color);
    }

    const cube: IRCube = { origin, size, uv };
    const [rx, ry, rz] = v.rotation;
    if (rx !== 0 || ry !== 0 || rz !== 0) {
      cube.rotation = [rx, ry, rz];
      // 回転の中心は立方体の中心。原点まわりで回すと積んだ位置からズレる
      cube.pivot = center;
    }
    return cube;
  });

  const bone: IRBone = { name: "root", pivot: [0, 0, 0], cubes };
  const id = toIdentifier(displayName, "voxel_mob");

  return {
    schema: IR_SCHEMA_VERSION,
    source: "manual",
    id,
    displayName,
    geometry: {
      identifier: `geometry.${id}`,
      textureWidth: texSize,
      textureHeight: texSize,
      bones: [bone],
    },
    textures: [
      {
        name: `${id}_palette`,
        width: texSize,
        height: texSize,
        dataUrl: buildPaletteTexture([...colorIndex.keys()], texSize),
      },
    ],
    animations: buildMotion(motion),
    behavior: defaultBehavior(),
  };
}

/** 変換前に見せる情報。UI に「何個の立方体が何色で入るか」を出すため */
export function describeVoxels(voxels: readonly VoxelSource[]): { cubes: number; colors: number } {
  const colors = new Set<string>();
  for (const v of voxels) for (const f of Object.values(v.faces)) colors.add(f.color);
  return { cubes: voxels.length, colors: colors.size };
}
