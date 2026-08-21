/**
 * ItemIR → 統合版のアイテム定義。
 *
 * モブと違って必要なものが少ない。BP に定義1つ、RP に絵と対応表。
 * ただし **RP 側の対応表（item_texture.json）を忘れると絵が出ない**。
 * ブロックの terrain_texture.json と同じ仕組みで、置き場所だけが違う。
 */

import type { OutFile, BedrockOutput } from "./toBedrock";
import { NAMESPACE } from "./toBedrock";
import type { ItemIR } from "./itemIr";

function itemJson(item: ItemIR): string {
  const components: Record<string, unknown> = {
    "minecraft:icon": { texture: `${NAMESPACE}_${item.id}` },
    "minecraft:max_stack_size": item.maxStack,
    // クリエイティブのどこに出すか。指定しないと持ち物から探せない
    "minecraft:creative_category": { parent: "itemGroup.name.miscFood" },
  };

  if (item.weapon) {
    // 攻撃力。持って殴ったときのダメージ
    components["minecraft:damage"] = item.weapon.damage;
    // 耐久値。**0 のときは何も書かない**。durability コンポーネント自体が
    // 無ければ減るものが無いので、そのまま「壊れない武器」になる
    if (item.weapon.durability > 0) {
      components["minecraft:durability"] = { max_durability: item.weapon.durability };
      // ⚠️ 剣として扱わせるには「何を壊すと耐久が減るか」を書く必要がある。
      //    無いとダメージは出るのに耐久が一切減らない。
      //    耐久が無いなら digger も要らない（あっても害はないが意味がない）
      components["minecraft:digger"] = {
        use_efficiency: false,
        destroy_speeds: [{ block: "minecraft:web", speed: 15 }],
      };
    }
    // 手に持ったときの見え方。剣らしく斜めに構える
    components["minecraft:enchantable"] = { value: 10, slot: "sword" };
    // 剣は重ねられない。耐久値を持つアイテムの仕様なので、ここで強制する。
    // UI 側でも検査しているが、出力が壊れるより静かに直すほうが安全
    components["minecraft:max_stack_size"] = 1;
    // 食べ物と違い、こちらは装備扱いのタブに出す
    components["minecraft:creative_category"] = { parent: "itemGroup.name.sword" };
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
