"use client";
import { useState, useRef, useEffect } from "react";

/**
 * キューブの一辺(px)。
 *
 * ⚠️ **見た目と物理演算の両方がこの値を使う。**
 *    以前は className の w-[200px] と、跳ね返り計算の `const size = 200` に
 *    別々に書いてあり、片方だけ変えたときに壁の位置がズレて
 *    画面の端で浮いたまま止まるようになった（2026-08-24）。
 *    Tailwind の w-[...] は文字列を静的に読むので変数を埋め込めない。
 *    そのため大きさは style で指定して、ここ1か所を真実にする。
 */
const LOGO_SIZE = 170;

export default function DraggableLogo() {
  const [mode, setMode] = useState<"css" | "physics">("css");
  const [pos, setPos] = useState({ x: 0, y: 0 });
  
  /** ぶつかった瞬間だけ光らせる。転がっている間ずっと光ると眩しい */
  const [hit, setHit] = useState(false);
  /** 止まったあと、光りながら定位置へ帰っている最中 */
  const [returning, setReturning] = useState(false);

  const logoRef = useRef<HTMLDivElement>(null);
  /** 定位置（ナビの中の枠）。帰る先を実寸で測るために持つ */
  const homeRef = useRef<HTMLAnchorElement>(null);
  const velRef = useRef({ x: 0, y: 0 });
  const posRef = useRef({ x: 0, y: 0 });
  const lastMouse = useRef({ x: 0, y: 0, time: 0 });
  const isDragging = useRef(false);
  const rafRef = useRef<number | null>(null);
  /** 止まっているフレームの数。数フレーム続いたら「落ち着いた」とみなす */
  const restRef = useRef(0);
  const flashTimer = useRef<number | null>(null);
  const homeTimer = useRef<number | null>(null);

  /** ぶつかった合図。連続で当たっても光り直せるように毎回タイマーを引き直す */
  const flash = () => {
    setHit(true);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setHit(false), 220);
  };

  /**
   * 光って定位置へ帰る。
   *
   * ⚠️ 帰る動きは物理ではなく transition でやる。物理のまま吸い寄せると
   *    重力と喧嘩して行ったり来たりする。
   * ⚠️ 帰り着くまで mode は "physics" のまま。先に "css" へ戻すと
   *    その瞬間に定位置へ瞬間移動して、光る前に消えたように見える。
   */
  const goHome = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    const rect = homeRef.current?.getBoundingClientRect();
    setReturning(true);
    flash();
    if (rect) {
      const target = {
        x: rect.left + rect.width / 2 - LOGO_SIZE / 2,
        y: rect.top + rect.height / 2 - LOGO_SIZE / 2,
      };
      posRef.current = target;
      setPos(target);
    }
    // ⚠️ 帰る途中で掴まれることがある。そのまま時間だけで mode を戻すと、
    //    **掴んでいる指の下からキューブが消えて定位置へワープする**。
    //    掴まれていたら何もしない（startDrag 側で returning も解いている）。
    homeTimer.current = window.setTimeout(() => {
      if (isDragging.current) return;
      setReturning(false);
      setMode("css");
      velRef.current = { x: 0, y: 0 };
    }, 620);
  };

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
    restRef.current = 0;

    // 帰っている途中で掴まれたら、帰るのをやめてその場から掴ませる。
    // transition を残したままだと、指に0.6秒遅れて付いてくる
    if (homeTimer.current) window.clearTimeout(homeTimer.current);
    setReturning(false);

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
      const size = LOGO_SIZE;
      const bounce = 0.7; // bounce energy retention
      
      // ぶつかった手応え。当たった瞬間だけ光らせる
      let onGround = false;
      const BUMP = 1.2;   // これ未満の当たりでは光らせない（着地際にチカチカするため）

      if (posRef.current.x < 0) {
        posRef.current.x = 0;
        if (Math.abs(velRef.current.x) > BUMP) flash();
        velRef.current.x *= -bounce;
      } else if (posRef.current.x > window.innerWidth - size) {
        posRef.current.x = window.innerWidth - size;
        if (Math.abs(velRef.current.x) > BUMP) flash();
        velRef.current.x *= -bounce;
      }

      if (posRef.current.y < 0) {
        posRef.current.y = 0;
        if (Math.abs(velRef.current.y) > BUMP) flash();
        velRef.current.y *= -bounce;
      } else if (posRef.current.y > window.innerHeight - size) {
        posRef.current.y = window.innerHeight - size;
        if (Math.abs(velRef.current.y) > BUMP) flash();
        velRef.current.y *= -bounce;
        // 地面に落ちた時の摩擦
        velRef.current.x *= 0.9;
        onGround = true;
      }

      setPos({ ...posRef.current });

      // ⚠️ 昔は「ずっと転がらせておいても可愛い」で止めていなかったが、
      //    キューブは zIndex 9999 で本文の上に居座るため、投げた場所に
      //    残り続けると読みたい所を隠してしまう。
      //    落ち着いたら光って定位置へ帰る＝遊びのまま片付く。
      const speed = Math.hypot(velRef.current.x, velRef.current.y);
      restRef.current = onGround && speed < 0.6 ? restRef.current + 1 : 0;
      if (restRef.current > 24) {
        restRef.current = 0;
        goHome();
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
      if (homeTimer.current) window.clearTimeout(homeTimer.current);
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
      ref={homeRef}
      // ⚠️ 昔はここに lapAround（300秒かけて画面を一周する）を掛けていたが外した。
      //    触ると光って定位置へ帰るようになったので、**触っていないのに動いている**と
      //    「自分がやったこと」と「勝手に起きること」の区別が付かなくなる。
      //    定位置は帰る先でもあるので、動かないほうが帰り着いた感じも出る。
      className="flex items-center group relative w-14 h-full justify-center mix-blend-screen opacity-95"
    >
      <div
        ref={logoRef}
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={
          mode === "css"
            ? "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-transform duration-700 hover:scale-110"
            : "fixed cursor-grab active:cursor-grabbing"
        }
        style={
          mode === "physics"
            ? {
                width: LOGO_SIZE,
                height: LOGO_SIZE,
                left: pos.x,
                top: pos.y,
                // ドラッグ中は回転しないが、投げた後は速度に応じて回るようにする
                // 帰っている間は回さない。ぐるぐる回りながら吸い込まれると酔う
                transform: returning ? "none" : `rotate(${pos.x}deg)`,
                zIndex: 9999,
                touchAction: "none",
                // 帰り道だけ transition を掛ける。物理中に掛けると動きが遅れる
                transition: returning
                  ? "left 0.6s cubic-bezier(0.3,0.9,0.25,1), top 0.6s cubic-bezier(0.3,0.9,0.25,1), filter 0.25s ease-out, transform 0.6s ease-out"
                  : "filter 0.18s ease-out",
                // ぶつかった瞬間と、帰るときに光る
                filter: returning
                  ? "brightness(2.6) drop-shadow(0 0 34px rgba(190,240,255,0.95))"
                  : hit
                    ? "brightness(1.9) drop-shadow(0 0 20px rgba(190,240,255,0.8))"
                    : "none",
              }
            : {
                width: LOGO_SIZE,
                height: LOGO_SIZE,
                // css モードの位置合わせは className の -translate が持っている。
                // ここで transform を書くと打ち消してしまうので書かない
              }
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
