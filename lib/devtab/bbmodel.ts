/**
 * Blockbench の .bbmodel を IR に変換する。
 *
 * このファイルは **UI も Worker API も import しない**。
 * 引数に文字列を受け取り、値を返すだけ。だからテストが書けるし、
 * メインスレッドからも Worker からも同じものを呼べる。
 *
 * .bbmodel の構造（必要な部分だけ）:
 *   {
 *     "name": "...",
 *     "resolution": { "width": 64, "height": 64 },   // UV の座標系
 *     "elements": [                                   // 立方体の実体
 *       { "uuid", "name", "from":[x,y,z], "to":[x,y,z], "origin":[x,y,z],
 *         "rotation":[x,y,z], "inflate":0,
 *         "faces": { "north": { "uv":[x1,y1,x2,y2] }, ... } }
 *     ],
 *     "outliner": [                                   // 階層。文字列は element の uuid
 *       { "uuid", "name", "origin", "rotation", "children": [ "uuid" | {...} ] }
 *     ],
 *     "textures": [ { "name", "source": "data:image/png;base64,...", "uuid" } ]
 *   }
 *
 * 注意している点:
 *   - faces の uv は **[x1, y1, x2, y2]（左上と右下）** で来る。
 *     IR / Bedrock は [u, v, 幅, 高さ] なので変換が要る。ここを取り違えると
 *     テクスチャがずれた状態で出力され、原因が分かりにくい。
 *   - outliner に属さない element がある。捨てるとモデルの一部が消えるので、
 *     ルート直下のボーンにまとめて拾う。
 */

import {
  IR_SCHEMA_VERSION,
  defaultBehavior,
  irFail,
  irOk,
  toIdentifier,
  type FaceName,
  type IRAnimation,
  type IRBone,
  type IRBoneAnimation,
  type IRCube,
  type IRKeyframe,
  type IRGeometry,
  type IRResult,
  type IRTexture,
  type MobIR,
  type UvRect,
  type Vec3,
} from "./ir";

/** bbmodel の face 名は Bedrock と同じ語彙。想定外の面は無視する */
const FACE_NAMES: FaceName[] = ["north", "south", "east", "west", "up", "down"];

type Unknown = Record<string, unknown>;

function isObj(v: unknown): v is Unknown {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** 数値3つの配列を Vec3 に。壊れていたら fallback を返す（throw しない） */
function vec3(v: unknown, fallback: Vec3 = [0, 0, 0]): Vec3 {
  if (!Array.isArray(v) || v.length < 3) return fallback;
  const out = v.slice(0, 3).map(n => (typeof n === "number" && Number.isFinite(n) ? n : 0));
  return [out[0], out[1], out[2]];
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function str(v: unknown, fallback: string): string {
  return typeof v === "string" && v.length > 0 ? v : fallback;
}

/**
 * bbmodel の [x1, y1, x2, y2] を IR の [u, v, 幅, 高さ] に直す。
 * 座標が逆転している（右下→左上の順で入っている）ことがあるので絶対値を取る。
 */
function toUvRect(v: unknown): UvRect | null {
  if (!Array.isArray(v) || v.length < 4) return null;
  const [x1, y1, x2, y2] = v.map(n => (typeof n === "number" && Number.isFinite(n) ? n : 0));
  return [Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1)];
}

function parseElement(el: Unknown, warnings: string[]): IRCube | null {
  const from = vec3(el.from);
  const to = vec3(el.to);
  const size: Vec3 = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];

  // 厚みゼロの面（平面）は Bedrock では表示されない。捨てずに警告だけ出す。
  // Blockbench 上では見えているので、黙って消すと「勝手に変わった」と見える。
  if (size[0] === 0 && size[1] === 0 && size[2] === 0) {
    warnings.push(`「${str(el.name, "無名")}」は大きさが 0 のため出力されません`);
    return null;
  }

  const uv: IRCube["uv"] = {};
  if (isObj(el.faces)) {
    for (const f of FACE_NAMES) {
      const face = (el.faces as Unknown)[f];
      if (!isObj(face)) continue;
      // texture が null の面は Blockbench 上で削除された面。出力に含めない
      if (face.texture === null) continue;
      const rect = toUvRect(face.uv);
      if (rect) uv[f] = rect;
    }
  }

  const cube: IRCube = { origin: from, size, uv };

  const origin = vec3(el.origin, [NaN, NaN, NaN]);
  if (Number.isFinite(origin[0])) cube.pivot = origin;

  const rot = vec3(el.rotation, [0, 0, 0]);
  if (rot[0] !== 0 || rot[1] !== 0 || rot[2] !== 0) cube.rotation = rot;

  const inflate = num(el.inflate, 0);
  if (inflate !== 0) cube.inflate = inflate;

  return cube;
}

