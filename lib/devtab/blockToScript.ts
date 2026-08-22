/**
 * モデルタブで作ったブロックの「まわりに粒子を出す」処理を、
 * 統合版のスクリプトに変換する。
 *
 * なぜ JSON ではなくスクリプトなのか:
 *   ブロックの JSON に粒子を出すコンポーネントはあるが、書式に確証が無い。
 *   間違えるとマイクラは**そのブロックを黙って読み込まなくなる**（エラーも出ない）。
 *   アイテムで同じ事故を起こしているので、確実に動くスクリプト側でやる。
 *
 * 出したコードは exporter が scripts/main.js に混ぜる。
 */

/** ブロックのうち、ここで要る部分だけ */
export interface ParticleBlockSource {
  /** マイクラの識別子に使う名前（cubicengine:○○ の ○○） */
  id: string;
  /** 出す粒子。空なら出さない */
  particle?: string;
}

/**
 * 選べる粒子の一覧。
 * ⚠️ ここに無いIDを書くとマイクラが**黙って無視する**（エラーも出ない）ので、
 *    自由入力にせず必ずこの中から選ばせること。
 */
export const BLOCK_PARTICLES = [
  { id: "", label: "出さない" },
  { id: "minecraft:endrod", label: "白いキラキラ" },
  { id: "minecraft:totem_particle", label: "緑のきらめき" },
  { id: "minecraft:heart_particle", label: "ハート" },
  { id: "minecraft:villager_happy", label: "よろこびの粒" },
  { id: "minecraft:basic_flame_particle", label: "炎" },
  { id: "minecraft:basic_smoke_particle", label: "けむり" },
  { id: "minecraft:water_splash_particle", label: "水しぶき" },
  { id: "minecraft:redstone_ore_dust_particle", label: "赤い粉" },
  { id: "minecraft:enchanting_table_particle", label: "魔法の文字" },
  { id: "minecraft:dragon_breath_fire", label: "紫のもや" },
] as const;

const NAMESPACE = "cubicengine";

/** JS の文字列リテラルに埋めても壊れないようにする */
function q(s: string): string {
  return JSON.stringify(s);
}

/**
 * 粒子を出すブロックがあれば、その処理を書いたコードを返す。
 * 1つも無ければ空文字。**空のときに空文字を返すのが大事**で、
 * 使いもしない処理が毎秒走ると重くなる。
 */
export function blocksToScript(blocks: readonly ParticleBlockSource[]): string {
  const withP = blocks.filter(b => b.particle && b.particle.length > 0);
  if (withP.length === 0) return "";

  const lines: string[] = [];
  lines.push("// ── CUBICENGINE モデルタブ：ブロックの粒子 ──");
  lines.push("// この部分は「モデル」タブの設定から自動で作られています。");
  lines.push("// 直接書き換えても、次に書き出したときに上書きされます。");
  lines.push("");
  lines.push("const CE_BLOCK_PARTICLES = {");
  for (const b of withP) {
    lines.push(`  ${q(`${NAMESPACE}:${b.id}`)}: ${q(b.particle!)},`);
  }
  lines.push("};");
  lines.push("");
  lines.push("// プレイヤーのまわりだけ見る。");
  lines.push("// ⚠️ ワールド全部を走査してはいけない。ブロックが増えるほど重くなり、");
  lines.push("//    しかも見えない場所の粒子は誰の役にも立たない。");
  lines.push("//    半径8ブロックなら、目に入る範囲はほぼ覆える。");
  lines.push("const CE_PT_R = 8;");
  lines.push("system.runInterval(() => {");
  lines.push("  for (const p of world.getAllPlayers()) {");
  lines.push("    const dim = p.dimension;");
  lines.push("    const o = p.location;");
  lines.push("    for (let dx = -CE_PT_R; dx <= CE_PT_R; dx += 2) {");
  lines.push("      for (let dy = -3; dy <= 3; dy += 2) {");
  lines.push("        for (let dz = -CE_PT_R; dz <= CE_PT_R; dz += 2) {");
  lines.push("          const loc = { x: Math.floor(o.x) + dx, y: Math.floor(o.y) + dy, z: Math.floor(o.z) + dz };");
  lines.push("          let b;");
  lines.push("          // 読み込まれていない場所を触ると例外。1マス飛ばして続ける");
  lines.push("          try { b = dim.getBlock(loc); } catch { continue; }");
  lines.push("          const pt = b && CE_BLOCK_PARTICLES[b.typeId];");
  lines.push("          if (!pt) continue;");
  lines.push("          try {");
  lines.push("            // ブロックの中心の少し上に出す。角だと埋まって見えない");
  lines.push("            dim.spawnParticle(pt, { x: loc.x + 0.5, y: loc.y + 1.1, z: loc.z + 0.5 });");
  lines.push("          } catch { /* 粒子IDが無い等。落とさず捨てる */ }");
  lines.push("        }");
  lines.push("      }");
  lines.push("    }");
  lines.push("  }");
  lines.push("// ⚠️ 20tick(1秒)ごと。毎tickにすると探索が20倍になり、");
  lines.push("//    低スペック端末で目に見えて重くなる");
  lines.push("}, 20);");
  lines.push("");

  return lines.join("\n");
}

/** 上のコードが必要とする import */
export function blocksScriptImports(blocks: readonly ParticleBlockSource[]): {
  world: boolean;
  system: boolean;
} {
  const need = blocks.some(b => b.particle && b.particle.length > 0);
  return { world: need, system: need };
}
