"use client";

/* ══════════════════════════════════════════════════════════
   チュートリアル・オーバーレイ — app/editor/TutorialOverlay.tsx

   はじめての人に、アドオン作りの流れを 5枚のカードで見せる。

   ⚠️ 作り直しの理由（2026-08-23）:
     前は4ページに文字を詰めていて「読みにくい」と言われた。
     スマホでは1ページが画面に収まらず、縦スクロールしないと
     本文の続きにも「つぎへ」にも辿り着けなかった。

   設計の芯:
     ・1枚 = 1つのことだけ。文字は短く、絵を大きく
     ・**縦にスクロールさせない。** 横スワイプで送る
     ・スワイプは CSS の scroll-snap に任せる。指に追従してヌルッと止まる。
       JSでドラッグを再実装すると WebView で取りこぼす
     ・小さい端末でも収まるよう、寸法は全部 clamp() で縮む

   ※ 単体で完結。LogicPanel から onClose を渡して使う。
   ══════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState } from "react";
import HowToInstallModal from "./HowToInstallModal";
import { useEditorStore } from "./store";

/** 1枚ぶんの中身。title は上の帯に出る短い見出し */
interface Slide {
  key: string;
  title: string;
  body: React.ReactNode;
}

export default function TutorialOverlay({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<number>(0);
  const [showInstallGuide, setShowInstallGuide] = useState<boolean>(false);
  const projectName = useEditorStore((s) => s.projectName);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const slides: Slide[] = [
    {
      key: "what",
      title: "これ、なに？",
      body: (
        <Center>
          <Row>
            <Builder />
            <Arrow />
            <Chip bg="#ecfdf5" border="#10b981" color="#065f46">
              <div style={{ fontSize: "clamp(10px,2.8vw,12px)", fontWeight: 900, color: "#047857" }}>
                マイクラの拡張パック
              </div>
              <div style={{ fontSize: "clamp(15px,4.6vw,21px)", fontWeight: 900, fontFamily: "monospace" }}>
                .mcaddon
              </div>
            </Chip>
          </Row>
          <Lead>
            カードを ならべるだけで
            <br />
            マイクラに <B>新しい あそび</B> を ふやせる。
          </Lead>
          <Note>コードは 1行も 書きません。</Note>
        </Center>
      ),
    },
    {
      key: "kind",
      title: "アドオン？ MOD？",
      body: (
        <Center>
          <Lead>どっちも <B>マイクラを 作りかえるもの</B>。</Lead>
          <div style={{ display: "flex", flexDirection: "column", gap: "clamp(8px,2.4vw,12px)", width: "100%" }}>
            <Chip bg="#ecfdf5" border="#6ee7b7" color="#065f46" wide>
              <div style={{ fontSize: "clamp(13px,3.6vw,16px)", fontWeight: 900, color: "#047857" }}>
                🟢 アドオン
              </div>
              <div style={{ fontSize: "clamp(11px,3vw,13px)", fontWeight: 800 }}>
                スマホ・Switch・PC の 統合版
              </div>
            </Chip>
            <Chip bg="#fff7ed" border="#fdba74" color="#7c2d12" wide>
              <div style={{ fontSize: "clamp(13px,3.6vw,16px)", fontWeight: 900, color: "#c2410c" }}>
                🟠 MOD
              </div>
              <div style={{ fontSize: "clamp(11px,3vw,13px)", fontWeight: 800 }}>
                パソコンの Java版
              </div>
            </Chip>
          </div>
          <Note>どっちでも 作り方は おなじ。</Note>
        </Center>
      ),
    },
    {
      key: "cards",
      title: "カードは 2しゅるい",
      body: (
        <Center>
          <Row>
            <Chip bg="#fef9c3" border="#d97706" color="#713f12">
              <div style={{ fontSize: "clamp(22px,6.5vw,30px)" }}>⚡</div>
              <div style={{ fontSize: "clamp(12px,3.4vw,15px)", fontWeight: 900 }}>きっかけ</div>
              <div style={{ fontSize: "clamp(10px,2.8vw,12px)", fontWeight: 800 }}>〜した とき</div>
            </Chip>
            <Chip bg="#e0f2fe" border="#0284c7" color="#0c4a6e">
              <div style={{ fontSize: "clamp(22px,6.5vw,30px)" }}>✨</div>
              <div style={{ fontSize: "clamp(12px,3.4vw,15px)", fontWeight: 900 }}>すること</div>
              <div style={{ fontSize: "clamp(10px,2.8vw,12px)", fontWeight: 800 }}>〜に なる</div>
            </Chip>
          </Row>
          <Lead>
            この <B>2まいセット</B> で
            <br />
            マイクラの ルールが できる。
          </Lead>
          <Note>まずは 黄色の「きっかけ」から おいてみよう。</Note>
        </Center>
      ),
    },
    {
      key: "snap",
      title: "かさねないと 動かない",
      body: (
        <Center>
          <Row>
            <Compare label="はなれてる">
              <MiniCard emoji="⚡" label="たたいた とき" color="#facc15" border="#d97706" />
              <div style={{ height: "clamp(10px,3vw,16px)" }} />
              <MiniCard emoji="✨" label="ダイヤ" color="#38bdf8" border="#0284c7" />
            </Compare>
            <Compare ok label="ピタッと かさねる">
              <MiniCard emoji="⚡" label="たたいた とき" color="#facc15" border="#d97706" />
              <MiniCard emoji="✨" label="ダイヤ" color="#38bdf8" border="#0284c7" />
            </Compare>
          </Row>
          <Lead>
            <B>ここが いちばん だいじ。</B>
            <br />
            はなれていると うごきません。
          </Lead>
          <Note>青いカードを 黄色の上に かさねてね。</Note>
        </Center>
      ),
    },
    {
      key: "export",
      title: "できたら マイクラへ",
      body: (
        <Center>
          <Row>
            <Chip bg="linear-gradient(135deg,#22c55e,#15803d)" border="#052e16" color="#ffffff">
              <div style={{ fontSize: "clamp(13px,3.8vw,17px)", fontWeight: 900 }}>🎉 アドオン完成！</div>
            </Chip>
            <Arrow />
            <Chip bg="#0f172a" border="#475569" color="#38bdf8">
              <div style={{ fontSize: "clamp(13px,3.8vw,17px)", fontWeight: 900 }}>🚀 マイクラ</div>
            </Chip>
          </Row>
          <Lead>
            みどりの <B>「アドオン完成！」</B> を おすと
            <br />
            ファイルが できて 共有メニューが 出ます。
          </Lead>
          <button
            onClick={() => setShowInstallGuide(true)}
            style={{
              cursor: "pointer", background: "#10b981", color: "#ffffff",
              border: "2px solid #065f46", borderRadius: 12,
              padding: "clamp(8px,2.4vw,11px) clamp(14px,4vw,20px)",
              fontWeight: 900, fontSize: "clamp(11px,3.2vw,13.5px)",
            }}
          >
            🎮 くわしい 入れ方を 見る
          </button>
        </Center>
      ),
    },
  ];

  const last = slides.length - 1;
  const isLast = step === last;

  /** 指でスワイプした結果を、下のドットと ボタンに反映する。
   *  scroll イベントは細かく飛んでくるので、幅で割って四捨五入した
   *  「何枚目か」が変わったときだけ state を触る（毎回 setState すると重い） */
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const w = el.clientWidth || 1;
        const i = Math.max(0, Math.min(last, Math.round(el.scrollLeft / w)));
        setStep(prev => (prev === i ? prev : i));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [last]);

  /** ボタン・ドットから動かすとき。scroll-snap があるので left を渡すだけで吸い付く */
  const goTo = (i: number) => {
    const el = trackRef.current;
    const n = Math.max(0, Math.min(last, i));
    setStep(n);
    el?.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(15, 23, 42, 0.65)",
      backdropFilter: "blur(6px)",
      padding: "clamp(6px, 2.5vw, 16px)",
      fontFamily: '"Inter", "Hiragino Sans", "Meiryo", system-ui, sans-serif',
    }}>
      {/* ── 詳しい入れ方ガイド（連携） ── */}
      <HowToInstallModal isOpen={showInstallGuide} onClose={() => setShowInstallGuide(false)} projectName={projectName} />

      <div style={{
        position: "relative",
        width: "100%",
        maxWidth: 560,
        // 画面より高くしない。ここを切らないと下の「つぎへ」が画面外に出る。
        // 100% は親（inset:0 の fixed）基準なので、アドレスバーの出入りにも付いてくる
        height: "min(620px, 100%)",
        maxHeight: "100%",
        borderRadius: 24,
        background: "linear-gradient(145deg, #ffffff 0%, #fefce8 100%)",
        border: "4px solid #f59e0b",
        boxShadow: "0 20px 50px rgba(0, 0, 0, 0.25)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        color: "#1e293b",
        animation: "to-fadeIn 0.25s ease-out both",
      }}>
        <style>{`
          .to-track { scrollbar-width: none; -ms-overflow-style: none; }
          .to-track::-webkit-scrollbar { display: none; }
          .to-slide, .to-slide * { box-sizing: border-box; min-width: 0; }
          @keyframes to-fadeIn { 0% { opacity: 0; transform: scale(0.96); } 100% { opacity: 1; transform: scale(1); } }
          @keyframes to-nudge { 0%,100% { transform: translateX(0); } 50% { transform: translateX(5px); } }
        `}</style>

        {/* ── 見出し ── */}
        <div style={{
          background: "linear-gradient(90deg, #f59e0b 0%, #d97706 100%)",
          padding: "clamp(9px, 2.8vw, 14px) clamp(13px, 4vw, 22px)",
          flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
          borderBottom: "4px solid #b45309", color: "#ffffff",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: "clamp(18px, 5vw, 24px)", flexShrink: 0 }}>📖</span>
            <h2 style={{
              fontSize: "clamp(14px, 4.2vw, 20px)", fontWeight: 900, margin: 0,
              lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {slides[step].title}
            </h2>
          </div>
          <button
            onClick={onClose}
            title="説明をとじます"
            style={{
              cursor: "pointer", width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
              border: "2px solid rgba(255, 255, 255, 0.4)", background: "rgba(0, 0, 0, 0.2)",
              color: "#ffffff", fontWeight: 900, fontSize: 16,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        {/* ── 本体：横スワイプ。1枚が画面ぴったりで、縦には伸ばさない ── */}
        <div
          ref={trackRef}
          className="to-track"
          style={{
            flex: 1, minHeight: 0,
            display: "flex", flexDirection: "row",
            overflowX: "auto", overflowY: "hidden",
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
            overscrollBehaviorX: "contain",
          }}
        >
          {slides.map(s => (
            <div
              key={s.key}
              className="to-slide"
              style={{
                flex: "0 0 100%", width: "100%", height: "100%",
                scrollSnapAlign: "start", scrollSnapStop: "always",
                padding: "clamp(12px, 3.6vw, 22px)",
                display: "flex", flexDirection: "column", justifyContent: "center",
                // 収まる設計だが、極端に小さい端末で中身が消えないよう逃げ道だけ残す
                overflowY: "auto",
              }}
            >
              {s.body}
            </div>
          ))}
        </div>

        {/* ── 足もと：ドットと 送りボタン ── */}
        <div style={{
          background: "#f8fafc", borderTop: "1px solid #e2e8f0",
          padding: "clamp(8px, 2.6vw, 13px) clamp(12px, 4vw, 22px)",
          flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {slides.map((s, i) => (
              <div
                key={s.key}
                onClick={() => goTo(i)}
                style={{
                  cursor: "pointer", width: step === i ? 26 : 11, height: 11,
                  borderRadius: 9999,
                  background: step === i ? "#d97706" : "#cbd5e1",
                  transition: "width 0.2s, background 0.2s",
                }}
              />
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {step > 0 && (
              <button
                onClick={() => goTo(step - 1)}
                style={{
                  cursor: "pointer", background: "#f1f5f9", border: "1px solid #cbd5e1",
                  color: "#475569", fontWeight: 800, borderRadius: 12,
                  padding: "clamp(7px,2.2vw,9px) clamp(12px,3.6vw,18px)",
                  fontSize: "clamp(12px,3.4vw,14px)",
                }}
              >
                ◀
              </button>
            )}
            {!isLast ? (
              <button
                onClick={() => goTo(step + 1)}
                style={{
                  cursor: "pointer", background: "#f59e0b", border: "2px solid #b45309",
                  color: "#ffffff", fontWeight: 900, borderRadius: 12,
                  padding: "clamp(7px,2.2vw,9px) clamp(16px,4.6vw,24px)",
                  fontSize: "clamp(12px,3.4vw,14.5px)",
                  boxShadow: "0 3px 6px rgba(245, 158, 11, 0.3)",
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}
              >
                つぎへ
                <span style={{ animation: "to-nudge 1.4s ease-in-out infinite" }}>▶</span>
              </button>
            ) : (
              <button
                onClick={onClose}
                style={{
                  cursor: "pointer", background: "#10b981", border: "2px solid #065f46",
                  color: "#ffffff", fontWeight: 900, borderRadius: 12,
                  padding: "clamp(7px,2.2vw,9px) clamp(14px,4.2vw,24px)",
                  fontSize: "clamp(12px,3.4vw,14.5px)",
                  boxShadow: "0 4px 10px rgba(16, 185, 129, 0.3)",
                }}
              >
                🌟 作ってみる！
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────── 1枚の中の並べ方をそろえる小さな部品 ────────── */

/** 縦まんなか寄せ。すべてのスライドがこの形なので、枚数が増えても崩れない */
function Center({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", gap: "clamp(10px,3vw,18px)",
      textAlign: "center", width: "100%", margin: "auto",
    }}>
      {children}
    </div>
  );
}

/** 絵の段。狭い端末では折り返す */
function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      gap: "clamp(8px,2.6vw,16px)", flexWrap: "wrap", width: "100%",
    }}>
      {children}
    </div>
  );
}

/** いちばん言いたいこと。ここだけ少し大きく */
function Lead({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      margin: 0, fontSize: "clamp(13px,3.8vw,17px)", fontWeight: 800,
      color: "#78350f", lineHeight: 1.7,
    }}>
      {children}
    </p>
  );
}

/** 補足。読み飛ばしても困らないことだけ書く */
function Note({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      margin: 0, fontSize: "clamp(11px,3vw,13px)", fontWeight: 700,
      color: "#94a3b8", lineHeight: 1.6,
    }}>
      {children}
    </p>
  );
}

function B({ children }: { children: React.ReactNode }) {
  return <b style={{ color: "#b45309" }}>{children}</b>;
}

function Arrow() {
  return <div style={{ fontSize: "clamp(18px,5vw,24px)", fontWeight: 900, color: "#d97706" }}>➜</div>;
}

function Chip({ children, bg, border, color, wide }: {
  children: React.ReactNode; bg: string; border: string; color: string; wide?: boolean;
}) {
  return (
    <div style={{
      background: bg, border: `3px solid ${border}`, color,
      borderRadius: 16, padding: "clamp(9px,2.6vw,14px) clamp(12px,3.4vw,18px)",
      boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
      width: wide ? "100%" : undefined, textAlign: wide ? "left" : "center",
    }}>
      {children}
    </div>
  );
}

/** ❌／⭕ の比較。文章で説明するより、並べて見せたほうが早い */
function Compare({ ok, label, children }: { ok?: boolean; label: string; children: React.ReactNode }) {
  return (
    <div style={{
      flex: "1 1 42%", minWidth: 0,
      background: ok ? "#ecfdf5" : "#f8fafc",
      border: ok ? "2px solid #10b981" : "2px dashed #94a3b8",
      borderRadius: 14, padding: "clamp(8px,2.4vw,12px)",
      display: "flex", flexDirection: "column", alignItems: "center",
    }}>
      <div style={{
        fontSize: "clamp(10px,2.9vw,13px)", fontWeight: 900,
        color: ok ? "#047857" : "#64748b", marginBottom: "clamp(6px,1.8vw,9px)",
      }}>
        {ok ? "⭕" : "❌"} {label}
      </div>
      {children}
    </div>
  );
}

/** チュートリアル用のミニマイクラ風キャラクター（ブランド色エメラルドで構成） */
function Builder() {
  return (
    <div style={{ width: "clamp(38px,11vw,48px)", height: "clamp(50px,14.6vw,64px)", position: "relative", flexShrink: 0 }}>
      <div style={{ position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)", width: "75%", height: 7, borderRadius: "50%", background: "rgba(0,0,0,0.15)" }} />
      <div style={{ position: "absolute", top: 0, left: "12%", width: "75%", height: "47%", borderRadius: 8, background: "linear-gradient(#fcd9a0,#f0b970)", border: "3px solid #b07a3a", boxSizing: "border-box" }}>
        <div style={{ position: "absolute", top: "33%", left: "17%", width: 5, height: 6, background: "#3b2a14", borderRadius: 2 }} />
        <div style={{ position: "absolute", top: "33%", right: "17%", width: 5, height: 6, background: "#3b2a14", borderRadius: 2 }} />
      </div>
      <div style={{ position: "absolute", top: "44%", left: "21%", width: "58%", height: "50%", borderRadius: 7, background: "linear-gradient(#34d399,#10b981)", border: "3px solid #065f46", boxSizing: "border-box" }} />
    </div>
  );
}

/** カードのミニチュア表記用ヘルパー */
function MiniCard({ emoji, label, color, border }: { emoji: string; label: string; color: string; border: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      padding: "clamp(5px,1.6vw,7px) clamp(7px,2.2vw,12px)",
      background: color, border: `2px solid ${border}`, borderRadius: 10,
      width: "100%", boxShadow: "0 2px 5px rgba(0,0,0,0.08)",
    }}>
      <span style={{ fontSize: "clamp(12px,3.4vw,16px)" }}>{emoji}</span>
      <span style={{ fontSize: "clamp(9.5px,2.7vw,12.5px)", fontWeight: 900, color: "#0f172a", whiteSpace: "nowrap" }}>{label}</span>
    </div>
  );
}
