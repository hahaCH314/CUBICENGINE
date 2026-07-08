// CUBICENGINE Service Worker
// 方針: ページ本体(HTML)は network-first ＝ オンラインなら常に最新を表示する。
//   - 開発が活発でバグ修正も多いフェーズなので「古い版が残る」事故を防ぐのが最優先。
//   - HTML をキャッシュ優先にすると、古いHTMLが古いJSチャンクを指して "stale" になる。
//   - 静的アセット(_next のハッシュ付きファイル等)はビルドごとに名前が変わるので
//     stale-while-revalidate で高速かつ古くならない。
//   - オフライン時のみキャッシュへフォールバック（ローカル/オフライン運営の盾を維持）。
// キャッシュ名を上げると activate で旧キャッシュ(古いHTML)を一掃する。
// ⚠️ 新しいビルドを配るたびに必ずこの版番号を上げる（activate で旧キャッシュを一掃するトリガー）。
const CACHE_NAME = 'cubicengine-v3'
// 実在するものだけ。存在しないURL(例: 削除した /icon.svg)を入れると addAll が丸ごと reject し、
// install 自体が失敗 → 新SWが有効化されず旧キャッシュが永久に残る（特にiOSで顕著だった事故）。
const STATIC_ASSETS = [
  '/',
  '/editor',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // allSettled: 1つの404で install 全体を壊さない（キャッシュはあくまでオフライン保険）。
      .then((cache) => Promise.allSettled(STATIC_ASSETS.map((u) => cache.add(u))))
      // キャッシュ処理後に即時有効化＝新SWを「待機」させず即引き継ぐ。
      // 旧設計は「更新バーを押すまで待機」だったが、PWA(特にiOS)利用者はバーに気づかず
      // 旧SWが古いキャッシュを配り続けて "アプリにすると古い版が消えない" 事故になっていた。
      // 開発が活発なフェーズは「常に最新」を最優先する。編集中は localStorage 自動保存で守る。
      .then(() => self.skipWaiting())
  )
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
