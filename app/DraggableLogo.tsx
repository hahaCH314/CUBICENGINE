"use client";
import { useState, useRef, useEffect } from "react";

export default function DraggableLogo() {
  const [mode, setMode] = useState<"css" | "physics">("css");
  const [pos, setPos] = useState({ x: 0, y: 0 });
  
  const logoRef = useRef<HTMLDivElement>(null);
  const velRef = useRef({ x: 0, y: 0 });
  const posRef = useRef({ x: 0, y: 0 });
  const lastMouse = useRef({ x: 0, y: 0, time: 0 });
  const isDragging = useRef(false);
  const rafRef = useRef<number | null>(null);

  const startDrag = (e: React.PointerEvent) => {
    if (mode === "css") {
      if (logoRef.current) {
        const rect = logoRef.current.getBoundingClientRect();
        posRef.current = { x: rect.left, y: rect.top };
        setPos(posRef.current);
      }
      setMode("physics");
    }
    
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY, time: performance.now() };
    velRef.current = { x: 0, y: 0 };
    
    // キャンセルされる前のアニメーションループを止める
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const moveDrag = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    
    const now = performance.now();
    const dt = now - lastMouse.current.time;
    
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    
    posRef.current = {
      x: posRef.current.x + dx,
      y: posRef.current.y + dy,
    };
    setPos(posRef.current);
    
    if (dt > 0) {
      // 速度を計算 (px / ms) -> px / frame (約16.6ms) に変換
      velRef.current = {
        x: (dx / dt) * 16.6,
        y: (dy / dt) * 16.6,
      };
    }
    
    lastMouse.current = { x: e.clientX, y: e.clientY, time: now };
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    
    // 物理エンジンスタート
    let lastFrameTime = performance.now();
    const tick = (now: number) => {
      if (isDragging.current) return;
      
      const dt = Math.min(now - lastFrameTime, 32); // Max 32ms delta to prevent huge jumps
      lastFrameTime = now;
      const timeScale = dt / 16.6;

      // 重力と空気抵抗
      velRef.current.y += 0.5 * timeScale; // gravity
      velRef.current.x *= Math.pow(0.99, timeScale);
      velRef.current.y *= Math.pow(0.99, timeScale);
      
      posRef.current.x += velRef.current.x * timeScale;
      posRef.current.y += velRef.current.y * timeScale;
      
      // 画面の端でバウンド
      const size = 200; // logo size
      const bounce = 0.7; // bounce energy retention
      
      if (posRef.current.x < 0) {
        posRef.current.x = 0;
        velRef.current.x *= -bounce;
      } else if (posRef.current.x > window.innerWidth - size) {
        posRef.current.x = window.innerWidth - size;
        velRef.current.x *= -bounce;
      }
      
      if (posRef.current.y < 0) {
        posRef.current.y = 0;
        velRef.current.y *= -bounce;
      } else if (posRef.current.y > window.innerHeight - size) {
        posRef.current.y = window.innerHeight - size;
        velRef.current.y *= -bounce;
        // 地面に落ちた時の摩擦
        velRef.current.x *= 0.9;
      }
      
      setPos({ ...posRef.current });
      
      // ほぼ止まったら終了？いや、ずっとそのまま転がらせておいても可愛い。
      rafRef.current = requestAnimationFrame(tick);
    };
    
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <a
      href={mode === "css" ? "https://cubicenginestudio.vercel.app/" : undefined}
      target={mode === "css" ? "_blank" : undefined}
      rel={mode === "css" ? "noopener noreferrer" : undefined}
      onClick={(e) => {
        // 物理モード中はリンク遷移を無効化
        if (mode === "physics") e.preventDefault();
      }}
      className={`flex items-center group relative w-14 h-full justify-center mix-blend-screen opacity-95 ${
        mode === "css" ? "animate-[lapAround_300s_ease-in-out_infinite]" : ""
      }`}
    >
      <div
        ref={logoRef}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={`w-[200px] h-[200px] ${
          mode === "css"
            ? "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-transform duration-700 hover:scale-110"
            : "fixed cursor-grab active:cursor-grabbing"
        }`}
        style={
          mode === "physics"
            ? {
                left: pos.x,
                top: pos.y,
                // ドラッグ中は回転しないが、投げた後は速度に応じて回るようにする
                transform: `rotate(${pos.x}deg)`,
                zIndex: 9999,
                touchAction: "none"
              }
            : undefined
        }
      >
        <img
          src="/studio-logo.jpg"
          alt="CUBICENGINEstudio"
          className="w-full h-full object-contain pointer-events-none"
        />
      </div>
    </a>
  );
}
