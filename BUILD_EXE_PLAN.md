# .exe 配布 準備計画書 — SPROUT / GROVE 別々の .exe ＋ Vercel ランディングからDL

> シオン(設計/中身) 2026-06-16。最終形の配布構成と、そこへ向けた準備。
> ステータス：準備（土台）。実ビルドは後日 `npm run electron:build` で。

## 1. 全体構成（確定）
```
┌─ Vercel（Webで公開＝トップページだけ）──────────────┐
│  app/page.tsx = ランディング ＝ ダウンロード窓口        │
│   └ [⬇ SPROUT.exe]  [⬇ GROVE.exe] をDLさせる           │
└───────────────────────────────────────────────────┘
        ↓ ダウンロード（GitHub Releases 等でホスト）
┌─ デスクトップ（.exe＝エディタ本体）───────────────────┐
│  CubicEngine-SPROUT.exe → /editor?mode=tsumiki に直行   │
│  CubicEngine-GROVE.exe  → /editor?mode=grape  に直行    │
└───────────────────────────────────────────────────┘
```
- **Vercelにはトップ(ランディング)だけ**。`/editor` はデスクトップ専用。
- **.exe は2つ別々**。中身は同じ Next アプリだが、起動時に**モードを固定**して各エディタへ直行。

## 2. 別々の .exe にする（electron-builder）
今は `electron:build = next build && electron-builder --win`、`build` 設定なし＝単一.exe。
→ **`MMC_EDITION` 環境変数でモードを固定**し、**productName/appId/icon を出し分け**て2回ビルドする。

### 2-1. `electron/main.js`（モード直行）
ウィンドウ生成時の `loadURL` を、edition で出し分け：
```js
const EDITION = process.env.MMC_EDITION || 'full'; // 'sprout' | 'grove' | 'full'
const startPath =
  EDITION === 'sprout' ? '/editor?mode=tsumiki'
: EDITION === 'grove'  ? '/editor?mode=grape'
:                        '/';                       // full=ランディング(従来)
await win.loadURL(`http://127.0.0.1:${PORT}${startPath}`);
```
※ `loadURL` は2箇所(119/141付近)あるので両方。`splash.html` 後の本ロードに適用。

### 2-2. `package.json` に `build` を追加（2エディション分の土台）
```jsonc
"build": {
  "appId": "com.cubicengine.${env.MMC_EDITION}",
  "productName": "CubicEngine ${env.MMC_EDITION}",
  "files": ["electron/**", ".next/standalone/**", ".next/static/**", "public/**"],
  "win": { "target": "nsis", "icon": "build/icon.ico" },
  "directories": { "output": "dist-exe/${env.MMC_EDITION}" }
}
```
※ `productName`/`icon` は SPROUT=🌱 / GROVE=🌿 で差し替え（アイコン2種＝**ヒマワリ**が用意）。

### 2-3. ビルドスクリプト（2回回す）
```jsonc
"scripts": {
  "build:sprout": "cross-env MMC_EDITION=sprout next build && cross-env MMC_EDITION=sprout electron-builder --win",
  "build:grove":  "cross-env MMC_EDITION=grove  next build && cross-env MMC_EDITION=grove  electron-builder --win",
  "build:all":    "npm run build:sprout && npm run build:grove"
}
```
※ `cross-env` をdevDepsに追加（Win環境変数の差異吸収）。
※ ⚠️ **このアプリは"普通のNextではない"（AGENTS.md）**。standalone出力やloadURLの取り回しは `node_modules/next/dist/docs/` を確認してから確定する。本書はパスを示すまで。

## 3. ホスティング（.exe の置き場）
- **Vercel に巨大バイナリ(.exe 100MB+)は置かない**（サイズ/転送制限）。
- 推奨：**GitHub Releases**（or R2/S3 等）に .exe を上げ、ランディングはそのURLにリンク。
- ランディング側は `DOWNLOADS` 定数1箇所でURL管理（ビルド後に差し替えるだけ）。

## 4. Vercel（トップだけ公開）
- ランディング `app/page.tsx` のみ公開。`/editor` 配下はデスクトップ専用。
- 注意：完全ローカル/オフライン方針（`/api/auth` 等は公開前に切る＝既決事項）。
- Next固有のbuild/exclude設定は AGENTS.md に従って確認。

## 5. 今回やった準備（このコミット）
- ランディング(`app/page.tsx`)に **「💻 デスクトップ版をダウンロード」セクション**を追加。
- `DOWNLOADS` 定数（SPROUT/GROVE のURL。**今はプレースホルダ＝準備中**）。ビルド＆ホスト後にURLを入れれば即有効。
- 既存の SPROUT/GROVE カード（`/editor` を開く）は dev/デスクトップ用に温存。Vercel公開時は「DLへ誘導」に寄せるか後で判断。

## 6. 残ステップ（後日・実ビルド時）
1. `main.js` に `MMC_EDITION` 分岐を入れる（§2-1）。
2. `package.json` の `build` ＋ `build:sprout/grove/all`、`cross-env` 追加（§2-2/2-3）。
3. アイコン2種（SPROUT/GROVE）＝**ヒマワリ**。
4. `npm run build:all` → `dist-exe/` に2つの.exe。動作確認。
5. .exe を GitHub Releases へ。`DOWNLOADS` のURLを差し替え。
6. Vercel にトップを公開（`/editor` 除外・`/api/auth` 等オフ）。

## 7. 分担
- 🛠 **シオン(中身)**：main.js分岐／build設定／DOWNLOAD配線／Vercel除外設定。
- 🎨 **ヒマワリ(見た目)**：DLボタン/セクションのデザイン、.exeアイコン2種、ランディングの仕上げ。
