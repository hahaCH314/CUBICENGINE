"use client";
import { useEffect, useState, useRef } from "react";

type Particle = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rot: number;
  vRot: number;
  life: number;
};

export default function CubeParticles() {
  const [particles, setParticles] = useState<Particle[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const idCounter = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // CUBIC ENGINE brand colors: Emerald, Amber, Cyan, plus some white/gold
    const colors = ["#10b981", "#34d399", "#f59e0b", "#fbbf24", "#22d3ee", "#ffffff"];

    const handleClick = (e: MouseEvent) => {
      // aタグやbuttonをクリックした場合は発火させない
      if ((e.target as HTMLElement).closest("a, button, input")) return;

      const newParticles: Particle[] = [];
      // クリック箇所から8個のキューブが弾け飛ぶ
      for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 10 + 5;
        newParticles.push({
          id: idCounter.current++,
          x: e.clientX,
          y: e.clientY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 4, // 少し上に跳ねるように
          color: colors[Math.floor(Math.random() * colors.length)],
          size: Math.random() * 8 + 4,
          rot: Math.random() * 360,
          vRot: (Math.random() - 0.5) * 30,
          life: 1.0, // 1.0 = 100% opacity
        });
      }
      particlesRef.current = [...particlesRef.current, ...newParticles];
    };

    window.addEventListener("click", handleClick);

    let lastTime = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(now - lastTime, 32);
      lastTime = now;
      const timeScale = dt / 16.6;

      particlesRef.current = particlesRef.current.filter((p) => {
        p.vy += 0.5 * timeScale; // 重力
        p.x += p.vx * timeScale;
        p.y += p.vy * timeScale;
        p.rot += p.vRot * timeScale;
        
        // 地面（画面下端）でのバウンド
        if (p.y > window.innerHeight - p.size) {
          p.y = window.innerHeight - p.size;
          p.vy *= -0.6; // 反発係数
          p.vx *= 0.8; // 摩擦
        }
        
        // 画面の左右でのバウンド
        if (p.x < 0) {
          p.x = 0;
          p.vx *= -0.6;
        } else if (p.x > window.innerWidth - p.size) {
          p.x = window.innerWidth - p.size;
          p.vx *= -0.6;
        }

        // 止まったら徐々に消える
        if (p.y >= window.innerHeight - p.size - 1 && Math.abs(p.vy) < 1.5 && Math.abs(p.vx) < 0.5) {
          p.life -= 0.02 * timeScale;
        }

        return p.life > 0;
      });

      setParticles([...particlesRef.current]);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("click", handleClick);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            opacity: p.life,
            transform: `rotate(${p.rot}deg)`,
            boxShadow: `0 0 10px ${p.color}`
          }}
        />
      ))}
    </div>
  );
}
