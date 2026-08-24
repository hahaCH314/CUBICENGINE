/**
 * ビルド種別の判定。
 *
 * IS_STORE_BUILD = App Store / Google Play に出す「アプリ版」のビルドかどうか。
 *
 * なぜ必要か（App Store 5.6 リジェクト対応・2026-08-22）:
 *   Web版と同じ静的バンドルをそのままアプリに同梱しているため、
 *   「パソコン版のダウンロード」「寄付(Ko-fi)」など **アプリに入れてはいけない導線** まで
 *   HTMLに含まれていた。従来はそれを Tailwind の `hidden md:*` (CSS)で隠していたが、
 *   md = 768px なので **iPhone を横向きにしただけで出現する**（iPhone 15 = 844pt）。
 *   審査から見ると「条件を満たすと現れる隠し機能」＝ガイドライン 5.6 違反そのもの。
 *   → CSSで隠すのをやめ、このフラグで **HTMLに出力しない**（DOMに残さない）。
 *
 * ⚠️ クライアントコンポーネントから読むので `NEXT_PUBLIC_` 接頭辞が必須。
 *    接頭辞の無い env は client バンドルに埋め込まれず、実行時 undefined になる。
 *    （既存の app/WebAnalytics.tsx の `process.env.MMC_TARGET` がまさにこれで、
 *      アプリ版でも判定が効かず素通りしていた。）
 *
 * セット箇所: package.json の `android:build` / `ios:build`
 */
export const IS_STORE_BUILD = process.env.NEXT_PUBLIC_MMC_STORE === "1";
