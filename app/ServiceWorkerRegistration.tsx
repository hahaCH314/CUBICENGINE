'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Service Worker を登録し、新しいバージョンが出たら画面下に
 * 「✨ 新しいバージョンがあります ｜ 更新する」バーを出す。
 *
 * 方針:
 *  - 新SWは sw.js 側で skipWaiting せず「待機」で止める。
 *  - ユーザーが「更新する」を押したときだけ SKIP_WAITING を送って切替＆リロード。
 *    （編集中に勝手にリロードして作業が飛ぶのを防ぐ）
 *  - 初回インストール時(controller が無い)はバーを出さない。
 */
export default function ServiceWorkerRegistration() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)
  const reloadingRef = useRef(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // 新SWが有効化されて制御が移ったら（ユーザーが更新を押したときのみ）リロード
    const onControllerChange = () => {
      if (!reloadingRef.current) return
      reloadingRef.current = false
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    // 「待機中の新SK」を見つけたら通知バー対象にする。
    // controller が既にある＝更新（初回インストールではない）ときだけ出す。
    const promote = (sw: ServiceWorker | null | undefined) => {
      if (sw && navigator.serviceWorker.controller) setWaiting(sw)
    }

    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((reg) => {
        if (reg.waiting) promote(reg.waiting)

        reg.addEventListener('updatefound', () => {
          const installing = reg.installing
          if (!installing) return
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed') promote(reg.waiting ?? installing)
          })
        })

        // 念のため起動直後にも更新チェック
        reg.update().catch(() => {})
      })
      .catch(() => {})

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }
  }, [])

  const applyUpdate = () => {
    if (!waiting) return
    reloadingRef.current = true
    waiting.postMessage({ type: 'SKIP_WAITING' })
    setWaiting(null)
    // この後 SW が有効化→controllerchange→reload で最新に切り替わる
  }

  if (!waiting) return null

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 20,
        transform: 'translateX(-50%)',
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px 10px 18px',
        borderRadius: 14,
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        border: '1px solid rgba(148,163,184,0.25)',
        boxShadow: '0 12px 34px rgba(0,0,0,0.4)',
        color: '#e2e8f0',
        fontSize: 13,
        fontWeight: 700,
        maxWidth: 'calc(100vw - 24px)',
        animation: 'cubicSwBarUp 0.3s cubic-bezier(0.2,0.8,0.2,1)',
      }}
    >
      <style>{`@keyframes cubicSwBarUp{from{opacity:0;transform:translate(-50%,16px)}to{opacity:1;transform:translate(-50%,0)}}`}</style>
      <span style={{ whiteSpace: 'nowrap' }}>
        <span style={{ marginRight: 6 }}>✨</span>新しいバージョンがあります
      </span>
      <button
        onClick={applyUpdate}
        style={{
          flexShrink: 0,
          padding: '7px 16px',
          borderRadius: 10,
          border: 'none',
          cursor: 'pointer',
          background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
          color: '#06281d',
          fontWeight: 900,
          fontSize: 13,
          boxShadow: '0 2px 6px rgba(16,185,129,0.4)',
        }}
      >
        更新する
      </button>
      <button
        onClick={() => setWaiting(null)}
        title="あとで（次にページを開いたときに自動で最新になります）"
        style={{
          flexShrink: 0,
          width: 28,
          height: 28,
          borderRadius: 8,
          border: 'none',
          cursor: 'pointer',
          background: 'rgba(255,255,255,0.08)',
          color: '#94a3b8',
          fontSize: 14,
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </div>
  )
}
