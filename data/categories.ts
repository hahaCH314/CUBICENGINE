import { Category } from '../app/editor/_types';

interface CatDef {
  bg: string;
  top: string;
  side: string;
  border: string;
  text: string;
  accent: string;
  icon: string;
  label: string;
}

// 旧パレット（Scratch原色・参考用に保存）
// trigger #ff4757 / action #2e86de / ifelse #10ac84 / value #ffa502
// loop #ff7f50 / calc #5dbb1a / ui #e056fd / variable #5f27cd

// ── テーマ連動パレット ──
// アナログ(工房)＝彩度を落とした深い暖色。電球に照らされた道具の色。
const CAT_WORKSHOP: Record<Category, CatDef> = {
  trigger:  { bg: "#c2504d", top: "#d76b66", side: "#9c3c3a", border: "#561d1c", text: "#ffffff", accent: "#e8b27a", icon: "⚡", label: "イベント" },
  action:   { bg: "#3d6e9c", top: "#5689b6", side: "#2c5277", border: "#163149", text: "#ffffff", accent: "#8fb6da", icon: "🎯", label: "アクション" },
  ifelse:   { bg: "#2d8a72", top: "#41a88c", side: "#1f6553", border: "#0e3328", text: "#ffffff", accent: "#7fd0b9", icon: "🔀", label: "条件" },
  value:    { bg: "#cf9740", top: "#e6b25c", side: "#a5752a", border: "#5c3f12", text: "#241a08", accent: "#a35e1f", icon: "💎", label: "値" },
  loop:     { bg: "#c2683f", top: "#db8259", side: "#9a4e2b", border: "#562713", text: "#ffffff", accent: "#e8b27a", icon: "🔄", label: "制御" },
  calc:     { bg: "#789938", top: "#95b751", side: "#5b7826", border: "#30420f", text: "#1a200a", accent: "#bcd989", icon: "🧮", label: "演算" },
  ui:       { bg: "#a45cae", top: "#c178c9", side: "#80428f", border: "#451b51", text: "#ffffff", accent: "#d39adb", icon: "🪟", label: "UI作成" },
  variable: { bg: "#5b50a4", top: "#7a6fc4", side: "#423783", border: "#221847", text: "#ffffff", accent: "#a59ce0", icon: "📦", label: "変数" },
};

// デジタル(電脳)＝蛍光・発光寄り。暗い空間で光って見える色（ブロック側で色 drop-shadow も付与）。
const CAT_CYBER: Record<Category, CatDef> = {
  trigger:  { bg: "#ff8d84", top: "#ffb1a9", side: "#e0655c", border: "#7a302b", text: "#ffffff", accent: "#ffd0a8", icon: "⚡", label: "イベント" },
  action:   { bg: "#74b4f0", top: "#9fd0ff", side: "#4f8fd0", border: "#244e7a", text: "#ffffff", accent: "#bfe0ff", icon: "🎯", label: "アクション" },
  ifelse:   { bg: "#4fe2b4", top: "#7ff5d2", side: "#2fb88f", border: "#1a6a52", text: "#053527", accent: "#aef7df", icon: "🔀", label: "条件" },
  value:    { bg: "#ffd166", top: "#ffe49a", side: "#d9a73f", border: "#6e4f15", text: "#3a2a08", accent: "#ffe9ad", icon: "💎", label: "値" },
  loop:     { bg: "#ffa96e", top: "#ffc79a", side: "#db7a45", border: "#6b3a1c", text: "#ffffff", accent: "#ffd6b0", icon: "🔄", label: "制御" },
  calc:     { bg: "#bdf06a", top: "#d6ff9a", side: "#8fc23f", border: "#4a6a1c", text: "#1f2e08", accent: "#ddffaa", icon: "🧮", label: "演算" },
  ui:       { bg: "#e29cf0", top: "#f3c0ff", side: "#b566c9", border: "#642f72", text: "#ffffff", accent: "#f4cdff", icon: "🪟", label: "UI作成" },
  variable: { bg: "#a99cff", top: "#c8bfff", side: "#7a66d9", border: "#3f2c82", text: "#ffffff", accent: "#d6cfff", icon: "📦", label: "変数" },
};

// 既定（後方互換）= 工房パレット
const CAT = CAT_WORKSHOP;

export { CAT, CAT_WORKSHOP, CAT_CYBER };
