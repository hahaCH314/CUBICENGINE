'use client'

import { useSyncExternalStore } from 'react'
import { Analytics } from '@vercel/analytics/next'

/**
 * Vercel Web Analytics（来訪者数の計測）。Web版のみ。
 *
 * 方針:
 *  - Cookie も広告識別子も使わない集計専用。個人は特定しない。
 *    この記載に合わせて app/privacy のポリシーも更新してある。片方だけ直さないこと。
 *  - Electron(デスクトップ版)では読み込まない。デスクトップ版は「完全オフライン」を
 *    うたっているので計測ビーコンを飛ばさない。そもそも同梱の .next を直接読むため
 *    /_vercel/insights/* は存在せず 404 になる。
 *  - 開発中(next dev)も読み込まない。dev では va.vercel-scripts.com のデバッグ用
 *    スクリプトを取りに行くが、next.config.ts の CSP(script-src 'self') に弾かれて
 *    コンソールが荒れるだけで計測もされない。
 *    本番は同一オリジンの /_vercel/insights/script.js なので CSP は現状のままで通る。
 *
 * ※コードを入れるだけでは記録は始まらない。Vercel のプロジェクト設定で
 *   Web Analytics を有効化して初めてデータが溜まる。
 */

// electronAPI は electron/preload.js が contextBridge で生やす（Web版には存在しない）。
type MaybeElectronWindow = Window & { electronAPI?: { isElectron?: boolean } }

// Electron判定はページ読み込み時点で確定していて後から変わらないので、購読は何もしない。
const subscribe = () => () => {}

// SSR時は window を見られないので false（＝読み込まない）。クライアントで再評価される。
const getServerSnapshot = () => false

const getSnapshot = () =>
  !(window as MaybeElectronWindow).electronAPI?.isElectron

export default function WebAnalytics() {
  const isWeb = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  if (process.env.NODE_ENV !== 'production') return null
  if (!isWeb) return null

  return <Analytics />
}
