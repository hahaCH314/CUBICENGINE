/**
 * IR を three.js のオブジェクトに変換する（プレビュー用）。
 *
 * ここも UI を import しない。React とは無関係に「IR を渡すと Group が返る」だけ。
 * 出力(toBedrock)と表示(ここ)を同じ IR から作るので、**見えているものと
 * 書き出されるものがズレない**。片方だけ直して食い違う事故を防ぐのが狙い。
 */

import * as THREE from "three";
import type { IRCube, MobIR } from "./ir";

/**
 * three の BoxGeometry の面の並び順。
 * Bedrock の面名と対応させるために要る。
 *   0:+X  1:-X  2:+Y  3:-Y  4:+Z  5:-Z
 * Bedrock は north=-Z / south=+Z / east=+X / west=-X / up=+Y / down=-Y。
 */
const FACE_ORDER = ["east", "west", "up", "down", "south", "north"] as const;

/**
 * 立方体1つぶんの UV を BoxGeometry に焼く。
 *
 * ⚠️ three の UV は **左下が原点**、Minecraft のテクスチャは **左上が原点**。
 *    V を反転しないと、模様が上下逆に貼られる。
 * ⚠️ UV が無い面（Blockbench 上で消した面）は潰しておく。放置すると
 *    テクスチャの左上隅が引き伸ばされて貼られ、意図しない色の面になる。
 */
function applyUv(geo: THREE.BoxGeometry, cube: IRCube, texW: number, texH: number): void {
  const uvAttr = geo.getAttribute("uv") as THREE.BufferAttribute;

  FACE_ORDER.forEach((face, faceIndex) => {
    const rect = cube.uv[face];
    const base = faceIndex * 4; // 1面につき頂点4つ

    if (!rect) {
      for (let i = 0; i < 4; i++) uvAttr.setXY(base + i, 0, 0);
      return;
    }

    const [u, v, w, h] = rect;
    const x0 = u / texW;
    const x1 = (u + w) / texW;
    // 上下反転。Minecraft の v は上からの距離なので 1 から引く
    const y0 = 1 - v / texH;
    const y1 = 1 - (v + h) / texH;

    // BoxGeometry の頂点順は 左上・右上・左下・右下
    uvAttr.setXY(base + 0, x0, y0);
    uvAttr.setXY(base + 1, x1, y0);
    uvAttr.setXY(base + 2, x0, y1);
    uvAttr.setXY(base + 3, x1, y1);
  });

  uvAttr.needsUpdate = true;
}

function buildCube(cube: IRCube, material: THREE.Material, texW: number, texH: number): THREE.Object3D {
  // inflate は全方向に膨らませる。0 の辺があると three が警告を出すので下限を入れる
  const inf = cube.inflate ?? 0;
  const size: [number, number, number] = [
    Math.max(0.001, cube.size[0] + inf * 2),
    Math.max(0.001, cube.size[1] + inf * 2),
    Math.max(0.001, cube.size[2] + inf * 2),
  ];

  const geo = new THREE.BoxGeometry(size[0], size[1], size[2]);
  applyUv(geo, cube, texW, texH);
  const mesh = new THREE.Mesh(geo, material);

  // BoxGeometry は中心が原点。IR の origin は隅なので、中心へずらす
  const center: [number, number, number] = [
    cube.origin[0] + cube.size[0] / 2,
    cube.origin[1] + cube.size[1] / 2,
    cube.origin[2] + cube.size[2] / 2,
  ];

  if (!cube.rotation) {
    mesh.position.set(center[0], center[1], center[2]);
    return mesh;
  }

  // 回転がある場合は pivot を中心にして回す。
  // pivot を無視して原点まわりで回すと Blockbench の見た目とズレる（出力側と同じ配慮）
  const pivot = cube.pivot ?? center;
  const holder = new THREE.Group();
  holder.position.set(pivot[0], pivot[1], pivot[2]);
  holder.rotation.set(
    THREE.MathUtils.degToRad(cube.rotation[0]),
    THREE.MathUtils.degToRad(cube.rotation[1]),
    THREE.MathUtils.degToRad(cube.rotation[2]),
  );
  mesh.position.set(center[0] - pivot[0], center[1] - pivot[1], center[2] - pivot[2]);
  holder.add(mesh);
  return holder;
}

/**
 * IR からプレビュー用の Group を作る。
 * texture は data URL。読み込みは非同期なので、貼れたら onTextureReady で知らせる。
 */
export function buildPreviewGroup(
  ir: MobIR,
  onTextureReady?: () => void,
): { group: THREE.Group; dispose: () => void } {
  const disposables: { dispose(): void }[] = [];

  let material: THREE.Material;
  const tex = ir.textures[0];
  if (tex) {
    const texture = new THREE.TextureLoader().load(tex.dataUrl, () => onTextureReady?.());
    // ドット絵なので拡大時にぼかさない
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    disposables.push(texture);
    // alphaTest で透明部分を抜く。Bedrock の entity_alphatest に合わせてある
    material = new THREE.MeshLambertMaterial({ map: texture, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
  } else {
    // テクスチャが取り込めなかったとき。真っ白だと形が読み取れないので薄い灰色にする
    material = new THREE.MeshLambertMaterial({ color: 0xb0b0b0 });
  }
  disposables.push(material);

  const group = new THREE.Group();
  const boneGroups = new Map<string, THREE.Group>();

  // 先に全ボーンの入れ物を作る。親が後ろに定義されていても繋げられるようにするため
  for (const bone of ir.geometry.bones) {
    const g = new THREE.Group();
    g.name = bone.name;
    boneGroups.set(bone.name, g);
  }

  for (const bone of ir.geometry.bones) {
    const g = boneGroups.get(bone.name)!;
    for (const cube of bone.cubes) {
      const obj = buildCube(cube, material, ir.geometry.textureWidth, ir.geometry.textureHeight);
      obj.traverse(o => {
        if (o instanceof THREE.Mesh) disposables.push(o.geometry);
      });
      g.add(obj);
    }
    // ボーン自体の回転。pivot を中心に回す
    if (bone.rotation) {
      g.position.set(bone.pivot[0], bone.pivot[1], bone.pivot[2]);
      g.rotation.set(
        THREE.MathUtils.degToRad(bone.rotation[0]),
        THREE.MathUtils.degToRad(bone.rotation[1]),
        THREE.MathUtils.degToRad(bone.rotation[2]),
      );
      for (const child of g.children) {
        child.position.sub(new THREE.Vector3(bone.pivot[0], bone.pivot[1], bone.pivot[2]));
      }
    }
    const parent = bone.parent ? boneGroups.get(bone.parent) : undefined;
    (parent ?? group).add(g);
  }

  return {
    group,
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}

/** モデル全体が画面に収まるカメラ距離を出す。大小どちらのモデルでも同じ見え方にするため */
export function fitDistance(ir: MobIR): { center: THREE.Vector3; distance: number } {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const bone of ir.geometry.bones) {
    for (const c of bone.cubes) {
      minX = Math.min(minX, c.origin[0]); maxX = Math.max(maxX, c.origin[0] + c.size[0]);
      minY = Math.min(minY, c.origin[1]); maxY = Math.max(maxY, c.origin[1] + c.size[1]);
      minZ = Math.min(minZ, c.origin[2]); maxZ = Math.max(maxZ, c.origin[2] + c.size[2]);
    }
  }
  if (!Number.isFinite(minX)) return { center: new THREE.Vector3(0, 0, 0), distance: 40 };
  const center = new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
  const span = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
  return { center, distance: Math.max(span * 2.2, 24) };
}
