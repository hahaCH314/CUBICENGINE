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

// 旧パレット（Scratch原色・参考用に保存。比較/復元するとき用）
// trigger  #ff4757 / action #2e86de / ifelse #10ac84 / value #ffa502
// loop     #ff7f50 / calc   #5dbb1a / ui     #e056fd / variable #5f27cd

// 試作#1：脱おもちゃ。彩度を落とし1段深く、工房の温かみ寄り。
// 色相(=カテゴリの見分け)は維持。top=ハイライト面 / side=陰影面 / border=最暗。
const CAT: Record<Category, CatDef> = {
  trigger:  { bg: "#c2504d", top: "#d76b66", side: "#9c3c3a", border: "#561d1c", text: "#ffffff", accent: "#e8b27a", icon: "⚡", label: "イベント" },
  action:   { bg: "#3d6e9c", top: "#5689b6", side: "#2c5277", border: "#163149", text: "#ffffff", accent: "#8fb6da", icon: "🎯", label: "アクション" },
  ifelse:   { bg: "#2d8a72", top: "#41a88c", side: "#1f6553", border: "#0e3328", text: "#ffffff", accent: "#7fd0b9", icon: "🔀", label: "条件" },
  value:    { bg: "#cf9740", top: "#e6b25c", side: "#a5752a", border: "#5c3f12", text: "#241a08", accent: "#a35e1f", icon: "💎", label: "値" },
  loop:     { bg: "#c2683f", top: "#db8259", side: "#9a4e2b", border: "#562713", text: "#ffffff", accent: "#e8b27a", icon: "🔄", label: "制御" },
  calc:     { bg: "#789938", top: "#95b751", side: "#5b7826", border: "#30420f", text: "#1a200a", accent: "#bcd989", icon: "🧮", label: "演算" },
  ui:       { bg: "#a45cae", top: "#c178c9", side: "#80428f", border: "#451b51", text: "#ffffff", accent: "#d39adb", icon: "🪟", label: "UI作成" },
  variable: { bg: "#5b50a4", top: "#7a6fc4", side: "#423783", border: "#221847", text: "#ffffff", accent: "#a59ce0", icon: "📦", label: "変数" },
};

export { CAT };
