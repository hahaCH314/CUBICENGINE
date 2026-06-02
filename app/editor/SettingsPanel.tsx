"use client";

import { useState, useCallback } from "react";
import { useEditorStore } from "./store";
import { exportProject } from "./exporter";

/* ═══════════════════════════════════════════
   Toggle Switch Component
   ═══════════════════════════════════════════ */
function Toggle({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      onClick={() => onChange(!value)}
      className={`w-10 h-5 rounded-full cursor-pointer transition-colors relative ${
        value ? "bg-accent" : "bg-surface-active"
      }`}
    >
      <div
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
          value ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════
   Export Button Component
   ═══════════════════════════════════════════ */
function ExportButton() {
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showGuide, setShowGuide] = useState(false);
  const [exportedPlatform, setExportedPlatform] = useState<"bedrock"|"java">("bedrock");

  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportDone(false);
    setError(null);
    try {
      const state = useEditorStore.getState();
      await exportProject(state, state.generatedJsCode);
      setExportDone(true);
      setExportedPlatform(state.targetPlatform as "bedrock"|"java");
      setShowGuide(true);
      setTimeout(() => setExportDone(false), 3000);
    } catch (e: any) {
      setError(e.message || "Export failed");
      setTimeout(() => setError(null), 5000);
    } finally {
      setExporting(false);
    }
  }, []);

  return (
    <div className="space-y-3">
      <button
        id="export-btn"
        onClick={handleExport}
        disabled={exporting}
        className={`w-full py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all duration-300 flex items-center justify-center gap-2.5 ${
          exporting
            ? "bg-accent/30 text-accent/60 cursor-wait"
            : exportDone
            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
            : "bg-gradient-to-r from-accent to-violet-500 text-white hover:shadow-lg hover:shadow-accent/25 hover:scale-[1.02] active:scale-[0.98]"
        }`}
      >
        {exporting ? (
          <>
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            エクスポート中...
          </>
        ) : exportDone ? (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            ダウンロード完了！
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            エクスポート
          </>
        )}
      </button>

      {error && (
        <div className="px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400">
          ⚠ {error}
        </div>
      )}

      {/* ─── 導入方法ガイド モーダル ─── */}
      {showGuide && (
        <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(60,50,30,0.45)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <div style={{background:"var(--panel)",border:"2px solid var(--accent)",borderRadius:16,padding:24,maxWidth:480,width:"100%",color:"var(--foreground)",position:"relative"}}>
            <button onClick={()=>setShowGuide(false)} style={{position:"absolute",top:12,right:12,background:"none",border:"none",color:"var(--muted)",fontSize:20,cursor:"pointer",lineHeight:1}}>✕</button>
            <div style={{fontSize:20,fontWeight:900,marginBottom:16}}>
              ✅ ダウンロード完了！
            </div>

            {exportedPlatform === "bedrock" ? (<>
              <div style={{fontSize:14,fontWeight:800,color:"var(--accent)",marginBottom:10}}>📱 Bedrock（スマホ・Win10・コンソール）の入れ方</div>
              <ol style={{fontSize:13,lineHeight:2,paddingLeft:20,color:"var(--foreground)"}}>
                <li>ダウンロードした <strong>.mcaddon</strong> ファイルをダブルクリック</li>
                <li>Minecraft が自動で開いてインポートされる</li>
                <li>Minecraft でワールドを作成 or 編集を開く</li>
                <li>「ビヘイビアーパック」→ 追加 ✅</li>
                <li>「リソースパック」→ 追加 ✅（<strong>両方必須！</strong>）</li>
                <li>ワールドに入ると <strong style={{color:"#15803d"}}>緑の起動メッセージ</strong> が出れば成功！</li>
              </ol>
              <div style={{marginTop:12,padding:"8px 12px",background:"rgba(220,80,80,0.12)",borderRadius:8,fontSize:12,color:"#a83232"}}>
                ⚠️ ビヘイビアーパック（BP）だけ有効にしてもスクリプトは動きません。<br/>
                <strong>必ずリソースパック（RP）も同時に有効</strong>にしてください。
              </div>
            </>) : (<>
              <div style={{fontSize:14,fontWeight:800,color:"#b8860b",marginBottom:10}}>☕ Java Edition（PC）の入れ方</div>
              <ol style={{fontSize:13,lineHeight:2,paddingLeft:20,color:"var(--foreground)"}}>
                <li>ZIPを解凍する</li>
                <li>Forge をインストール：<strong>files.minecraftforge.net</strong></li>
                <li>Gradle をインストール：<strong>gradle.org/install</strong></li>
                <li>解凍フォルダでコマンドプロンプトを開き実行：<code style={{background:"var(--surface-active)",padding:"1px 6px",borderRadius:4,color:"var(--foreground)"}}>gradle build</code></li>
                <li><code>build\libs\</code> の <strong>.jar</strong> を <code>.minecraft\mods\</code> へコピー</li>
                <li>Forge プロファイル (1.20.1) で Minecraft を起動</li>
              </ol>
              <div style={{marginTop:12,padding:"8px 12px",background:"rgba(218,165,32,0.15)",borderRadius:8,fontSize:12,color:"#8a6914"}}>
                ⚠️ 通常の Minecraft（バニラ）では動きません。<br/>
                <strong>Forge のインストールが必須</strong>です。
              </div>
            </>)}

            <button onClick={()=>setShowGuide(false)} style={{marginTop:16,width:"100%",padding:"10px",background:"var(--accent)",color:"#fff",border:"none",borderRadius:10,fontSize:14,fontWeight:800,cursor:"pointer"}}>
              わかった！
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Settings Panel
   ═══════════════════════════════════════════ */
export default function SettingsPanel() {
  const projectName = useEditorStore((s) => s.projectName);
  const setProjectName = useEditorStore((s) => s.setProjectName);
  const projectDescription = useEditorStore((s) => s.projectDescription);
  const setProjectDescription = useEditorStore((s) => s.setProjectDescription);
  const targetPlatform = useEditorStore((s) => s.targetPlatform);
  const setTargetPlatform = useEditorStore((s) => s.setTargetPlatform);
  const exportFormat = useEditorStore((s) => s.exportFormat);
  const setExportFormat = useEditorStore((s) => s.setExportFormat);
  const compress = useEditorStore((s) => s.compress);
  const setCompress = useEditorStore((s) => s.setCompress);
  const mcVersion = useEditorStore((s) => s.mcVersion);
  const setMcVersion = useEditorStore((s) => s.setMcVersion);
  const blocks = useEditorStore((s) => s.blocks);
  const generatedJsCode = useEditorStore((s) => s.generatedJsCode);
  const packIconDataUrl = useEditorStore((s) => s.packIconDataUrl);
  const setPackIconDataUrl = useEditorStore((s) => s.setPackIconDataUrl);

  const [autoSave, setAutoSave] = useState(true);
  const [gridSnap, setGridSnap] = useState(true);
  const [autoUuid, setAutoUuid] = useState(true);

  // アイコン画像の読み込み
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
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* ─── アドオンアイコン ─── */}
        <div>
          <h3 className="text-sm font-bold text-accent uppercase tracking-wider mb-4 flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-accent" />
            アドオンアイコン
          </h3>
          <div className="bg-panel rounded-xl border border-border p-4">
            <div className="flex items-center gap-5">
              {/* プレビュー */}
              <div className="relative shrink-0">
                {packIconDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={packIconDataUrl} alt="pack icon"
                    className="w-20 h-20 rounded-xl object-cover border border-border" />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-surface border border-border flex flex-col items-center justify-center gap-1">
                    <svg className="w-8 h-8 text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    </svg>
                    <span className="text-[9px] text-muted/40">デフォルト</span>
                  </div>
                )}
              </div>

              {/* ボタン群 */}
              <div className="flex flex-col gap-2 flex-1">
                <label className="cursor-pointer">
                  <div className="px-4 py-2 rounded-lg bg-accent/10 border border-accent/30 text-accent text-xs font-bold
                    hover:bg-accent/20 transition-colors text-center">
                    📁 画像をアップロード
                  </div>
                  <input type="file" accept="image/png,image/jpeg,image/gif,image/webp"
                    className="hidden" onChange={handleIconFile} />
                </label>
                {packIconDataUrl && (
                  <button onClick={() => setPackIconDataUrl("")}
                    className="px-4 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold
                      hover:bg-rose-500/20 transition-colors">
                    ↺ デフォルトに戻す
                  </button>
                )}
                <p className="text-[10px] text-muted/50 leading-relaxed">
                  推奨: 128×128 px の PNG<br/>
                  pack_icon.png として同梱されます
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Project ─── */}
        <div>
          <h3 className="text-sm font-bold text-accent uppercase tracking-wider mb-4 flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-accent" />
            プロジェクト設定
          </h3>
          <div className="space-y-3 bg-panel rounded-xl border border-border p-4">
            <div className="flex items-center justify-between gap-4 py-2">
              <label className="text-sm text-foreground/70 whitespace-nowrap">
                プロジェクト名
              </label>
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="px-3 py-1.5 rounded-md bg-surface border border-border text-sm font-mono text-foreground/80 w-48 focus:outline-none focus:border-accent/50"
              />
            </div>
            <div className="flex items-center justify-between gap-4 py-2">
              <label className="text-sm text-foreground/70 whitespace-nowrap">
                説明
              </label>
              <input
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                className="px-3 py-1.5 rounded-md bg-surface border border-border text-sm font-mono text-foreground/80 w-48 focus:outline-none focus:border-accent/50"
              />
            </div>
            <div className="flex items-center justify-between gap-4 py-2">
              <label className="text-sm text-foreground/70 whitespace-nowrap">
                ターゲットプラットフォーム
              </label>
              <select
                value={targetPlatform}
                onChange={(e) => setTargetPlatform(e.target.value as "bedrock" | "java")}
                className="px-3 py-1.5 rounded-md bg-surface border border-border text-sm font-mono text-foreground/80 focus:outline-none focus:border-accent/50"
              >
                <option value="bedrock">🟢 Bedrock（おすすめ）</option>
                <option value="java">☕ Java（上級者むけ）</option>
              </select>
            </div>
            {targetPlatform === "bedrock" && (
              <div className="flex items-center justify-between gap-4 py-2">
                <label className="text-sm text-foreground/70 whitespace-nowrap">
                  Minecraftバージョン
                </label>
                <select
                  value={mcVersion}
                  onChange={(e) => setMcVersion(e.target.value as "1.21.40+" | "1.21.0" | "1.20.x")}
                  className="px-3 py-1.5 rounded-md bg-surface border border-border text-sm font-mono text-foreground/80 focus:outline-none focus:border-accent/50"
                >
                  <option value="1.21.40+">1.21.40以降 / 1.22〜1.26系（最新）</option>
                  <option value="1.21.0">1.21.0〜1.21.30</option>
                  <option value="1.20.x">1.20.x（古いバージョン）</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* ─── Editor ─── */}
        <div>
          <h3 className="text-sm font-bold text-accent uppercase tracking-wider mb-4 flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-accent" />
            エディター設定
          </h3>
          <div className="space-y-3 bg-panel rounded-xl border border-border p-4">
            <div className="flex items-center justify-between gap-4 py-2">
              <label className="text-sm text-foreground/70">自動保存</label>
              <Toggle value={autoSave} onChange={setAutoSave} />
            </div>
            <div className="flex items-center justify-between gap-4 py-2">
              <label className="text-sm text-foreground/70">グリッドスナップ</label>
              <Toggle value={gridSnap} onChange={setGridSnap} />
            </div>
            <div className="flex items-center justify-between gap-4 py-2">
              <label className="text-sm text-foreground/70">グリッドサイズ</label>
              <input
                readOnly
                value="1"
                className="px-3 py-1.5 rounded-md bg-surface border border-border text-sm font-mono text-foreground/80 w-48"
              />
            </div>
            <div className="flex items-center justify-between gap-4 py-2">
              <label className="text-sm text-foreground/70">テーマ</label>
              <select
                defaultValue="dark"
                className="px-3 py-1.5 rounded-md bg-surface border border-border text-sm font-mono text-foreground/80 focus:outline-none focus:border-accent/50"
              >
                <option value="dark">Dark</option>
                <option value="midnight">Midnight</option>
                <option value="abyss">Abyss</option>
              </select>
            </div>
          </div>
        </div>

        {/* ─── Export ─── */}
        <div>
          <h3 className="text-sm font-bold text-accent uppercase tracking-wider mb-4 flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-accent" />
            エクスポート設定
          </h3>
          <div className="space-y-3 bg-panel rounded-xl border border-border p-4">
            <div className="flex items-center justify-between gap-4 py-2">
              <label className="text-sm text-foreground/70">出力フォーマット</label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as "mcaddon" | "mcpack" | "zip")}
                className="px-3 py-1.5 rounded-md bg-surface border border-border text-sm font-mono text-foreground/80 focus:outline-none focus:border-accent/50"
              >
                <option value="mcaddon">.mcaddon</option>
                <option value="mcpack">.mcpack</option>
                <option value="zip">.zip</option>
              </select>
            </div>
            <div className="flex items-center justify-between gap-4 py-2">
              <label className="text-sm text-foreground/70">圧縮</label>
              <Toggle value={compress} onChange={setCompress} />
            </div>
            <div className="flex items-center justify-between gap-4 py-2">
              <label className="text-sm text-foreground/70">UUID自動生成</label>
              <Toggle value={autoUuid} onChange={setAutoUuid} />
            </div>
          </div>
        </div>

        {/* ─── Export Summary ─── */}
        <div>
          <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-emerald-400" />
            エクスポートプレビュー
          </h3>
          <div className="bg-panel rounded-xl border border-border p-4 space-y-3">
            {/* Platform badge */}
            <div className="flex items-center gap-3">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  targetPlatform === "bedrock"
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                }`}
              >
                {targetPlatform === "bedrock" ? "🟢 Bedrock" : "☕ Java"}
              </span>
              <span className="text-xs text-muted">
                {targetPlatform === "bedrock"
                  ? "Minecraft Bedrock 1.21+ — .mcaddon をダブルクリックで即インストール"
                  : "Forge 1.20.4 — ソースコードのZIPです"}
              </span>
            </div>

            {/* Java 注意バナー */}
            {targetPlatform === "java" && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-300 space-y-1">
                <div className="font-bold text-amber-400">⚠️ Java エクスポートについて</div>
                <div>このエクスポートは <strong>コンパイル済みの .jar ではありません</strong>。</div>
                <div>ZIP を解凍後、以下の手順で .jar を作成してください：</div>
                <ol className="list-decimal list-inside space-y-0.5 mt-1 text-amber-300/80">
                  <li>JDK 17 以上をインストール</li>
                  <li>ZIP を解凍して、フォルダを開く</li>
                  <li>ターミナルで <code className="bg-amber-500/20 px-1 rounded">./gradlew build</code> を実行</li>
                  <li><code className="bg-amber-500/20 px-1 rounded">build/libs/</code> の .jar を <code className="bg-amber-500/20 px-1 rounded">mods/</code> フォルダへ</li>
                </ol>
                <div className="text-amber-400/60 mt-1">
                  💡 初めての方は Bedrock 版がおすすめです
                </div>
              </div>
            )}

            {/* Bedrock 案内 */}
            {targetPlatform === "bedrock" && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-300 space-y-1">
                <div className="font-bold text-emerald-400">✅ Bedrock の使いかた</div>
                <ol className="list-decimal list-inside space-y-0.5 text-emerald-300/80">
                  <li>エクスポートボタンを押す</li>
                  <li>ダウンロードされた .mcaddon をダブルクリック</li>
                  <li>Minecraft が自動で開いてインポート完了！</li>
                </ol>
              </div>
            )}

            {/* File structure preview */}
            <div className="rounded-lg bg-surface/50 border border-border p-3 font-mono text-xs text-muted">
              <div className="text-foreground/70 font-bold mb-2">
                📦 {projectName.replace(/\s+/g, "_").toLowerCase()}
                {targetPlatform === "bedrock" ? ".mcaddon" : "-forge-mod.zip"}
              </div>
              {targetPlatform === "bedrock" ? (
                <div className="space-y-0.5 pl-2">
                  <div className="text-emerald-400/70">
                    📂 {projectName.replace(/\s+/g, "_").toLowerCase()}_BP/
                  </div>
                  <div className="pl-4">├─ manifest.json</div>
                  <div className="pl-4">├─ scripts/main.js</div>
                  <div className="pl-4">├─ pack_icon.png</div>
                  {blocks.map((b) => (
                    <div key={b.id} className="pl-4">
                      └─ blocks/{b.name}.json
                    </div>
                  ))}
                  <div className="text-cyan-400/70 mt-1">
                    📂 {projectName.replace(/\s+/g, "_").toLowerCase()}_RP/
                  </div>
                  <div className="pl-4">├─ manifest.json</div>
                  <div className="pl-4">├─ textures/terrain_texture.json</div>
                  <div className="pl-4">├─ blocks.json</div>
                  {blocks.map((b) => (
                    <div key={b.id} className="pl-4">
                      └─ textures/blocks/{b.name}.png
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-0.5 pl-2">
                  <div>├─ build.gradle</div>
                  <div>├─ settings.gradle</div>
                  <div>├─ gradle.properties</div>
                  <div className="text-amber-400/70 mt-1">
                    📂 src/main/java/com/mmc/{projectName.replace(/\s+/g, "_").toLowerCase().replace(/[^a-z0-9_]/g, "")}/
                  </div>
                  <div className="pl-4">├─ {projectName.replace(/\s+/g, "").replace(/[^a-zA-Z0-9]/g, "")}Mod.java</div>
                  <div className="pl-4">├─ ModBlocks.java</div>
                  <div className="pl-4">├─ ModItems.java</div>
                  <div className="pl-4">└─ ModEventHandler.java</div>
                  <div className="text-cyan-400/70 mt-1">
                    📂 src/main/resources/
                  </div>
                  <div className="pl-4">├─ META-INF/mods.toml</div>
                  <div className="pl-4">├─ pack.mcmeta</div>
                  {blocks.map((b) => (
                    <div key={b.id} className="pl-4">
                      └─ assets/.../block/{b.name}.json
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="flex gap-4 text-xs text-muted">
              <span>
                📦 ブロック: <span className="text-foreground/70">{blocks.length}</span>
              </span>
              <span>
                📝 コード: <span className="text-foreground/70">
                  {generatedJsCode ? `${generatedJsCode.split("\n").length} lines` : "なし"}
                </span>
              </span>
            </div>

            {/* Export Button */}
            <ExportButton />
          </div>
        </div>
      </div>
    </div>
  );
}
