// 実行中の“ガワ”を判定する。Web / Electron(デスクトップ) / Capacitor(Android) の3種。
//
// なぜ必要か: 同じ Next アプリを3つのガワで動かしているが、
// Service Worker やインストール誘導のように「Webでは要る／ガワの中では有害」な
// 機能があるため、UI側で分岐できるようにする。
//
// Capacitor は WebView 内に `window.Capacitor` を注入する。ビルド時定数ではなく
// 実行時判定にしているのは、同じ out/ を将来 Web に流用しても壊れないようにするため。

export function isElectron(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as unknown as { electronAPI?: { isElectron?: boolean } })
    .electronAPI?.isElectron;
}

export function isCapacitor(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as unknown as { Capacitor?: unknown }).Capacitor;
}

/** Electron/Capacitor など、ストア配布のガワの中で動いているか。 */
export function isNativeShell(): boolean {
  return isElectron() || isCapacitor();
}
