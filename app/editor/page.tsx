"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEditorStore } from "./store";
import { exportProject } from "./exporter";
import { McButton } from "../_mc";

// Electron 環境でのチャンクロード失敗を防ぐため静的インポートに変更
import LogicPanel  from "./LogicPanel";
import GrapePanel  from "./GrapePanel";
import LaunchPanel from "./LaunchPanel";
const ModelPanel   = dynamic(() => import("./ModelPanel"),   { ssr: false });  // Three.js は SSR 不可のため dynamic 維持

/* ─── Types ─── */
type Tab = "logic" | "model" | "settings" | "launcher";
type MenuKey = "file" | "edit" | "view";

interface MenuItem {
  label: string;
  shortcut?: string;
  divider?: boolean;
  action?: () => void;
}

/* ─── Menu Definitions ─── */
function useMenuItems() {
  const handleExport = useCallback(async () => {
    const state = useEditorStore.getState();
    await exportProject(state, state.generatedJsCode);
  }, []);

  const menuItems: Record<MenuKey, MenuItem[]> = {
    file: [
      { label: "新規プロジェクト", shortcut: "Ctrl+N" },
      { label: "開く...", shortcut: "Ctrl+O" },
      { label: "divider", divider: true },
      { label: "保存", shortcut: "Ctrl+S" },
      { label: "名前を付けて保存...", shortcut: "Ctrl+Shift+S" },
      { label: "divider", divider: true },
      { label: "エクスポート", shortcut: "Ctrl+E", action: handleExport },
      { label: "divider", divider: true },
      { label: "設定", shortcut: "Ctrl+," },
    ],
    edit: [
      { label: "元に戻す", shortcut: "Ctrl+Z" },
      { label: "やり直し", shortcut: "Ctrl+Shift+Z" },
      { label: "divider", divider: true },
      { label: "切り取り", shortcut: "Ctrl+X" },
      { label: "コピー", shortcut: "Ctrl+C" },
      { label: "貼り付け", shortcut: "Ctrl+V" },
      { label: "divider", divider: true },
      { label: "すべて選択", shortcut: "Ctrl+A" },
      { label: "選択解除" },
    ],
    view: [
      { label: "ズームイン", shortcut: "Ctrl+=" },
      { label: "ズームアウト", shortcut: "Ctrl+-" },
      { label: "divider", divider: true },
      { label: "グリッド表示切替" },
      { label: "ワイヤーフレーム表示" },
      { label: "divider", divider: true },
      { label: "フルスクリーン", shortcut: "F11" },
    ],
  };
  return menuItems;
}

const menuLabels: Record<MenuKey, string> = {
  file: "ファイル",
  edit: "編集",
  view: "表示",
};

/* HEX 色を相対的に明るく/暗くする小ヘルパー（タブのベベル色生成用） */
function shiftHex(hex: string, delta: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 0xff) + delta));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + delta));
  const b = Math.max(0, Math.min(255, (n & 0xff) + delta));
  return `#${[r, g, b].map(v => v.toString(16).padStart(2, "0")).join("")}`;
}
const lighten = (hex: string) => shiftHex(hex, 50);
const darken  = (hex: string) => shiftHex(hex, -60);

/* ─── Tab Config ─── */
const tabConfig: { key: Tab; label: string; color: string; icon: string }[] = [
  {
    key: "logic",
    label: "ロジック",
    color: "#fb7185", // ヒーリング・ポーションピンク
    icon: "🧩",
  },
  {
    key: "model",
    label: "モデル",
    color: "#fb7185",
    icon: "📦",
  },
  {
    key: "settings",
    label: "設定",
    color: "#fb7185",
    icon: "⚙️",
  },
  {
    key: "launcher",
    label: "起動",
    color: "#fb7185",
    icon: "🚀",
  },
];

