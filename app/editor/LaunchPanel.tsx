"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useEditorStore } from "./store";
import { buildJavaFileList } from "./exporter";

/* ══════════════════════════════════════════════════════════
   型定義
══════════════════════════════════════════════════════════ */

interface McStatus {
  minecraftDir:  string | null;
  modsDir:       string | null;
  launcherPath:  string | null;
  hasJava:       boolean;
  javaVersion:   string | null;
  forgeVersions: string[];
}

type Phase =
  | "idle"
  | "detecting"
  | "ready"
  | "building"
  | "done"
  | "error"
  | "no_electron";

/* ══════════════════════════════════════════════════════════
   ステップバッジ
══════════════════════════════════════════════════════════ */

function Step({ n, label, done, active }: { n: number; label: string; done: boolean; active: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, opacity: done || active ? 1 : 0.4 }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: done ? "#00b894" : active ? "#6c5ce7" : "#e8eaf0",
        color: done || active ? "#fff" : "#aaa",
        fontWeight: 800, fontSize: 14,
        boxShadow: active ? "0 0 12px #6c5ce788" : "none",
        transition: "all 0.3s",
      }}>
        {done ? "✓" : n}
      </div>
      <span style={{ fontSize: 13, fontWeight: active ? 700 : 600,
        color: active ? "#6c5ce7" : done ? "#00b894" : "#888" }}>
        {label}
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   メインパネル
══════════════════════════════════════════════════════════ */

