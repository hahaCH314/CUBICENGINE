"use client";

/* ══════════════════════════════════════════════════════════
   マイクラへの入れ方ガイド — app/editor/HowToInstallModal.tsx

   ⚠️ 統合版と Java版で**入れ方がまったく違う**。
      統合版 … .mcaddon を開くだけ。スマホ・Switch・PC。
      Java版 … .jar を mods フォルダに置く。Forge 1.20.1 が要る。パソコンだけ。
      ここを1本にまとめると、Java版の人は「mods」の3文字に辿り着けないまま
      離脱する。作れるのに入れ方が書いていない、が一番もったいない。
   ══════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import { X, Smartphone, Monitor, Sparkles, CheckCircle2, AlertTriangle } from "lucide-react";
import { useEditorStore } from "./store";

type Edition = "bedrock" | "java";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
}

/** ダウンロードされるファイル名。⚠️ exporter.ts の sanitizeSlug と同じ規則にすること */
function slugOf(name: string): string {
  const slug = name.replace(/\s+/g, "_").replace(/[^a-z0-9_-]/gi, "").toLowerCase();
  return slug || "project";
}

export default function HowToInstallModal({ isOpen, onClose, projectName = "my_addon" }: Props) {
  const [deviceTab, setDeviceTab] = useState<"ios" | "android" | "pc">("ios");
  const targetPlatform = useEditorStore((s) => s.targetPlatform);

  // どちらを作っているかは設定で分かっている。開いた瞬間はそちらを出す。
  // ただし固定はしない（統合版の人が「Java版ってどうやるの？」と見に来る）。
  const [edition, setEdition] = useState<Edition>(targetPlatform === "java" ? "java" : "bedrock");
  const wasOpen = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpen.current) setEdition(targetPlatform === "java" ? "java" : "bedrock");
    wasOpen.current = isOpen;
  }, [isOpen, targetPlatform]);

  if (!isOpen) return null;

  const slug = slugOf(projectName);
  const isJava = edition === "java";

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className={`relative w-full max-w-lg overflow-hidden rounded-2xl border-4 bg-slate-900 text-white shadow-2xl ${isJava ? "border-orange-600" : "border-emerald-600"}`}>
        {/* マイクラ草ブロック風ヘッダー（Java版はオレンジ＝MODの色） */}
        <div className={`px-5 py-4 border-b-4 flex items-center justify-between ${
          isJava
            ? "bg-gradient-to-r from-orange-600 via-amber-500 to-orange-700 border-orange-800"
            : "bg-gradient-to-r from-emerald-600 via-green-500 to-emerald-700 border-emerald-800"
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{isJava ? "🟧" : "🟩"}</span>
            <div>
              <h2 className="font-extrabold text-lg text-yellow-300 drop-shadow-md">
                マイクラへのあそびかたガイド 🎮
              </h2>
              <p className={`text-xs font-bold ${isJava ? "text-orange-100" : "text-emerald-100"}`}>
                {isJava
                  ? "ダウンロードした MOD をマイクラに入れよう！"
                  : "ダウンロードしたアドオンをマイクラに入れよう！"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-black/30 p-1.5 text-white hover:bg-black/50 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* ── どっちのマイクラ？（ここが分からないと以降が全部間違う） ── */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-800 rounded-xl border border-slate-700">
            <button
              onClick={() => setEdition("bedrock")}
              className={`py-2.5 rounded-lg font-bold text-xs transition-all ${
                !isJava ? "bg-emerald-500 text-slate-950 shadow-md scale-105" : "text-slate-400 hover:text-white"
              }`}
            >
              🟢 統合版<span className="hidden sm:inline">（スマホ・Switch）</span>
              <span className="block font-mono text-[10px] opacity-80">.mcaddon</span>
            </button>
            <button
              onClick={() => setEdition("java")}
              className={`py-2.5 rounded-lg font-bold text-xs transition-all ${
                isJava ? "bg-orange-500 text-slate-950 shadow-md scale-105" : "text-slate-400 hover:text-white"
              }`}
            >
              🟠 Java版<span className="hidden sm:inline">（パソコン）</span>
              <span className="block font-mono text-[10px] opacity-80">.jar</span>
            </button>
          </div>

          {/* ══════════ 統合版 ══════════ */}
          {!isJava && (
            <>
              {/* デバイス切り替えタブ */}
              <div className="grid grid-cols-3 gap-2 p-1 bg-slate-800 rounded-xl border border-slate-700">
                <button
                  onClick={() => setDeviceTab("ios")}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-bold text-xs transition-all ${
                    deviceTab === "ios"
                      ? "bg-emerald-500 text-slate-950 shadow-md scale-105"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Smartphone size={14} /> iPhone/iPad
                </button>
                <button
                  onClick={() => setDeviceTab("android")}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-bold text-xs transition-all ${
                    deviceTab === "android"
                      ? "bg-emerald-500 text-slate-950 shadow-md scale-105"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Smartphone size={14} /> Android
                </button>
                <button
                  onClick={() => setDeviceTab("pc")}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-bold text-xs transition-all ${
                    deviceTab === "pc"
                      ? "bg-emerald-500 text-slate-950 shadow-md scale-105"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Monitor size={14} /> パソコン(Win)
                </button>
              </div>

              {/* ステップ案内 */}
              <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                {deviceTab === "ios" && (
                  <>
                    <Step n={1} title="ファイルを開く">
                      「ファイル」アプリの「ダウンロード」フォルダにある <Code>{slug}.mcaddon</Code> をタップ！
                    </Step>
                    <Step n={2} title="「Minecraft」を選択">
                      共有メニューが表示されたら、「Minecraft」アイコンをえらんで開きます。
                    </Step>
                    <Step n={3} title="ワールドでオンにする！">
                      マイクラが自動起動してインポートされます。「ワールド設定 ➔ ビヘイビアーパック」でONにすれば完了！✨
                    </Step>
                  </>
                )}

                {deviceTab === "android" && (
                  <>
                    <Step n={1} title="ダウンロードを開く">
                      ブラウザの通知または「ファイル」アプリから <Code>{slug}.mcaddon</Code> をタップ！
                    </Step>
                    <Step n={2} title="マイクラで開く">
                      「このアプリで開く」で「Minecraft」を選びます。
                    </Step>
                    <Step n={3} title="ワールドに適用する！">
                      ワールド編集画面の「ビヘイビアーパック」でアドオンを有効化して遊ぼう！🎉
                    </Step>
                  </>
                )}

                {deviceTab === "pc" && (
                  <>
                    <Step n={1} title="ファイルをダブルクリック">
                      ダウンロードした <Code>{slug}.mcaddon</Code> ファイルをダブルクリックするだけ！
                    </Step>
                    <Step n={2} title="自動インポート完了">
                      Minecraft（統合版）が自動で起動し、上部に「インポート完了」と出ます。
                    </Step>
                    <Step n={3} title="ワールドに追加！">
                      ワールドの設定から「ビヘイビアーパック」を選んで「有効化」すればすぐに冒険できます！
                    </Step>
                  </>
                )}
              </div>

              {/* アドバイスメモ（実験的機能は統合版だけの話） */}
              <div className="bg-emerald-950/40 p-3 rounded-xl border border-emerald-800/60 flex items-center gap-2 text-xs text-emerald-200">
                <Sparkles className="text-yellow-400 flex-shrink-0" size={18} />
                <span>
                  ワールドの「ベータ機能（実験的機能）」をONにすると、アドオンがより確実に動くよ！
                </span>
              </div>
            </>
          )}

          {/* ══════════ Java版 ══════════ */}
          {isJava && (
            <>
              {/* ⚠️ 先に言う。スマホの人がここまで読み進めてから
                     「パソコンだけ」と知るのが一番つらい。 */}
              <div className="bg-orange-950/50 p-3 rounded-xl border border-orange-700/60 flex items-start gap-2 text-xs text-orange-100">
                <Monitor className="text-orange-300 flex-shrink-0 mt-0.5" size={18} />
                <span>
                  Java版は <b className="text-yellow-300">パソコンのマイクラだけ</b>で遊べます。
                  スマホ・Switch・Xbox のマイクラ（統合版）には入れられません。
                </span>
              </div>

              <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <Step n={1} title="Forge 1.20.1 を入れる" java>
                  MOD を動かすための土台です。<b className="text-yellow-300">files.minecraftforge.net</b> から
                  <b className="text-yellow-300"> 1.20.1</b> のインストーラーをダウンロードし、
                  「Install client」で入れます。
                  <span className="block mt-1 text-orange-300/90">
                    ⚠️ バージョンが 1.20.1 でないと、作った MOD は読み込まれません。
                  </span>
                </Step>
                <Step n={2} title="mods フォルダを開く" java>
                  Forge を入れて一度マイクラを起動すると <Code java>mods</Code> フォルダができます。
                  <span className="block mt-1">
                    Windows … <Code java>Win + R</Code> を押して <Code java>%appdata%\.minecraft\mods</Code>
                  </span>
                  <span className="block">
                    Mac … <Code java>~/Library/Application Support/minecraft/mods</Code>
                  </span>
                  <span className="block mt-1 text-slate-400">
                    見あたらないときは、自分で <Code java>mods</Code> という名前のフォルダを作ってOK。
                  </span>
                </Step>
                <Step n={3} title=".jar をそのまま置く" java>
                  ダウンロードした <Code java>{slug}-mod.jar</Code> を、その mods フォルダに
                  <b className="text-yellow-300">コピーするだけ</b>。
                  <span className="block mt-1 text-orange-300/90">
                    ⚠️ 開いたり、展開（解凍）したりしないこと。ファイルのまま置きます。
                  </span>
                </Step>
                <Step n={4} title="Forge で起動する！" java>
                  マイクラのランチャーで、遊び方（プロファイル）を
                  <b className="text-yellow-300">「forge」</b>に切り替えてプレイ。
                  ワールドに入るとチャットにメッセージが出て、作ったブロックは
                  クリエイティブの持ち物に並びます！🎉
                </Step>
              </div>

              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex items-start gap-2 text-xs text-slate-300">
                <AlertTriangle className="text-amber-400 flex-shrink-0 mt-0.5" size={18} />
                <span>
                  何も起きないときは、
                  <b className="text-yellow-300">①ランチャーが「forge」になっているか</b>、
                  <b className="text-yellow-300">②置いた場所が本当に mods フォルダか</b> の順に見てね。
                  だいたいこのどちらかです。
                </span>
              </div>
            </>
          )}

          {/* 閉じるボタン */}
          <button
            onClick={onClose}
            className={`w-full py-3 text-slate-950 font-black rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 ${
              isJava
                ? "bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500"
                : "bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500"
            }`}
          >
            <CheckCircle2 size={18} />
            わかった！マイクラであそぶ 🎉
          </button>
        </div>
      </div>
    </div>
  );
}

/** 手順1つ。番号の丸＋見出し＋説明 */
function Step({ n, title, java, children }: { n: number; title: string; java?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start">
      <span className={`flex-shrink-0 w-7 h-7 rounded-full text-slate-950 font-black flex items-center justify-center text-sm shadow ${java ? "bg-orange-400" : "bg-emerald-500"}`}>
        {n}
      </span>
      <div className="min-w-0">
        <p className="font-bold text-sm text-yellow-300">{title}</p>
        <p className="text-xs text-slate-300 break-words">{children}</p>
      </div>
    </div>
  );
}

/** ファイル名・フォルダ名など、そのまま打つもの */
function Code({ java, children }: { java?: boolean; children: React.ReactNode }) {
  return (
    <span className={`font-mono font-bold break-all ${java ? "text-orange-300" : "text-emerald-400"}`}>
      {children}
    </span>
  );
}
