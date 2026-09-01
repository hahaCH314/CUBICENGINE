"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useEditorStore } from "./store";
import { JAVA_TARGET_LIST, getJavaTarget } from "../../lib/javaEngine/targets";
import { exportProject, buildJavaFileList } from "./exporter";
import { t } from "@/lib/i18n";

/* ═══════════════════════════════════════════
   Toggle Switch
   ═══════════════════════════════════════════ */
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!value)}
      className={`w-10 h-5 rounded-full cursor-pointer transition-colors relative ${value ? "bg-accent" : "bg-surface-active"}`}
    >
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`} />
    </div>
  );
}

/* ═══════════════════════════════════════════
   フィールド行（ラベル＋コントロール）
   ═══════════════════════════════════════════ */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <label className="text-xs text-foreground/70 whitespace-nowrap">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "px-2.5 py-1 rounded-md bg-surface border border-border text-xs font-mono text-foreground/80 focus:outline-none focus:border-accent/60 min-w-0";

/* ═══════════════════════════════════════════
   ビルド・ターミナル付き エクスポートボタン
   （"プログラマーになった気持ち" の核）
   ═══════════════════════════════════════════ */
function BuildTerminal() {
    const locale = useEditorStore((s) => s.locale);
  const [building, setBuilding] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [exportedPlatform, setExportedPlatform] = useState<"bedrock" | "java">("bedrock");
  const [exportShared, setExportShared] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const projectName = useEditorStore((s) => s.projectName);
  const blocks = useEditorStore((s) => s.blocks);
  const exportArmed = useEditorStore((s) => s.exportArmed); // メインEXPORTボタンを押して初めて解錠
  const targetPlatform = useEditorStore((s) => s.targetPlatform);
  // Java(GROVE)は「アドオン完成」ボタンが無く「マイクラへ放つ」が本番なので、exportArmedゲートを外す。
  const armed = exportArmed || targetPlatform === "java";

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const push = (line: string) => setLog((l) => [...l, line]);
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const handleBuild = useCallback(async () => {
    if (building) return;
    // 抜け道防止：Bedrockはメインの「アドオン完成！」で解錠必須。Java(GROVE)は「放つ」が本番なので不要。
    if (!useEditorStore.getState().exportArmed && useEditorStore.getState().targetPlatform !== "java") {
      setLog([t(locale, "editor_022e20")]);
      return;
    }
    setBuilding(true);
    setError(null);
    setLog([]);
    setExportShared(false);
    try {
      const state = useEditorStore.getState();
      const plat = state.targetPlatform as "bedrock" | "java";
      const isElec = typeof window !== "undefined" && !!(window as any).electronAPI?.isElectron;
      push(`# ターゲット: ${plat === "java" ? "Java / Forge 1.20.1" : t(locale, "editor_844896")} ${isElec ? t(locale, "editor_992f33") : "(Web)"}`);

      // デスクトップのJavaは、ソースZIPでなく本物ビルド→.minecraft/mods へ.jar導入（「放つ」と同じ）。
      if (plat === "java" && isElec) {
        const api = (window as any).electronAPI.minecraft;
        push(t(locale, "editor_4bc914"));
        const det = await api.detect();
        if (!det?.modsDir) throw new Error(t(locale, "editor_c2d0e7"));
        const files = await buildJavaFileList(state as any, state.generatedJsCode || "");
        api.onBuildLog?.((m: string) => push(m));
        const res = await api.buildAndInstall({ files, modsDir: det.modsDir, projectName: state.projectName });
        api.offBuildLog?.();
        push("");
        push(`✅ ${res.jarName} を mods に導入しました！Forge 1.20.1 で起動して確認してね。`);
        setExportedPlatform("java");
        setShowGuide(false);
        return;
      }

      push("$ cubicengine build --release");
      await wait(220);
      push(t(locale, "editor_a837e0"));
      await wait(260);
      push("  ✓ manifest.json");
      push(`  ▸ scripts/main.js を書き出し (${state.blocks.length} blocks) …`);
      await wait(300);
      push("  ✓ scripts/main.js");
      push(plat === "bedrock" ? t(locale, "editor_e9aefa") : t(locale, "editor_4e6e24"));
      await wait(280);
      push(plat === "bedrock" ? "  ✓ resource pack" : "  ✓ src/main/java");
      push(t(locale, "editor_c4da08"));
      // 実エクスポート
      const shared = await exportProject(state, state.generatedJsCode);
      await wait(180);
      push(t(locale, "editor_90afc2"));
      push("");
      push(shared ? t(locale, "editor_0bcb79") : t(locale, "editor_d7d013"));
      setExportedPlatform(plat);
      setExportShared(shared);
      setShowGuide(true);
    } catch (e: any) {
      push("");
      push(`✗ BUILD FAILED: ${e?.message || "unknown error"}`);
      setError(e?.message || "Export failed");
    } finally {
      setBuilding(false);
    }
  }, [building]);

  return (
    <div className="flex flex-col gap-2 min-h-0 h-full">
      {/* ターミナル風ログ */}
      <div
        ref={logRef}
        className="flex-1 min-h-[88px] rounded-lg bg-[#0c0d10] border border-border overflow-y-auto p-2.5 font-mono text-[11px] leading-relaxed"
        style={{ boxShadow: "inset 0 2px 10px rgba(0,0,0,0.5)" }}
      >
        {log.length === 0 ? (
          <div className="text-muted/40">
            <span className="text-emerald-400/60">●</span> {t(locale, "editor_ff1b87")}</div>
        ) : (
          log.map((line, i) => (
            <div
              key={i}
              className={
                line.startsWith("✅")
                  ? "text-emerald-400 font-bold"
                  : line.startsWith("✗")
                  ? "text-rose-400 font-bold"
                  : line.startsWith("  ✓")
                  ? "text-emerald-300/90"
                  : line.startsWith("$")
                  ? "text-cyan-300"
                  : "text-foreground/60"
              }
            >
              {line || " "}
            </div>
          ))
        )}
      </div>

      {/* 規約同意チェック（セキュリティ・著作権の誓約） */}
      <label className="flex items-start gap-2 p-2 bg-rose-500/10 border border-rose-500/20 rounded-md cursor-pointer mt-2">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 flex-shrink-0"
        />
        <div className="min-w-0 break-words text-[11px] text-foreground/80 leading-relaxed">
          <strong className="text-rose-400">{t(locale, "editor_85be83")}</strong> {t(locale, "editor_302134")}</div>
      </label>

      {/* ビルドボタン */}
      <button
        id="export-btn"
        onClick={handleBuild}
        disabled={building || !armed || !agreed}
        title={!armed ? t(locale, "editor_b68505") : !agreed ? t(locale, "editor_e3d365") : undefined}
        className={`mc-btn ${building || !armed || !agreed ? "" : "mc-btn--primary"} w-full py-3`}
        style={{ fontSize: 13, borderRadius: 16, opacity: !building && !armed ? 0.6 : !agreed ? 0.8 : 1 }}
      >
        {building ? (
          <>
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {t(locale, "editor_77c296")}</>
        ) : !armed ? (
          <>{t(locale, "editor_c07de9")}</>
        ) : !agreed ? (
          <>{t(locale, "editor_cd6fce")}</>
        ) : (
          <>{t(locale, "editor_1c3c36")}</>
        )}
      </button>
      {error && (
        <div className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-400">⚠ {error}</div>
      )}

      {/* 導入ガイド モーダル */}
      {showGuide && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(60,50,30,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "var(--panel)", border: "2px solid var(--accent)", borderRadius: 16, padding: 24, maxWidth: 480, width: "100%", color: "var(--foreground)", position: "relative" }}>
            <button onClick={() => setShowGuide(false)} style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", color: "var(--muted)", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>✕</button>
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 16 }}>{exportShared ? t(locale, "editor_bc7c2e") : t(locale, "editor_3c3fa5")}</div>
            {exportedPlatform === "bedrock" ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--accent)", marginBottom: 10 }}>{t(locale, "editor_1ed1f1")}</div>
                <ol style={{ fontSize: 13, lineHeight: 2, paddingLeft: 20 }}>
                  {exportShared ? (
                    <>
                      <li>{t(locale, "editor_2ac253")}<strong>Minecraft</strong> {t(locale, "editor_1edaa5")}</li>
                      <li>{t(locale, "editor_78acbe")}</li>
                    </>
                  ) : (
                    <>
                      <li>{t(locale, "editor_736d6d")}<strong>.mcaddon</strong> {t(locale, "editor_556dcf")}</li>
                      <li>{t(locale, "editor_78acbe")}</li>
                    </>
                  )}
                  <li>{t(locale, "editor_6bb3ff")}</li>
                  <li>{t(locale, "editor_3c22c8")}<strong>{t(locale, "editor_38426c")}</strong>）</li>
                  <li>{t(locale, "editor_2a9102")}<strong style={{ color: "#15803d" }}>{t(locale, "editor_52c38c")}</strong> {t(locale, "editor_4eda40")}</li>
                </ol>
                <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(220,80,80,0.12)", borderRadius: 8, fontSize: 12, color: "#a83232" }}>
                  {t(locale, "editor_7fbd21")}<strong>{t(locale, "editor_f15e7b")}</strong>{t(locale, "editor_6c41e5")}</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#b8860b", marginBottom: 10 }}>{t(locale, "editor_fc4f5b")}</div>
                <ol style={{ fontSize: 13, lineHeight: 2, paddingLeft: 20 }}>
                  <li>{t(locale, "editor_877064")}</li>
                  <li>{t(locale, "editor_4a43d7")}<strong>files.minecraftforge.net</strong></li>
                  <li>{t(locale, "editor_38c95c")}<code style={{ background: "var(--surface-active)", padding: "1px 6px", borderRadius: 4 }}>gradle build</code></li>
                  <li><code>build/libs/</code> {t(locale, "editor_359ebe")}<strong>.jar</strong> {t(locale, "editor_96ac23")}<code>.minecraft/mods/</code> {t(locale, "editor_40346e")}</li>
                  <li>{t(locale, "editor_c8a535")}</li>
                </ol>
                <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(218,165,32,0.15)", borderRadius: 8, fontSize: 12, color: "#8a6914" }}>
                  {t(locale, "editor_35c529")}<strong>{t(locale, "editor_e152af")}</strong>{t(locale, "punct.period")}
                </div>
              </>
            )}
             <button onClick={() => setShowGuide(false)} className="mc-btn mc-btn--primary w-full" style={{ marginTop: 16 }}>
               {t(locale, "editor_f67ad6")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   ライブ・ファイルツリー（生きてる計器盤）
   ═══════════════════════════════════════════ */
function LiveTree() {
  const projectName = useEditorStore((s) => s.projectName);
  const targetPlatform = useEditorStore((s) => s.targetPlatform);
  const blocks = useEditorStore((s) => s.blocks);
  const slug = projectName.replace(/\s+/g, "_").toLowerCase();

  // 変更でフッと光らせる
  const [flash, setFlash] = useState(false);
  const sig = `${slug}|${targetPlatform}|${blocks.length}`;
  useEffect(() => {
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 450);
    return () => clearTimeout(t);
  }, [sig]);

  return (
    <div
      className="flex-1 min-h-0 rounded-lg bg-surface/40 border border-border p-2.5 font-mono text-[11px] overflow-y-auto transition-shadow duration-300"
      style={{ boxShadow: flash ? "inset 0 0 0 1px var(--accent), 0 0 10px rgba(124,92,255,0.25)" : "none" }}
    >
      <div className="text-foreground/70 font-bold mb-1.5">
        📦 {slug}{targetPlatform === "bedrock" ? ".mcaddon" : "-forge.zip"}
      </div>
      {targetPlatform === "bedrock" ? (
        <div className="space-y-0.5 pl-1.5">
          <div className="text-emerald-400/70">📂 {slug}_BP/</div>
          <div className="pl-3 text-muted">├─ manifest.json</div>
          <div className="pl-3 text-muted">├─ scripts/main.js</div>
          <div className="pl-3 text-muted">└─ pack_icon.png</div>
          <div className="text-cyan-400/70 mt-1">📂 {slug}_RP/</div>
          <div className="pl-3 text-muted">├─ blocks.json</div>
          {blocks.slice(0, 6).map((b) => (
            <div key={b.id} className="pl-3 text-muted">└─ textures/blocks/{b.name}.png</div>
          ))}
          {blocks.length > 6 && <div className="pl-3 text-muted/50">… +{blocks.length - 6}</div>}
        </div>
      ) : (
        <div className="space-y-0.5 pl-1.5 text-muted">
          <div>├─ build.gradle</div>
          <div className="text-amber-400/70">📂 src/main/java/com/cubicengine/{slug.replace(/[^a-z0-9_]/g, "")}/</div>
          <div className="pl-3">├─ ModBlocks.java</div>
          <div className="pl-3">└─ ModEventHandler.java</div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   設定パネル（開発コックピット）
   ═══════════════════════════════════════════ */
export default function SettingsPanel() {
    const locale = useEditorStore((s) => s.locale);
  const projectName = useEditorStore((s) => s.projectName);
  const setProjectName = useEditorStore((s) => s.setProjectName);
  const projectDescription = useEditorStore((s) => s.projectDescription);
  const setProjectDescription = useEditorStore((s) => s.setProjectDescription);
  const targetPlatform = useEditorStore((s) => s.targetPlatform);
  const javaTarget = useEditorStore((s) => s.javaTarget);
  const setJavaTarget = useEditorStore((s) => s.setJavaTarget);
  const exportFormat = useEditorStore((s) => s.exportFormat);
  const setExportFormat = useEditorStore((s) => s.setExportFormat);
  const compress = useEditorStore((s) => s.compress);
  const setCompress = useEditorStore((s) => s.setCompress);
  const betaApi = useEditorStore((s) => s.betaApi);
  const setBetaApi = useEditorStore((s) => s.setBetaApi);
  const mcVersion = useEditorStore((s) => s.mcVersion);
  const setMcVersion = useEditorStore((s) => s.setMcVersion);
  const blocks = useEditorStore((s) => s.blocks);
  const generatedJsCode = useEditorStore((s) => s.generatedJsCode);
  const packIconDataUrl = useEditorStore((s) => s.packIconDataUrl);
  const setPackIconDataUrl = useEditorStore((s) => s.setPackIconDataUrl);

  const [autoSave, setAutoSave] = useState(true);
  const [gridSnap, setGridSnap] = useState(true);
  const [autoUuid, setAutoUuid] = useState(true);

  // エディターテーマ（CSS変数を data-theme で切替・localStorage記憶）
  const [theme, setTheme] = useState("dark");
  useEffect(() => {
    const t = localStorage.getItem("mmc-theme") || "dark";
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
  }, []);
  const applyTheme = (t: string) => {
    setTheme(t);
    localStorage.setItem("mmc-theme", t);
    document.documentElement.setAttribute("data-theme", t);
  };

  // かんたん/プロ は手動トグル廃止→プラットフォームで自動決定：
  // SPROUT(統合版/Bedrock)=かんたん / GROVE(Java版)=プロ。
  const pro = targetPlatform === "java";

  const slug = projectName.replace(/\s+/g, "_").toLowerCase().replace(/[^a-z0-9_]/g, "") || "my_addon";

  const handleIconFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      if (url) setPackIconDataUrl(url);
    };
    reader.readAsDataURL(file);
  }, [setPackIconDataUrl]);

  return (
    <div className="h-full overflow-y-auto p-4 flex flex-col gap-3 select-none">
      {/* ── ヘッダー：タイトル＋モード切替 ── */}
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-sm font-bold text-foreground/90 flex items-center gap-2">
          <span className="text-accent">🚀</span> {t(locale, "editor_17b3c8")}<span className="text-muted/50 text-xs font-mono">{t(locale, "editor_fdf19b")}</span>
        </h2>
        {/* モード切替（プロ）は廃止＝常にかんたん */}
      </div>

      {/* ── 本体グリッド（スクロールなし・1画面） ── */}
      <div className={`grid gap-3 ${pro ? "flex-1 min-h-0 grid-cols-1 lg:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto w-full content-start"}`}>

        {/* ▌ 左：アイデンティティ（アイコン＋なまえ） */}
        <div className="flex flex-col gap-3 min-h-0">
          <div className="bg-panel rounded-xl border border-border p-3">
            <div className="text-[10px] font-bold text-accent uppercase tracking-wider mb-2">{t(locale, "editor_0baad1")}</div>
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                {packIconDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={packIconDataUrl} alt="icon" className="w-16 h-16 rounded-xl object-cover border border-border" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-surface border border-border flex flex-col items-center justify-center gap-1">
                    <svg className="w-7 h-7 text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                <label className="cursor-pointer">
                  <div className="mc-btn mc-btn--sm mc-btn--info text-center w-full">{t(locale, "editor_22503a")}</div>
                  <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={handleIconFile} />
                </label>
                {packIconDataUrl && (
                  <button onClick={() => setPackIconDataUrl("")} className="mc-btn mc-btn--sm mc-btn--danger w-full">{t(locale, "editor_a7ecda")}</button>
                )}
                <p className="text-[9px] text-muted/50 leading-tight">{t(locale, "editor_351719")}</p>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-border/60">
              <Row label={t(locale, "editor_d8a5aa")}>
                <input value={projectName} onChange={(e) => setProjectName(e.target.value)} className={`${inputCls} w-40`} />
              </Row>
              {pro && (
                <Row label={t(locale, "editor_d59c76")}>
                  <input value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} className={`${inputCls} w-40`} />
                </Row>
              )}
            </div>
          </div>

          {/* エディター設定（プロのみ） */}
          {pro && (
            <div className="bg-panel rounded-xl border border-border p-3">
              <div className="text-[10px] font-bold text-accent uppercase tracking-wider mb-1">{t(locale, "editor_fa5b46")}</div>
              <Row label={t(locale, "editor_c459fa")}><Toggle value={autoSave} onChange={setAutoSave} /></Row>
              <Row label={t(locale, "editor_e81545")}><Toggle value={gridSnap} onChange={setGridSnap} /></Row>
              <Row label={t(locale, "editor_724a86")}>
                <select value={theme} onChange={(e) => applyTheme(e.target.value)} title={t(locale, "editor_b3aaac")} className={inputCls}>
                  <option value="dark">{t(locale, "editor_cf0d13")}</option>
                  <option value="midnight">{t(locale, "editor_de6aac")}</option>
                  <option value="abyss">{t(locale, "editor_e55220")}</option>
                </select>
              </Row>
            </div>
          )}

          {/* コミュニティ・リンク */}
          <div className="bg-panel rounded-xl border border-border p-3">
            <div className="text-[10px] font-bold text-accent uppercase tracking-wider mb-2">{t(locale, "editor_f27aa4")}</div>
            {/* ⚠️ **Discord は外した**（2026-08-17、伊波さん「ここはもう会社のだから
                切り離して欲しい」）。誰もいないサーバーに招くと逆効果で、
                「13歳以上」の注意書きもそのために要っていたもの。
                会社HP が唯一のハブなので、そこへ送る */}
            <a
              href="https://cubicenginestudio.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg bg-[#22d3ee] hover:bg-[#06b6d4] active:bg-[#0891b2] text-[#0b0b09] font-bold text-xs transition-colors"
              style={{ boxShadow: "0 2px 4px rgba(34,211,238,0.2)" }}
            >
              🏠 CUBICENGINEstudio
            </a>
            <p className="text-[9px] text-muted/50 mt-1.5 text-center leading-tight">
              {t(locale, "editor_ca50d9")}</p>
          </div>
        </div>

        {/* ▌ 中央：ビルドターゲット & 出力設定 */}
        <div className="flex flex-col gap-3 min-h-0">
          <div className="bg-panel rounded-xl border border-border p-3">
            <div className="text-[10px] font-bold text-accent uppercase tracking-wider mb-1">{t(locale, "editor_798124")}</div>
            <Row label={t(locale, "editor_3418ba")}>
              <div className={inputCls} style={{ cursor: "default", pointerEvents: "none" }}>
                {targetPlatform === "java" ? "🟪 Java（MOD）" : t(locale, "editor_06bd3a")}
              </div>
            </Row>
            {/* ── Java版だけ：どのローダー・どのバージョン向けに出すか ──
                ⚠️ Forge 用の .jar を NeoForge に入れても、マイクラは理由を言わずに
                   何も起きない。作った本人が「どっちで遊ぶか」を先に選べないと、
                   その後の全部が無駄になる（実際に半日溶かした）。
                ⚠️ エンジンがまだ無い出し先は**押せなくする**。押せて壊れた .jar が
                   出るのが、このプロジェクトで一番高くつく形。 */}
            {targetPlatform === "java" && (
              <div className="mt-2">
                <div className="text-[11px] font-bold mb-1.5">{t(locale, "editor_4cced5")}</div>
                <div className="flex gap-2">
                  {JAVA_TARGET_LIST.map((tg) => {
                    const on = javaTarget === tg.id;
                    const locked = !tg.ready;
                    return (
                      <button
                        key={tg.id}
                        onClick={() => { if (!locked) setJavaTarget(tg.id); }}
                        disabled={locked}
                        title={locked ? tg.notReadyReason : `遊ぶ人は ${tg.requires} が必要です`}
                        className="flex-1 px-2 py-2 rounded-lg text-[11px] text-left transition-colors"
                        style={{
                          background: locked
                            ? "rgba(255,255,255,0.02)"
                            : on ? "rgba(60,208,112,0.15)" : "rgba(255,255,255,0.03)",
                          border: `1px solid ${locked ? "rgba(255,255,255,0.06)" : on ? "rgba(60,208,112,0.5)" : "rgba(255,255,255,0.1)"}`,
                          color: locked ? "rgba(255,255,255,0.3)" : undefined,
                          cursor: locked ? "not-allowed" : "pointer",
                        }}
                      >
                        <div className="font-bold">{locked ? "🔒 " : ""}{tg.label}</div>
                        <div className="opacity-60 mt-0.5">
                          {locked ? tg.notReadyReason : tg.hint}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {/* 遊ぶ人が何を入れるかを、選んだあとにも出しておく。
                    作った .jar を人に渡すとき、これを伝えないと相手が動かせない */}
                <div className="text-[10px] text-muted/60 mt-1.5 leading-relaxed">
                  {t(locale, "editor_f284f5")}<b>{getJavaTarget(javaTarget).requires}</b> {t(locale, "editor_e7e007")}</div>
              </div>
            )}
            {targetPlatform === "bedrock" && (
              <>
                <Row label={t(locale, "editor_5c22e7")}>
                  <select value={mcVersion} onChange={(e) => setMcVersion(e.target.value as "1.21.40+" | "1.21.0" | "1.20.x")} className={inputCls}>
                    <option value="1.21.40+">{t(locale, "editor_b0747a")}</option>
                    <option value="1.21.0">1.21.0〜1.21.30</option>
                    <option value="1.20.x">{t(locale, "editor_bb4a02")}</option>
                  </select>
                </Row>
                <Row label={t(locale, "editor_7692be")}><Toggle value={betaApi} onChange={setBetaApi} /></Row>
              </>
            )}
          </div>

          {/* 「出力 & 識別子」カード(圧縮/UUID/namespace/min_engine)は撤去したまま。
             技術者向けの内部設定で、賢い既定に任せるほうがよい。

             ただし **拡張子だけは戻した**。Android は .mcaddon を知らない拡張子として
             扱い、保存そのものを拒否することがある（「このファイルは保存できません」）。
             そうなると作ったアドオンを取り出す手段が一切なくなるので、
             .zip で受け取れる逃げ道が要る。技術的な設定ではなく「保存できない人の出口」。 */}
          {targetPlatform === "bedrock" && (
            <div className="bg-panel rounded-xl border border-border p-3">
              <div className="text-[11px] font-bold mb-2">{t(locale, "editor_30ba28")}</div>
              <div className="flex gap-2">
                {([
                  ["mcaddon", ".mcaddon", t(locale, "editor_69034c")],
                  ["zip", ".zip", t(locale, "editor_922227")],
                ] as const).map(([v, label, hint]) => (
                  <button
                    key={v}
                    onClick={() => setExportFormat(v)}
                    className="flex-1 px-2 py-2 rounded-lg text-[11px] text-left transition-colors"
                    style={{
                      background: exportFormat === v ? "rgba(60,208,112,0.15)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${exportFormat === v ? "rgba(60,208,112,0.5)" : "rgba(255,255,255,0.1)"}`,
                    }}
                  >
                    <span className="font-bold">{label}</span>
                    <span className="block text-[10px] text-muted/60">{hint}</span>
                  </button>
                ))}
              </div>
              {exportFormat === "zip" && (
                <p className="text-[10px] text-muted/70 mt-2 leading-relaxed">
                  {t(locale, "editor_923152")}<b>.zip</b> {t(locale, "editor_96ac23")}<b>.mcaddon</b> {t(locale, "editor_f7070f")}</p>
              )}
            </div>
          )}

          {/* ステータス */}
          <div className="bg-panel rounded-xl border border-border p-3 flex gap-4 text-[11px] text-muted">
            <span>{t(locale, "editor_87a077")}<span className="text-foreground/80 font-bold">{blocks.length}</span></span>
            <span>{t(locale, "editor_f76ee4")}<span className="text-foreground/80 font-bold">{generatedJsCode ? generatedJsCode.split("\n").length : 0}</span> {t(locale, "editor_2d5aef")}</span>
          </div>
        </div>

        {/* ▌ 右：開発ターミナル & ライブツリー */}
        <div className="flex flex-col gap-3 min-h-0">
          <div className="bg-panel rounded-xl border border-border p-3 flex flex-col min-h-0" style={{ flex: pro ? "1 1 0" : "0 0 auto" }}>
            <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> {t(locale, "editor_d5ea2a")}</div>
            <BuildTerminal />
          </div>
          {pro && (
            <div className="bg-panel rounded-xl border border-border p-3 flex flex-col min-h-0" style={{ flex: "1 1 0" }}>
              <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-2">{t(locale, "editor_7a81a9")}</div>
              <LiveTree />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
