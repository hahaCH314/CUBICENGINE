/**
 * ItemIR → 統合版のアイテム定義。
 *
 * モブと違って必要なものが少ない。BP に定義1つ、RP に絵と対応表。
 * ただし **RP 側の対応表（item_texture.json）を忘れると絵が出ない**。
 * ブロックの terrain_texture.json と同じ仕組みで、置き場所だけが違う。
 */

import type { OutFile, BedrockOutput } from "./toBedrock";
import { NAMESPACE } from "./toBedrock";
import { TOOL_KINDS, type ItemIR } from "./itemIr";

function itemJson(item: ItemIR): string {
  const components: Record<string, unknown> = {
    "minecraft:icon": { texture: `${NAMESPACE}_${item.id}` },
    "minecraft:max_stack_size": item.maxStack,
    // クリエイティブのどこに出すか。指定しないと持ち物から探せない
    "minecraft:creative_category": { parent: "itemGroup.name.miscFood" },
  };

  if (item.weapon) {
    const w = item.weapon;
    // 種類が無いのは、この項目より前に保存された作品。剣として扱う
    const kind = w.kind ?? "sword";
    const def = TOOL_KINDS.find(k => k.id === kind) ?? TOOL_KINDS[0];
    // 剣は「速く掘る」ものではないので固定。他は設定値を使う
    const speed = kind === "sword" ? 15 : (w.digSpeed ?? 8);

    // 攻撃力。持って殴ったときのダメージ
    components["minecraft:damage"] = w.damage;

    // ⚠️ digger は耐久の有無と関係なく必要。
    //    これが無いとツルハシで石を掘っても素手と同じ速さになる。
    //    （耐久がある場合は「何を壊すと減るか」の役割も兼ねる）
    components["minecraft:digger"] = {
      // 効率のエンチャントを効かせるか。掘る道具では効かせたい
      use_efficiency: kind !== "sword",
      destroy_speeds: def.tags.map(tag => ({
        // block に文字列ではなく tags を渡すと、ブロックを1つずつ
        // 並べずに「石ぜんぶ」のような指定ができる
        block: { tags: tag },
        speed,
      })),
    };

    // 耐久値。**0 のときは何も書かない**。durability コンポーネント自体が
    // 無ければ減るものが無いので、そのまま「壊れない道具」になる
    if (w.durability > 0) {
      components["minecraft:durability"] = { max_durability: w.durability };
    }

    // 手に持ったときの見え方と、エンチャント台での扱い
    components["minecraft:enchantable"] = { value: 10, slot: def.enchantSlot };
    // 耐久値を持つアイテムは重ねられない。マイクラの仕様なのでここで強制する。
    // UI 側でも検査しているが、出力が壊れるより静かに直すほうが安全
    components["minecraft:max_stack_size"] = 1;
    // 食べ物と違い、こちらは装備扱いのタブに出す
    components["minecraft:creative_category"] = { parent: def.category };
  }

  if (item.armor) {
    const a = item.armor;
    // 防御力。ダイヤ一式で20 になるくらいが目安
    components["minecraft:armor"] = { protection: a.protection };
    // ⚠️ wearable が無いと**着られない**。armor だけでは「防御力を持つ置物」になる
    components["minecraft:wearable"] = { slot: `slot.armor.${a.slot}` };
    if (a.durability > 0) {
      components["minecraft:durability"] = { max_durability: a.durability };
    }
    components["minecraft:max_stack_size"] = 1;
    // エンチャント枠。防具の部位ごとに指定が違う
    components["minecraft:enchantable"] = { value: 10, slot: `armor_${a.slot}` };
    components["minecraft:creative_category"] = { parent: "itemGroup.name.helmet" };
  }

  if (item.skill) {
    // ⚠️ 技そのものはスクリプトが動かす（itemToScript.ts）。ここでは
    //    「右クリックを押せる状態にする」ことだけをやる。
    //    use_modifiers が無いと itemUse イベントが飛ばず、押しても無反応になる
    components["minecraft:use_modifiers"] = { use_duration: 0.1, movement_modifier: 1 };
    if (item.skill.cooldownSeconds > 0) {
      // クールダウンはマイクラ側の仕組みを使う。自前で数えるより確実で、
      // 画面にも残り時間が出る
      components["minecraft:cooldown"] = {
        category: `${NAMESPACE}_${item.id}`,
        duration: item.skill.cooldownSeconds,
      };
    }
  }

  if (item.food) {
    components["minecraft:food"] = {
      nutrition: item.food.nutrition,
      saturation_modifier: item.food.saturation,
      can_always_eat: item.food.canAlwaysEat,
    };
    // ⚠️ food だけでは食べられない。use_modifiers が無いと
    //    「持てるが口に運べない」アイテムになる（原因が分かりにくい）
    components["minecraft:use_modifiers"] = {
      use_duration: item.food.useDuration,
      movement_modifier: 0.35,
    };
    // 食べる動作。これが無いと手を口に持っていくモーションが出ない
    components["minecraft:use_animation"] = "eat";
  }

  return JSON.stringify(
    {
      format_version: "1.20.50",
      "minecraft:item": {
        description: { identifier: `${NAMESPACE}:${item.id}` },
        components,
      },
    },
    null,
    2,
  );
}

/**
 * アイテム全体をまとめて出す。
 * item_texture.json は**1ファイルに全アイテム分をまとめる**必要があるので、
 * 1個ずつではなく配列で受け取る。
 */
export function itemsToBedrock(items: ItemIR[]): BedrockOutput {
  const bp: OutFile[] = [];
  const rp: OutFile[] = [];
  const langLines: string[] = [];

  if (items.length === 0) return { bp, rp, langLines };

  const textureData: Record<string, { textures: string }> = {};

  for (const item of items) {
    bp.push({ path: `items/${item.id}.json`, text: itemJson(item) });
    rp.push({ path: `textures/items/${item.id}.png`, dataUrl: item.iconDataUrl });
    textureData[`${NAMESPACE}_${item.id}`] = { textures: `textures/items/${item.id}` };

    const name = item.displayName.replace(/[\r\n]/g, " ");
    langLines.push(`item.${NAMESPACE}:${item.id}.name=${name}`);
  }

  rp.push({
    path: "textures/item_texture.json",
    text: JSON.stringify(
      { resource_pack_name: NAMESPACE, texture_name: "atlas.items", texture_data: textureData },
      null,
      2,
    ),
  });

  return { bp, rp, langLines };
}
