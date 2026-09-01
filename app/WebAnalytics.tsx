'use client'

import { useSyncExternalStore } from 'react'
import { Analytics } from '@vercel/analytics/next'
import { IS_STORE_BUILD } from '../lib/build'

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

// アプリ版(App Store / Google Play)はビルド時点で確定する。
//
// ⚠️ 以前ここは `process.env.MMC_TARGET === 'android'` を見ていたが、**効いていなかった**。
//    クライアントコンポーネントに埋め込まれる env は `NEXT_PUBLIC_` 接頭辞付きだけで、
//    接頭辞の無い MMC_TARGET は実行時 undefined になる（ビルド後の out/ を読むと
//    `"android"===process.env.MMC_TARGET` が実行時判定のまま残っているのが確認できる）。
//    その結果アプリ版でも <Analytics /> がマウントされ、同一オリジンの
//    /_vercel/insights/script.js を取りに行って 404 になっていた
//    （端末外へデータは出ないが、「計測しない」という設計意図は壊れていた）。
//    → NEXT_PUBLIC_ 付きの IS_STORE_BUILD で判定する。詳細は lib/build.ts。
export default function WebAnalytics() {
  const isWeb = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  if (IS_STORE_BUILD) return null
  if (process.env.NODE_ENV !== 'production') return null
  if (!isWeb) return null

  return <Analytics />
}