/**
 * outliner を再帰的に辿ってボーンを組み立てる。
 * children の中身は「element の uuid（文字列）」か「入れ子のグループ（オブジェクト）」。
 */
function walkOutliner(
  nodes: unknown[],
  parentName: string | undefined,
  elements: Map<string, Unknown>,
  used: Set<string>,
  bones: IRBone[],
  warnings: string[],
): void {
  for (const node of nodes) {
    // 文字列 = element への参照。親グループのボーンに属する立方体
    if (typeof node === "string") continue;
    if (!isObj(node)) continue;

    const name = str(node.name, `bone_${bones.length}`);
    const bone: IRBone = {
      name,
      parent: parentName,
      pivot: vec3(node.origin),
      cubes: [],
    };
    const rot = vec3(node.rotation, [0, 0, 0]);
    if (rot[0] !== 0 || rot[1] !== 0 || rot[2] !== 0) bone.rotation = rot;

    const children = Array.isArray(node.children) ? node.children : [];
    for (const c of children) {
      if (typeof c !== "string") continue;
      const el = elements.get(c);
      if (!el) {
        warnings.push(`階層が参照している立方体 ${c} が見つかりません`);
        continue;
      }
      used.add(c);
      const cube = parseElement(el, warnings);
      if (cube) bone.cubes.push(cube);
    }

    bones.push(bone);
    // 入れ子のグループを先に積んでから潜る。親が bones に居る状態を保つ
    walkOutliner(children, name, elements, used, bones, warnings);
  }
}

/**
 * bbmodel の animations を IR に変換する。
 *
 * bbmodel 側の形:
 *   "animations": [
 *     { "name": "walk", "loop": "loop"|"once"|"hold", "length": 1.0,
 *       "animators": {
 *         "<uuid>": { "name": "head", "type": "bone",
 *           "keyframes": [ { "channel": "rotation", "time": 0,
 *                            "data_points": [ { "x": 0, "y": 0, "z": 0 } ] } ] } } }
 *   ]
 *
 * 注意:
 *   - data_points の x/y/z は **文字列で入ることがある**（Blockbench が数式を許すため）。
 *     数値化できないものは 0 にする。ここで NaN を通すと出力JSONが壊れて
 *     マイクラ側が無言で読み込みを諦める
 *   - animator は bone 以外（effect など）も入る。type を見て弾く
 */
function parseAnimations(raw: unknown, warnings: string[]): IRAnimation[] {
  if (!Array.isArray(raw)) return [];
  const out: IRAnimation[] = [];

  const usedNames = new Set<string>();

  for (const a of raw) {
    if (!isObj(a)) continue;
    const rawName = str(a.name, `anim_${out.length}`);
    // 日本語だけの名前は識別子に使える文字が残らず、toIdentifier の
    // フォールバック名に潰れる。複数あると全部同じ名前になって上書きし合うので、
    // 重複したら連番を足して必ず一意にする
    let name = toIdentifier(rawName, `anim_${out.length + 1}`);
    if (usedNames.has(name)) {
      let n = 2;
      while (usedNames.has(`${name}_${n}`)) n++;
      name = `${name}_${n}`;
    }
    if (name !== rawName.toLowerCase()) {
      warnings.push(`アニメーション「${rawName}」はマイクラ内部では「${name}」になります`);
    }
    usedNames.add(name);
    const length = num(a.length, 0);
    // Blockbench の loop は文字列。"loop" 以外（once / hold）は繰り返さない
    const loop = a.loop === "loop" || a.loop === true;

    const bones: IRBoneAnimation[] = [];
    const animators = isObj(a.animators) ? a.animators : {};
    for (const anim of Object.values(animators)) {
      if (!isObj(anim)) continue;
      if (anim.type !== undefined && anim.type !== "bone") continue;
      const boneName = str(anim.name, "");
      if (!boneName) continue;

      const channels: Record<string, IRKeyframe[]> = {};
      const kfs = Array.isArray(anim.keyframes) ? anim.keyframes : [];
      for (const kf of kfs) {
        if (!isObj(kf)) continue;
        const ch = str(kf.channel, "");
        if (ch !== "rotation" && ch !== "position" && ch !== "scale") continue;
        const dp = Array.isArray(kf.data_points) ? kf.data_points[0] : undefined;
        if (!isObj(dp)) continue;
        // 数式が入りうるので Number() で通し、駄目なら 0
        const v = (k: string): number => {
          const n = Number(dp[k]);
          return Number.isFinite(n) ? n : 0;
        };
        (channels[ch] ??= []).push({ time: num(kf.time, 0), value: [v("x"), v("y"), v("z")] });
      }

      // 時刻順に並べる。順不同で来ることがあり、そのままだと動きが飛ぶ
      for (const list of Object.values(channels)) list.sort((p, q) => p.time - q.time);

      if (Object.keys(channels).length === 0) continue;
      bones.push({
        bone: boneName,
        ...(channels.rotation ? { rotation: channels.rotation } : {}),
        ...(channels.position ? { position: channels.position } : {}),
        ...(channels.scale ? { scale: channels.scale } : {}),
      });
    }

    if (bones.length === 0) {
      warnings.push(`アニメーション「${str(a.name, name)}」は中身が空なので取り込みませんでした`);
      continue;
    }
    if (length <= 0) {
      warnings.push(`アニメーション「${str(a.name, name)}」は長さが 0 です`);
    }
    out.push({ name, length, loop, bones });
  }

  return out;
}

