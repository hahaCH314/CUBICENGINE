import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ─── メンテナンスモード ───────────────────────────────────────────
// true の間、全ページ（静的アセット除く）を /maintenance へ振り替える。
// 解除するときは false にして push（Vercel 再デプロイで反映）。
// ※Next 16 で middleware → proxy に改称（node_modules/next/dist/docs/.../proxy.md）。
const MAINTENANCE_MODE = true;

export function proxy(request: NextRequest) {
  if (!MAINTENANCE_MODE) return NextResponse.next();
  // デスクトップ(Electron)は同じNextアプリを 127.0.0.1 で読む。メンテはWeb来訪者向けなので
  // localhost は素通しして、窓に編集画面(GROVE)がちゃんと出るようにする。
  const host = request.nextUrl.hostname;
  if (host === "127.0.0.1" || host === "localhost") return NextResponse.next();
  if (request.nextUrl.pathname === "/maintenance") return NextResponse.next();
  return NextResponse.rewrite(new URL("/maintenance", request.url));
}

export const config = {
  // 静的アセット(_next/*、ドットを含むファイル=画像/manifest/sw.js等)と
  // /maintenance 自身は除外し、メンテ画面が正しく描画されるようにする。
  matcher: ["/((?!_next/static|_next/image|maintenance|.*\\.).*)"],
};