export default function LaunchPanel() {
  const projectName = useEditorStore(s => s.projectName);
  // store state は buildAndLaunch 内で直接取得する

  const [phase,    setPhase]    = useState<Phase>("idle");
  const [status,   setStatus]   = useState<McStatus | null>(null);
  const [logs,     setLogs]     = useState<string[]>([]);
  const [jarName,  setJarName]  = useState<string>("");
  const [errMsg,   setErrMsg]   = useState<string>("");
  const logEndRef  = useRef<HTMLDivElement>(null);

  const isElectron = typeof window !== "undefined" && !!(window as any).electronAPI?.isElectron;
  const api = isElectron ? (window as any).electronAPI.minecraft : null;

  // ── ログ自動スクロール ──
  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  // ── Minecraft 環境を検出 ──
  const detect = useCallback(async () => {
    setPhase("detecting");
    setLogs([]);
    try {
      const s: McStatus = await api.detect();
      setStatus(s);
      setPhase("ready");
    } catch (e: any) {
      setErrMsg(e.message);
      setPhase("error");
    }
  }, [api]);

  // ── ビルド → インストール → 起動 ──
  const buildAndLaunch = useCallback(async () => {
    if (!status?.modsDir) return;
    setPhase("building");
    setLogs(["🚀 ビルド開始..."]);
    setJarName("");

    // ログリスナー登録
    api.onBuildLog((msg: string) => {
      setLogs(prev => [...prev, msg]);
    });

    try {
      // Java エクスポーター(本物)でプロジェクトファイルを生成。
      // exportJava と同じ buildJavaZip 由来＝1.20.1 / UTF-8 / gradle wrapper同梱 / Block・Item・挙動入り。
      const st = useEditorStore.getState() as any;
      const files = await buildJavaFileList(st, st.generatedJsCode || "");

      const result = await api.buildAndInstall({
        files,
        modsDir: status.modsDir,
        projectName,
      });

      api.offBuildLog();
      setJarName(result.jarName);
      setPhase("done");
      setLogs(prev => [...prev, `✅ ${result.jarName} をインストールしました！`]);
    } catch (e: any) {
      api.offBuildLog();
      setErrMsg(e.message);
      setPhase("error");
    }
  }, [status, projectName, api]);

  // ── Minecraft 起動 ──
  const launch = useCallback(async () => {
    await api.launch(status?.launcherPath ?? null);
  }, [status, api]);

  // ── Electron 以外では案内を表示 ──
  if (!isElectron) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🖥️</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
          ランチャーは .exe 版のみ利用できます
        </h2>
        <p style={{ color: "#888", fontSize: 13 }}>
          デスクトップアプリ（CUBICENGINE デスクトップ版）を使用してください。
        </p>
      </div>
    );
  }

  /* ═══════ レンダー ═══════ */
  return (
    <div style={{ height: "100%", overflow: "hidden", padding: "16px 24px", background: "#f8f9ff", display: "flex", flexDirection: "column" }}>
      <div style={{ maxWidth: 780, margin: "0 auto", width: "100%", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>

        {/* ヘッダー */}
        <div style={{ marginBottom: 10, flexShrink: 0 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "#222" }}>
            ☕ Java Minecraft ランチャー
          </h2>
          <p style={{ fontSize: 12, color: "#888" }}>
            作成した Mod をワンクリックでビルド・インストール・起動。
          </p>
        </div>

        {/* ステップ表示（横並び・コンパクト） */}
        <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 10, flexShrink: 0,
          padding: "12px 14px", background: "#fff", borderRadius: 14,
          border: "2px solid #e8eaf0", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <Step n={1} label="Minecraft 環境を検出"
            done={phase !== "idle" && phase !== "detecting"}
            active={phase === "detecting"} />
          <Step n={2} label="Forge Mod をビルド（JDK 17 必要）"
            done={phase === "done"}
            active={phase === "building"} />
          <Step n={3} label="mods/ フォルダへインストール"
            done={phase === "done"}
            active={phase === "building" && logs.some(l => l.includes("インストール"))} />
          <Step n={4} label="Minecraft ランチャーを起動"
            done={false}
            active={phase === "done"} />
        </div>

        {/* 状態 UI（必要時のみ内部スクロール） */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 4 }}>
        {phase === "idle" && (
          <button onClick={detect} style={primaryBtn}>
            🔍 環境を検出する
          </button>
        )}

        {phase === "detecting" && (
          <div style={card}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>🔍</div>
            <div style={{ fontWeight: 700 }}>Minecraft を探しています...</div>
          </div>
        )}

        {phase === "ready" && status && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* 検出結果 */}
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#6c5ce7", marginBottom: 10 }}>
                🔎 検出結果
              </div>
              <InfoRow label="Minecraft フォルダ"
                value={status.minecraftDir || "❌ 見つかりません"}
                ok={!!status.minecraftDir} />
              <InfoRow label="mods/ フォルダ"
                value={status.modsDir || "❌ 見つかりません"}
                ok={!!status.modsDir} />
              <InfoRow label="Minecraft ランチャー"
                value={status.launcherPath ? "✅ 検出" : "⚠️ 見つかりません（手動で起動）"}
                ok={!!status.launcherPath} />
              <InfoRow label="Java (JDK)"
                value={status.hasJava ? `✅ ${status.javaVersion}` : "❌ 未インストール"}
                ok={status.hasJava} />
              {status.forgeVersions.length > 0 && (
                <InfoRow label="Forge バージョン"
                  value={status.forgeVersions.join(", ")}
                  ok={true} />
              )}
            </div>

            {/* Java なし警告 */}
            {!status.hasJava && (
              <div style={{ ...card, background: "#fff3e0", border: "2px solid #ffcc80" }}>
                <div style={{ fontWeight: 700, color: "#e67e22", marginBottom: 6 }}>
                  ⚠️ JDK 17 以上が必要です
                </div>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>
                  Forge Mod のビルドには Java Development Kit が必要です。
                </div>
                <a href="https://adoptium.net"
                  onClick={e => { e.preventDefault(); (window as any).electronAPI && shell_open("https://adoptium.net"); }}
                  style={{ fontSize: 12, color: "#6c5ce7", fontWeight: 700 }}>
                  → Adoptium から JDK 17 をダウンロード
                </a>
              </div>
            )}

            {/* Minecraft なし警告 */}
            {!status.minecraftDir && (
              <div style={{ ...card, background: "#fce4ec", border: "2px solid #f48fb1" }}>
                <div style={{ fontWeight: 700, color: "#c2185b" }}>
                  ❌ Minecraft Java Edition が見つかりません
                </div>
                <div style={{ fontSize: 12, color: "#888" }}>
                  先に Minecraft Java Edition をインストールして、
                  一度起動して .minecraft フォルダを作成してください。
                </div>
              </div>
            )}

            {/* アクションボタン */}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={buildAndLaunch}
                disabled={!status.hasJava || !status.modsDir}
                style={!status.hasJava || !status.modsDir ? disabledBtn : primaryBtn}>
                🔨 Modをビルドしてインストール
              </button>
              {status.modsDir && (
                <button onClick={() => api.openModsDir(status.modsDir)} style={secondaryBtn}>
                  📂 mods/ を開く
                </button>
              )}
            </div>
          </div>
        )}

        {/* ビルドログ */}
        {(phase === "building" || phase === "done") && logs.length > 0 && (
          <div style={{ marginTop: 16, ...card, padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", background: "var(--surface)",
              fontSize: 11, fontWeight: 700, color: "var(--accent)" }}>
              🔨 ビルドログ
            </div>
            <div style={{ background: "var(--surface-hover)", padding: "10px 14px",
              maxHeight: 240, overflowY: "auto", fontFamily: "monospace",
              fontSize: 11, color: "#15803d", lineHeight: 1.7 }}>
              {logs.map((l, i) => <div key={i}>{l}</div>)}
              <div ref={logEndRef} />
            </div>
          </div>
        )}

        {/* 完了 */}
        {phase === "done" && (
          <div style={{ marginTop: 16, ...card, background: "#e0faf0",
            border: "2px solid #00b894", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#00b894", marginBottom: 4 }}>
              インストール完了！
            </div>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 16 }}>
              <strong>{jarName}</strong> を mods/ フォルダに追加しました。
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={launch} style={primaryBtn}>
                🚀 Minecraft を起動
              </button>
              {status?.modsDir && (
                <button onClick={() => api.openModsDir(status.modsDir)} style={secondaryBtn}>
                  📂 mods/ を確認
                </button>
              )}
            </div>
          </div>
        )}

        {/* エラー */}
        {phase === "error" && (
          <div style={{ ...card, background: "#fce4ec", border: "2px solid #f48fb1" }}>
            <div style={{ fontWeight: 800, color: "#c2185b", marginBottom: 8 }}>❌ エラーが発生しました</div>
            <pre style={{ fontSize: 11, color: "#555", whiteSpace: "pre-wrap",
              background: "#fff0f3", borderRadius: 8, padding: 10, marginBottom: 12 }}>
              {errMsg}
            </pre>

            {/* Gradle 未インストール時は自動インストールボタンを出す */}
            {errMsg.includes("Gradle がインストールされていません") && isElectron && (
              <button
                onClick={async () => {
                  setPhase("building");
                  setErrMsg("");
                  try {
                    await api.installGradle();
                    setPhase("ready");
                    alert("✅ インストール完了！アプリを再起動してから「Minecraftにインストール」を押してください。");
                  } catch (e: any) {
                    setErrMsg(e.message);
                    setPhase("error");
                  }
                }}
                style={{ ...secondaryBtn, background: "#4caf50", color: "#fff", marginBottom: 8,
                  fontWeight: 800, fontSize: 13, padding: "10px 20px" }}>
                🪄 Gradle を自動インストール（おまかせ）
              </button>
            )}

            <button onClick={() => { setPhase("ready"); setErrMsg(""); }} style={secondaryBtn}>
              もう一度試す
            </button>
          </div>
        )}

        {/* 再検出ボタン */}
        {phase !== "idle" && phase !== "detecting" && phase !== "building" && (
          <button onClick={detect} style={{ ...secondaryBtn, marginTop: 12, fontSize: 11 }}>
            🔄 再検出
          </button>
        )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Gradle プロジェクトのファイルリストを生成
   (exporter.ts の exportJava を参考に、ZIP ではなくファイル配列で返す)
══════════════════════════════════════════════════════════ */

interface ProjectFile { path: string; content: string }

async function buildFileList(projectName: string): Promise<ProjectFile[]> {
  const files: ProjectFile[] = [];
  const name  = slug(projectName);
  const cls   = className(projectName);
  const modId = modid(name);
  const pkg   = `com.cubicengine.${modId}`;
  const pkgPath = `com/cubicengine/${modId}`;

  // build.gradle
  files.push({ path: "build.gradle", content: [
    `plugins {`,
    `    id 'net.minecraftforge.gradle' version '6.0.+'`,
    `}`,
    `version = '1.0.0'`,
    `group = '${pkg}'`,
    `archivesBaseName = '${modId}'`,
    `java.toolchain.languageVersion = JavaLanguageVersion.of(17)`,
    `minecraft {`,
    `    mappings channel: 'official', version: '1.20.4'`,
    `    runs {`,
    `        client { workingDirectory project.file('run') }`,
    `    }`,
    `}`,
    `dependencies {`,
    `    minecraft 'net.minecraftforge:forge:1.20.4-49.0.30'`,
    `}`,
  ].join("\n") });

  // settings.gradle
  files.push({ path: "settings.gradle", content: [
    `pluginManagement {`,
    `    repositories {`,
    `        gradlePluginPortal()`,
    `        maven { url = 'https://maven.minecraftforge.net/' }`,
    `    }`,
    `}`,
  ].join("\n") });

  // gradle.properties
  files.push({ path: "gradle.properties", content: `org.gradle.jvmargs=-Xmx3G\norg.gradle.daemon=false\n` });

  // Gradle wrapper properties
  files.push({ path: "gradle/wrapper/gradle-wrapper.properties", content: [
    `distributionBase=GRADLE_USER_HOME`,
    `distributionPath=wrapper/dists`,
    `distributionUrl=https\\://services.gradle.org/distributions/gradle-8.4-bin.zip`,
    `zipStoreBase=GRADLE_USER_HOME`,
    `zipStorePath=wrapper/dists`,
  ].join("\n") });

  const srcBase = `src/main/java/${pkgPath}`;
  const resBase = `src/main/resources`;

  // Main Mod Class
  files.push({ path: `${srcBase}/${cls}Mod.java`, content: [
    `package ${pkg};`,
    `import net.minecraftforge.common.MinecraftForge;`,
    `import net.minecraftforge.fml.common.Mod;`,
    `import net.minecraftforge.fml.event.lifecycle.FMLCommonSetupEvent;`,
    `import net.minecraftforge.fml.javafmlmod.FMLJavaModLoadingContext;`,
    `@Mod("${modId}")`,
    `public class ${cls}Mod {`,
    `    public static final String MOD_ID = "${modId}";`,
    `    public ${cls}Mod() {`,
    `        FMLJavaModLoadingContext.get().getModEventBus().addListener(this::setup);`,
    `        MinecraftForge.EVENT_BUS.register(this);`,
    `    }`,
    `    private void setup(final FMLCommonSetupEvent event) {}`,
    `}`,
  ].join("\n") });

  // mods.toml
  files.push({ path: `${resBase}/META-INF/mods.toml`, content: [
    `modLoader="javafml"`,
    `loaderVersion="[49,)"`,
    `license="MIT"`,
    `[[mods]]`,
    `modId="${modId}"`,
    `version="1.0.0"`,
    `displayName="${projectName}"`,
    `[[dependencies.${modId}]]`,
    `    modId="forge"`,
    `    mandatory=true`,
    `    versionRange="[49,)"`,
    `    ordering="NONE"`,
    `    side="BOTH"`,
    `[[dependencies.${modId}]]`,
    `    modId="minecraft"`,
    `    mandatory=true`,
    `    versionRange="[1.20.4,1.21)"`,
    `    ordering="NONE"`,
    `    side="BOTH"`,
  ].join("\n") });

  // pack.mcmeta
  files.push({ path: `${resBase}/pack.mcmeta`, content:
    JSON.stringify({ pack: { description: `${projectName} resources`, pack_format: 15 } }, null, 2) });

  return files;
}

// ── ヘルパー ──
function slug(s: string)      { return s.replace(/\s+/g,"_").replace(/[^a-z0-9_-]/gi,"").toLowerCase()||"mod"; }
function className(s: string) { const c=s.replace(/[^a-zA-Z0-9]/g,""); return (/^\d/.test(c)?`Mod${c}`:c)||"Mod"; }
function modid(s: string)     { const id=s.replace(/[^a-z0-9_]/g,""); return id||"mod"; }

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function shell_open(url: string) {
  window.open(url, "_blank");
}

/* ══════════════════════════════════════════════════════════
   スタイル定数
══════════════════════════════════════════════════════════ */

const primaryBtn: React.CSSProperties = {
  padding: "11px 22px", borderRadius: 12,
  background: "linear-gradient(135deg,#6c5ce7,#a29bfe)",
  border: "none", color: "#fff", fontSize: 13, fontWeight: 800,
  cursor: "pointer", boxShadow: "0 4px 16px rgba(108,92,231,0.35)",
  transition: "transform 0.1s, box-shadow 0.15s",
};
const secondaryBtn: React.CSSProperties = {
  padding: "11px 18px", borderRadius: 12,
  background: "#fff", border: "2px solid #e0e1f0",
  color: "#555", fontSize: 13, fontWeight: 700,
  cursor: "pointer",
};
const disabledBtn: React.CSSProperties = {
  ...primaryBtn,
  background: "#ccc", boxShadow: "none", cursor: "not-allowed", opacity: 0.6,
};
const card: React.CSSProperties = {
  background: "#fff", borderRadius: 14,
  padding: "16px 18px", border: "2px solid #e8eaf0",
  boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
};

function InfoRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start",
      padding: "7px 0", borderBottom: "1px solid #f0f1f8", gap: 10 }}>
      <span style={{ fontSize: 12, color: "#888", flexShrink: 0, minWidth: 140 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: ok ? "#333" : "#e17055",
        textAlign: "right", wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}
