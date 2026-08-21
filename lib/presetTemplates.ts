import { CBlock } from "../app/editor/_types";

export interface PresetTemplate {
  id: string;
  name: string;
  badge: string;
  icon: string;
  description: string;
  bgGradient: string;
  borderColor: string;
  /**
   * テンプレは「どの種類のブロックを・どんな値で・どこに置くか」だけを持つ。
   * emoji / sublabel / category は読み込み時に type でパレット(data/templates.ts)を引いて
   * 継承するので、ここに書かなくてよい（同じ定義を2箇所に持たない＝ズレない）。
   * ※ emoji の中身は絵文字ではなく lucide のアイコン名。手書きすると崩れるので継承推奨。
   * ※ id / nextId は現在の読み込み処理では使われない（配列の並び順どおりに連結する）。
   *    残してあるのは「どう繋がる想定か」を読んで分かるようにするため。
   */
  blocks: Array<
    Pick<CBlock, "type" | "x" | "y"> &
      Partial<Pick<CBlock, "id" | "emoji" | "label" | "sublabel" | "category" | "fields" | "nextId">>
  >;
}

export const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    id: "boom_chicken",
    name: "爆発ニワトリアドオン 🐔💣",
    badge: "超たのしい",
    icon: "🐔",
    description: "モブを攻撃するとドカン！とド派手に爆発音とダイヤが出るよ！",
    bgGradient: "from-amber-500/20 to-red-500/20",
    borderColor: "#f59e0b",
    blocks: [
      {
        id: "preset_bc_1",
        type: "ev_attack",
        label: "エンティティを攻撃",
        category: "trigger",
        fields: [],
        x: 80,
        y: 100,
        nextId: "preset_bc_2",
      },
      {
        id: "preset_bc_2",
        type: "ac_sound",
        label: "効果音を鳴らす",
        category: "action",
        fields: [
          { id: "snd", label: "効果音", value: "random.explode" },
          { id: "vol", label: "音量", value: "1" },
        ],
        x: 80,
        y: 200,
        nextId: "preset_bc_3",
      },
      {
        id: "preset_bc_3",
        type: "ac_give",
        label: "アイテムを与える",
        category: "action",
        fields: [
          { id: "item", label: "アイテム", value: "minecraft:diamond" },
          { id: "count", label: "個数", value: "16" },
        ],
        x: 80,
        y: 300,
      },
    ],
  },
  {
    id: "thunder_sword",
    name: "雷のドデカ剣 ⚔️⚡",
    badge: "人気No.1",
    icon: "⚔️",
    description: "ダイヤモンドを右クリックすると目の前に雷が落ちる伝説の魔法！",
    bgGradient: "from-blue-500/20 to-cyan-500/20",
    borderColor: "#38bdf8",
    blocks: [
      {
        id: "preset_ts_1",
        type: "ev_item",
        label: "アイテム使用",
        category: "trigger",
        fields: [{ id: "item", label: "アイテム", value: "minecraft:diamond" }],
        x: 80,
        y: 100,
        nextId: "preset_ts_2",
      },
      {
        id: "preset_ts_2",
        type: "ac_cmd",
        label: "コマンド実行",
        category: "action",
        fields: [{ id: "cmd", label: "コマンド", value: "summon lightning_bolt" }],
        x: 80,
        y: 200,
        nextId: "preset_ts_3",
      },
      {
        id: "preset_ts_3",
        type: "ac_title",
        label: "タイトルの表示",
        category: "action",
        fields: [
          { id: "title", label: "タイトル", value: "⚡ 雷撃発動！ ⚡" },
          { id: "sub", label: "サブタイトル", value: "マイクラを大冒険！" },
        ],
        x: 80,
        y: 300,
      },
    ],
  },
  {
    id: "infinite_meat",
    name: "無限ダイヤのお肉 🥩💎",
    badge: "超かんたん",
    icon: "🥩",
    description: "お肉を食べると一瞬でダイヤ大量ゲット＋レベルアップ！",
    bgGradient: "from-purple-500/20 to-pink-500/20",
    borderColor: "#a855f7",
    blocks: [
      {
        id: "preset_im_1",
        type: "ev_item",
        label: "アイテム使用",
        category: "trigger",
        fields: [{ id: "item", label: "アイテム", value: "minecraft:cooked_beef" }],
        x: 80,
        y: 100,
        nextId: "preset_im_2",
      },
      {
        id: "preset_im_2",
        type: "ac_sound",
        label: "効果音を鳴らす",
        category: "action",
        fields: [
          { id: "snd", label: "効果音", value: "random.levelup" },
          { id: "vol", label: "音量", value: "1" },
        ],
        x: 80,
        y: 200,
        nextId: "preset_im_3",
      },
      {
        id: "preset_im_3",
        type: "ac_give",
        label: "アイテムを与える",
        category: "action",
        fields: [
          { id: "item", label: "アイテム", value: "minecraft:diamond" },
          { id: "count", label: "個数", value: "64" },
        ],
        x: 80,
        y: 300,
      },
    ],
  },
];
