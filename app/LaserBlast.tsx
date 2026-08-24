"use client";

/* ══════════════════════════════════════════════════════════
   レーザーの嵐 — app/LaserBlast.tsx

   Java版をダウンロードした瞬間だけ、宝箱を開けたみたいに光る。
   お祝いなので、機能は何も持たない。

   ⚠️ 本体を壊さないための決まり:
     - pointer-events: none。押した瞬間に出るので、絶対にクリックを奪わない
     - ダウンロードは止めない。落ち始めたうえで、上で勝手に光る
     - z-index は 99998。チュートリアル(99999)より下に置く
     - 時間で DOM ごと片付ける。居座らない
   ⚠️ 目のこと:
     - **明滅で派手さを出さない。** 強い光の点滅は毎秒3回未満に抑える
       （光過敏性発作の目安）。派手さは「量」「広がり」「動きの速さ」で出す
     - prefers-reduced-motion の人には、動きを削った静かな版を出す
   ⚠️ 出る場所:
     - 呼び出し元のボタンが hidden md:flex なので、スマホでは出ない。
       要素数が多いので、ここが変わるときは低スペック端末を考えること
   ══════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";

export interface Origin { x: number; y: number }

const BEAMS = 40;        // 主役の光線
const BEAMS_REV = 24;    // 逆回りの束
const SPOTS = 5;         // 上から降ってくるスポットライト
const RINGS = 4;         // 衝撃波の輪
const CUBES = 22;        // 飛び散るキューブ（ブランドなので四角）
const SPARKS = 44;       // 粒
const LIFE = 3400;       // 出てから片付けるまで(ms)

const GOLD = "#fde047";
const SKY = "#7dd3fc";
const MINT = "#a7f3d0";

export default function LaserBlast({ origin, onDone }: { origin: Origin | null; onDone: () => void }) {
  // ⚠️ effect で setState しない（描画のたびに一往復増える）。
  //    このコンポーネントは origin が入るまで null を返すので、
  //    最初の描画は必ずクリック後＝ブラウザの上。ここで読んで問題ない
  const [calm] = useState(
    () => typeof window !== "undefined" && (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false),
  );

  useEffect(() => {
    if (!origin) return;
    const id = window.setTimeout(onDone, LIFE);
    return () => window.clearTimeout(id);
  }, [origin, onDone]);

  if (!origin) return null;

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 99998, overflow: "hidden" }} aria-hidden>
      <style>{`
        /* 光線は「伸びる」で見せる。点滅では見せない */
        @keyframes lb-beam {
          0%   { transform: scaleX(0); opacity: 0; }
          10%  { transform: scaleX(1); opacity: 1; }
          70%  { opacity: 0.5; }
          100% { transform: scaleX(1.2); opacity: 0; }
        }
        /* コンサートっぽさは薙ぎ払いで出す */
        @keyframes lb-sweep      { from { transform: rotate(0deg); }   to { transform: rotate(64deg); } }
        @keyframes lb-sweep-rev  { from { transform: rotate(0deg); }   to { transform: rotate(-78deg); } }
        /* 上から降るスポットライト。左右にゆっくり振る */
        @keyframes lb-spot {
          0%   { transform: rotate(var(--a0)) scaleY(0); opacity: 0; }
          14%  { transform: rotate(var(--a0)) scaleY(1); opacity: 0.75; }
          60%  { transform: rotate(var(--a1)) scaleY(1); opacity: 0.6; }
          100% { transform: rotate(var(--a2)) scaleY(1); opacity: 0; }
        }
        /* 一拍だけの閃光。ここだけ強い。以降は明滅させない */
        @keyframes lb-flash { 0% { opacity: 0; } 7% { opacity: 0.9; } 100% { opacity: 0; } }
        /* 宝箱から立ちのぼる光の柱 */
        @keyframes lb-pillar {
          0%   { transform: translateX(-50%) scaleY(0) scaleX(0.6); opacity: 0; }
          16%  { transform: translateX(-50%) scaleY(1) scaleX(1);   opacity: 0.95; }
          100% { transform: translateX(-50%) scaleY(1.12) scaleX(1.5); opacity: 0; }
        }
        /* 衝撃波 */
        @keyframes lb-ring {
          0%   { transform: translate(-50%,-50%) scale(0); opacity: 0.9; }
          100% { transform: translate(-50%,-50%) scale(1); opacity: 0; }
        }
        @keyframes lb-spark {
          0%   { transform: translate(0,0) scale(0.4); opacity: 0; }
          12%  { opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(1); opacity: 0; }
        }
        /* キューブは投げ上げて落とす。回しながら */
        @keyframes lb-cube {
          0%   { transform: translate(0,0) rotate(0deg) scale(0.3); opacity: 0; }
          10%  { opacity: 1; }
          55%  { transform: translate(calc(var(--dx) * 0.75), var(--peak)) rotate(var(--spin)) scale(1); opacity: 1; }
          100% { transform: translate(var(--dx), var(--fall)) rotate(calc(var(--spin) * 1.8)) scale(0.9); opacity: 0; }
        }
      `}</style>

      {/* ── 上から降るスポットライト。会場の天井のあれ ── */}
      {!calm && Array.from({ length: SPOTS }).map((_, i) => {
        const originX = (100 / (SPOTS + 1)) * (i + 1);
        const swing = i % 2 === 0 ? 1 : -1;
        return (
          <div
            key={`spot-${i}`}
            style={{
              position: "absolute",
              left: `${originX}%`,
              top: -40,
              width: 260,
              height: "135vh",
              marginLeft: -130,
              transformOrigin: "50% 0%",
              background: `linear-gradient(to bottom, ${i % 2 ? SKY : GOLD}55, ${i % 2 ? SKY : GOLD}12 45%, transparent 78%)`,
              clipPath: "polygon(46% 0%, 54% 0%, 100% 100%, 0% 100%)",
              filter: "blur(3px)",
              animation: `lb-spot ${2.9 + i * 0.16}s ease-in-out ${i * 0.09}s forwards`,
              ["--a0" as string]: `${-26 * swing}deg`,
              ["--a1" as string]: `${22 * swing}deg`,
              ["--a2" as string]: `${-14 * swing}deg`,
            }}
          />
        );
      })}

      {/* ── 一拍の閃光 ── */}
      <div
        style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(circle at ${origin.x}px ${origin.y}px, rgba(255,255,255,0.98), rgba(125,211,252,0.4) 30%, transparent 64%)`,
          animation: "lb-flash 2.1s ease-out forwards",
        }}
      />

      {/* ── 衝撃波の輪 ── */}
      {!calm && Array.from({ length: RINGS }).map((_, i) => {
        const c = i % 2 ? SKY : GOLD;
        return (
          <div
            key={`ring-${i}`}
            style={{
              // 画面の端まで届かせたいので、実寸を大きく取って scale 0→1 で広げる。
              // 小さい実寸を scale で拡大すると、線まで太って別物になる
              position: "absolute", left: origin.x, top: origin.y,
              width: "150vmax", height: "150vmax",
              borderRadius: "50%",
              border: `${4 - i * 0.7}px solid ${c}`,
              boxShadow: `0 0 26px ${c}, inset 0 0 26px ${c}`,
              transform: "translate(-50%,-50%) scale(0)",
              animation: `lb-ring ${1.6 + i * 0.3}s cubic-bezier(0.1,0.7,0.2,1) ${i * 0.16}s forwards`,
            }}
          />
        );
      })}

      {/* ── 光の柱 ── */}
      <div
        style={{
          position: "absolute",
          left: origin.x, top: 0,
          width: 210, height: origin.y + 12,
          transformOrigin: "bottom center",
          background: `linear-gradient(to top, ${GOLD}cc, ${GOLD}30 52%, transparent)`,
          filter: "blur(2px)",
          animation: "lb-pillar 2.6s cubic-bezier(0.15,0.8,0.2,1) forwards",
        }}
      />

      {/* ── レーザー本体（主役の束）── */}
      <Bundle
        origin={origin}
        count={BEAMS}
        sweep={calm ? undefined : "lb-sweep 3.0s ease-in-out forwards"}
        color={(i) => (i % 2 === 0
          ? `linear-gradient(to right, rgba(255,255,255,1), ${GOLD}d0 16%, ${GOLD}00 76%)`
          : `linear-gradient(to right, rgba(255,255,255,1), ${SKY}c0 16%, ${SKY}00 76%)`)}
        thickness={(i) => (i % 2 === 0 ? 6 : 3)}
        delayStep={0.028}
      />

      {/* ── 逆回りの束。2方向に薙ぐと一気に会場になる ── */}
      {!calm && (
        <Bundle
          origin={origin}
          count={BEAMS_REV}
          sweep="lb-sweep-rev 3.0s ease-in-out forwards"
          color={() => `linear-gradient(to right, rgba(255,255,255,0.9), ${MINT}90 18%, transparent 74%)`}
          thickness={() => 2}
          delayStep={0.036}
          opacity={0.6}
          offsetDeg={7}
        />
      )}

      {/* ── 飛び散るキューブ。ブランドなので四角 ── */}
      {!calm && Array.from({ length: CUBES }).map((_, i) => {
        const a = (i / CUBES) * Math.PI * 2 + i * 0.29;
        const dist = 220 + (i % 7) * 70;
        const dx = Math.cos(a) * dist;
        const size = 12 + (i % 4) * 6;
        const c = i % 3 === 0 ? GOLD : i % 3 === 1 ? SKY : "#f472b6";
        return (
          <span
            key={`cube-${i}`}
            style={{
              position: "absolute", left: origin.x, top: origin.y,
              width: size, height: size, borderRadius: 3,
              background: `linear-gradient(135deg, #ffffff, ${c})`,
              border: `1px solid rgba(0,0,0,0.25)`,
              boxShadow: `0 0 16px ${c}`,
              animation: `lb-cube ${2.0 + (i % 6) * 0.18}s cubic-bezier(0.2,0.7,0.3,1) ${(i % 8) * 0.045}s forwards`,
              ["--dx" as string]: `${dx}px`,
              ["--peak" as string]: `${-180 - (i % 5) * 60}px`,
              ["--fall" as string]: `${window.innerHeight}px`,
              ["--spin" as string]: `${(i % 2 ? 1 : -1) * (240 + (i % 4) * 120)}deg`,
            }}
          />
        );
      })}

      {/* ── 粒 ── */}
      {!calm && Array.from({ length: SPARKS }).map((_, i) => {
        const a = (i / SPARKS) * Math.PI * 2 + i * 0.41;
        const dist = 200 + (i % 6) * 80;
        return (
          <span
            key={`sp-${i}`}
            style={{
              position: "absolute", left: origin.x, top: origin.y,
              width: i % 3 === 0 ? 10 : 6, height: i % 3 === 0 ? 10 : 6,
              borderRadius: 2,
              background: i % 3 === 0 ? GOLD : i % 3 === 1 ? SKY : "#ffffff",
              boxShadow: `0 0 14px ${i % 3 === 0 ? GOLD : SKY}`,
              animation: `lb-spark ${1.6 + (i % 5) * 0.18}s cubic-bezier(0.15,0.75,0.25,1) ${(i % 7) * 0.05}s forwards`,
              ["--dx" as string]: `${Math.cos(a) * dist}px`,
              ["--dy" as string]: `${Math.sin(a) * dist - 70}px`,
            }}
          />
        );
      })}
    </div>
  );
}

/** 原点から放射状に伸びる光線の束。束ごと回して薙ぎ払う */
function Bundle({
  origin, count, sweep, color, thickness, delayStep, opacity = 1, offsetDeg = 0,
}: {
  origin: Origin;
  count: number;
  sweep?: string;
  color: (i: number) => string;
  thickness: (i: number) => number;
  delayStep: number;
  opacity?: number;
  offsetDeg?: number;
}) {
  return (
    <div
      style={{
        position: "absolute", left: origin.x, top: origin.y,
        width: 0, height: 0, transformOrigin: "0 0",
        animation: sweep, opacity,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            position: "absolute", left: 0, top: 0,
            width: "150vmax", height: thickness(i),
            transform: `rotate(${(360 / count) * i + offsetDeg}deg)`,
            transformOrigin: "0 50%",
            background: color(i),
            filter: "blur(0.4px)",
            animation: `lb-beam ${1.7 + (i % 5) * 0.15}s ease-out ${(i % 9) * delayStep}s forwards`,
          }}
        />
      ))}
    </div>
  );
}
