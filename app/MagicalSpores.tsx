"use client";
import { useEffect, useState } from "react";

type Spore = {
  id: number;
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  opacity: number;
  delay: number;
};

export default function MagicalSpores() {
  const [spores, setSpores] = useState<Spore[]>([]);

  useEffect(() => {
    const newSpores: Spore[] = [];
    // 30個の光る胞子（種）を生成
    for (let i = 0; i < 30; i++) {
      newSpores.push({
        id: i,
        x: Math.random() * 100, // vw
        y: Math.random() * 100, // vh
        size: Math.random() * 3 + 1, // 1px ~ 4px
        speedY: Math.random() * 10 + 15, // 15s ~ 25s for full screen travel
        speedX: Math.random() * 2 + 2, // sway duration
        opacity: Math.random() * 0.5 + 0.2,
        delay: Math.random() * -20, // start at different points in animation
      });
    }
    setSpores(newSpores);
  }, []);

  if (spores.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden mix-blend-screen">
      {spores.map((spore) => (
        <div
          key={spore.id}
          className="absolute rounded-full bg-emerald-200"
          style={{
            left: `${spore.x}vw`,
            top: `${spore.y}vh`,
            width: spore.size,
            height: spore.size,
            opacity: spore.opacity,
            boxShadow: `0 0 ${spore.size * 3}px ${spore.size}px rgba(167, 243, 208, 0.8)`,
            animation: `floatUp ${spore.speedY}s linear infinite, sway ${spore.speedX}s ease-in-out infinite alternate`,
            animationDelay: `${spore.delay}s, ${spore.delay}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(100vh); opacity: 0; }
          10% { opacity: var(--tw-opacity, 1); }
          90% { opacity: var(--tw-opacity, 1); }
          100% { transform: translateY(-20vh); opacity: 0; }
        }
        @keyframes sway {
          0% { margin-left: -15px; }
          100% { margin-left: 15px; }
        }
      `}</style>
    </div>
  );
}
