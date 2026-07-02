"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useEditorStore } from "./store";
import { exportProject } from "./exporter";

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
  const [building, setBuilding] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [exportedPlatform, setExportedPlatform] = useState<"bedrock" | "java">("bedrock");
  const logRef = useRef<HTMLDivElement>(null);

  const projectName = useEditorStore((s) => s.projectName);
  const blocks = useEditorStore((s) => s.blocks);
  const exportArmed = useEditorStore((s) => s.exportArmed); // メインEXPORTボタンを押して初めて解錠

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const push = (line: string) => setLog((l) => [...l, line]);
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const handleBuild = useCallback(async () => {
    if (building) return;
    // 抜け道防止：メインの「アドオン完成！」ボタンを押して解錠していないと書き出さない
    if (!useEditorStore.getState().exportArmed) {
      setLog(["⚠ まず ロジック画面の「アドオン完成！🎉」ボタンを押してください。"]);
      return;
    }
    setBuilding(true);
    setError(null);
    setLog([]);
    try {
      const state = useEditorStore.getState();
      const plat = state.targetPlatform as "bedrock" | "java";
      push("$ cubicengine build --release");
      await wait(220);
      push("  ▸ manifest.json を生成 …");
      await wait(260);
      push("  ✓ manifest.json");
      push(`  ▸ scripts/main.js を書き出し (${state.blocks.length} blocks) …`);
      await wait(300);
      push("  ✓ scripts/main.js");
      push(plat === "bedrock" ? "  ▸ textures / blocks をパック …" : "  ▸ java sources を生成 …");
      await wait(280);
      push(plat === "bedrock" ? "  ✓ resource pack" : "  ✓ src/main/java");
      push("  ▸ 圧縮中 …");
      // 実エクスポート
      await exportProject(state, state.generatedJsCode);
      await wait(180);
      push("  ✓ 圧縮完了");
      push("");
      push("✅ BUILD SUCCESS — ダウンロード完了！");
      setExportedPlatform(plat);
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
            <span className="text-emerald-400/60">●</span> ビルド待機中… 「ビルド＆ダウンロード」を押すとここに出力が流れます
          </div>
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

      {/* ビルドボタン */}
      <button
        id="export-btn"
        onClick={handleBuild}
        disabled={building || !exportArmed}
        title={!exportArmed ? "先にロジック画面の「アドオン完成！🎉」ボタンを押してください" : undefined}
        className={`mc-btn ${building || !exportArmed ? "" : "mc-btn--primary"} w-full py-3`}
        style={{ fontSize: 13, borderRadius: 16, opacity: !building && !exportArmed ? 0.6 : 1 }}
      >
        {building ? (
          <>
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            ビルド中…
          </>
        ) : !exportArmed ? (
          <>🔒 まず「アドオン完成！🎉」を押してね</>
        ) : (
          <>⚡ ビルド＆ダウンロード</>
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
            <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 16 }}>✅ ダウンロード完了！</div>
            {exportedPlatform === "bedrock" ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--accent)", marginBottom: 10 }}>📱 Bedrock（スマホ・Win10・コンソール）の入れ方</div>
                <ol style={{ fontSize: 13, lineHeight: 2, paddingLeft: 20 }}>
                  <li>ダウンロードした <strong>.mcaddon</strong> をダブルクリック</li>
                  <li>Minecraft が自動で開いてインポート</li>
                  <li>ワールドの「ビヘイビアーパック」→ 追加 ✅</li>
                  <li>「リソースパック」→ 追加 ✅（<strong>両方必須！</strong>）</li>
                  <li>入って <strong style={{ color: "#15803d" }}>緑の起動メッセージ</strong> が出れば成功！</li>
                </ol>
                <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(220,80,80,0.12)", borderRadius: 8, fontSize: 12, color: "#a83232" }}>
                  ⚠️ BPだけ有効ではスクリプトは動きません。<strong>RPも必ず同時に有効</strong>に。
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#b8860b", marginBottom: 10 }}>☕ Java Edition（PC）の入れ方</div>
                <ol style={{ fontSize: 13, lineHeight: 2, paddingLeft: 20 }}>
                  <li>ZIPを解凍</li>
                  <li>Forge を導入：<strong>files.minecraftforge.net</strong></li>
                  <li>解凍フォルダで <code style={{ background: "var(--surface-active)", padding: "1px 6px", borderRadius: 4 }}>gradle build</code></li>
                  <li><code>build/libs/</code> の <strong>.jar</strong> を <code>.minecraft/mods/</code> へ</li>
                  <li>Forge プロファイルで起動</li>
                </ol>
                <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(218,165,32,0.15)", borderRadius: 8, fontSize: 12, color: "#8a6914" }}>
                  ⚠️ バニラでは動きません。<strong>Forge 必須</strong>。
                </div>
              </>
            )}
             <button onClick={() => setShowGuide(false)} className="mc-btn mc-btn--primary w-full" style={{ marginTop: 16 }}>
               わかった！
             </button>
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
  const projectName = useEditorStore((s) => s.projectName);
  const setProjectName = useEditorStore((s) => s.setProjectName);
  const projectDescription = useEditorStore((s) => s.projectDescription);
  const setProjectDescription = useEditorStore((s) => s.setProjectDescription);
  const targetPlatform = useEditorStore((s) => s.targetPlatform);
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
          <span className="text-accent">🚀</span> マイクラへ <span className="text-muted/50 text-xs font-mono">— ビルド＆ダウンロード</span>
        </h2>
        {/* モード切替（プロ）は廃止＝常にかんたん */}
      </div>

      {/* ── 本体グリッド（スクロールなし・1画面） ── */}
      <div className={`grid gap-3 ${pro ? "flex-1 min-h-0 grid-cols-1 lg:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto w-full content-start"}`}>

        {/* ▌ 左：アイデンティティ（アイコン＋なまえ） */}
        <div className="flex flex-col gap-3 min-h-0">
          <div className="bg-panel rounded-xl border border-border p-3">
            <div className="text-[10px] font-bold text-accent uppercase tracking-wider mb-2">アイコン & なまえ</div>
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
                  <div className="mc-btn mc-btn--sm mc-btn--info text-center w-full">📁 画像を選ぶ</div>
                  <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={handleIconFile} />
                </label>
                {packIconDataUrl && (
                  <button onClick={() => setPackIconDataUrl("")} className="mc-btn mc-btn--sm mc-btn--danger w-full">↺ もどす</button>
                )}
                <p className="text-[9px] text-muted/50 leading-tight">128×128 PNG 推奨</p>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-border/60">
              <Row label="なまえ">
                <input value={projectName} onChange={(e) => setProjectName(e.target.value)} className={`${inputCls} w-40`} />
              </Row>
              {pro && (
                <Row label="説明">
                  <input value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} className={`${inputCls} w-40`} />
                </Row>
              )}
            </div>
          </div>

          {/* エディター設定（プロのみ） */}
          {pro && (
            <div className="bg-panel rounded-xl border border-border p-3">
              <div className="text-[10px] font-bold text-accent uppercase tracking-wider mb-1">エディター</div>
              <Row label="自動保存"><Toggle value={autoSave} onChange={setAutoSave} /></Row>
              <Row label="グリッドスナップ"><Toggle value={gridSnap} onChange={setGridSnap} /></Row>
              <Row label="テーマ">
                <select value={theme} onChange={(e) => applyTheme(e.target.value)} title="エディターの配色テーマ" className={inputCls}>
                  <option value="dark">🪨 Dark（石）</option>
                  <option value="midnight">🌃 Midnight（紺）</option>
                  <option value="abyss">🕳️ Abyss（漆黒）</option>
                </select>
              </Row>
            </div>
          )}

          {/* コミュニティ・リンク */}
          <div className="bg-panel rounded-xl border border-border p-3">
            <div className="text-[10px] font-bold text-accent uppercase tracking-wider mb-2">リンク & サポート</div>
            <a
              href="https://discord.gg/Hm82tUUY8g"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] active:bg-[#3C45A5] text-white font-bold text-xs transition-colors"
              style={{ boxShadow: "0 2px 4px rgba(88,101,242,0.2)" }}
            >
              <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 127.14 96.36">
                <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,52.88,6.83,77.19,77.19,0,0,0,49.58,0,105.15,105.15,0,0,0,19.14,8.07C3,31.58-1.45,54.47,1,77.06a107.4,107.4,0,0,0,32.22,16.14,78.11,78.11,0,0,0,6.77-11,68.86,68.86,0,0,1-10.75-5.13c.91-.66,1.8-1.34,2.65-2a75.58,75.58,0,0,0,62.93,0c.84.69,1.74,1.37,2.65,2a68.86,68.86,0,0,1-10.75,5.13,78.11,78.11,0,0,0,6.77,11,107.4,107.4,0,0,0,32.22-16.14C128.87,54.47,124.1,31.58,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.83,46,53.83,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.07,46,96.07,53,91,65.69,84.69,65.69Z"/>
              </svg>
              公式Discordに参加する
            </a>
            <p className="text-[9px] text-muted/50 mt-1.5 text-center leading-tight">
              ※Discordの利用規約に基づき、13歳以上の方が対象です。
            </p>
          </div>
        </div>

        {/* ▌ 中央：ビルドターゲット & 出力設定 */}
        <div className="flex flex-col gap-3 min-h-0">
          <div className="bg-panel rounded-xl border border-border p-3">
            <div className="text-[10px] font-bold text-accent uppercase tracking-wider mb-1">つくる先</div>
            <Row label="プラットフォーム">
              <div className={inputCls} style={{ cursor: "default", pointerEvents: "none" }}>
                {targetPlatform === "java" ? "🟪 Java（MOD）" : "🟢 Bedrock（統合版）"}
              </div>
            </Row>
            {targetPlatform === "bedrock" && (
              <>
                <Row label="MCバージョン">
                  <select value={mcVersion} onChange={(e) => setMcVersion(e.target.value as "1.21.40+" | "1.21.0" | "1.20.x")} className={inputCls}>
                    <option value="1.21.40+">1.21.40+ / 1.22〜（最新）</option>
                    <option value="1.21.0">1.21.0〜1.21.30</option>
                    <option value="1.20.x">1.20.x（古い）</option>
                  </select>
                </Row>
                <Row label="ベータAPI"><Toggle value={betaApi} onChange={setBetaApi} /></Row>
              </>
            )}
          </div>

          {pro && (
            <div className="bg-panel rounded-xl border border-border p-3">
              <div className="text-[10px] font-bold text-accent uppercase tracking-wider mb-1">出力 & 識別子</div>
              <Row label="出力フォーマット">
                <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as "mcaddon" | "mcpack" | "zip")} className={inputCls}>
                  <option value="mcaddon">.mcaddon</option>
                  <option value="mcpack">.mcpack</option>
                  <option value="zip">.zip</option>
                </select>
              </Row>
              <Row label="圧縮"><Toggle value={compress} onChange={setCompress} /></Row>
              <Row label="UUID自動生成"><Toggle value={autoUuid} onChange={setAutoUuid} /></Row>
              <div className="mt-1.5 pt-1.5 border-t border-border/60 font-mono text-[10px] text-muted/70 space-y-0.5">
                <div>namespace: <span className="text-cyan-300/80">cubicengine:{slug}</span></div>
                <div>min_engine: <span className="text-cyan-300/80">forge 1.20.x</span></div>
              </div>
            </div>
          )}

          {/* ステータス */}
          <div className="bg-panel rounded-xl border border-border p-3 flex gap-4 text-[11px] text-muted">
            <span>📦 ブロック <span className="text-foreground/80 font-bold">{blocks.length}</span></span>
            <span>📝 コード <span className="text-foreground/80 font-bold">{generatedJsCode ? generatedJsCode.split("\n").length : 0}</span> 行</span>
          </div>
        </div>

        {/* ▌ 右：開発ターミナル & ライブツリー */}
        <div className="flex flex-col gap-3 min-h-0">
          <div className="bg-panel rounded-xl border border-border p-3 flex flex-col min-h-0" style={{ flex: pro ? "1 1 0" : "0 0 auto", maxHeight: pro ? undefined : 200 }}>
            <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> ビルド出力
            </div>
            <BuildTerminal />
          </div>
          {pro && (
            <div className="bg-panel rounded-xl border border-border p-3 flex flex-col min-h-0" style={{ flex: "1 1 0" }}>
              <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-2">📦 出力プレビュー（ライブ）</div>
              <LiveTree />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