/* ─── Dropdown Component ─── */
function MenuDropdown({
  items,
  onClose,
}: {
  items: MenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-0.5 min-w-[220px] py-1.5 mc-panel z-50"
      style={{ background: "var(--surface)" }}
    >
      {items.map((item, i) =>
        item.divider ? (
          <div key={i} className="my-1.5 mx-2 h-0.5 bg-border" />
        ) : (
          <button
            key={i}
            onClick={() => {
              item.action?.();
              onClose();
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-foreground/85 hover:bg-black/40 hover:text-white transition-colors"
          >
            <span className="font-pixel text-[10px] tracking-wide">{item.label}</span>
            {item.shortcut && (
              <span className="text-[9px] text-muted font-mono ml-6">
                {item.shortcut}
              </span>
            )}
          </button>
        )
      )}
    </div>
  );
}

/* ─── Logic Panel: imported from LogicPanel.tsx via dynamic import ─── */

/* ─── Model Panel: imported from ModelPanel.tsx via dynamic import ─── */

/* ─── Settings Panel ─── */
const SettingsPanel = dynamic(() => import("./SettingsPanel"), { ssr: false });

/* ─── ログインボタン（右上） ─── */
function EditorAuthButton() {
  // ローカル/オフライン運営（アカウント機能なし・決定事項）: ログインUIは表示しない
  return null;
}

/* ─── Status Bar ─── */
function StatusBar() {
  const blocksCount = useEditorStore((s) => s.blocks.length);
  return (
    <div className="h-7 bg-panel border-t-2 border-[#121210] flex items-center justify-between px-3 text-[10px] text-muted font-sans" style={{ textShadow: "1px 1px 0px #1e1208" }}>
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-emerald-500 shadow-[0_0_4px_#10b981]" />
          準備完了
        </span>
        <span>ブロック: {blocksCount}</span>
        <span>グリッド: 16×16</span>
      </div>
      <div className="flex items-center gap-4">
        <span>Bedrock v1.21</span>
        <span>CUBICENGINE v2.0</span>
      </div>
    </div>
  );
}

/* ─── Main Editor Page ─── */
export default function EditorPage() {
  const [activeTab, setActiveTab] = useState<Tab>("logic");
  const [logicView, setLogicView] = useState<"tsumiki" | "grape">("tsumiki");
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);
  const menuItems = useMenuItems();

  const handleMenuClick = useCallback(
    (key: MenuKey) => {
      setOpenMenu(openMenu === key ? null : key);
    },
    [openMenu]
  );

  const closeMenu = useCallback(() => setOpenMenu(null), []);

  return (
    <div className="h-screen flex flex-col overflow-hidden select-none">
      {/* ─ Menu Bar ─ */}
      <div className="h-9 bg-panel border-b border-border flex items-center px-2 gap-0.5 shrink-0">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center justify-center px-2 py-1 mr-4 group"
          title="ホームへ戻る"
        >
          {/* 強めのピクセル文字（マイクラ風のアウトラインと影付き・サイズ調整版） */}
          <span className="font-pixel relative transition-transform duration-150 group-hover:scale-110 group-active:scale-95" style={{
            fontSize: 14,
            color: "#ffffff",
            textShadow: "1.5px 1.5px 0 #3a3a3a, -1.5px -1.5px 0 #3a3a3a, 1.5px -1.5px 0 #3a3a3a, -1.5px 1.5px 0 #3a3a3a, 0 3px 0 #1a1a1a",
            letterSpacing: "1px",
            lineHeight: 1
          }}>
            CE
          </span>
        </Link>

        {/* Menu Items */}
        {(Object.keys(menuItems) as MenuKey[]).map((key) => (
          <div key={key} className="relative">
            <button
              id={`menu-${key}`}
              onClick={() => handleMenuClick(key)}
              onMouseEnter={() => openMenu && setOpenMenu(key)}
              className={`px-3 py-1 rounded-none text-xs transition-colors font-pixel text-[10px] ${
                openMenu === key
                  ? "bg-black/40 text-accent border border-border"
                  : "text-foreground/75 hover:bg-surface hover:text-foreground"
              }`}
            >
              {menuLabels[key]}
            </button>
            {openMenu === key && (
              <MenuDropdown items={menuItems[key]} onClose={closeMenu} />
            )}
          </div>
        ))}

        {/* Spacer */}
        <div className="flex-1" />

        {/* ログインボタン（右上） */}
        <EditorAuthButton />

        {/* Window controls placeholder */}
        <div className="flex items-center gap-0.5">
          <button className="w-7 h-7 rounded-none flex items-center justify-center text-muted hover:text-foreground hover:bg-surface transition-colors text-xs border border-transparent hover:border-border">
            ─
          </button>
          <button className="w-7 h-7 rounded-none flex items-center justify-center text-muted hover:text-foreground hover:bg-surface transition-colors text-xs border border-transparent hover:border-border">
            □
          </button>
          <button className="w-7 h-7 rounded-none flex items-center justify-center text-muted hover:text-white hover:bg-rose-600 transition-colors text-xs border border-transparent hover:border-border">
            ✕
          </button>
        </div>
      </div>

      {/* ─ Tab Bar （マイクラ・インベントリ風タブ） ─ */}
      <div className="h-10 bg-surface border-b-2 border-border flex items-end px-2 gap-1 shrink-0">
        {tabConfig.map((tab) => {
          const isActive = activeTab === tab.key;
          // タブごとの色をボタン CSS 変数として注入（押下時/通常時で同じカラー）
          const tabStyle = {
            "--mc-btn-bg": isActive ? tab.color : "#3a3833", // 非アクティブ時は暗い石色
            "--mc-btn-edge": isActive ? lighten(tab.color) : "#5a574e",
            "--mc-btn-shadow": isActive ? darken(tab.color) : "#1f1e1a",
            "--mc-btn-text": isActive ? "#ffffff" : "#9c9890",
          } as React.CSSProperties;
          return (
            <McButton
              key={tab.key}
              id={`tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              active={isActive}
              style={tabStyle}
            >
              <span className="flex items-center gap-1.5">
                <span className="text-[14px] leading-none">{tab.icon}</span>
                <span>{tab.label}</span>
              </span>
            </McButton>
          );
        })}
      </div>

      {/* ─ Tab Content ─ */}
      {/* display で切り替えて常にマウント維持 → state が消えない */}
      <div className="flex-1 overflow-hidden relative flex flex-col" style={{ display: activeTab === "logic" ? "flex" : "none" }}>
        {/* 作り方の切替：積み木(従来) / 🍇ハブ(新・実験) */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "6px 10px", background: "#1b1a17", borderBottom: "1px solid #2a2924", flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#8a857a" }}>作り方:</span>
          <button type="button" onClick={() => setLogicView("tsumiki")}
            style={{ fontSize: 12, fontWeight: 800, padding: "4px 12px", borderRadius: 8, cursor: "pointer", border: "none",
              background: logicView === "tsumiki" ? "#facc15" : "#2a2924", color: logicView === "tsumiki" ? "#3a2c05" : "#a59c8a" }}>
            🧱 積み木
          </button>
          <button type="button" onClick={() => setLogicView("grape")}
            style={{ fontSize: 12, fontWeight: 800, padding: "4px 12px", borderRadius: 8, cursor: "pointer", border: "none",
              background: logicView === "grape" ? "#5fe0b8" : "#2a2924", color: logicView === "grape" ? "#0a3a2c" : "#a59c8a" }}>
            🍇 ハブ（新）
          </button>
        </div>
        <div className="flex-1 relative overflow-hidden">
          <div style={{ position: "absolute", inset: 0, display: logicView === "tsumiki" ? "block" : "none" }}><LogicPanel /></div>
          <div style={{ position: "absolute", inset: 0, display: logicView === "grape" ? "block" : "none" }}><GrapePanel /></div>
        </div>
      </div>
      <div className="flex-1 overflow-hidden relative" style={{ display: activeTab === "model" ? "block" : "none" }}>
        <ModelPanel />
      </div>
      <div className="flex-1 overflow-hidden relative" style={{ display: activeTab === "settings" ? "block" : "none" }}>
        <SettingsPanel />
      </div>
      {/* ランチャーはタブ選択時のみマウント（エディターページへの干渉を防ぐ） */}
      {activeTab === "launcher" && (
        <div className="flex-1 overflow-hidden" style={{ display: "flex", flexDirection: "column" }}>
          <LaunchPanel />
        </div>
      )}

      {/* ─ Status Bar ─ */}
      <StatusBar />
    </div>
  );
}
