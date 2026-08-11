/**
 * IR → 統合版（Bedrock）のアドオンファイル一式。
 *
 * ここも UI を import しない。**ファイルの中身を組み立てて返すだけ**で、
 * ZIP に詰めるのは呼び出し側（exporter.ts）の仕事。そうしておくと
 * 出力が正しいかをテストで確かめられる。
 *
 * 教育版対応（Phase 4）はこの関数に分岐を足す形になる。IR を挟んでいるので、
 * 入力側（bbmodel）には一切触らずに済む。
 */

import type { IRBone, IRCube, MobIR } from "./ir";

/** 既存のブロック出力と同じ名前空間に揃える */
export const NAMESPACE = "cubicengine";

/** 出力する1ファイル。バイナリは data URL のまま返し、変換は呼び出し側に任せる */
export interface OutFile {
  path: string;
  /** テキストならこちら */
  text?: string;
  /** 画像などバイナリならこちら（data:image/png;base64,...） */
  dataUrl?: string;
}

export interface BedrockOutput {
  bp: OutFile[];
  rp: OutFile[];
  /** RP の texts/en_US.lang に足す行。既存の行と混ぜる必要があるので分けて返す */
  langLines: string[];
}

/** IR の [u, v, 幅, 高さ] を Bedrock の { uv: [u,v], uv_size: [w,h] } に直す */
function toBedrockUv(cube: IRCube): Record<string, { uv: [number, number]; uv_size: [number, number] }> {
  const out: Record<string, { uv: [number, number]; uv_size: [number, number] }> = {};
  for (const [face, rect] of Object.entries(cube.uv)) {
    if (!rect) continue;
    out[face] = { uv: [rect[0], rect[1]], uv_size: [rect[2], rect[3]] };
  }
  return out;
}

function toBedrockCube(cube: IRCube) {
  // pivot が無い立方体に rotation だけ付いていると、Bedrock は原点まわりで回してしまう。
  // Blockbench の見た目と変わるので、中心を補って渡す
  const pivot =
    cube.pivot ??
    (cube.rotation
      ? ([cube.origin[0] + cube.size[0] / 2, cube.origin[1] + cube.size[1] / 2, cube.origin[2] + cube.size[2] / 2] as [
          number,
          number,
          number,
        ])
      : undefined);

  return {
    origin: cube.origin,
    size: cube.size,
    uv: toBedrockUv(cube),
    ...(pivot ? { pivot } : {}),
    ...(cube.rotation ? { rotation: cube.rotation } : {}),
    ...(cube.inflate ? { inflate: cube.inflate } : {}),
  };
}

function toBedrockBone(bone: IRBone) {
  return {
    name: bone.name,
    ...(bone.parent ? { parent: bone.parent } : {}),
    pivot: bone.pivot,
    ...(bone.rotation ? { rotation: bone.rotation } : {}),
    cubes: bone.cubes.map(toBedrockCube),
  };
}

/** モデル全体が収まる箱を測る。省略すると遠くから見たときにモブが消える */
function visibleBounds(ir: MobIR): { width: number; height: number; offset: [number, number, number] } {
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const bone of ir.geometry.bones) {
    for (const c of bone.cubes) {
      minX = Math.min(minX, c.origin[0]); maxX = Math.max(maxX, c.origin[0] + c.size[0]);
      minY = Math.min(minY, c.origin[1]); maxY = Math.max(maxY, c.origin[1] + c.size[1]);
      minZ = Math.min(minZ, c.origin[2]); maxZ = Math.max(maxZ, c.origin[2] + c.size[2]);
    }
  }
  if (!Number.isFinite(minX)) return { width: 1, height: 1, offset: [0, 0, 0] };
  // 1ブロック = 16単位。Bedrock の visible_bounds はブロック単位
  const w = Math.max(maxX - minX, maxZ - minZ) / 16;
  const h = (maxY - minY) / 16;
  return {
    width: Math.max(1, Math.ceil(w)),
    height: Math.max(1, Math.ceil(h)),
    offset: [0, Math.round(((maxY + minY) / 2 / 16) * 100) / 100, 0],
  };
}

