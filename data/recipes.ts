/* ══════════════════════════════════════════════════════════════════
   recipes.ts — 「〇〇するアドオンの作り方」記事の中身

   検索されるのは「マイクラ アドオン 作り方」のような大きい言葉だけでなく、
   「ダメージを受けたら爆発」のような具体的な言葉のほうが多い。数で拾うために、
   記事はここにデータとして足すだけで増える形にしてある（/guide/[slug] が描画）。

   ⚠️ card の type / field は data/templates.ts の定義と合わせること。
      ここがズレると「書いてあるカードが見つからない」記事になる。
   ══════════════════════════════════════════════════════════════════ */

export interface RecipeCard {
  /** data/templates.ts の type */
  type: string;
  /** 画面に出るカード名（templates.ts の label と一致させる） */
  label: string;
  /** そのカードで何が起きるか、記事の文脈での説明 */
  why: string;
  /** 変える値。[画面上の項目名, 入れる値] */
  fields?: [string, string][];
}

export interface Recipe {
  slug: string;
  /** 検索結果に出る見出し。狙う言葉をそのまま入れる */
  title: string;
  /** 一覧に出す短い名前 */
  shortTitle: string;
  emoji: string;
  description: string;
  keywords: string[];
  /** どんなアドオンか、最初に読ませる説明 */
  intro: string[];
  cards: RecipeCard[];
  /** 作ったあとの遊び方・注意 */
  notes: string[];
  faq: { q: string; a: string }[];
}

export const RECIPES: Recipe[] = [
  {
    slug: "explode-on-damage",
    title: "ダメージを受けたら爆発するアドオンの作り方【マイクラ】",
    shortTitle: "ダメージを受けたら爆発する",
    emoji: "💥",
    description:
      "マイクラでダメージを受けた瞬間に爆発するアドオンを、コードを書かずに作る方法。カードを3枚かさねるだけで作れます。統合版（.mcaddon）対応・無料。",
    keywords: ["マイクラ", "アドオン", "作り方", "爆発", "ダメージ", "統合版", "mcaddon", "コード不要"],
    intro: [
      "敵に殴られた瞬間にドカン！と爆発する、派手なアドオンを作ります。",
      "使うカードは3枚だけです。プログラミングのコードは1行も書きません。",
    ],
    cards: [
      {
        type: "ev_hurt",
        label: "ダメージ受信",
        why: "これが「きっかけ」です。ダメージを受けた瞬間に、下にかさねたカードが動きます。",
      },
      {
        type: "ac_sound",
        label: "サウンド再生",
        why: "爆発音を鳴らします。音があるだけで迫力がまったく違うので、最初に入れるのがおすすめです。",
        fields: [["サウンド", "random.explode"], ["音量", "1"]],
      },
      {
        type: "ac_particle",
        label: "パーティクル表示",
        why: "爆発の見た目を出します。音と光がそろうと、本当に爆発したように見えます。",
        fields: [["粒子", "minecraft:huge_explosion_emitter"]],
      },
    ],
    notes: [
      "本物の爆発（まわりのブロックがこわれる）にしたいときは、「エンティティ召喚」のカードを足して minecraft:tnt を呼びます。ただし自分の家がふっとぶので、試すときは平地で。",
      "ダメージを受けるたびに爆発するので、連続で殴られるとにぎやかになります。落ちついた感じにしたいときは、条件シールで「HPが少ないとき」だけ動くようにすると調整できます。",
    ],
    faq: [
      {
        q: "爆発してもブロックがこわれません",
        a: "パーティクルは見た目だけなので、ブロックはこわれません。本当にこわしたいときは「エンティティ召喚」でTNTを出してください。",
      },
      {
        q: "音が鳴りません",
        a: "サウンドの名前が合っているか確かめてください。爆発音は random.explode です。マイクラ側の音量設定も確認してみてください。",
      },
    ],
  },
];

export const getRecipe = (slug: string) => RECIPES.find(r => r.slug === slug);
