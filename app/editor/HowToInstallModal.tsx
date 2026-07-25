"use client";

import { useState } from "react";
import { X, Smartphone, Monitor, ChevronRight, Sparkles, CheckCircle2 } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
}

export default function HowToInstallModal({ isOpen, onClose, projectName = "my_addon" }: Props) {
  const [deviceTab, setDeviceTab] = useState<"ios" | "android" | "pc">("ios");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border-4 border-emerald-600 bg-slate-900 text-white shadow-2xl">
        {/* マイクラ草ブロック風ヘッダー */}
        <div className="bg-gradient-to-r from-emerald-600 via-green-500 to-emerald-700 px-5 py-4 border-b-4 border-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🟩</span>
            <div>
              <h2 className="font-extrabold text-lg text-yellow-300 drop-shadow-md">
                マイクラへのあそびかたガイド 🎮
              </h2>
              <p className="text-xs text-emerald-100 font-bold">
                ダウンロードしたアドオンをマイクラに入れよう！
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
                <div className="flex gap-3 items-start">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500 text-slate-950 font-black flex items-center justify-center text-sm shadow">
                    1
                  </span>
                  <div>
                    <p className="font-bold text-sm text-yellow-300">ファイルを開く</p>
                    <p className="text-xs text-slate-300">
                      「ファイル」アプリの「ダウンロード」フォルダにある <span className="text-emerald-400 font-mono font-bold">{projectName}.mcaddon</span> をタップ！
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500 text-slate-950 font-black flex items-center justify-center text-sm shadow">
                    2
                  </span>
                  <div>
                    <p className="font-bold text-sm text-yellow-300">「Minecraft」を選択</p>
                    <p className="text-xs text-slate-300">
                      共有メニューが表示されたら、「Minecraft」アイコンをえらんで開きます。
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500 text-slate-950 font-black flex items-center justify-center text-sm shadow">
                    3
                  </span>
                  <div>
                    <p className="font-bold text-sm text-yellow-300">ワールドでオンにする！</p>
                    <p className="text-xs text-slate-300">
                      マイクラが自動起動してインポートされます。「ワールド設定 ➔ ビヘイビアーパック」でONにすれば完了！✨
                    </p>
                  </div>
                </div>
              </>
            )}

            {deviceTab === "android" && (
              <>
                <div className="flex gap-3 items-start">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500 text-slate-950 font-black flex items-center justify-center text-sm shadow">
                    1
                  </span>
                  <div>
                    <p className="font-bold text-sm text-yellow-300">ダウンロードを開く</p>
                    <p className="text-xs text-slate-300">
                      ブラウザの通知または「ファイル」アプリから <span className="text-emerald-400 font-mono font-bold">{projectName}.mcaddon</span> をタップ！
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500 text-slate-950 font-black flex items-center justify-center text-sm shadow">
                    2
                  </span>
                  <div>
                    <p className="font-bold text-sm text-yellow-300">マイクラで開く</p>
                    <p className="text-xs text-slate-300">
                      「このアプリで開く」で「Minecraft」を選びます。
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500 text-slate-950 font-black flex items-center justify-center text-sm shadow">
                    3
                  </span>
                  <div>
                    <p className="font-bold text-sm text-yellow-300">ワールドに適用する！</p>
                    <p className="text-xs text-slate-300">
                      ワールド編集画面の「ビヘイビアーパック」でアドオンを有効化して遊ぼう！🎉
                    </p>
                  </div>
                </div>
              </>
            )}

            {deviceTab === "pc" && (
              <>
                <div className="flex gap-3 items-start">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500 text-slate-950 font-black flex items-center justify-center text-sm shadow">
                    1
                  </span>
                  <div>
                    <p className="font-bold text-sm text-yellow-300">ファイルをダブルクリック</p>
                    <p className="text-xs text-slate-300">
                      ダウンロードした <span className="text-emerald-400 font-mono font-bold">{projectName}.mcaddon</span> ファイルをダブルクリックするだけ！
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500 text-slate-950 font-black flex items-center justify-center text-sm shadow">
                    2
                  </span>
                  <div>
                    <p className="font-bold text-sm text-yellow-300">自動インポート完了</p>
                    <p className="text-xs text-slate-300">
                      Minecraft（統合版）が自動で起動し、上部に「インポート完了」と出ます。
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-emerald-500 text-slate-950 font-black flex items-center justify-center text-sm shadow">
                    3
                  </span>
                  <div>
                    <p className="font-bold text-sm text-yellow-300">ワールドに追加！</p>
                    <p className="text-xs text-slate-300">
                      ワールドの設定から「ビヘイビアーパック」を選んで「有効化」すればすぐに冒険できます！
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* アドバイスメモ */}
          <div className="bg-emerald-950/40 p-3 rounded-xl border border-emerald-800/60 flex items-center gap-2 text-xs text-emerald-200">
            <Sparkles className="text-yellow-400 flex-shrink-0" size={18} />
            <span>
              ワールドの「ベータ機能（実験的機能）」をONにすると、アドオンがより確実に動くよ！
            </span>
          </div>

          {/* 閉じるボタン */}
          <button
            onClick={onClose}
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-slate-950 font-black rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-95"
          >
            <CheckCircle2 size={18} />
            わかった！マイクラであそぶ 🎉
          </button>
        </div>
      </div>
    </div>
  );
}
