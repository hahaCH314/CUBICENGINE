import { create } from "zustand";
import { persist } from "zustand/middleware";

export type WorldThemeId = "land" | "sea";

export interface AmbientCreature {
  id: string;
  kind: "bird" | "butterfly" | "fish" | "bubble";
  count: number;
  // 以下はヒマワリが描画時に使う用
  delay?: number;
  duration?: number;
  top?: number | string;
  scale?: number;
  opacity?: number;
}

export interface WorldTheme {
  id: WorldThemeId;
  name: string;
  emoji: string;
  bgGradient: string;
  groundColor: string;
  groundTopBorder: string;
  lightTint: string;
  heroKind: "steve" | "diver";
  ambient: AmbientCreature[];
  accent?: string;
}

export const WORLD_THEMES: Record<WorldThemeId, WorldTheme> = {
  land: {
    id: "land",
    name: "陸",
    emoji: "🌳",
    bgGradient: "linear-gradient(to bottom, #bfe3ff 0%, #dff0ff 52%, #f0f8ff 100%)",
    groundColor: "linear-gradient(#5fa845, #4a7d36)",
    groundTopBorder: "4px solid #3c8a2f",
    lightTint: "radial-gradient(ellipse, rgba(255,238,180,0.7), transparent 70%)",
    heroKind: "steve",
    accent: "#5fa845",
    ambient: [
      { id: "bird-1", kind: "bird", count: 1, duration: 15, delay: 0, top: "10%", scale: 1 },
      { id: "bird-2", kind: "bird", count: 1, duration: 18, delay: 5, top: "15%", scale: 0.8 },
      { id: "butterfly-1", kind: "butterfly", count: 1, duration: 12, delay: 2, top: "60%", scale: 0.6 },
      { id: "butterfly-2", kind: "butterfly", count: 1, duration: 14, delay: 7, top: "50%", scale: 0.7 },
    ]
  },
  sea: {
    id: "sea",
    name: "海",
    emoji: "🌊",
    bgGradient: "linear-gradient(to bottom, #1ebbf0 0%, #0a4f9e 60%, #062b59 100%)",
    groundColor: "linear-gradient(#e2cda3, #c2ae84)",
    groundTopBorder: "4px solid #a8946f",
    lightTint: "radial-gradient(ellipse at 50% -20%, rgba(180,240,255,0.35), transparent 80%)",
    heroKind: "diver",
    accent: "#0a4f9e",
    ambient: [
      { id: "fish-1", kind: "fish", count: 1, duration: 20, delay: 0, top: "30%", scale: 1 },
      { id: "fish-2", kind: "fish", count: 1, duration: 25, delay: 6, top: "50%", scale: 0.8 },
      { id: "fish-3", kind: "fish", count: 1, duration: 18, delay: 12, top: "70%", scale: 1.2 },
      { id: "bubble-1", kind: "bubble", count: 1, duration: 8, delay: 1, top: "100%", scale: 0.5 },
      { id: "bubble-2", kind: "bubble", count: 1, duration: 10, delay: 4, top: "100%", scale: 0.7 },
      { id: "bubble-3", kind: "bubble", count: 1, duration: 7, delay: 8, top: "100%", scale: 0.4 },
    ]
  }
};

interface ThemeState {
  themeId: WorldThemeId;
  setThemeId: (id: WorldThemeId) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      themeId: "land",
      setThemeId: (id) => set({ themeId: id }),
    }),
    { name: "world-theme-storage" }
  )
);
