/**
 * themeSong.ts — CUBICENGINE のテーマ曲（公式BGM）。
 *
 * 鳴らす場所は **「アドオン完成！」を押した瞬間だけ**。
 * 作ったものが形になった瞬間を祝うためのもので、作業中ずっと流すBGMではない。
 *
 * ⚠️ 再生はユーザーの操作の中から呼ぶこと（ボタンの onClick から直接）。
 *    iOS / Safari は操作を伴わない音の再生を拒否する。await のあとに呼ぶと
 *    「操作の中」と見なされず無音になるので、**押した直後に同期で呼ぶ**。
 *    LogicPanel の完成ボタンは playSuccessSound() と並べて呼んでいる。
 *
 * ※ 端末が消音（サイレントスイッチ）のときは鳴らない。WKWebView の既定動作で、
 *   こちらから上書きしない（授業中に鳴る方が困るため）。
 */

/** public/audio/ に置いた実ファイル。日本語ファイル名はURLで壊れるので英字にしてある */
const SRC = "/audio/cubicengine-theme.mp3";

/** 「つぎから鳴らさない」の記憶。"1" なら鳴らさない（既定は鳴らす） */
const OFF_KEY = "ce-theme-song-off";

let audio: HTMLAudioElement | null = null;
let playing = false;

/* 再生中かどうかを画面（とめるボタン）に伝えるための購読口。
   zustand を通さないのは、音の状態がエディタの保存対象ではないため。 */
const listeners = new Set<() => void>();
function emit() {
  playing = !!audio && !audio.paused;
  for (const l of listeners) l();
}

export function subscribeThemeSong(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function isThemeSongPlaying(): boolean {
  return playing;
}

/** SSR では localStorage が無いので、既定（鳴らす）を返す */
export function isThemeSongEnabled(): boolean {
  try {
    return localStorage.getItem(OFF_KEY) !== "1";
  } catch {
    return true;
  }
}

export function setThemeSongEnabled(on: boolean): void {
  try {
    if (on) localStorage.removeItem(OFF_KEY);
    else localStorage.setItem(OFF_KEY, "1");
  } catch { /* プライベートモード等。記憶できなくても再生自体は動く */ }
  if (!on) stopThemeSong();
  emit();
}

/**
 * テーマ曲を頭から鳴らす。設定でオフなら何もしない。
 * 連打されても重ならないよう、鳴っていれば頭に巻き戻すだけにする。
 */
export function playThemeSong(): void {
  if (typeof window === "undefined") return;
  if (!isThemeSongEnabled()) return;

  try {
    if (!audio) {
      audio = new Audio(SRC);
      audio.preload = "auto";
      // 最後まで鳴ったらボタンを消すため、状態を戻す
      audio.addEventListener("ended", emit);
      audio.addEventListener("pause", emit);
      audio.addEventListener("play", emit);
    }
    audio.currentTime = 0;
    // play() は Promise を返す。拒否されるのは主に自動再生ブロックで、
    // その場合は黙って諦める（完成の演出自体は音が無くても成立する）。
    void audio.play().catch(() => { emit(); });
  } catch {
    /* Audio が使えない環境。音は諦めて他の演出だけ動かす */
  }
  emit();
}

export function stopThemeSong(): void {
  if (!audio) return;
  try {
    audio.pause();
    audio.currentTime = 0;
  } catch { /* 停止に失敗しても画面は進める */ }
  emit();
}
