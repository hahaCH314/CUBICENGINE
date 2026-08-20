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
 *  - Android(Google Play版)でも読み込まない。理由は Electron と同じで、out/ を
 *    端末内から読むので /_vercel/insights/* が存在しない。
 *    ⚠️ Android は electronAPI を持たないので、下の実行時判定では「Web版」と
 *       誤判定される。MMC_TARGET でも見ること。
 *    ※ ライブラリのコード自体は out/ のバンドルに残る（呼ばれない死んだコード）。
 *      turbopack の resolveAlias や next/dynamic では剥がせなかった。
 *      通信は起きないので Play のデータセーフティ上の申告は「収集なし」で正しい。
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

// Android版はビルド時点で確定する。process.env はここで値に置き換わるので、
// Android ビルドの out/ には Analytics のコードごと入らない
const IS_ANDROID = process.env.MMC_TARGET === 'android'

export default function WebAnalytics() {
  const isWeb = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  if (IS_ANDROID) return null
  if (process.env.NODE_ENV !== 'production') return null
  if (!isWeb) return null

  return <Analytics />
}
