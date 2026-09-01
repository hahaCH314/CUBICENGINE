"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEditorStore } from "./store";
import { exportProject, buildJavaFileList } from "./exporter";
import { McButton } from "../_mc";

// Electron 環境でのチャンクロード失敗を防ぐため静的インポートに変更
import LogicPanel  from "./LogicPanel";
import GrapePanel  from "./GrapePanel";
import LaunchPanel from "./LaunchPanel";
import { t } from "@/lib/i18n";

const ModelPanel   = dynamic(() => import("./ModelPanel"),   { ssr: false });  // Three.js は SSR 不可のため dynamic 維持

/* ─── Types ─── */
type Tab = "logic" | "model" | "developer" | "settings" | "launcher";
type MenuKey = "file" | "edit" | "view";

interface MenuItem {
  label: string;
  shortcut?: string;
  divider?: boolean;
  action?: () => void;
}

/* ─── Menu Definitions ─── */
function useMenuItems() {
    const locale = useEditorStore((s) => s.locale);
  const handleExport = useCallback(async () => {
    const state = useEditorStore.getState();
    // 抜け道防止：メインの「アドオン完成！」ボタンを押して解錠していないと書き出さない。
    // ただし Java(GROVE) は「放つ」が本番なのでゲート対象外（SettingsPanel と同じ扱い）。
    if (!state.exportArmed && state.targetPlatform !== "java") return;

    // デスクトップのJavaは、ソースZIPでなく本物ビルド→ .minecraft/mods へ .jar 導入。
    // 「放つ」/ ランチャー / 設定タブの「ビルド」は既にこの経路だが、このメニューだけ
    // 無条件に exportProject を呼んでZIPを落としていた＝取り残しを塞ぐ。
    const api = (window as any).electronAPI?.minecraft;
    if (state.targetPlatform === "java" && api) {
      try {
        const det = await api.detect();
        if (!det?.modsDir) {
          alert(t(locale, "editor_bc1ce8"));
          return;
        }
        const files = await buildJavaFileList(state, state.generatedJsCode || "");
        const res = await api.buildAndInstall({ files, modsDir: det.modsDir, projectName: state.projectName });
        alert(`✅ ${res.jarName} を mods に導入しました！\nForge 1.20.1 でマイクラを起動して確認してください。`);
      } catch (e: any) {
        alert(t(locale, "editor_8c12a3") + (e?.message || e) + t(locale, "editor_a563f2"));
      }
      return;
    }

    // ⚠️ 失敗を握りつぶさないこと。スマホには開発者ツールが無いので、
    //    黙って終わると利用者は「押したのに何も起きない」としか分からない
    try {
      await exportProject(state, state.generatedJsCode);
    } catch (err) {
      console.error("Failed to export project:", err);
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      alert(
        t(locale, "editor_6bf4c2") +
        msg +
        t(locale, "editor_59a5f9"),
      );
    }
  }, []);

  const menuItems: Record<MenuKey, MenuItem[]> = {
    file: [
      { label: t(locale, "editor_b6106f"), shortcut: "Ctrl+N" },
      { label: t(locale, "editor_353084"), shortcut: "Ctrl+O" },
      { label: "divider", divider: true },
      { label: t(locale, "editor_be5fbb"), shortcut: "Ctrl+S" },
      { label: t(locale, "editor_4c3141"), shortcut: "Ctrl+Shift+S" },
      { label: "divider", divider: true },
      { label: t(locale, "editor_be3cfd"), shortcut: "Ctrl+E", action: handleExport },
      { label: "divider", divider: true },
      { label: t(locale, "editor_029c0d"), shortcut: "Ctrl+," },
    ],
    edit: [
      { label: t(locale, "editor_db693a"), shortcut: "Ctrl+Z" },
      { label: t(locale, "editor_14d4eb"), shortcut: "Ctrl+Shift+Z" },
      { label: "divider", divider: true },
      { label: t(locale, "editor_b92202"), shortcut: "Ctrl+X" },
      { label: t(locale, "editor_9e646d"), shortcut: "Ctrl+C" },
      { label: t(locale, "editor_c272d4"), shortcut: "Ctrl+V" },
      { label: "divider", divider: true },
      { label: t(locale, "editor_ab0e66"), shortcut: "Ctrl+A" },
      { label: t(locale, "editor_404885") },
    ],
    view: [
      { label: t(locale, "editor_5d603f"), shortcut: "Ctrl+=" },
      { label: t(locale, "editor_0e1421"), shortcut: "Ctrl+-" },
      { label: "divider", divider: true },
      { label: t(locale, "editor_4af590") },
      { label: t(locale, "editor_14e5fe") },
      { label: "divider", divider: true },
      { label: t(locale, "editor_278138"), shortcut: "F11" },
    ],
  };
  return menuItems;
}

