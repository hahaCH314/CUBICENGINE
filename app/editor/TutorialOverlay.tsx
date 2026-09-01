"use client";

/* ══════════════════════════════════════════════════════════
   チュートリアル・オーバーレイ — app/editor/TutorialOverlay.tsx
   
   初見のユーザー・子どもたちに対して
     1. アドオンとは何か？ (機能とことばの言い換え)
     2. きっかけの置き方 (何が起こったら)
     3. することの重ね方 (※「繋がないと動かない」最も重要な注意！)
     4. アドオンの完成と読み込み (HowToInstallModalとの連動)
   の4ステップを明るく分かりやすいカード・TCG調UIで案内するコンポーネント。
   
   ※ 単体で完結しており、シオンさんの LogicPanel にて onClose を渡して組込可能。
   ══════════════════════════════════════════════════════════ */

import { useState } from "react";
import * as LucideIcons from "lucide-react";
import HowToInstallModal from "./HowToInstallModal";
import { useEditorStore } from "./store";
import { t, tNode } from "@/lib/i18n";

interface Props {
  onClose: () => void;
}

export default function TutorialOverlay({ onClose }: { onClose: () => void }) {
    const locale = useEditorStore((s) => s.locale);
  const [step, setStep] = useState<number>(0);
  const [showInstallGuide, setShowInstallGuide] = useState<boolean>(false);
  // ⚠️ 出るファイルも入れ方も版でまったく違う。作っている版のほうを見せる。
  //    「.mcaddon をダブルクリック」しか書いていないと、Java版の人は
  //    せっかく .jar が作れても mods フォルダに辿り着けない。
  const isJava = useEditorStore((s) => s.targetPlatform) === "java";
  const projectName = useEditorStore((s) => s.projectName);
  const fileExt = isJava ? ".jar" : ".mcaddon";

  const steps = [
    { title: t(locale, "editor_ccbda0"), subtitle: isJava ? t(locale, "editor_1f04e8") : t(locale, "editor_1a140f") },
    { title: t(locale, "editor_c796a0"), subtitle: t(locale, "editor_de89d1") },
    { title: t(locale, "editor_69dbe0"), subtitle: t(locale, "editor_308788") },
    { title: t(locale, "editor_4c4c61"), subtitle: t(locale, "editor_d35093") },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(15, 23, 42, 0.65)",
      backdropFilter: "blur(6px)",
      padding: "clamp(8px, 2.5vw, 16px)",
      fontFamily: '"Inter", "Hiragino Sans", "Meiryo", system-ui, sans-serif'
    }}>
      {/* ── 詳しい入れ方ガイド（連携） ── */}
      <HowToInstallModal isOpen={showInstallGuide} onClose={() => setShowInstallGuide(false)} projectName={projectName} />

      <div style={{
        position: "relative",
        width: "100%",
        maxWidth: 640,
        // スマホは画面が低い。上限を切らないと下の「つぎへ」が画面外に出て押せなくなる。
        // 100dvh はアドレスバーの出入りを含んだ実際の高さ（100vh だと足りない端末がある）。
        maxHeight: "100%",
        borderRadius: 24,
        background: "linear-gradient(145deg, #ffffff 0%, #fefce8 100%)",
        border: "4px solid #f59e0b",
        boxShadow: "0 20px 50px rgba(0, 0, 0, 0.25)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        color: "#1e293b",
        animation: "to-fadeIn 0.25s ease-out both"
      }}>
        <style>{`/* 中の箱が枠を超えないようにする最後の砦。
             インラインstyleで1つずつ指定すると必ず付け忘れるので、まとめて掛ける。
             長い英数字(.mcaddon など)が折り返せずに横へ伸びるのも防ぐ。 */
          .to-body, .to-body * { box-sizing: border-box; max-width: 100%; min-width: 0; }
          .to-body { overflow-wrap: anywhere; }
          @keyframes to-fadeIn { 0% { opacity: 0; transform: scale(0.96); } 100% { opacity: 1; transform: scale(1); } }
          @keyframes to-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
          @keyframes to-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }`}</style>

        {/* ── トップ・タイトルヘッダー（明るいトランプ/ TC G風バナー） ── */}
        <div style={{
          background: "linear-gradient(90deg, #f59e0b 0%, #d97706 100%)",
          padding: "clamp(11px, 3.2vw, 16px) clamp(13px, 4vw, 24px)",
          flexShrink: 0,   // 本文が伸びてもヘッダーは潰さない
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          borderBottom: "4px solid #b45309",
          color: "#ffffff"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: "clamp(20px, 5.5vw, 26px)", flexShrink: 0 }}>📖</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "clamp(9.5px, 2.6vw, 11px)", fontWeight: 800, color: "#fef08a", letterSpacing: "0.05em" }}>
                {current.subtitle}
              </div>
              <h2 style={{ fontSize: "clamp(15px, 4.2vw, 20px)", fontWeight: 900, margin: 0, letterSpacing: "0.02em", lineHeight: 1.3 }}>
                {current.title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            title={t(locale, "editor_13f8d3")}
            style={{
              cursor: "pointer", width: 34, height: 34, borderRadius: "50%",
              border: "2px solid rgba(255, 255, 255, 0.4)", background: "rgba(0, 0, 0, 0.2)",
              color: "#ffffff", fontWeight: 900, fontSize: 16,
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.15s"
            }}
          >
            ✕
          </button>
        </div>

        {/* ── コンテンツ・エリア ── */}
        {/* 本文だけスクロールさせる。minHeight:0 が無いと flex 子が縮まず、
            はみ出した分がそのまま画面外へ出てしまう（スマホで下が切れていた原因）。 */}
        <div className="to-body" style={{
          padding: "clamp(14px, 4vw, 24px) clamp(14px, 4.5vw, 28px)",
          flex: 1, minHeight: 0, overflowY: "auto",
          display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 12,
        }}>
          
          {tNode(locale, "editor_frag_1a05c067bf0_1", { arg0: {/* STEP 0: これは何？ */}, arg1: {/* STEP 1: きっかけを置く */}, arg2: {/* STEP 2: することを重ねる（★最重要注意点！） */}, arg3: {/* STEP 3: 完成とダウンロード */} })}</div>

        {/* ── フッター・ステップ操作エリア ── */}
        <div style={{
          background: "#f8fafc",
          borderTop: "1px solid #e2e8f0",
          padding: "clamp(10px, 3vw, 14px) clamp(13px, 4vw, 24px)",
          flexShrink: 0,   // ここが潰れると「つぎへ」が押せなくなる
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}>
          {/* ドットインジケーター */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {steps.map((_, i) => (
              <div
                key={i}
                onClick={() => setStep(i)}
                style={{
                  cursor: "pointer", width: step === i ? 28 : 12, height: 12,
                  borderRadius: 9999,
                  background: step === i ? "#d97706" : "#cbd5e1",
                  transition: "width 0.2s, background 0.2s"
                }}
              />
            ))}
          </div>

          {/* 移動ボタン群 */}
          <div style={{ display: "flex", gap: 12 }}>
            {tNode(locale, "editor_frag_1a05c067bf8_2")}</div>
        </div>

      </div>
    </div>
  );
}

/** チュートリアル用のミニマイクラ風キャラクター（既存ロゴ等との重複を避け、ブランド色エメラルドで構成） */
function Builder() {
  return (
    <div style={{ width: 48, height: 64, position: "relative", flexShrink: 0 }}>
      <div style={{ position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)", width: 36, height: 7, borderRadius: "50%", background: "rgba(0,0,0,0.15)" }} />
      <div style={{ position: "absolute", top: 0, left: 6, width: 36, height: 30, borderRadius: 8, background: "linear-gradient(#fcd9a0,#f0b970)", border: "3px solid #b07a3a", boxSizing: "border-box" }}>
        <div style={{ position: "absolute", top: 10, left: 6, width: 5, height: 6, background: "#3b2a14", borderRadius: 2 }} />
        <div style={{ position: "absolute", top: 10, right: 6, width: 5, height: 6, background: "#3b2a14", borderRadius: 2 }} />
      </div>
      <div style={{ position: "absolute", top: 28, left: 10, width: 28, height: 32, borderRadius: 7, background: "linear-gradient(#34d399,#10b981)", border: "3px solid #065f46", boxSizing: "border-box" }} />
    </div>
  );
}

/** カードのミニチュア表記用ヘルパー */
function MiniCard({ emoji, label, color, border }: { emoji: string; label: string; color: string; border: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "6px 12px",
      background: color, border: `2px solid ${border}`, borderRadius: 10,
      width: "85%", justifyContent: "center", boxShadow: "0 2px 5px rgba(0,0,0,0.08)"
    }}>
      <span style={{ fontSize: 16 }}>{emoji}</span>
      <span style={{ fontSize: 12.5, fontWeight: 900, color: "#0f172a" }}>{label}</span>
    </div>
  );
}
