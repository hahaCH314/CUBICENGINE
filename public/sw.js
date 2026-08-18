// CUBICENGINE Service Worker
// 方針: ページ本体(HTML)は network-first ＝ オンラインなら常に最新を表示する。
//   - 開発が活発でバグ修正も多いフェーズなので「古い版が残る」事故を防ぐのが最優先。
//   - HTML をキャッシュ優先にすると、古いHTMLが古いJSチャンクを指して "stale" になる。
//   - 静的アセット(_next のハッシュ付きファイル等)はビルドごとに名前が変わるので
//     stale-while-revalidate で高速かつ古くならない。
//   - オフライン時のみキャッシュへフォールバック（ローカル/オフライン運営の盾を維持）。
// キャッシュ名を上げると activate で旧キャッシュ(古いHTML)を一掃する。
// ⚠️ 新しいビルドを配るたびに必ずこの版番号を上げる（activate で旧キャッシュを一掃するトリガー）。
// v4: fetch ハンドラが undefined を返しうるバグを直したので、旧キャッシュを一掃する
const CACHE_NAME = 'cubicengine-v4'
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

// respondWith に undefined を渡すと "Failed to convert value to 'Response'" で
// ナビゲーション自体が失敗し、ページが開けなくなる。**必ず Response を返す**ための最後の砦。
// 毎回新しく作る（Response は一度読まれると使い回せない）。
function offlineResponse(isNavigation) {
  if (!isNavigation) return new Response('', { status: 504, statusText: 'Offline' })
  return new Response(
    '<!doctype html><html lang="ja"><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>オフライン</title>' +
      '<body style="background:#151411;color:#eee;font-family:sans-serif;text-align:center;padding:3rem">' +
      '<h1>つながりませんでした</h1><p>通信を確認して、もう一度ひらいてください。</p>' +
      '<p><a href="/" style="color:#3cd070">トップへ</a></p>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
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
      (async () => {
        try {
          return putIfOk(event.request, await fetch(event.request))
        } catch {
          // ⚠️ ignoreSearch が要る。/editor?mode=tsumiki は既定の照合では
          //    キャッシュ済みの /editor と一致せず undefined が返っていた。
          //    それが respondWith に渡って TypeError になり、
          //    デプロイ直後にエディタが開けない事故になっていた。
          const cached = await caches.match(event.request, { ignoreSearch: true })
          if (cached) return cached
          const root = await caches.match('/')
          if (root) return root
          return offlineResponse(true)
        }
      })()
    )
    return
  }

  // ── それ以外(ハッシュ付き静的アセット等)は stale-while-revalidate ──
  // 即キャッシュを返しつつ裏で更新。ビルドごとにファイル名が変わるので古くならない。
  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request)
      if (cached) {
        // 裏で更新。respondWith とは切り離す（失敗しても表示中の応答に影響させない）
        event.waitUntil(
          fetch(event.request)
            .then((r) => putIfOk(event.request, r))
            .catch(() => {})
        )
        return cached
      }
      try {
        return putIfOk(event.request, await fetch(event.request))
      } catch {
        // 未キャッシュ かつ 取得失敗。ここで undefined を返すと同じ TypeError になる
        return offlineResponse(false)
      }
    })()
  )
})
