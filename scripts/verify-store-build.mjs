#!/usr/bin/env node
/**
 * verify-store-build.mjs — ストア版(App Store / Google Play)のビルド成果物 out/ に
 *   「アプリに入れてはいけないもの」が混ざっていないかを検査する。混ざっていたらビルドを止める。
 *
 * 使い方: node scripts/verify-store-build.mjs
 *   android:build / ios:build から `next build` の直後・`cap sync` の直前に呼ばれる。
 *   ここで止めれば、まずいバンドルがネイティブ側(ios/, android/)へコピーされない。
 *
 * なぜ要るか（2026-08-22 の App Store リジェクト / ガイドライン 5.6）:
 *   Web版と同じ静的バンドルをアプリに同梱しているため、パソコン版インストーラのDLリンクや
 *   寄付(Ko-fi)への導線までHTMLに入っていた。当時はそれを Tailwind の `hidden md:*` で
 *   隠していたが、md = 768px なので **iPhone を横向きにすると出てきていた**。
 *   審査からは「条件次第で現れる隠し機能」に見え、Developer Code of Conduct 違反を疑われた。
 *
 *   人間の目視は必ずすり抜ける（実際、Java版カードを隠した後もDL区画が残っていた）ので、
 *   機械で落とす。CSSで隠す対処は**直したことにならない**点に注意（DOMには残る）。
 *
 * 落ちたときは:
 *   「CSSで隠す」ではなく、lib/build.ts の IS_STORE_BUILD で**出力しない**ように直すこと。
 */
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "out");

/* アプリに入っていてはいけない文字列。見つかったら即エラー。
   ※ 中身を消したつもりでも、JSチャンクの死んだ分岐に文字列だけ残ることがある。
     そこも含めて拾いたいので、HTMLだけでなく .js も見る。 */
const FORBIDDEN = [
  { pat: "ko-fi.com",        why: "外部の決済/寄付ページへの誘導（App Store 3.1.1）" },
  { pat: "_editor.exe",      why: "App Store 外で配るソフト（Windows版インストーラ）のDLリンク" },
  { pat: "_editor.dmg",      why: "App Store 外で配るソフト（Mac版インストーラ）のDLリンク" },
  { pat: "mode=grape",       why: "URLパラメータで切り替わる別モードの入口（5.6 の典型例）" },
  { pat: "virustotal.com",   why: "パソコン版インストーラの検査結果リンク（アプリには無関係）" },
  { pat: "launcherPath",     why: "Electron専用の Minecraft ランチャー起動コード" },
  { pat: "forgeVersions",    why: "Electron専用の Minecraft 環境検出コード" },
];

/* 画面幅で出し分けている要素。`hidden md:flex` 等は「見えない」だけでHTMLには残る。
   これ自体は状況次第（例: スマホで統計バーを隠す）なので、
   **リンクやダウンロードを含むもの**だけエラーにし、それ以外は警告として出す。 */
const BREAKPOINT_HIDE = /hidden (sm|md|lg|xl|2xl):/g;
const LINKISH = /href="https?:|\bdownload\b/;

if (!existsSync(outDir)) {
  console.error("❌ out/ がありません。先に `next build`（静的エクスポート）を実行してください。");
  process.exit(1);
}

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) files.push(...walk(p));
    else if (/\.(html|js|txt|json)$/.test(name)) files.push(p);
  }
  return files;
}

const errors = [];
const warnings = [];

for (const file of walk(outDir)) {
  const text = readFileSync(file, "utf8");
  const rel = relative(root, file);

  for (const { pat, why } of FORBIDDEN) {
    if (text.includes(pat)) errors.push({ rel, what: pat, why });
  }

  // 画面幅で隠している箇所の周辺を見て、リンク/ダウンロードを含むかを判定する。
  for (const m of text.matchAll(BREAKPOINT_HIDE)) {
    const around = text.slice(Math.max(0, m.index - 400), m.index + 400);
    const hit = { rel, what: m[0].trim(), why: "画面幅で隠しているだけで、HTMLには残っている（横向き/iPadで出現する）" };
    if (LINKISH.test(around)) errors.push(hit);
    else warnings.push(hit);
  }
}

// 同じファイルの同じ書き方は1行にまとめる（装飾アイコン等で同じ警告が何度も出て埋もれるため）
const shown = new Map();
for (const w of warnings) {
  const key = `${w.rel}|${w.what}`;
  shown.set(key, (shown.get(key) ?? 0) + 1);
}
for (const [key, n] of shown) {
  const [rel, what] = key.split("|");
  console.warn(`⚠️  ${rel}: ${what}${n > 1 ? ` ×${n}` : ""} — 画面幅で隠しているだけでHTMLには残る。リンクを含まないので通した`);
}

if (errors.length > 0) {
  console.error("\n❌ ストア版に入れてはいけないものが見つかりました。cap sync は行いません。\n");
  for (const e of errors) console.error(`   ${e.rel}\n     → ${e.what} : ${e.why}`);
  console.error(
    "\n直し方: CSS(`hidden md:*`)で隠すのは**直したことになりません**（DOMに残ります）。" +
    "\n        lib/build.ts の IS_STORE_BUILD で条件レンダリングし、出力そのものを止めてください。\n"
  );
  process.exit(1);
}

console.log(`✅ ストア版バンドルの検査OK（禁止項目 0 件${warnings.length ? ` / 要確認 ${warnings.length} 件` : ""}）`);
