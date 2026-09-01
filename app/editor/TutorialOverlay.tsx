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
import { t } from "@/lib/i18n";

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
        <style>{t(locale, "editor_74aa97")}</style>

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
          
          {/* STEP 0: これは何？ */}
          {step === 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20, alignItems: "stretch", textAlign: "center", minWidth: 0 }}>
              <div style={{ display: "flex", gap: 16, alignItems: "center", justifyContent: "center", marginTop: 10, flexWrap: "wrap" }}>
                <Builder />
                <div style={{ fontSize: 24, fontWeight: 900, color: "#d97706" }}>➜ 🎁</div>
                <div style={{
                  padding: "12px 18px", borderRadius: 16,
                  background: isJava ? "#fff7ed" : "#ecfdf5",
                  border: `3px solid ${isJava ? "#f97316" : "#10b981"}`,
                  boxShadow: `0 4px 10px ${isJava ? "rgba(249, 115, 22, 0.15)" : "rgba(16, 185, 129, 0.15)"}`,
                  textAlign: "left"
                }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: isJava ? "#c2410c" : "#047857" }}>
                    {isJava ? t(locale, "editor_0ca37e") : t(locale, "editor_988105")}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: isJava ? "#7c2d12" : "#065f46", fontFamily: "monospace" }}>✨ {fileExt}</div>
                </div>
              </div>
              <div style={{ background: "#fffbeb", border: "2px solid #fef08a", borderRadius: 16, padding: "16px 20px", textAlign: "left" }}>
                <p style={{ fontSize: 15, fontWeight: 800, color: "#78350f", margin: 0, lineHeight: 1.6 }}>
                  {t(locale, "editor_30dc0a")}<b>{isJava ? "「MOD」" : t(locale, "editor_d3f16f")}</b>{t(locale, "editor_9af60b")}<b>{t(locale, "editor_28dfd5")}</b>{t(locale, "editor_43e51c")}</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#92400e", margin: "10px 0 0 0", lineHeight: 1.6 }}>
                  {t(locale, "editor_b1e7db")}<span style={{ background: "#fef08a", padding: "2px 6px", borderRadius: 6, fontWeight: 900 }}>{fileExt}</span>
                  {isJava ? t(locale, "editor_aed5c2") : t(locale, "editor_b0812e")}{t(locale, "editor_e79c1c")}</p>
              </div>

              {/* 「アドオン」も「MOD」も、知らない人には通じない言葉。
                  どちらも“マイクラを作りかえるもの”で、違いは遊んでいる版だけ、と先に伝える。
                  ここが分からないと、自分がどちらを作ればいいのかも決められない。 */}
              <div style={{
                background: "#ffffff", border: "2px dashed #cbd5e1", borderRadius: 16,
                padding: "14px 16px", textAlign: "left", width: "100%",
              }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#475569", marginBottom: 10 }}>
                  {t(locale, "editor_e22f2e")}</div>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: "#475569", margin: "0 0 12px 0", lineHeight: 1.65 }}>
                  {t(locale, "editor_a3052f")}<b>{t(locale, "editor_a1d473")}</b> {t(locale, "editor_f19166")}<b>{t(locale, "editor_42caa1")}</b> {t(locale, "editor_9176ff")}</p>
                {/* いま作っている版のほうを濃く出す。作り方は同じでも
                    「できるファイル・入れ方・必要なもの」は全部ちがうので、
                    ここで自分の版がどれかを掴めないと最後の一歩で詰まる。 */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{
                    background: "#ecfdf5", borderRadius: 12, padding: "10px 12px",
                    border: `2px solid ${!isJava ? "#10b981" : "#d1fae5"}`,
                    opacity: !isJava ? 1 : 0.65,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#047857" }}>
                      {t(locale, "editor_dee428")}<span style={{ fontSize: 11, color: "#059669" }}>{t(locale, "editor_012a84")}</span>
                      {!isJava && <span style={{ fontSize: 10, marginLeft: 6, background: "#10b981", color: "#fff", padding: "1px 6px", borderRadius: 999 }}>{t(locale, "editor_e407f4")}</span>}
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "#065f46", marginTop: 3, lineHeight: 1.55 }}>
                      {t(locale, "editor_d6258c")}<br />{t(locale, "editor_d949f2")}<b style={{ fontFamily: "monospace" }}>.mcaddon</b>
                      <br />{t(locale, "editor_8c4b3b")}<b>{t(locale, "editor_30f759")}</b>
                      <br />{t(locale, "editor_7abe3d")}<b>{t(locale, "editor_3609f9")}</b>
                    </div>
                  </div>
                  <div style={{
                    background: "#fff7ed", borderRadius: 12, padding: "10px 12px",
                    border: `2px solid ${isJava ? "#f97316" : "#fed7aa"}`,
                    opacity: isJava ? 1 : 0.65,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#c2410c" }}>
                      🟠 MOD <span style={{ fontSize: 11, color: "#ea580c" }}>{t(locale, "editor_5a8dc4")}</span>
                      {isJava && <span style={{ fontSize: 10, marginLeft: 6, background: "#f97316", color: "#fff", padding: "1px 6px", borderRadius: 999 }}>{t(locale, "editor_e407f4")}</span>}
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "#7c2d12", marginTop: 3, lineHeight: 1.55 }}>
                      {t(locale, "editor_7c7498")}<br />{t(locale, "editor_d949f2")}<b style={{ fontFamily: "monospace" }}>.jar</b>
                      <br />{t(locale, "editor_8c4b3b")}<b>{t(locale, "editor_4d8b70")}</b>
                      <br />{t(locale, "editor_7abe3d")}<b>Forge 1.20.1</b>
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", margin: "10px 0 0 0", lineHeight: 1.55 }}>
                  {t(locale, "editor_dca47e")}<b>{t(locale, "editor_d1ed52")}</b>{t(locale, "editor_317568")}</p>
              </div>
            </div>
          )}

          {/* STEP 1: きっかけを置く */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18, alignItems: "stretch", minWidth: 0 }}>
              <div style={{ background: "#fef08a", border: "3px solid #d97706", borderRadius: 16, padding: "12px 24px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 6px 16px rgba(217, 119, 6, 0.2)", animation: "to-bounce 2s ease-in-out infinite" }}>
                <span style={{ fontSize: 32 }}>⚡</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 900, color: "#854d0e" }}>{t(locale, "editor_5d127a")}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#451a03" }}>{t(locale, "editor_a47840")}</div>
                </div>
              </div>
              <div style={{ background: "#ffffff", border: "2px solid #e2e8f0", borderRadius: 16, padding: "16px 20px" }}>
                <h4 style={{ margin: "0 0 8px 0", fontSize: 16, fontWeight: 900, color: "#0f172a" }}>
                  {t(locale, "editor_3e512b")}</h4>
                <p style={{ fontSize: 14.5, fontWeight: 700, color: "#334155", margin: 0, lineHeight: 1.7 }}>
                  {t(locale, "editor_eb1b55")}<b>{t(locale, "editor_76aba4")}</b> {t(locale, "editor_a5401f")}<b>{t(locale, "editor_05c48f")}</b> {t(locale, "editor_7e3f92")}<br /><br />
                  {t(locale, "editor_ba01eb")}<b>{t(locale, "editor_5bd5c2")}</b> {t(locale, "editor_9d8359")}</p>
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
                    {t(locale, "editor_e4c527")}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: "#b91c1c" }}>
                    {t(locale, "editor_7105f4")}</div>
                </div>
              </div>

              {/* 比較グラフィック */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {/* NG例 */}
                <div style={{ background: "#f8fafc", border: "2px dashed #94a3b8", borderRadius: 14, padding: 12, textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#64748b", marginBottom: 8 }}>{t(locale, "editor_696aa4")}</div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                    <MiniCard emoji="⚡" label={t(locale, "editor_692c90")} color="#facc15" border="#d97706" />
                    <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 800 }}>{t(locale, "editor_c3b73a")}</span>
                    <MiniCard emoji="✨" label={t(locale, "editor_aa9200")} color="#38bdf8" border="#0284c7" />
                  </div>
                </div>

                {/* OK例 */}
                <div style={{ background: "#ecfdf5", border: "2px solid #10b981", borderRadius: 14, padding: 12, textAlign: "center", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.15)" }}>
                  {/* ⚠️ この図が「正解」。文章とズレていたので、図のほうに合わせて
                      「きっかけが上」だと言い切る形にした（2026-08-31） */}
                  <div style={{ fontSize: 13, fontWeight: 900, color: "#047857", marginBottom: 8 }}>{t(locale, "editor_5bb2a9")}</div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 900, color: "#047857", marginBottom: 2 }}>{t(locale, "editor_e82a67")}</div>
                    <MiniCard emoji="⚡" label={t(locale, "editor_692c90")} color="#facc15" border="#d97706" />
                    <div style={{ margin: "-4px 0", zIndex: 2, fontSize: 16, color: "#10b981", fontWeight: 900 }}>{t(locale, "editor_4313c6")}</div>
                    <MiniCard emoji="✨" label={t(locale, "editor_aa9200")} color="#38bdf8" border="#0284c7" />
                    <div style={{ fontSize: 10, fontWeight: 900, color: "#047857", marginTop: 2 }}>{t(locale, "editor_08bfbb")}</div>
                  </div>
                </div>
              </div>

              <p style={{ fontSize: 13.5, fontWeight: 800, color: "#334155", margin: 0, textAlign: "center" }}>
                {/* ⚠️ ここの言い回しで実際に事故が起きた（2026-08-31）。
                    「黄カードの上に重ねる」と書いてあったので、青を上・黄を下に置いた人が居た。
                    この仕組みは nextId＝**下**につながるカードを実行するので、
                    その並びだと きっかけ の下に何も無い＝**何も起きない抜け殻**になる。
                    しかも書き出しは成功してしまうので、誰も間違いに気づけない。
                    「上下」ではなく「どっちが先か」で書くこと。 */}
                💡 <b>{t(locale, "editor_4e20c7")}</b>
                {t(locale, "editor_caa28a")}<b>{t(locale, "editor_ecf147")}</b>
                <br />
                <span style={{ color: "#b91c1c" }}>
                  {t(locale, "editor_96fbdf")}</span>
                <br />{t(locale, "editor_f47092")}</p>
            </div>
          )}

          {/* STEP 3: 完成とダウンロード */}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, alignItems: "stretch", minWidth: 0 }}>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <div style={{
                  padding: "12px 20px", borderRadius: 16, background: "linear-gradient(135deg, #22c55e, #15803d)",
                  color: "#ffffff", fontWeight: 900, fontSize: 18, boxShadow: "0 4px 12px rgba(34, 197, 94, 0.3)",
                  border: "3px solid #052e16", animation: "to-pulse 1.5s ease-in-out infinite"
                }}>
                  🎉 {isJava ? "MOD" : t(locale, "editor_b6e715")}{t(locale, "editor_2cd9ed")}</div>
                <div style={{ fontSize: 24, color: "#334155" }}>➜</div>
                <div style={{
                  padding: "12px 20px", borderRadius: 16, background: "#0f172a",
                  color: "#38bdf8", fontWeight: 900, fontSize: 18, border: "2px solid #475569"
                }}>
                  {t(locale, "editor_6d0609")}</div>
              </div>

              <div style={{ background: "#ffffff", border: "2px solid #e2e8f0", borderRadius: 16, padding: "16px", width: "100%" }}>
                {isJava ? (
                  <p style={{ fontSize: 14, fontWeight: 800, color: "#334155", margin: 0, lineHeight: 1.7 }}>
                    {t(locale, "editor_9e407d")}<b>{t(locale, "editor_da59bb")}</b> {t(locale, "editor_91712f")}<br />
                    2. <b>「.jar」</b> {t(locale, "editor_0c42dc")}<br />
                    {t(locale, "editor_faa436")}<b>{t(locale, "editor_9d8f97")}</b> {t(locale, "editor_15c1ff")}<b>「forge」</b> {t(locale, "editor_457718")}<br />
                    <span style={{ color: "#c2410c" }}>
                      {t(locale, "editor_f5ea59")}<b>{t(locale, "editor_fcd560")}</b>{t(locale, "punct.period")}<b>Forge 1.20.1</b> {t(locale, "editor_5b9654")}</span>
                  </p>
                ) : (
                  <p style={{ fontSize: 14, fontWeight: 800, color: "#334155", margin: 0, lineHeight: 1.7 }}>
                    {t(locale, "editor_9e407d")}<b>{t(locale, "editor_24ba24")}</b> {t(locale, "editor_91712f")}<br />
                    {t(locale, "editor_e21a3f")}<b>「.mcaddon」</b> {t(locale, "editor_866f02")}<br />
                    {t(locale, "editor_babeb1")}</p>
                )}
                <div style={{ textAlign: "center", marginTop: 14 }}>
                  <button
                    onClick={() => setShowInstallGuide(true)}
                    style={{
                      cursor: "pointer", background: "#10b981", color: "#ffffff", border: "2px solid #065f46",
                      borderRadius: 12, padding: "10px 18px", fontWeight: 900, fontSize: 13.5,
                      boxShadow: "0 2px 6px rgba(16, 185, 129, 0.3)", display: "inline-flex", alignItems: "center", gap: 6
                    }}
                  >
                    <span>
                      {isJava
                        ? t(locale, "editor_bfa6e2")
                        : t(locale, "editor_90e2b8")}
                    </span>
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
            {step > 0 ? (
              <button
                onClick={() => setStep(s => s - 1)}
                style={{
                  cursor: "pointer", background: "#f1f5f9", border: "1px solid #cbd5e1",
                  color: "#475569", fontWeight: 800, padding: "9px 18px", borderRadius: 12, fontSize: 14
                }}
              >
                {t(locale, "editor_6cc1e5")}</button>
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
                {t(locale, "editor_a64996")}</button>
            ) : (
              <button
                onClick={onClose}
                style={{
                  cursor: "pointer", background: "#10b981", border: "2px solid #065f46",
                  color: "#ffffff", fontWeight: 900, padding: "9px 24px", borderRadius: 12, fontSize: 14.5,
                  boxShadow: "0 4px 10px rgba(16, 185, 129, 0.3)"
                }}
              >
                {t(locale, "editor_fdadc1")}</button>
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
