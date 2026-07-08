'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Web版からスマホアプリ（ホーム画面に追加＝PWA）への誘導バナー。
 *  - Android/Chrome: `beforeinstallprompt` を捕まえてワンタップ設置ボタン。
 *  - iOS Safari: 同イベントが無いので「共有 → ホーム画面に追加」の手動案内。
 *  - 既にインストール済み(standalone) / PC / エディタ内 / 一度閉じた後 は出さない。
 */
export default function InstallPrompt() {
  const [mode, setMode] = useState<'none' | 'android' | 'ios'>('none')
  const deferred = useRef<{ prompt: () => void; userChoice: Promise<unknown> } | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    // 既にアプリとして起動中なら出さない
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    if (standalone) return
    // スマホのみ・エディタ内では邪魔しない・一度閉じたら出さない
    if (window.innerWidth > 900) return
    if (window.location.pathname.startsWith('/editor')) return
    if (localStorage.getItem('ce-install-dismissed')) return

    const ua = navigator.userAgent
    const isIOS = /iphone|ipad|ipod/i.test(ua)
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios|android/i.test(ua)

    const onBIP = (e: Event) => {
      e.preventDefault()
      deferred.current = e as unknown as { prompt: () => void; userChoice: Promise<unknown> }
      setMode('android')
    }
    window.addEventListener('beforeinstallprompt', onBIP)

    if (isIOS && isSafari) setMode('ios')

    return () => window.removeEventListener('beforeinstallprompt', onBIP)
  }, [])

  const install = async () => {
    const e = deferred.current
    if (!e) return
    e.prompt()
    try { await e.userChoice } catch { /* noop */ }
    deferred.current = null
    setMode('none')
  }

  const dismiss = () => {
    try { localStorage.setItem('ce-install-dismissed', '1') } catch { /* noop */ }
    setMode('none')
  }

  if (mode === 'none') return null

  return (
    <div
      role="dialog"
      aria-label="ホーム画面に追加"
      style={{
        position: 'fixed', left: 10, right: 10, bottom: 14, zIndex: 99998,
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 12px 12px 16px', borderRadius: 16,
        background: 'linear-gradient(135deg,#0a1614,#0f2320)',
        border: '1.5px solid rgba(0,221,181,0.35)',
        boxShadow: '0 12px 34px rgba(0,0,0,0.5)',
        color: '#e6fff9', fontFamily: "'M PLUS Rounded 1c', system-ui, sans-serif",
        animation: 'ceInstallUp 0.3s cubic-bezier(0.2,0.8,0.2,1)',
      }}
    >
      <style>{`@keyframes ceInstallUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <span style={{ fontSize: 26, lineHeight: 1, filter: 'drop-shadow(0 0 8px #00ddb5aa)' }}>📲</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: '#00ddb5' }}>アプリとして使うと快適！</div>
        <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.5, color: '#bfeee4' }}>
          {mode === 'ios'
            ? <>下の<b>共有 ⬆️</b> →「<b>ホーム画面に追加</b>」でアプリになります。</>
            : <>ホーム画面に追加して、全画面でサクッと開けます。</>}
        </div>
      </div>
      {mode === 'android' && (
        <button
          onClick={install}
          style={{
            flexShrink: 0, padding: '9px 16px', borderRadius: 11, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#34d399,#00ddb5)', color: '#06281d',
            fontWeight: 900, fontSize: 13, boxShadow: '0 2px 6px rgba(0,221,181,0.4)',
          }}
        >
          追加
        </button>
      )}
      <button
        onClick={dismiss}
        aria-label="閉じる"
        style={{
          flexShrink: 0, width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer',
          background: 'rgba(255,255,255,0.08)', color: '#94a3b8', fontSize: 14, lineHeight: 1,
        }}
      >
        ✕
      </button>
    </div>
  )
}
