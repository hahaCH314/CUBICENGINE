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
  trigger:  { bg: "#facc15", top: "#fef08a", side: "#d97706", border: "#facc15", text: "#451a03", accent: "#fef08a", icon: "Zap", label: "イベント" },
  action:   { bg: "#38bdf8", top: "#bae6fd", side: "#0284c7", border: "#38bdf8", text: "#0369a1", accent: "#bae6fd", icon: "Target", label: "アクション" },
  ifelse:   { bg: "#ec4899", top: "#fbcfe8", side: "#db2777", border: "#ec4899", text: "#9d174d", accent: "#fbcfe8", icon: "GitBranch", label: "条件" },
  value:    { bg: "#f97316", top: "#fed7aa", side: "#ea580c", border: "#f97316", text: "#7c2d12", accent: "#fed7aa", icon: "Gem", label: "値" },
  loop:     { bg: "#ef4444", top: "#fecaca", side: "#dc2626", border: "#ef4444", text: "#991b1b", accent: "#fecaca", icon: "Repeat", label: "制御" },
  calc:     { bg: "#22c55e", top: "#bbf7d0", side: "#16a34a", border: "#22c55e", text: "#064e3b", accent: "#bbf7d0", icon: "Calculator", label: "演算" },
  ui:       { bg: "#a855f7", top: "#e9d5ff", side: "#9333ea", border: "#a855f7", text: "#4c1d95", accent: "#e9d5ff", icon: "AppWindow", label: "UI作成" },
  variable: { bg: "#64748b", top: "#cbd5e1", side: "#475569", border: "#64748b", text: "#1e293b", accent: "#cbd5e1", icon: "Package", label: "変数" },
};

// デジタル(電脳)＝蛍光・発光寄り。暗い空間で光って見える色（ブロック側で色 drop-shadow も付与）。
const CAT_CYBER: Record<Category, CatDef> = {
  trigger:  { bg: "#ff8d84", top: "#ffb1a9", side: "#e0655c", border: "#7a302b", text: "#ffffff", accent: "#ffd0a8", icon: "Zap", label: "イベント" },
  action:   { bg: "#74b4f0", top: "#9fd0ff", side: "#4f8fd0", border: "#244e7a", text: "#ffffff", accent: "#bfe0ff", icon: "Target", label: "アクション" },
  ifelse:   { bg: "#4fe2b4", top: "#7ff5d2", side: "#2fb88f", border: "#1a6a52", text: "#053527", accent: "#aef7df", icon: "GitBranch", label: "条件" },
  value:    { bg: "#ffd166", top: "#ffe49a", side: "#d9a73f", border: "#6e4f15", text: "#3a2a08", accent: "#ffe9ad", icon: "Gem", label: "値" },
  loop:     { bg: "#ffa96e", top: "#ffc79a", side: "#db7a45", border: "#6b3a1c", text: "#ffffff", accent: "#ffd6b0", icon: "Repeat", label: "制御" },
  calc:     { bg: "#bdf06a", top: "#d6ff9a", side: "#8fc23f", border: "#4a6a1c", text: "#1f2e08", accent: "#ddffaa", icon: "Calculator", label: "演算" },
  ui:       { bg: "#e29cf0", top: "#f3c0ff", side: "#b566c9", border: "#642f72", text: "#ffffff", accent: "#f4cdff", icon: "AppWindow", label: "UI作成" },
  variable: { bg: "#a99cff", top: "#c8bfff", side: "#7a66d9", border: "#3f2c82", text: "#ffffff", accent: "#d6cfff", icon: "Package", label: "変数" },
};

// 既定（後方互換）= 工房パレット
const CAT = CAT_WORKSHOP;

export { CAT, CAT_WORKSHOP, CAT_CYBER };
