"use client";

/* ══════════════════════════════════════════════════════════
   レーザーの嵐 — app/LaserBlast.tsx

   Java版をダウンロードした瞬間だけ、宝箱を開けたみたいに光る。
   お祝いなので、機能は何も持たない。

   ⚠️ 邪魔をしないための決まり:
     - pointer-events: none。押した瞬間に出るので、絶対にクリックを奪わない
     - ダウンロードは止めない。落ち始めたうえで、上で勝手に光る
     - 2秒ちょっとで自分で消える。居座らない
   ⚠️ 目のこと:
     - 強い明滅は**毎秒3回未満**に抑える（光過敏性発作の目安）。
       「コンサートっぽく」を速さで出そうとしない。回転と伸びで出す
     - prefers-reduced-motion の人には、動かない静かな版を出す
   ══════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";

export interface Origin { x: number; y: number }

/** 光線の本数。増やすほど密になるが、多すぎると"線"ではなく"面"になる */
const BEAMS = 22;
/** 飛び散る粒 */
const SPARKS = 28;
/** 出てから消えるまで(ms)。これを過ぎたら DOM ごと片付ける */
const LIFE = 2300;

export default function LaserBlast({ origin, onDone }: { origin: Origin | null; onDone: () => void }) {
  const [calm, setCalm] = useState(false);

  useEffect(() => {
    // 動きを減らす設定の人には、静かな版を出す
    setCalm(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false);
  }, []);

  useEffect(() => {
    if (!origin) return;
    const id = window.setTimeout(onDone, LIFE);
    return () => window.clearTimeout(id);
  }, [origin, onDone]);

  if (!origin) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 99998, overflow: "hidden" }}
      aria-hidden
    >
      <style>{`
        /* 光線は「伸びる」で見せる。点滅で見せない（目に来るので） */
        @keyframes lb-beam {
          0%   { transform: scaleX(0); opacity: 0; }
          12%  { transform: scaleX(1); opacity: 0.95; }
          70%  { opacity: 0.55; }
          100% { transform: scaleX(1.15); opacity: 0; }
        }
        /* コンサートっぽさは回転で出す。ゆっくり薙ぎ払う */
        @keyframes lb-sweep {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(38deg); }
        }
        @keyframes lb-sweep-rev {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(-46deg); }
        }
        /* 宝箱を開けた瞬間の光。1回だけ強く光って、あとは引く */
        @keyframes lb-flash {
          0%   { opacity: 0; }
          8%   { opacity: 0.85; }
          100% { opacity: 0; }
        }
        /* 箱から立ちのぼる光の柱 */
        @keyframes lb-pillar {
          0%   { transform: translate(-50%, 0) scaleY(0); opacity: 0; }
          18%  { transform: translate(-50%, 0) scaleY(1); opacity: 0.9; }
          100% { transform: translate(-50%, 0) scaleY(1.1); opacity: 0; }
        }
        @keyframes lb-spark {
          0%   { transform: translate(0,0) scale(0.4); opacity: 0; }
          14%  { opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(1); opacity: 0; }
        }
      `}</style>

      {/* ひと呼吸ぶんの閃光。ここだけ強い。以降は明滅させない */}
      <div
        style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(circle at ${origin.x}px ${origin.y}px, rgba(255,255,255,0.95), rgba(125,211,252,0.35) 32%, transparent 62%)`,
          animation: calm ? "lb-flash 1.6s ease-out forwards" : "lb-flash 1.9s ease-out forwards",
        }}
      />

      {/* 光の柱。宝箱を開けたときのあれ */}
      <div
        style={{
          position: "absolute",
          left: origin.x,
          top: 0,
          width: 190,
          height: origin.y + 10,
          transformOrigin: "bottom center",
          background: "linear-gradient(to top, rgba(253,224,71,0.75), rgba(253,224,71,0.16) 55%, transparent)",
          filter: "blur(2px)",
          animation: "lb-pillar 2.1s cubic-bezier(0.15,0.8,0.2,1) forwards",
        }}
      />

      {/* レーザー本体。原点から放射状に伸ばして、束ごとゆっくり薙ぐ */}
      <div
        style={{
          position: "absolute", left: origin.x, top: origin.y,
          width: 0, height: 0,
          transformOrigin: "0 0",
          animation: calm ? undefined : "lb-sweep 2.2s ease-in-out forwards",
        }}
      >
        {Array.from({ length: BEAMS }).map((_, i) => {
          const deg = (360 / BEAMS) * i;
          // 交互に色を変える。黄＝宝物、水色＝Java版のブランド色
          const gold = i % 2 === 0;
          return (
            <div
              key={i}
              style={{
                position: "absolute", left: 0, top: 0,
                width: "140vmax", height: gold ? 5 : 3,
                transform: `rotate(${deg}deg)`,
                transformOrigin: "0 50%",
                background: gold
                  ? "linear-gradient(to right, rgba(255,255,255,0.95), rgba(253,224,71,0.75) 18%, rgba(253,224,71,0) 78%)"
                  : "linear-gradient(to right, rgba(255,255,255,0.95), rgba(125,211,252,0.7) 18%, rgba(56,189,248,0) 78%)",
                filter: "blur(0.4px)",
                animation: `lb-beam ${1.5 + (i % 5) * 0.14}s ease-out ${(i % 7) * 0.035}s forwards`,
              }}
            />
          );
        })}
      </div>

      {/* 逆回りの薄い束。2方向に薙ぐと一気にコンサートになる */}
      {!calm && (
        <div
          style={{
            position: "absolute", left: origin.x, top: origin.y,
            width: 0, height: 0, transformOrigin: "0 0",
            animation: "lb-sweep-rev 2.2s ease-in-out forwards",
            opacity: 0.5,
          }}
        >
          {Array.from({ length: Math.floor(BEAMS / 2) }).map((_, i) => {
            const deg = (360 / (BEAMS / 2)) * i + 9;
            return (
              <div
                key={i}
                style={{
                  position: "absolute", left: 0, top: 0,
                  width: "140vmax", height: 2,
                  transform: `rotate(${deg}deg)`,
                  transformOrigin: "0 50%",
                  background: "linear-gradient(to right, rgba(255,255,255,0.8), rgba(167,243,208,0.5) 20%, transparent 75%)",
                  animation: `lb-beam ${1.7 + (i % 4) * 0.12}s ease-out ${0.1 + (i % 5) * 0.04}s forwards`,
                }}
              />
            );
          })}
        </div>
      )}

      {/* 宝物の粒。飛び散って消える */}
      {!calm && Array.from({ length: SPARKS }).map((_, i) => {
        const a = (i / SPARKS) * Math.PI * 2 + i * 0.37;
        const dist = 160 + (i % 6) * 55;
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: origin.x, top: origin.y,
              width: i % 3 === 0 ? 9 : 6,
              height: i % 3 === 0 ? 9 : 6,
              borderRadius: 2,
              background: i % 3 === 0 ? "#fde047" : i % 3 === 1 ? "#7dd3fc" : "#ffffff",
              boxShadow: "0 0 12px currentColor",
              color: i % 3 === 0 ? "#fde047" : "#7dd3fc",
              animation: `lb-spark ${1.4 + (i % 5) * 0.16}s cubic-bezier(0.15,0.75,0.25,1) ${(i % 6) * 0.05}s forwards`,
              ["--dx" as string]: `${Math.cos(a) * dist}px`,
              ["--dy" as string]: `${Math.sin(a) * dist - 60}px`,
            }}
          />
        );
      })}
    </div>
  );
}
