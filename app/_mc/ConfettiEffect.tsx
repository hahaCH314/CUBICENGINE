"use client";

import { useEffect, useRef } from "react";

interface Props {
  trigger: boolean;
  onComplete?: () => void;
}

export default function ConfettiEffect({ trigger, onComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!trigger) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // マイクラカラー（エメラルドグリーン、ダイヤモンドブルー、ゴールド、XPオーブグリーン、レッドストーンピンク）
    const colors = ["#10b981", "#38bdf8", "#facc15", "#22c55e", "#ec4899", "#a855f7"];
    const particles: Array<{
      x: number;
      y: number;
      size: number;
      color: string;
      vx: number;
      vy: number;
      rotation: number;
      rotSpeed: number;
      shape: "square" | "star";
      opacity: number;
    }> = [];

    const count = 70;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height / 3 + (Math.random() - 0.5) * 100,
        size: Math.random() * 12 + 6,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 14,
        vy: Math.random() * -12 - 4,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.2,
        shape: Math.random() > 0.4 ? "square" : "star",
        opacity: 1,
      });
    }

    let animationId: number;
    let startTime = Date.now();

    const render = () => {
      const elapsed = Date.now() - startTime;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let alive = false;

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.4; // 重力
        p.rotation += p.rotSpeed;

        if (elapsed > 1500) {
          p.opacity -= 0.03;
        }

        if (p.opacity > 0 && p.y < canvas.height + 50) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;

          if (p.shape === "square") {
            // ドットブロック風の四角
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          } else {
            // ダイヤ・星風のひし形
            ctx.beginPath();
            ctx.moveTo(0, -p.size);
            ctx.lineTo(p.size / 1.5, 0);
            ctx.lineTo(0, p.size);
            ctx.lineTo(-p.size / 1.5, 0);
            ctx.closePath();
            ctx.fill();
          }

          ctx.restore();
        }
      });

      if (alive && elapsed < 3000) {
        animationId = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (onComplete) onComplete();
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [trigger, onComplete]);

  if (!trigger) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[999999]"
    />
  );
}
