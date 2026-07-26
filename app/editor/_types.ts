/* ══════════════════════════════════════════════════════════
   共通型定義 — LogicPanel から抽出
   ══════════════════════════════════════════════════════════ */

/** ブロックのカテゴリ */
export type Category =
  | "trigger" | "action" | "ifelse" | "value"
  | "loop"    | "calc"   | "ui"     | "variable";

/** ブロックのフィールド（中の入力欄）定義 */
export interface FieldDef {
  id: string;
  label: string;
  value: string;
  /** ドロップダウン用の選択肢（任意） */
  options?: string[];
}

/** カードに貼る「条件シール」。
 *  カードゲームに「カードの中に入るカード」という概念は無いので、条件は入れ子ではなく
 *  動きのカードに貼り付ける形で表す。1枚のカードに複数貼ったら「かつ(AND)」、
 *  シールをめくると(neg) 「〜じゃないとき」になる。
 *  ※ type は data/templates.ts の co_* をそのまま使う。条件式の生成は既存の
 *    genExpr にそのまま乗るので、条件の種類を増やしてもここは変えなくてよい。 */
export interface Sticker {
  id: string;
  type: string;
  /** しきい値・アイテム名など、その条件のパラメータ */
  fields: FieldDef[];
  /** めくった状態＝条件を反転する */
  neg: boolean;
}

/** ワイヤーなし・チェーン式ブロック */
export interface CBlock {
  id: string;
  type: string;
  emoji: string;
  label: string;
  sublabel: string;
  category: Category;
  fields: FieldDef[];
  /** フリー時の位置 */
  x: number;
  y: number;
  /** 下につながるブロック */
  nextId:  string | null;
  /** ドーナツの穴の中（条件ブロック） */
  innerId: string | null;
  /** そうなら先頭ブロック */
  thenId:  string | null;
  /** ちがうなら先頭ブロック */
  elseId:  string | null;
  /** 貼られた条件シール。無い＝いつでも動く。
   *  省略可にしてあるので、シール導入前に保存された作品もそのまま読める。 */
  stickers?: Sticker[];
}

/** カテゴリ別の色・アイコン定義 */
export interface CatDef {
  bg: string;
  top: string;
  side: string;
  border: string;
  text: string;
  accent: string;
  icon: string;
  label: string;
}

/** トレイ用のテンプレート（ユーザーがクリックして生成する元データ） */
export interface Tmpl {
  type: string;
  emoji: string;
  label: string;
  sublabel: string;
  category: Category;
  fields: FieldDef[];
}

/** calc カテゴリのサブカテゴリ識別子 */
export type CalcSubCat = "arith" | "math" | "compare" | "string" | "id";
