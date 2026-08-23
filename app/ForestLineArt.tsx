"use client";

import React, { useMemo } from "react";

export default function ForestLineArt() {
  const leaves = useMemo(() => {
    const items: React.ReactNode[] = [];
    
    // 大人っぽくオーガニックな「ユーカリ」や「オリーブ」のような、
    // しなやかで美しい曲線の茎を3本定義します。
    const branches = [
      // 左下から左上へ（画面左端を縁取る）
      { startX: -100, startY: 1000, endX: 200, endY: -100, curveHeight: 300, scale: 1 },
      // 右下から右上へ（画面右端を縁取る）
      { startX: 1600, startY: 1000, endX: 1200, endY: -100, curveHeight: -300, scale: 0.8 },
      // 右上の角から少し垂れ下がる枝
      { startX: 1600, startY: -100, endX: 1000, endY: 300, curveHeight: -150, scale: 0.6 },
      // 左下の角から少し伸びる短い枝
      { startX: -200, startY: 900, endX: 300, endY: 1000, curveHeight: 150, scale: 0.5 },
    ];

    branches.forEach((b, bIdx) => {
      // ベジェ曲線の制御点
      const qx = (b.startX + b.endX) / 2;
      const qy = b.startY - b.curveHeight;

      // 茎（極細の線で上品に）
      items.push(
        <path
          key={`stem-${bIdx}`}
          d={`M ${b.startX} ${b.startY} Q ${qx} ${qy} ${b.endX} ${b.endY}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={0.8 * b.scale}
        />
      );

      // 茎に沿って葉っぱを配置
      const steps = 30; // 葉の数
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        
        // ベジェ曲線上の現在位置を計算
        const x = (1 - t) * (1 - t) * b.startX + 2 * (1 - t) * t * qx + t * t * b.endX;
        const y = (1 - t) * (1 - t) * b.startY + 2 * (1 - t) * t * qy + t * t * b.endY;

        // 接線の角度（茎の流れる向き）を計算
        const dx = 2 * (1 - t) * (qx - b.startX) + 2 * t * (b.endX - qx);
        const dy = 2 * (1 - t) * (qy - b.startY) + 2 * t * (b.endY - qy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        // オリーブやユーカリのように、左右に交互に葉をつける（互生）
        const side = i % 2 === 0 ? 1 : -1;
        // 茎の進行方向に対して斜め前方に葉を向ける
        const leafAngle = angle + side * (35 + Math.random() * 15);
        
        // 端に行くほど葉を小さくする（自然なボタニカル感）
        const leafSize = (40 + Math.random() * 20) * b.scale * Math.sin(t * Math.PI);
        
        if (leafSize < 5) continue; // 小さすぎる葉は描画しない

        // 葉の輪郭（繊細なアーモンド型）
        const leafPath = `M 0 0 C ${leafSize/3} ${-leafSize/3}, ${leafSize*2/3} ${-leafSize/3}, ${leafSize} 0 C ${leafSize*2/3} ${leafSize/3}, ${leafSize/3} ${leafSize/3}, 0 0`;

        items.push(
          <g key={`leaf-${bIdx}-${i}`} transform={`translate(${x}, ${y}) rotate(${leafAngle})`}>
            {/* 葉脈（さらに細い線） */}
            <path d={`M 0 0 Q ${leafSize/2} ${leafSize/10} ${leafSize*0.9} 0`} fill="none" stroke="currentColor" strokeWidth={0.3 * b.scale} />
            {/* 葉の輪郭 */}
            <path d={leafPath} fill="none" stroke="currentColor" strokeWidth={0.6 * b.scale} />
          </g>
        );
      }
    });

    return items;
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden mix-blend-screen opacity-[0.12]">
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1440 800"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
        style={{ color: "#6ee7b7" }} // 大人っぽい淡いセージグリーン
      >
        <g strokeLinecap="round" strokeLinejoin="round">
          {leaves}
        </g>
      </svg>
    </div>
  );
}