function parseTextures(raw: unknown, warnings: string[]): IRTexture[] {
  if (!Array.isArray(raw)) return [];
  const out: IRTexture[] = [];
  raw.forEach((t, i) => {
    if (!isObj(t)) return;
    const source = t.source;
    if (typeof source !== "string" || !source.startsWith("data:image/")) {
      // Blockbench でファイル参照のまま保存すると source がパスになる。
      // その場合こちらからは画像を読めないので、拾えなかったことを伝える
      warnings.push(
        `テクスチャ「${str(t.name, String(i))}」は画像が埋め込まれていません（Blockbench で「テクスチャを埋め込む」を有効にして保存してください）`,
      );
      return;
    }
    out.push({
      name: str(t.name, `texture_${i}`),
      width: num(t.width, 0),
      height: num(t.height, 0),
      dataUrl: source,
    });
  });
  return out;
}

/**
 * .bbmodel の中身（JSON文字列）を IR に変換する。
 * 失敗しても throw せず、IRResult に理由を詰めて返す。
 */
export function parseBbmodel(text: string, fallbackName = "custom_mob"): IRResult<MobIR> {
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    return irFail(["ファイルを JSON として読めませんでした。.bbmodel ファイルか確認してください"]);
  }
  if (!isObj(root)) return irFail(["ファイルの中身が想定と違います"]);

  const warnings: string[] = [];

  const elements = new Map<string, Unknown>();
  if (Array.isArray(root.elements)) {
    for (const el of root.elements) {
      if (isObj(el) && typeof el.uuid === "string") elements.set(el.uuid, el);
    }
  }
  if (elements.size === 0) {
    return irFail(["立方体が1つも入っていません。空のモデルは取り込めません"], warnings);
  }

  const bones: IRBone[] = [];
  const used = new Set<string>();
  if (Array.isArray(root.outliner)) {
    walkOutliner(root.outliner, undefined, elements, used, bones, warnings);
  }

  // どのグループにも属していない立方体を拾う。捨てるとモデルの一部が黙って消える
  const orphans: IRCube[] = [];
  for (const [uuid, el] of elements) {
    if (used.has(uuid)) continue;
    const cube = parseElement(el, warnings);
    if (cube) orphans.push(cube);
  }
  if (orphans.length > 0) {
    bones.unshift({ name: "root", pivot: [0, 0, 0], cubes: orphans });
    if (bones.length > 1) {
      warnings.push(`グループに属さない立方体 ${orphans.length} 個を root にまとめました`);
    }
  }

  if (bones.length === 0) {
    return irFail(["取り込める立方体がありませんでした"], warnings);
  }

  const resolution = isObj(root.resolution) ? root.resolution : {};
  const displayName = str(root.name, fallbackName);
  const id = toIdentifier(displayName);
  // 日本語だけの名前は識別子に使える文字が1つも残らず custom_mob に落ちる。
  // 表示名は日本語のままでいいが、識別子が勝手に変わったことは伝える。
  // 黙って変えると、出力を見たときに「知らない名前になっている」と混乱する
  if (id !== displayName.toLowerCase()) {
    warnings.push(`マイクラ内部の名前は「${id}」になります（表示名は「${displayName}」のままです）`);
  }

  const geometry: IRGeometry = {
    identifier: `geometry.${id}`,
    textureWidth: num(resolution.width, 16),
    textureHeight: num(resolution.height, 16),
    bones,
  };

  const animations = parseAnimations(root.animations, warnings);

  const textures = parseTextures(root.textures, warnings);
  if (textures.length === 0) {
    warnings.push("テクスチャが取り込めませんでした。真っ白なモブになります");
  }

  return irOk<MobIR>(
    {
      schema: IR_SCHEMA_VERSION,
      source: "bbmodel",
      id,
      displayName,
      geometry,
      textures,
      animations,
      behavior: defaultBehavior(),
    },
    warnings,
  );
}

/** 取り込んだモデルの規模。UI に出して「重すぎないか」を判断させる */
export function describeIR(ir: MobIR): { bones: number; cubes: number; textures: number } {
  return {
    bones: ir.geometry.bones.length,
    cubes: ir.geometry.bones.reduce((n, b) => n + b.cubes.length, 0),
    textures: ir.textures.length,
  };
}