/** 当たり判定。見た目より大きいと壁にめり込むので、実寸から出す */
function collisionBox(ir: MobIR): { width: number; height: number } {
  const b = visibleBounds(ir);
  return {
    width: Math.min(Math.max(0.2, b.width), 4),
    height: Math.min(Math.max(0.2, b.height), 4),
  };
}

function entityJson(ir: MobIR): string {
  const id = `${NAMESPACE}:${ir.id}`;
  const box = collisionBox(ir);
  const b = ir.behavior;

  const components: Record<string, unknown> = {
    // 家族名を付けておくと、後からロジック側で「この種類だけ」を狙える
    "minecraft:type_family": { family: [NAMESPACE, ir.id] },
    "minecraft:health": { value: b.health, max: b.health },
    "minecraft:movement": { value: b.movementSpeed },
    "minecraft:physics": {},
    "minecraft:jump.static": {},
    "minecraft:movement.basic": {},
    "minecraft:navigation.walk": { can_path_over_water: true, avoid_water: true },
    "minecraft:collision_box": box,
    "minecraft:nameable": {},
    // これが無いと弓や剣の当たり判定が通らず「殴れないモブ」になる
    "minecraft:damage_sensor": { triggers: [{ cause: "all", deals_damage: true }] },
    "minecraft:behavior.random_stroll": { priority: 6, speed_multiplier: 1 },
    "minecraft:behavior.look_at_player": { priority: 7, look_distance: 8, probability: 0.02 },
    "minecraft:behavior.random_look_around": { priority: 8 },
  };

  if (b.hostile) {
    components["minecraft:attack"] = { damage: b.attackDamage };
    components["minecraft:behavior.melee_attack"] = { priority: 3, speed_multiplier: 1.2 };
    components["minecraft:behavior.nearest_attackable_target"] = {
      priority: 2,
      must_see: true,
      reselect_targets: true,
      entity_types: [{ filters: { test: "is_family", subject: "other", value: "player" }, max_dist: 16 }],
    };
  } else {
    // 中立のモブは殴られたら逃げる。何も入れないと棒立ちのまま殴られ続けて不自然になる
    components["minecraft:behavior.panic"] = { priority: 1, speed_multiplier: 1.25 };
  }

  if (b.drops.length > 0) {
    components["minecraft:loot"] = { table: `loot_tables/entities/${ir.id}.json` };
  }

  return JSON.stringify(
    {
      format_version: "1.20.0",
      "minecraft:entity": {
        description: {
          identifier: id,
          is_spawnable: true,
          is_summonable: true,
          is_experimental: false,
        },
        components,
      },
    },
    null,
    2,
  );
}

function lootTableJson(ir: MobIR): string {
  return JSON.stringify(
    {
      pools: ir.behavior.drops.map(d => ({
        rolls: 1,
        // chance は「落ちるかどうか」。1 未満なら確率プールにする
        conditions: d.chance >= 1 ? undefined : [{ condition: "random_chance", chance: d.chance }],
        entries: [
          {
            type: "item",
            name: d.item,
            weight: 1,
            functions: [{ function: "set_count", count: { min: d.min, max: d.max } }],
          },
        ],
      })),
    },
    null,
    2,
  );
}

function spawnRuleJson(ir: MobIR): string {
  const s = ir.behavior.spawn;
  return JSON.stringify(
    {
      format_version: "1.8.0",
      "minecraft:spawn_rules": {
        description: {
          identifier: `${NAMESPACE}:${ir.id}`,
          population_control: "monster",
        },
        conditions: [
          {
            "minecraft:spawns_on_surface": {},
            "minecraft:brightness_filter": {
              min: s.minLightLevel,
              max: s.maxLightLevel,
              adjust_for_weather: false,
            },
            "minecraft:weight": { default: s.weight },
            "minecraft:herd": { min_size: 1, max_size: 2 },
          },
        ],
      },
    },
    null,
    2,
  );
}

