"use client";

/* ══════════════════════════════════════════════════════════
   さわって分かる「重ねると動く」— app/SnapCards.tsx

   この製品の一番大事な仕組みは「カードを重ねると動く」。
   チュートリアルでは赤枠で「超重要！繋がらないと動かない」と叫んでいるが、
   **言葉で叫ぶより、1回くっつけてもらう方が速い。**

   置き方の決まり:
     - 素通りできること。触らない人の邪魔をしない
     - 中央を占領しない。胞子を消して線画を隅へ寄せた判断と同じ線に乗る
     - 新しく作るものを増やさない（吸着もお祝いもエディタに既にある考え方）
   ══════════════════════════════════════════════════════════ */

import { useRef, useState } from "react";

/** くっついたと判定する距離(px)。近すぎると入らず、遠すぎると勝手にくっつく */
const SNAP_DIST = 38;
/** 青カードの初めの位置。ここから動かして黄カードの下へ重ねてもらう */
const HOME = { x: 66, y: 30 };

const TEXT = {
  ja: {
    lead: "カードは、重ねるとつながります。",
    hint: "青いカードを、黄色いカードの下にドラッグ（タップでもOK）",
    done: "つながりました！",
    doneSub: "これだけで、マイクラの中で本当に動きます。",
    again: "もう一回",
    go: "つくってみる",
    trigger: "たたいたとき",
    action: "ダイヤをあげる",
  },
  en: {
    lead: "Cards connect when you stack them.",
    hint: "Drag the blue card under the yellow one (tap works too)",
    done: "Connected!",
    doneSub: "That's all it takes to make it run inside Minecraft.",
    again: "Again",
    go: "Try making one",
    trigger: "When hit",
    action: "Give a diamond",
  },
} as const;

export default function SnapCards({ locale = "ja" }: { locale?: "ja" | "en" }) {
  const T = TEXT[locale === "en" ? "en" : "ja"];
  const [pos, setPos] = useState(HOME);
  const [snapped, setSnapped] = useState(false);
  /** 指を離した直後だけ滑らかに動かす。ドラッグ中に transition があると重く見える */
  const [gliding, setGliding] = useState(false);
  const drag = useRef<{ active: boolean; sx: number; sy: number; ox: number; oy: number }>({
    active: false, sx: 0, sy: 0, ox: 0, oy: 0,
  });

  const settle = (p: { x: number; y: number }) => {
    const near = Math.hypot(p.x, p.y) < SNAP_DIST;
    setGliding(true);
    if (near) {
      setPos({ x: 0, y: 0 });
      setSnapped(true);
    } else {
      // 外したら手ぶらで終わらせない。元の位置に戻して、また試せるようにする
      setPos(HOME);
    }
  };

  const onDown = (e: React.PointerEvent) => {
    if (snapped) return;
    drag.current = { active: true, sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
    setGliding(false);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return;
    setPos({
      x: drag.current.ox + (e.clientX - drag.current.sx),
      y: drag.current.oy + (e.clientY - drag.current.sy),
    });
  };
  const onUp = (e: React.PointerEvent) => {
    if (!drag.current.active) return;
    drag.current.active = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    settle({ x: pos.x, y: pos.y });
  };

  // ドラッグが難しい人（タッチの取りこぼし・指がすべる）でも進めるように、
  // 押すだけでも重なるようにしておく。ここで詰まると先に進めないので
  const onClick = () => {
    if (snapped || drag.current.active) return;
    setGliding(true);
    setPos({ x: 0, y: 0 });
    setSnapped(true);
  };

  return (
    <div className="w-full flex flex-col items-center gap-2 py-2 select-none">
      <style>{`
        @keyframes sc-pop { 0% { transform: scale(1); } 45% { transform: scale(1.07); } 100% { transform: scale(1); } }
        @keyframes sc-spark { 0% { opacity: 0; transform: translate(0,0) scale(0.6); } 25% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(1); } }
        @keyframes sc-nudge { 0%,100% { transform: translateY(0); } 50% { transform: translateY(4px); } }
      `}</style>

      <p className="text-[11px] sm:text-xs font-bold text-foreground/70 tracking-wide">
        {snapped ? T.done : T.lead}
      </p>

      <div className="relative" style={{ width: 260, height: 150 }}>
        {/* きっかけ（黄）。動かさない側 */}
        <Card
          emoji="⚡"
          label={T.trigger}
          bg="#facc15"
          border="#a16207"
          style={{ position: "absolute", left: "50%", top: 6, transform: "translateX(-50%)" }}
        />

        {/* すること（青）。こちらを動かして重ねてもらう */}
        <div
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onClick={onClick}
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
          aria-label={T.hint}
          style={{
            position: "absolute",
            left: "50%",
            top: 62,
            transform: `translateX(-50%) translate(${pos.x}px, ${pos.y}px)`,
            transition: gliding ? "transform 0.22s cubic-bezier(0.2,0.9,0.3,1)" : "none",
            cursor: snapped ? "default" : "grab",
            touchAction: "none",
            animation: snapped ? "sc-pop 0.35s ease-out" : undefined,
          }}
        >
          <Card emoji="✨" label={T.action} bg="#38bdf8" border="#0369a1" />
        </div>

        {/* くっついた瞬間の粒。派手にしない。祝われている感じだけ残す */}
        {snapped && (
          <div className="pointer-events-none absolute left-1/2 top-[62px]" aria-hidden>
            {[...Array(8)].map((_, i) => {
              const a = (i / 8) * Math.PI * 2;
              return (
                <span
                  key={i}
                  style={{
                    position: "absolute",
                    width: 6, height: 6, borderRadius: 9999,
                    background: i % 2 ? "#fde047" : "#7dd3fc",
                    animation: "sc-spark 0.6s ease-out forwards",
                    ["--dx" as string]: `${Math.cos(a) * 46}px`,
                    ["--dy" as string]: `${Math.sin(a) * 46}px`,
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {snapped ? (
        <div className="flex flex-col items-center gap-2">
          <p className="text-[11px] sm:text-xs text-foreground/70">{T.doneSub}</p>
          <div className="flex items-center gap-2">
            <a
              href="/editor"
              className="px-4 py-2 rounded-xl text-xs font-black transition-transform hover:scale-105 active:scale-95"
              style={{ background: "#10b981", color: "#04231a", boxShadow: "0 6px 18px -6px rgba(16,185,129,0.7)" }}
            >
              {T.go} →
            </a>
            <button
              type="button"
              onClick={() => { setGliding(true); setSnapped(false); setPos(HOME); }}
              className="px-3 py-2 rounded-xl text-[11px] font-bold text-foreground/60 hover:text-foreground/90 transition-colors"
            >
              {T.again}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[10px] sm:text-[11px] text-foreground/45" style={{ animation: "sc-nudge 2.4s ease-in-out infinite" }}>
          {T.hint}
        </p>
      )}
    </div>
  );
}

/** エディタのカードの見た目に寄せた小さいカード */
function Card({
  emoji, label, bg, border, style,
}: { emoji: string; label: string; bg: string; border: string; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 8,
        width: 176, padding: "10px 14px",
        background: bg, border: `2px solid ${border}`, borderRadius: 12,
        boxShadow: "0 4px 10px rgba(0,0,0,0.35)",
        ...style,
      }}
    >
      <span style={{ fontSize: 16 }}>{emoji}</span>
      <span style={{ fontSize: 12.5, fontWeight: 900, color: "#0f172a", whiteSpace: "nowrap" }}>{label}</span>
    </div>
  );
}
