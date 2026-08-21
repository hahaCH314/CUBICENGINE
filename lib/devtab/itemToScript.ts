/**
 * 武器の効果（毒・炎・持続効果）を、統合版のスクリプトに変換する。
 *
 * なぜ JSON ではなくスクリプトなのか:
 *   統合版のアイテム JSON には「殴った相手に効果を付ける」コンポーネントが無い。
 *   `minecraft:on_hurt_entity` のような名前を推測して書くと、**マイクラは
 *   そのアイテムを黙って読み込まなくなる**（エラーも出ないので原因が分からない）。
 *   スクリプト API の entityHurt イベントなら確実に動く。
 *
 * 出したコードは exporter が scripts/main.js に混ぜる。
 * ロジックタブが生成したコードとは別々に作られ、最後に連結される。
 */

import type { ItemIR } from "./itemIr";
import { NAMESPACE } from "./toBedrock";

/** JS の文字列リテラルに埋めても壊れないようにする */
function q(s: string): string {
  return JSON.stringify(s);
}

/**
 * 古い保存データを安全に読む。
 *
 * この機能より前に作られたプロジェクトの武器には effects / selfEffects /
 * fireSeconds が無い。そのまま .length を見ると落ちて、**保存済みの作品が
 * 開けなくなる**。型の上では必須でも、実データには無いことがある。
 */
function eff(w: ItemIR["weapon"]) {
  return {
    effects: w?.effects ?? [],
    selfEffects: w?.selfEffects ?? [],
    fireSeconds: w?.fireSeconds ?? 0,
  };
}

/** 効果を1つでも持っているか */
function hasEffect(it: ItemIR): boolean {
  if (!it.weapon) return false;
  const e = eff(it.weapon);
  return e.effects.length > 0 || e.selfEffects.length > 0 || e.fireSeconds > 0;
}

/** 着ている間の効果を持つ防具か */
function hasWearEffect(it: ItemIR): boolean {
  return (it.armor?.wearEffects?.length ?? 0) > 0;
}

/** 技を持つか */
function hasSkill(it: ItemIR): boolean {
  return !!it.skill;
}

/**
 * 武器の効果を持つアイテムがあれば、その処理を書いたコードを返す。
 * 1つも無ければ空文字。**空のときに空文字を返すのが大事**で、
 * 使いもしない import が混ざるとロード失敗の原因になる。
 */