function geometryJson(ir: MobIR): string {
  const vb = visibleBounds(ir);
  return JSON.stringify(
    {
      format_version: "1.12.0",
      "minecraft:geometry": [
        {
          description: {
            identifier: ir.geometry.identifier,
            texture_width: ir.geometry.textureWidth,
            texture_height: ir.geometry.textureHeight,
            visible_bounds_width: vb.width,
            visible_bounds_height: vb.height,
            visible_bounds_offset: vb.offset,
          },
          bones: ir.geometry.bones.map(toBedrockBone),
        },
      ],
    },
    null,
    2,
  );
}

function clientEntityJson(ir: MobIR): string {
  return JSON.stringify(
    {
      format_version: "1.10.0",
      "minecraft:client_entity": {
        description: {
          identifier: `${NAMESPACE}:${ir.id}`,
          // alphatest にしておくと、テクスチャの透明部分がちゃんと抜ける
          materials: { default: "entity_alphatest" },
          textures: { default: `textures/entity/${ir.id}` },
          geometry: { default: ir.geometry.identifier },
          render_controllers: ["controller.render.default"],
        },
      },
    },
    null,
    2,
  );
}

/**
 * モブ1体を統合版のファイル群にする。
 * ZIP には詰めない。呼び出し側が BP/RP それぞれに配る。
 */
export function mobToBedrock(ir: MobIR): BedrockOutput {
  const bp: OutFile[] = [{ path: `entities/${ir.id}.json`, text: entityJson(ir) }];
  if (ir.behavior.drops.length > 0) {
    bp.push({ path: `loot_tables/entities/${ir.id}.json`, text: lootTableJson(ir) });
  }
  if (ir.behavior.spawn.enabled) {
    bp.push({ path: `spawn_rules/${ir.id}.json`, text: spawnRuleJson(ir) });
  }

  const rp: OutFile[] = [
    { path: `entity/${ir.id}.entity.json`, text: clientEntityJson(ir) },
    { path: `models/entity/${ir.id}.geo.json`, text: geometryJson(ir) },
  ];
  // テクスチャが無くても出力は通る（真っ白になる）。取り込み時に警告済みなのでここでは止めない
  if (ir.textures[0]) {
    rp.push({ path: `textures/entity/${ir.id}.png`, dataUrl: ir.textures[0].dataUrl });
  }

  // 改行が混ざると lang ファイルの行が壊れるので落とす
  const name = ir.displayName.replace(/[\r\n]/g, " ");
  return { bp, rp, langLines: [`entity.${NAMESPACE}:${ir.id}.name=${name}`] };
}

/** 複数体をまとめて。呼び出し側で1件ずつ回さなくていいように */
export function mobsToBedrock(mobs: MobIR[]): BedrockOutput {
  const out: BedrockOutput = { bp: [], rp: [], langLines: [] };
  for (const m of mobs) {
    const one = mobToBedrock(m);
    out.bp.push(...one.bp);
    out.rp.push(...one.rp);
    out.langLines.push(...one.langLines);
  }
  return out;
}

/** 出す前に確かめる。ここで止めれば、マイクラ側で無言で読み込み失敗するのを防げる */
export function validateMob(ir: MobIR): string[] {
  const problems: string[] = [];
  if (!/^[a-z0-9_]+$/.test(ir.id)) problems.push(`内部名「${ir.id}」に使えない文字が含まれています`);
  if (ir.geometry.bones.length === 0) problems.push("ボーンが1つもありません");
  if (ir.geometry.bones.every(b => b.cubes.length === 0)) problems.push("立方体が1つもありません");
  if (ir.behavior.health <= 0) problems.push("体力は1以上にしてください");
  if (ir.behavior.hostile && ir.behavior.attackDamage <= 0) {
    problems.push("敵対にする場合、攻撃力を1以上にしてください");
  }
  for (const d of ir.behavior.drops) {
    if (!/^[a-z0-9_]+:[a-z0-9_]+$/.test(d.item)) {
      problems.push(`ドロップ品「${d.item}」は minecraft:diamond のような形式で書いてください`);
    }
    if (d.min > d.max) problems.push(`ドロップ品「${d.item}」の最小が最大を超えています`);
  }
  return problems;
}
