'use client'

import { useEffect } from 'react'

/**
 * Service Worker を登録し、新しいバージョンが出たら自動で最新に切り替える。
 *
 * 方針（2026-07-08 変更）:
 *  - 新SWは sw.js 側で `skipWaiting()` して即時有効化する。
 *  - 制御が新SWに移ったら（＝新しいビルドが有効になったら）自動でリロードして最新を表示。
 *  - これで PWA(特にiOS)でも「古いキャッシュ/古い版が残る」事故を防ぐ。
 *  - 初回インストール時（それまで controller が無かった）は不要なリロードをしない。
 *  - 編集中の作業は localStorage 自動保存で保護しているため、更新リロードで概ね復元される。
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // Electron(デスクトップ)ではSWを使わない。SWが _next/HMR を横取りして
    // ERR_INVALID_HTTP_RESPONSE / ハイドレート停止(LOADINGのまま)を起こす。SWはWeb PWA専用。
    if ((window as any).electronAPI?.isElectron) {
      navigator.serviceWorker.getRegistrations()
        .then((rs) => rs.forEach((r) => r.unregister())).catch(() => {})
      return
    }

    // 登録時点で既に制御SWがあれば「更新」、無ければ「初回インストール」。
    const hadController = !!navigator.serviceWorker.controller
    let reloaded = false

    const onControllerChange = () => {
      // 初回インストール(clients.claim)による制御開始ではリロードしない。
      if (!hadController || reloaded) return
      reloaded = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((reg) => {
        // 起動直後に更新チェック（待機中の新SWがあれば skipWaiting で即有効化される）
        reg.update().catch(() => {})
      })
      .catch(() => {})

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  return null
}
