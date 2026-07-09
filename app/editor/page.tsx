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
    // 抜け道防止：メインの「アドオン完成！」ボタンを押して解錠していないと書き出さない
    if (!state.exportArmed) return;
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
    color: "#00ddb5", // SPROUT×GROVE中間色（アクアマリン）
    icon: "🧩",
  },
  {
    key: "model",
    label: "モデル",
    color: "#3cd070",
    icon: "📦",
  },
  {
    key: "settings",
    label: "マイクラへ",
    color: "#3cd070",
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
        <span>カード: {blocksCount}</span>
        <span>グリッド: 16×16</span>
      </div>
      <div className="flex items-center gap-4">
        <span>Bedrock v1.21</span>
        <span>CUBICENGINE v2.0</span>
      </div>
    </div>
  );
}

function PhoneHint() {
  // 縦スマホ用UI（LogicPanel の isMobile: FAB「➕カードを追加」/プレビュー非表示/ズーム0.55）を
  // ヒマワリが実装済み。以前ここにあった「横向きにしてね」全画面オーバーレイは、その縦UIを覆って
  // 操作不能にしていたため撤去（衝突解消）。縦のまま操作させる方針。
  return null;
}

/* ─── Main Editor Page ─── */
export default function EditorPage() {
  const [activeTab, setActiveTab] = useState<Tab>("logic");
  const [logicView, setLogicView] = useState<"tsumiki" | "grape">("tsumiki");
  const [isElectron, setIsElectron] = useState<boolean | null>(null);

  // スタート画面の選択（?mode=tsumiki|grape）で初期モードを決める（Next固有APIを避け window から取得）
  useEffect(() => {
    const hasElectronApi = !!(window as any).electronAPI?.isElectron;
    setIsElectron(hasElectronApi);

    const mode = new URLSearchParams(window.location.search).get("mode");
    // GROVE(Java)解禁(2026-07-02)。?mode=grape で web GROVE エディタを開けるようにした。
    // プラットフォームもモード連動：grape=java / それ以外(tsumiki・無指定)=bedrock。
    // （SettingsPanel側の「常にbedrockへ戻す」旧処理はこれに一本化して撤去）
    useEditorStore.getState().setTargetPlatform(mode === "grape" ? "java" : "bedrock");
    if (mode === "grape" || mode === "tsumiki") {
      setLogicView(mode);
      setActiveTab("logic");
    }
  }, []);
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);
  const menuItems = useMenuItems();

  const handleMenuClick = useCallback(
    (key: MenuKey) => {
      setOpenMenu(openMenu === key ? null : key);
    },
    [openMenu]
  );

  const closeMenu = useCallback(() => setOpenMenu(null), []);

  // ハイブリッド配布: Web版(ブラウザ)でもエディタを利用可能にする（即試せる入口）。
  // 旧「デスクトップ専用」ブロックは撤去。isElectron はデスクトップ専用機能
  // (Java自動ビルド/Minecraft検出 等)の出し分けに今後使う。

  if (isElectron === null) {
    return (
      <div className="h-screen bg-[#0d0d0f] flex items-center justify-center text-muted font-pixel text-xs">
        LOADING...
      </div>
    );
  }


  return (
    <div className="h-screen flex flex-col overflow-hidden select-none">
      {/* スマホ来訪者への案内（タブレット/PC推奨・作品はスマホで遊べる。閉じられる） */}
      <PhoneHint />

      {/* ─ Menu Bar ─ */}
      <div className="h-9 bg-panel border-b border-border flex items-center px-2 gap-0.5 shrink-0 overflow-x-auto whitespace-nowrap scrollbar-hide">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center justify-center px-2 py-1 mr-4 group shrink-0"
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

        {/* ニセの窓ボタン(─□✕)は撤去：ブラウザで無意味＆"事務ソフトの顔"の元凶。
            初見の第一印象を「魔法の創作ツール」に寄せる（[[feedback_novelty_over_familiar]]）。 */}
      </div>

      {/* ─ Premium Modern Tab Bar ─ */}
      <div 
        className="h-12 flex items-center justify-start md:justify-center px-4 gap-2 shrink-0 relative z-10 overflow-x-auto whitespace-nowrap scrollbar-hide"
        style={{ 
          background: "linear-gradient(to bottom, #2d3436, #222f3e)",
          borderBottom: "2px solid rgba(255,255,255,0.1)",
          boxShadow: "0 4px 15px rgba(0,0,0,0.3)"
        }}
      >
        {tabConfig.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              id={`tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className="relative px-6 py-1.5 flex items-center gap-2 rounded-full transition-all duration-200 ease-out outline-none shrink-0"
              style={{
                background: isActive
                  ? `linear-gradient(180deg, ${lighten(tab.color)}, ${tab.color})`
                  : "transparent",
                color: isActive ? "#1a1a1a" : "rgba(255,255,255,0.55)",
                fontWeight: isActive ? 900 : 700,
                boxShadow: isActive
                  ? `0 2px 10px ${tab.color}77, inset 0 1px 0 rgba(255,255,255,0.55)`
                  : "none",
              }}
              onMouseEnter={e => {
                if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.08)";
              }}
              onMouseLeave={e => {
                if (!isActive) e.currentTarget.style.background = "transparent";
              }}
            >
              <span className="text-[16px]" style={{ filter: isActive ? "none" : "grayscale(0.6) opacity(0.7)" }}>{tab.icon}</span>
              <span className="text-[13px] tracking-wide" style={{ fontFamily: "'M PLUS Rounded 1c', sans-serif" }}>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ─ Tab Content ─ */}
      {/* display で切り替えて常にマウント維持 → state が消えない */}
      {/* 作り方はスタート画面で選択済み（?mode）。editor内の切替トグルは撤去。 */}
      <div className="flex-1 overflow-hidden relative" style={{ display: activeTab === "logic" ? "block" : "none" }}>
        <div style={{ position: "absolute", inset: 0, display: logicView === "tsumiki" ? "block" : "none" }}><LogicPanel onExportReady={() => setActiveTab("settings")} /></div>
        <div style={{ position: "absolute", inset: 0, display: logicView === "grape" ? "block" : "none" }}><GrapePanel /></div>
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
      <div className="hidden sm:block">
        <StatusBar />
      </div>
    </div>
  );
}