const menuLabels: Record<MenuKey, string> = {
  get file() { return t(useEditorStore.getState().locale, "editor_1abe2e"); },
  get edit() { return t(useEditorStore.getState().locale, "editor_757886"); },
  get view() { return t(useEditorStore.getState().locale, "editor_3d7dfb"); },
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
    get label() { return t(useEditorStore.getState().locale, "editor_92e35f"); },
    color: "#00ddb5", // SPROUT×GROVE中間色（アクアマリン）
    icon: "🧩",
  },
  {
    key: "model",
    get label() { return t(useEditorStore.getState().locale, "editor_17850b"); },
    color: "#3cd070",
    icon: "📦",
  },
  {
    // 上級者向け。既存のタブより後ろに置く。初めての人の導線（ロジック→モデル→マイクラへ）を
    // 割り込まないようにするため、「マイクラへ」の手前ではなく後ろに並べている
    key: "developer",
    get label() { return t(useEditorStore.getState().locale, "editor_6af213"); },
    color: "#a78bfa",
    icon: "🛠",
  },
  {
    key: "settings",
    get label() { return t(useEditorStore.getState().locale, "editor_17b3c8"); },
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

/* ─── Developer Panel ───
   File API と Web Worker を使うのでブラウザ限定。ssr:false で読み込む。
   dynamic にしておくと、デベロッパータブを開くまで読み込まれない＝初回表示が重くならない。 */
const DeveloperPanel = dynamic(() => import("./developer/DeveloperPanel"), { ssr: false });

/* ─── ログインボタン（右上） ─── */
function EditorAuthButton() {
  // ローカル/オフライン運営（アカウント機能なし・決定事項）: ログインUIは表示しない
  return null;
}

/* ─── Status Bar ─── */
function StatusBar() {
    const locale = useEditorStore((s) => s.locale);
  const blocksCount = useEditorStore((s) => s.blocks.length);
  return (
    <div className="h-7 bg-panel border-t-2 border-[#121210] flex items-center justify-between px-3 text-[10px] text-muted font-sans" style={{ textShadow: "1px 1px 0px #1e1208" }}>
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 bg-emerald-500 shadow-[0_0_4px_#10b981]" />
          {t(locale, "editor_46f58c")}</span>
        <span>{t(locale, "editor_08cb6e")}{blocksCount}</span>
        <span>{t(locale, "editor_8c7bb5")}</span>
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

  export default function EditorPage() {
    const locale = useEditorStore((s) => s.locale);
    const setLocale = useEditorStore((s) => s.setLocale);
  const [activeTab, setActiveTab] = useState<Tab>("logic");

  // 2026-08-23、Java の設計図に mobs を足した（spec 2）ので、
  // デベロッパータブは Java でも出す。中で「モブだけ使える」ように
  // 制限しているので、ここでタブごと隠す必要はなくなった。
  // ⚠️ アイテム・道具・防具・技はまだ Bedrock 専用。
  //    制限は DeveloperPanel 側にある（そちらのコメント参照）。

  // タブ列がはみ出しているか（スマホでは4つ並びきらない）。
  // 端の帯を出すかどうかの判定に使う。両端とも「その方向にまだ続くか」を持つ
  const tabBarRef = useRef<HTMLDivElement>(null);
  const [tabOverflow, setTabOverflow] = useState({ left: false, right: false });

  const handleTabScroll = useCallback(() => {
    const el = tabBarRef.current;
    if (!el) return;
    // 端ぴったりで帯が残ってチラつかないよう、1px の遊びを持たせる
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setTabOverflow(prev => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, []);

  // 初回と、画面の向きが変わったときに測り直す。
  // 横向きにすると収まって帯が要らなくなることがある。
  //
  // ⚠️ ResizeObserver では拾えない。あれが見るのは要素自身の大きさで、
  //    タブ列の幅は画面幅のまま変わらない。伸びるのは中身(scrollWidth)のほう。
  // ⚠️ マウント直後の1回だけでも足りない。Webフォント(var(--font-yusei))が
  //    届く前は文字幅が確定しておらず、あとからタブが広がって溢れる。
  //    → フォントの読み込み完了を待って測り直す。
  useEffect(() => {
    // 描画が一度済んでから測る。同じ回で測ると scrollWidth が確定していない
    const raf = requestAnimationFrame(handleTabScroll);
    window.addEventListener("resize", handleTabScroll);
    // ⚠️ Promise は途中で止められないので、外れたかどうかを自分で覚えておく。
    //    付けないと、画面を離れたあとにフォントが届いたとき、
    //    もう無い要素に対して測りにいく
    let alive = true;
    // document.fonts は Safari 含め主要ブラウザにある。念のため存在確認する
    document.fonts?.ready.then(() => { if (alive) handleTabScroll(); }).catch(() => {});
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleTabScroll);
    };
  }, [handleTabScroll]);

  // 選んだタブが画面外だと「押したのに見えない」状態になるので引き寄せる。
  // ⚠️ block: "nearest" が要る。既定の "center" は縦にもスクロールしてしまい、
  //    タブを押すたびにエディタ本体が上下に飛ぶ
  useEffect(() => {
    const el = document.getElementById(`tab-${activeTab}`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    // ⚠️ 滑らかスクロールが終わったあとにもう一度測る。onScroll でも更新されるが、
    //    最後の1フレームを取りこぼすと端の帯（‹ ›）が出たままになる
    const t = setTimeout(handleTabScroll, 500);
    return () => clearTimeout(t);
  }, [activeTab, handleTabScroll]);
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
    // h-dvh（100dvh）を使う。h-screen(100vh) はスマホのブラウザだとアドレスバー等を
    // 含んだ高さになるため、器が実際の表示領域より縦に長くなり、下端に固定している
    // キーボードやボタンが画面外へ押し出されて切れる。dvh は実際に見えている高さ。
    <div className="h-dvh flex flex-col overflow-hidden select-none">
      {/* スマホ来訪者への案内（タブレット/PC推奨・作品はスマホで遊べる。閉じられる） */}
      <PhoneHint />

      {/* ─ Menu Bar ─ */}
      <div className="h-9 bg-panel border-b border-border flex items-center px-2 gap-0.5 shrink-0 overflow-x-auto whitespace-nowrap scrollbar-hide">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center justify-center px-2 py-1 mr-4 group shrink-0"
          title={t(locale, "editor_e48a5b")}
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

        {/* 言語切替ボタン */}
        <button
          onClick={() => setLocale(locale === "ja" ? "en" : "ja")}
          className="px-2 py-1 text-[10px] sm:text-xs font-pixel text-foreground/75 hover:bg-surface hover:text-foreground transition-colors shrink-0"
          title={locale === "ja" ? "Switch to English" : "日本語に切り替え"}
        >
          {locale === "ja" ? "EN" : "JP"}
        </button>

        {/* ログインボタン（右上） */}
        <EditorAuthButton />

        {/* ニセの窓ボタン(─□✕)は撤去：ブラウザで無意味＆"事務ソフトの顔"の元凶。
            初見の第一印象を「魔法の創作ツール」に寄せる（[[feedback_novelty_over_familiar]]）。 */}
      </div>

      {/* ─ Premium Modern Tab Bar ─ */}
      {/* スマホでは4つのタブが横に並びきらない（412px幅に対して中身は約600px）。
          横スクロールはできるが、**できることに気づけない**のが問題だった。
          一番右の「マイクラへ」は作ったアドオンを書き出すボタンなので、
          見つからないと作業が完結しない。
          → 右端にグラデーションを重ねて「まだ続く」ことを見せる。
            スクロールしきったら消えるので、端末が広いときは何も出ない。 */}
      <div className="relative shrink-0">
      <div
        ref={tabBarRef}
        onScroll={handleTabScroll}
        className="h-12 flex items-center justify-start md:justify-center px-4 gap-2 relative z-10 overflow-x-auto whitespace-nowrap scrollbar-hide"
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
              // スマホでは px-6 だと4つで約600px になり画面(412px)に入らない。
              // 狭いときだけ詰める。広い画面は今までどおりゆったり見せる
              className="relative px-3 sm:px-6 py-1.5 flex items-center gap-1.5 sm:gap-2 rounded-full transition-all duration-200 ease-out outline-none shrink-0"
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
              <span className="text-[13px] tracking-wide" style={{ fontFamily: "var(--font-yusei), sans-serif" }}>{tab.label}</span>
            </button>
          );
        })}
      </div>

        {/* 「まだ右に続く」ことを示す帯。押せてしまうと混乱するので pointer-events は切る。
            タブ列と同じ色から透明へ向かわせ、タブが霧に溶けるように見せる */}
        {tabOverflow.right && (
          <div
            className="absolute top-0 right-0 h-12 w-14 z-20 pointer-events-none flex items-center justify-end pr-1"
            style={{ background: "linear-gradient(to right, rgba(34,47,62,0), #222f3e 65%)" }}
          >
            <span className="text-white/45 text-lg leading-none select-none">›</span>
          </div>
        )}
        {/* 左も同じ。右端まで送ったあと、左に戻れることを示す */}
        {tabOverflow.left && (
          <div
            className="absolute top-0 left-0 h-12 w-14 z-20 pointer-events-none flex items-center justify-start pl-1"
            style={{ background: "linear-gradient(to left, rgba(45,52,54,0), #2d3436 65%)" }}
          >
            <span className="text-white/45 text-lg leading-none select-none">‹</span>
          </div>
        )}
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
      {/* 開いたときだけマウントする。モデル取り込みは状態を持たないので、
          他のタブと違って常時マウントしておく必要がない */}
      {activeTab === "developer" && (
        <div className="flex-1 overflow-hidden relative">
          <DeveloperPanel />
        </div>
      )}

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