export function itemsToScript(items: readonly ItemIR[]): string {
  // 効果を持つ武器だけ集める。ただの剣はスクリプト不要。
  // ⚠️ ?? を必ず通すこと。この機能より前に保存されたプロジェクトには
  //    effects / selfEffects / fireSeconds が無く、.length で落ちる
  const armed = items.filter(it => hasEffect(it));
  const armors = items.filter(it => hasWearEffect(it));
  const skills = items.filter(it => hasSkill(it));
  if (armed.length === 0 && armors.length === 0 && skills.length === 0) return "";

  // 殴ったときの処理が要るか / 持っている間の処理が要るか を分けて判定する。
  // 要らないほうの仕掛けまで動かすと、無駄に毎tick走ることになる
  const onHit = armed.filter(it => eff(it.weapon).effects.length > 0 || eff(it.weapon).fireSeconds > 0);
  const onHold = armed.filter(it => eff(it.weapon).selfEffects.length > 0);

  const lines: string[] = [];
  lines.push("// ── CUBICENGINE デベロッパータブ：武器の効果 ──");
  lines.push("// この部分は「アイテム」の設定から自動で作られています。");
  lines.push("// 直接書き換えても、次に書き出したときに上書きされます。");
  lines.push("");

  if (onHit.length > 0) {
    // 武器ID → やること の対応表。if を並べるより読みやすく、増えても遅くならない
    lines.push("const CE_HIT_EFFECTS = {");
    for (const it of onHit) {
      const w = eff(it.weapon);
      const parts: string[] = [];
      if (w.fireSeconds > 0) parts.push(`fire: ${w.fireSeconds}`);
      if (w.effects.length > 0) {
        const es = w.effects
          .map(e => `{ id: ${q(e.id)}, sec: ${e.seconds}, amp: ${e.amplifier} }`)
          .join(", ");
        parts.push(`effects: [${es}]`);
      }
      lines.push(`  ${q(`${NAMESPACE}:${it.id}`)}: { ${parts.join(", ")} },`);
    }
    lines.push("};");
    lines.push("");
    lines.push("world.afterEvents.entityHurt.subscribe(ev => {");
    lines.push("  const src = ev.damageSource?.damagingEntity;");
    lines.push("  const target = ev.hurtEntity;");
    lines.push("  if (!src || !target) return;");
    lines.push("  // 殴った側が今まさに持っている物を見る。");
    lines.push("  // ⚠️ getComponent は装備を持たない相手（矢など）では undefined になる");
    lines.push("  let held;");
    lines.push("  try {");
    lines.push("    const eq = src.getComponent('minecraft:equippable');");
    lines.push("    held = eq?.getEquipment('Mainhand');");
    lines.push("  } catch { return; }");
    lines.push("  const rule = held && CE_HIT_EFFECTS[held.typeId];");
    lines.push("  if (!rule) return;");
    lines.push("  try {");
    lines.push("    if (rule.fire) target.setOnFire(rule.fire, true);");
    lines.push("    if (rule.effects) {");
    lines.push("      for (const e of rule.effects) {");
    lines.push("        // duration は tick 単位。20tick = 1秒");
    lines.push("        target.addEffect(e.id, e.sec * 20, { amplifier: e.amp });");
    lines.push("      }");
    lines.push("    }");
    lines.push("  } catch (err) {");
    lines.push("    // 死んだ直後の相手には効果を付けられない。落とさず捨てる");
    lines.push("  }");
    lines.push("});");
    lines.push("");
  }

  if (onHold.length > 0) {
    lines.push("const CE_HOLD_EFFECTS = {");
    for (const it of onHold) {
      const es = eff(it.weapon)
        .selfEffects.map(e => `{ id: ${q(e.id)}, amp: ${e.amplifier} }`)
        .join(", ");
      lines.push(`  ${q(`${NAMESPACE}:${it.id}`)}: [${es}],`);
    }
    lines.push("};");
    lines.push("");
    lines.push("// 持っている間ずっと掛ける。");
    lines.push("// ⚠️ 毎tickではなく1秒ごと。毎tickだと重くなるうえ、効果の点滅が出る。");
    lines.push("//    効果の長さを2秒にして、1秒ごとに掛け直すことで途切れなく続く");
    lines.push("system.runInterval(() => {");
    lines.push("  for (const p of world.getAllPlayers()) {");
    lines.push("    let held;");
    lines.push("    try {");
    lines.push("      const eq = p.getComponent('minecraft:equippable');");
    lines.push("      held = eq?.getEquipment('Mainhand');");
    lines.push("    } catch { continue; }");
    lines.push("    const list = held && CE_HOLD_EFFECTS[held.typeId];");
    lines.push("    if (!list) continue;");
    lines.push("    for (const e of list) {");
    lines.push("      try {");
    lines.push("        // showParticles:false で画面が渦巻きだらけになるのを防ぐ");
    lines.push("        p.addEffect(e.id, 40, { amplifier: e.amp, showParticles: false });");
    lines.push("      } catch { /* 死亡直後など。捨てる */ }");
    lines.push("    }");
    lines.push("  }");
    lines.push("}, 20);");
    lines.push("");
  }

  // ── 着ている間ずっと効く防具 ──
  if (armors.length > 0) {
    lines.push("const CE_ARMOR_EFFECTS = {");
    for (const it of armors) {
      const es = (it.armor!.wearEffects ?? [])
        .map(e => `{ id: ${q(e.id)}, amp: ${e.amplifier} }`)
        .join(", ");
      lines.push(`  ${q(`${NAMESPACE}:${it.id}`)}: [${es}],`);
    }
    lines.push("};");
    lines.push("");
    lines.push("// 防具スロット4つを毎秒見る。手持ちと違い、着ていれば手に何を持っていても効く");
    lines.push("const CE_ARMOR_SLOTS = ['Head', 'Chest', 'Legs', 'Feet'];");
    lines.push("system.runInterval(() => {");
    lines.push("  for (const p of world.getAllPlayers()) {");
    lines.push("    let eq;");
    lines.push("    try { eq = p.getComponent('minecraft:equippable'); } catch { continue; }");
    lines.push("    if (!eq) continue;");
    lines.push("    for (const slot of CE_ARMOR_SLOTS) {");
    lines.push("      let worn;");
    lines.push("      try { worn = eq.getEquipment(slot); } catch { continue; }");
    lines.push("      const list = worn && CE_ARMOR_EFFECTS[worn.typeId];");
    lines.push("      if (!list) continue;");
    lines.push("      for (const e of list) {");
    lines.push("        try {");
    lines.push("          p.addEffect(e.id, 40, { amplifier: e.amp, showParticles: false });");
    lines.push("        } catch { /* 死亡直後など */ }");
    lines.push("      }");
    lines.push("    }");
    lines.push("  }");
    lines.push("}, 20);");
    lines.push("");
  }

  // ── 右クリックで出す技 ──
  if (skills.length > 0) {
    lines.push("const CE_SKILLS = {");
    for (const it of skills) {
      const s = it.skill!;
      lines.push(
        `  ${q(`${NAMESPACE}:${it.id}`)}: { kind: ${q(s.kind)}, power: ${s.power}, range: ${s.range}, cd: ${s.cooldownSeconds} },`,
      );
    }
    lines.push("};");
    lines.push("");
    lines.push("// ⚠️ minecraft:cooldown はアイテムの使用を抑えるだけで、");
    lines.push("//    itemUse イベント自体は飛んでくる。押しっぱなしで連発されるので、");
    lines.push("//    ここでも「誰がいつ使ったか」を覚えて弾く。");
    lines.push("const CE_LAST_USE = new Map();");
    lines.push("world.afterEvents.itemUse.subscribe(ev => {");
    lines.push("  const p = ev.source;");
    lines.push("  const skill = CE_SKILLS[ev.itemStack?.typeId];");
    lines.push("  if (!p || !skill) return;");
    lines.push("  if (skill.cd > 0) {");
    lines.push("    const key = p.id + '|' + ev.itemStack.typeId;");
    lines.push("    const now = system.currentTick;");
    lines.push("    const last = CE_LAST_USE.get(key) ?? -Infinity;");
    lines.push("    if (now - last < skill.cd * 20) return;");
    lines.push("    CE_LAST_USE.set(key, now);");
    lines.push("  }");
    lines.push("  try {");
    lines.push("    const loc = p.location;");
    lines.push("    const dim = p.dimension;");
    lines.push("");
    lines.push("    if (skill.kind === 'heal') {");
    lines.push("      const hp = p.getComponent('minecraft:health');");
    lines.push("      // ⚠️ effectiveMax が無い版があるので必ず候補を用意する。");
    lines.push("      //    Math.min(undefined, n) は NaN になり、setCurrentValue が");
    lines.push("      //    黙って失敗する（外側の catch に飲まれて何も起きない）");
    lines.push("      if (hp) {");
    lines.push("        const max = hp.effectiveMax ?? hp.defaultValue ?? 20;");
    lines.push("        hp.setCurrentValue(Math.min(max, hp.currentValue + skill.power));");
    lines.push("      }");
    lines.push("");
    lines.push("    } else if (skill.kind === 'dash') {");
    lines.push("      // 見ている向きへ弾く。applyKnockback は水平＋垂直を分けて渡す");
    lines.push("      const v = p.getViewDirection();");
    lines.push("      p.applyKnockback({ x: v.x * skill.power, z: v.z * skill.power }, v.y * skill.power);");
    lines.push("");
    lines.push("    } else if (skill.kind === 'lightning') {");
    lines.push("      // 見ている先に落とす。当たらなければ足元");
    lines.push("      const hit = p.getBlockFromViewDirection({ maxDistance: Math.max(1, skill.range) });");
    lines.push("      const at = hit?.block?.location ?? loc;");
    lines.push("      dim.spawnEntity('minecraft:lightning_bolt', at);");
    lines.push("");
    lines.push("    } else {");
    lines.push("      // shockwave / knockback。まわりの相手を集めて処理する。");
    lines.push("      // ⚠️ 絞り込まないと村人・ペット・友達まで巻き込む。");
    lines.push("      //    'monster' ファミリーに絞って、敵だけに当てる");
    lines.push("      const targets = dim.getEntities({");
    lines.push("        location: loc,");
    lines.push("        maxDistance: Math.max(1, skill.range),");
    lines.push("        families: ['monster'],");
    lines.push("      });");
    lines.push("      for (const t of targets) {");
    lines.push("        // ⚠️ 自分を外すのは id で見ること。excludeNames は**名前**で");
    lines.push("        //    弾くので、同じ名前を付けたモブや同名の別プレイヤーまで");
    lines.push("        //    巻き添えで対象から外れる");
    lines.push("        if (t.id === p.id) continue;");
    lines.push("        try {");
    lines.push("          if (skill.kind === 'shockwave') {");
    lines.push("            t.applyDamage(skill.power, { cause: 'entityAttack', damagingEntity: p });");
    lines.push("          } else {");
    lines.push("            // 自分から見て外向きへ飛ばす");
    lines.push("            const dx = t.location.x - loc.x;");
    lines.push("            const dz = t.location.z - loc.z;");
    lines.push("            const len = Math.hypot(dx, dz) || 1;");
    lines.push("            t.applyKnockback(");
    lines.push("              { x: (dx / len) * skill.power, z: (dz / len) * skill.power },");
    lines.push("              skill.power * 0.4,");
    lines.push("            );");
    lines.push("          }");
    lines.push("        } catch { /* 無敵時間中など。1体飛ばして続ける */ }");
    lines.push("      }");
    lines.push("    }");
    lines.push("  } catch (err) {");
    lines.push("    // 技が失敗しても他の処理を巻き込まない");
    lines.push("  }");
    lines.push("});");
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * 上のコードが必要とする import 文。
 * ⚠️ exporter 側で「既に同じ import があるか」を見て重複を避けること。
 *    同じ名前を二重に import すると SyntaxError でスクリプトごと死ぬ。
 */
export function itemsScriptImports(items: readonly ItemIR[]): { world: boolean; system: boolean } {
  const armed = items.filter(it => hasEffect(it));
  const armors = items.filter(it => hasWearEffect(it));
  const skills = items.filter(it => hasSkill(it));
  return {
    world: armed.length > 0 || armors.length > 0 || skills.length > 0,
    // system が要るのは「毎秒くり返す」処理（手持ち効果・防具効果）と、
    // 技のクールダウン判定（system.currentTick を読む）
    system:
      armed.some(it => eff(it.weapon).selfEffects.length > 0) ||
      armors.length > 0 ||
      skills.some(it => (it.skill?.cooldownSeconds ?? 0) > 0),
  };
}
