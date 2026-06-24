// CUBICENGINE Service Worker
// 方針: ページ本体(HTML)は network-first ＝ オンラインなら常に最新を表示する。
//   - 開発が活発でバグ修正も多いフェーズなので「古い版が残る」事故を防ぐのが最優先。
//   - HTML をキャッシュ優先にすると、古いHTMLが古いJSチャンクを指して "stale" になる。
//   - 静的アセット(_next のハッシュ付きファイル等)はビルドごとに名前が変わるので
//     stale-while-revalidate で高速かつ古くならない。
//   - オフライン時のみキャッシュへフォールバック（ローカル/オフライン運営の盾を維持）。
// キャッシュ名を上げると activate で旧キャッシュ(古いHTML)を一掃する。
const CACHE_NAME = 'cubicengine-v2'
const STATIC_ASSETS = [
  '/',
  '/editor',
  '/icon-512x512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  // ここでは skipWaiting しない＝新SWは「待機」状態で止める。
  // ユーザーが画面の「更新する」バーを押したら SKIP_WAITING メッセージで切替える。
  // （編集中に勝手にリロードして作業が飛ぶのを防ぐため）
})

// クライアント(ページ)から「更新する」が押されたら待機を解除して新SWを有効化。
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// 200 / same-origin / 非リダイレクトのレスポンスだけをキャッシュに保存する小ヘルパー。
// 'basic' type は same-origin を保証し、opaque な cross-origin やエラー応答の
// キャッシュ汚染を防ぐ。
function putIfOk(request, response) {
  if (
    response &&
    response.status === 200 &&
    response.type === 'basic' &&
    !response.redirected
  ) {
    const cloned = response.clone()
    caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned))
  }
  return response
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  // same-origin のみ介入（cross-origin のキャッシュ汚染防止）
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  // ── ページ本体(HTML/ナビゲーション)は network-first ──
  // オンラインなら毎回ネットワークから最新を取り、裏でキャッシュも更新。
  // ネットワーク不可のときだけキャッシュ→無ければ '/' にフォールバック。
  const isNavigation =
    event.request.mode === 'navigate' ||
    event.request.destination === 'document'

  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((response) => putIfOk(event.request, response))
        .catch(() =>
          caches.match(event.request).then((c) => c || caches.match('/'))
        )
    )
    return
  }

  // ── それ以外(ハッシュ付き静的アセット等)は stale-while-revalidate ──
  // 即キャッシュを返しつつ裏で更新。ビルドごとにファイル名が変わるので古くならない。
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => putIfOk(event.request, response))
        .catch(() => cached)
      return cached || networkFetch
    })
  )
})
