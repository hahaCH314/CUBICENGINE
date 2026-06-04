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
