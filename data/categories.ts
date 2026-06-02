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

const CAT: Record<Category, CatDef> = {
  trigger:  { bg: "#ff4757", top: "#ff6b81", side: "#d93847", border: "#7d121c", text: "#ffffff", accent: "#ffeaa7", icon: "⚡", label: "イベント" },
  action:   { bg: "#2e86de", top: "#54a0ff", side: "#1b62ab", border: "#0b396b", text: "#ffffff", accent: "#74b9ff", icon: "🎯", label: "アクション" },
  ifelse:   { bg: "#10ac84", top: "#1dd1a1", side: "#0b7c5f", border: "#044232", text: "#ffffff", accent: "#55efc4", icon: "🔀", label: "条件" },
  value:    { bg: "#ffa502", top: "#ffc048", side: "#d98100", border: "#704200", text: "#111111", accent: "#d35400", icon: "💎", label: "値" },
  loop:     { bg: "#ff7f50", top: "#ff9f43", side: "#e15f41", border: "#8c2813", text: "#ffffff", accent: "#ffeaa7", icon: "🔄", label: "制御" },
  calc:     { bg: "#5dbb1a", top: "#7fd831", side: "#3d8a0f", border: "#1a4d04", text: "#111111", accent: "#c3f573", icon: "🧮", label: "演算" },
  ui:       { bg: "#e056fd", top: "#ff9ff3", side: "#be2edd", border: "#6c1585", text: "#ffffff", accent: "#ff7897", icon: "🪟", label: "UI作成" },
  variable: { bg: "#5f27cd", top: "#a29bfe", side: "#341f97", border: "#1b0b6b", text: "#ffffff", accent: "#a29bfe", icon: "📦", label: "変数" },
};

export { CAT };
