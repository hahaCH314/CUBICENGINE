"use client";

import { useSyncExternalStore } from "react";
import { subscribeThemeSong, isThemeSongPlaying, stopThemeSong } from "../../lib/themeSong";

/**
 * テーマ曲が鳴っている間だけ出る「とめる」ボタン。
 *
 * 完成の演出（紙吹雪・コードのお披露目）は画面いっぱいに出るので、
 * その上から必ず押せるように z-index は LogicPanel の最大(9999)より上に置く。
 *
 * ⚠️ 鳴っている間に消す手段が無いのは駄目。95秒の曲を止められないと、
 *    2回目からは「完成させたくない」になってしまう。
 *    ずっと鳴らしたくない人は マイクラへタブの設定でオフにできる。
 */
export default function ThemeSongControl() {
  const playing = useSyncExternalStore(
    subscribeThemeSong,
    isThemeSongPlaying,
    () => false, // SSR では音は鳴っていない
  );

  if (!playing) return null;

  return (
    <button
      type="button"
      onClick={stopThemeSong}
      aria-label="テーマ曲をとめる"
      style={{
        position: "fixed", left: 12, bottom: 12, zIndex: 10000,
        display: "inline-flex", alignItems: "center", gap: 6,
        height: 40, padding: "0 16px", borderRadius: 999,
        border: "3px solid #1e293b", cursor: "pointer",
        background: "linear-gradient(135deg,#fde68a,#fbbf24)",
        boxShadow: "0 4px 0 #b45309, 0 5px 14px rgba(180,83,9,0.35)",
        color: "#451a03", fontWeight: 900, fontSize: 13, whiteSpace: "nowrap",
      }}
    >
      🎵 とめる
    </button>
  );
}
