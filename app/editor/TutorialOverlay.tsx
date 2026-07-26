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

interface Props {
  onClose: () => void;
}

export default function TutorialOverlay({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<number>(0);
  const [showInstallGuide, setShowInstallGuide] = useState<boolean>(false);

  const steps = [
    { title: "これはなにができる道具？", subtitle: "〜 魔法のアドオンづくり 〜" },
    { title: "ステップ1：『きっかけ』をえらぶ", subtitle: "〜 すべてはここから始まる 〜" },
    { title: "ステップ2：『すること』をピタッ！と重ねる", subtitle: "〜 超重要！繋がらないと動かない 〜" },
    { title: "完成したらマイクラの世界へ！", subtitle: "〜 夢の世界で遊びつくそう 〜" },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(15, 23, 42, 0.65)",
      backdropFilter: "blur(6px)",
      padding: 16,
      fontFamily: '"Inter", "Hiragino Sans", "Meiryo", system-ui, sans-serif'
    }}>
      {/* ── 詳しい入れ方ガイド（連携） ── */}
      <HowToInstallModal isOpen={showInstallGuide} onClose={() => setShowInstallGuide(false)} />

      <div style={{
        position: "relative",
        width: "100%",
        maxWidth: 640,
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
        <style>{`
          @keyframes to-fadeIn { 0% { opacity: 0; transform: scale(0.96); } 100% { opacity: 1; transform: scale(1); } }
          @keyframes to-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
          @keyframes to-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        `}</style>

        {/* ── トップ・タイトルヘッダー（明るいトランプ/ TC G風バナー） ── */}
        <div style={{
          background: "linear-gradient(90deg, #f59e0b 0%, #d97706 100%)",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "4px solid #b45309",
          color: "#ffffff"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 26 }}>📖</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#fef08a", letterSpacing: "0.05em" }}>
                {current.subtitle}
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 900, margin: 0, letterSpacing: "0.02em" }}>
                {current.title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            title="説明をとじます"
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
        <div style={{ padding: "24px 28px", minHeight: 310, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          
          {/* STEP 0: これは何？ */}
          {step === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20, alignItems: "center", textAlign: "center" }}>
              <div style={{ display: "flex", gap: 16, alignItems: "center", justifyContent: "center", marginTop: 10 }}>
                <Builder />
                <div style={{ fontSize: 24, fontWeight: 900, color: "#d97706" }}>➜ 🎁</div>
                <div style={{
                  padding: "12px 18px", borderRadius: 16, background: "#ecfdf5", border: "3px solid #10b981",
                  boxShadow: "0 4px 10px rgba(16, 185, 129, 0.15)", textAlign: "left"
                }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#047857" }}>マイクラの拡張パック</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: "#065f46", fontFamily: "monospace" }}>✨ .mcaddon</div>
                </div>
              </div>
              <div style={{ background: "#fffbeb", border: "2px solid #fef08a", borderRadius: 16, padding: "16px 20px", textAlign: "left" }}>
                <p style={{ fontSize: 15, fontWeight: 800, color: "#78350f", margin: 0, lineHeight: 1.6 }}>
                  ここはマイクラの世界に新しい遊び方やルールを追加する魔法のパワーアップパック（＝<b>「アドオン」</b>）を、
                  <b>プログラミングのコードを１行も書かずに作れる場所</b>だよ！
                </p>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#92400e", margin: "10px 0 0 0", lineHeight: 1.6 }}>
                  作ったカードの組み合わせが <span style={{ background: "#fef08a", padding: "2px 6px", borderRadius: 6, fontWeight: 900 }}>.mcaddon</span> （エムシー・アドオン）というファイルになり、
                  君のいつものマイクラに読み込むだけで本当に動き出すんだ！
                </p>
              </div>
            </div>
          )}

          {/* STEP 1: きっかけを置く */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "center" }}>
              <div style={{ background: "#fef08a", border: "3px solid #d97706", borderRadius: 16, padding: "12px 24px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 6px 16px rgba(217, 119, 6, 0.2)", animation: "to-bounce 2s ease-in-out infinite" }}>
                <span style={{ fontSize: 32 }}>⚡</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 900, color: "#854d0e" }}>スタートの条件カード</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#451a03" }}>「ブロックを叩いたとき」 など</div>
                </div>
              </div>
              <div style={{ background: "#ffffff", border: "2px solid #e2e8f0", borderRadius: 16, padding: "16px 20px" }}>
                <h4 style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 900, color: "#0f172a" }}>
                  ❓ そもそもプログラムってなに？
                </h4>
                <p style={{ fontSize: 14.5, fontWeight: 700, color: "#334155", margin: 0, lineHeight: 1.7 }}>
                  マイクラを動かすルールは、必ず <b>『きっかけ（〜したとき）』</b> と <b>『すること（〜なる）』</b> のセットで出来ています！
                  <br /><br />
                  だから、最初は画面下のキーボードから黄色の <b>『きっかけ』</b> カードを選んで、空っぽのキャンバスにポンと置きましょう！すべてはそこから始まります！
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: することを重ねる（★最重要注意点！） */}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: "#fef2f2", border: "3px solid #ef4444", borderRadius: 16, padding: "12px 18px", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 26 }}>⚠️</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: "#991b1b" }}>
                    超重要な注意！ カードは『置いただけ』では動かないぞ！
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: "#b91c1c" }}>
                    バラバラに置いてあるカードは、マイクラが気づくことができません。
                  </div>
                </div>
              </div>

              {/* 比較グラフィック */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {/* NG例 */}
                <div style={{ background: "#f8fafc", border: "2px dashed #94a3b8", borderRadius: 14, padding: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#64748b", marginBottom: 8 }}>❌ 離れてバラバラ (動きません)</div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                    <MiniCard emoji="⚡" label="叩いたとき" color="#facc15" border="#d97706" />
                    <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 800 }}>▲ スキマが空いてる… ▲</span>
                    <MiniCard emoji="✨" label="ダイヤ獲得" color="#38bdf8" border="#0284c7" />
                  </div>
                </div>

                {/* OK例 */}
                <div style={{ background: "#ecfdf5", border: "2px solid #10b981", borderRadius: 14, padding: 12, textAlign: "center", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.15)" }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#047857", marginBottom: 8 }}>⭕ 上にピタッ！と重ねて接続！</div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
                    <MiniCard emoji="⚡" label="叩いたとき" color="#facc15" border="#d97706" />
                    <div style={{ margin: "-4px 0", zIndex: 2, fontSize: 16, color: "#10b981", fontWeight: 900 }}>🔗 接続完了！</div>
                    <MiniCard emoji="✨" label="ダイヤ獲得" color="#38bdf8" border="#0284c7" />
                  </div>
                </div>
              </div>

              <p style={{ fontSize: 13.5, fontWeight: 800, color: "#334155", margin: 0, textAlign: "center" }}>
                💡 <b>『こと（青カード）』</b> を持って、<b>『きっかけ（黄カード）』の上にピッタリ重ねよう！</b>
                <br />上下がくっついて繋がることで、初めて魔法のアドオンが発動します！
              </p>
            </div>
          )}

          {/* STEP 3: 完成とダウンロード */}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{
                  padding: "12px 20px", borderRadius: 16, background: "linear-gradient(135deg, #22c55e, #15803d)",
                  color: "#ffffff", fontWeight: 900, fontSize: 18, boxShadow: "0 4px 12px rgba(34, 197, 94, 0.3)",
                  border: "3px solid #052e16", animation: "to-pulse 1.5s ease-in-out infinite"
                }}>
                  🎉 アドオン完成！
                </div>
                <div style={{ fontSize: 24, color: "#334155" }}>➜</div>
                <div style={{
                  padding: "12px 20px", borderRadius: 16, background: "#0f172a",
                  color: "#38bdf8", fontWeight: 900, fontSize: 18, border: "2px solid #475569"
                }}>
                  🚀 マイクラへ導入
                </div>
              </div>

              <div style={{ background: "#ffffff", border: "2px solid #e2e8f0", borderRadius: 16, padding: "16px", width: "100%" }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: "#334155", margin: 0, lineHeight: 1.7 }}>
                  1. カードを正しくつないだら、右下の明るい緑の <b>『アドオン完成！🎉』</b> ボタンを押します。
                  <br />
                  2. 画面の指示にしたがって <b>「.mcaddon」</b> をダウンロード！
                  <br />
                  3. ダブルクリックで開いて、いつものマイクラで遊び込もう！
                </p>
                <div style={{ textAlign: "center", marginTop: 14 }}>
                  <button
                    onClick={() => setShowInstallGuide(true)}
                    style={{
                      cursor: "pointer", background: "#10b981", color: "#ffffff", border: "2px solid #065f46",
                      borderRadius: 12, padding: "10px 18px", fontWeight: 900, fontSize: 13.5,
                      boxShadow: "0 2px 6px rgba(16, 185, 129, 0.3)", display: "inline-flex", alignItems: "center", gap: 6
                    }}
                  >
                    <span>🎮 詳しい「マイクラへの入れ方ガイド（スマホ/PC/Switch対応）」を見る</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── フッター・ステップ操作エリア ── */}
        <div style={{
          background: "#f8fafc",
          borderTop: "1px solid #e2e8f0",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
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
            {step > 0 ? (
              <button
                onClick={() => setStep(s => s - 1)}
                style={{
                  cursor: "pointer", background: "#f1f5f9", border: "1px solid #cbd5e1",
                  color: "#475569", fontWeight: 800, padding: "9px 18px", borderRadius: 12, fontSize: 14
                }}
              >
                ◀ 前へ
              </button>
            ) : (
              <div />
            )}

            {!isLast ? (
              <button
                onClick={() => setStep(s => s + 1)}
                style={{
                  cursor: "pointer", background: "#f59e0b", border: "2px solid #b45309",
                  color: "#ffffff", fontWeight: 900, padding: "9px 24px", borderRadius: 12, fontSize: 14.5,
                  boxShadow: "0 3px 6px rgba(245, 158, 11, 0.3)"
                }}
              >
                次へ進む ▶
              </button>
            ) : (
              <button
                onClick={onClose}
                style={{
                  cursor: "pointer", background: "#10b981", border: "2px solid #065f46",
                  color: "#ffffff", fontWeight: 900, padding: "9px 24px", borderRadius: 12, fontSize: 14.5,
                  boxShadow: "0 4px 10px rgba(16, 185, 129, 0.3)"
                }}
              >
                🌟 さあ、アドオンを作ろう！
              </button>
            )}
          </div>
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
