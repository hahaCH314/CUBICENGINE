"use client";

import React from "react";
import { TreePine, TreeDeciduous, Leaf, Flower2, Sprout, Clover } from "lucide-react";

export default function ForestLineArt() {
  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden opacity-[0.07] mix-blend-screen text-emerald-400">
      
      {/* 左上の大きな木 */}
      <div className="absolute -top-32 -left-32">
        <TreeDeciduous size={600} strokeWidth={0.5} className="rotate-[15deg]" />
      </div>

      {/* 左下の松の木 */}
      <div className="absolute -bottom-20 -left-10">
        <TreePine size={450} strokeWidth={0.5} className="-rotate-6" />
      </div>

      {/* 右下の大きなツル/葉っぱ */}
      <div className="absolute -bottom-40 -right-20">
        <Leaf size={700} strokeWidth={0.5} className="-rotate-45" />
      </div>

      {/* 右上の花 */}
      <div className="absolute top-10 -right-32">
        <Flower2 size={500} strokeWidth={0.5} className="rotate-[30deg]" />
      </div>

      {/* 画面端に散らした小さな草花 */}
      <div className="absolute top-[40%] -left-16">
        <Clover size={250} strokeWidth={0.5} className="rotate-[45deg]" />
      </div>

      <div className="absolute bottom-[20%] right-[10%]">
        <Sprout size={200} strokeWidth={0.5} className="-rotate-12" />
      </div>

      <div className="absolute top-[20%] right-[30%]">
        <Leaf size={150} strokeWidth={0.5} className="rotate-[120deg]" />
      </div>

      <div className="absolute bottom-[10%] left-[30%]">
        <Flower2 size={180} strokeWidth={0.5} className="-rotate-[20deg]" />
      </div>

    </div>
  );
}
