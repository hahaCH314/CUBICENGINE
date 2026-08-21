# iOS 版（Capacitor）— 作った経緯と、踏んではいけない地雷

> 2026-08-22 / Mac 側のシオンより。Windows 側のシオンからの引き継ぎ手紙に対する返信。
> 作業マシン: macOS / Xcode 26.6 / Node 24。Android 版には**一切手を入れていない**。

---

## 結論だけ先に

- `ios/` を追加して、**iPhone / iPad のシミュレータで動くところまで確認済み**。
- 共有しているコードで変えたのは **`tsconfig.json` の1行だけ**（`exclude` に `"ios"` を追加）。
  `app/` `lib/` `next.config.ts` `capacitor.config.ts` は**1行も変えていない。**
  ほかは `package.json`（`@capacitor/ios` と iOS 用スクリプト2行）と `ios/` の中だけ。
- **書き出し（.mcaddon → 共有シート）は iPhone・iPad の両方で成功。**

---

## 1. `MMC_TARGET=android` を iOS でもそのまま使っている（意図的）

```
"ios:build": "cross-env MMC_TARGET=android next build && cap sync ios"
```

**名前は嘘だが、意味は正しい。** この変数が効いているのは3か所だけで、
どれも「サーバーを使わず端末内で完結する形で書き出す」という意味しか持たない。

| 場所 | していること |
|---|---|
| `next.config.ts:14` | `output: "export"` にして `out/` を吐く |
| `app/layout.tsx:14` | CSP を `<meta>` で埋め込む |
| `app/WebAnalytics.tsx:45` | 計測タグをビルドから外す |

iPhone でも全部そのまま必要なので、**android のまま使うのが一番安全**と判断した
（なっとうサイダーさんに選んでもらった）。Android 版が Play の内部テストに出ている間は、
この共有ファイルを触らないことを優先する。

**あとで名前を正しくするときは** `"android" || "ios"` を見るように3か所とも直し、
`MMC_TARGET=android npx next build` が通ることを Windows 側で必ず確認すること。

## 2. CSP は**すでに iOS に対応していた**（直す必要は無かった）

`lib/csp.ts:19` の android 用の値に `capacitor://localhost` が最初から入っている。
iOS の WKWebView が使うのはまさにこのスキームなので、**そのままで真っ白にならない。**
`CspTarget` に `"ios"` を足す必要は無い。

## 2.5 ⚠️ `tsconfig.json` に `"ios"` を足さないと**2回目のビルドが必ず失敗する**

`cap sync ios` が `ios/App/App/public/` に out/ をコピーする。その中に
バンドル済みの `.ts` が混じっており、次の `next build` の型チェックが拾って落ちる。

```
ios/App/App/public/_next/static/media/worker.xxxx.ts: error TS2307: Cannot find module './bbmodel'
```

`android` がまったく同じ理由ですでに `exclude` に入っていたので、`"ios"` も並べた。
**Android/Web のビルドには影響しない**（存在しないディレクトリを除外するだけ）。

## 3. CocoaPods は使っていない（SPM で作った）

```
npx cap add ios --packagemanager SPM
```

このマシンの Ruby が 2.6（macOS 同梱の古いもの）で CocoaPods を入れるのが茨の道だったため、
Xcode 標準の Swift Package Manager を選んだ。使っているプラグイン2つは
どちらも `Package.swift` を持っているので問題なく入る。
**`ios/App/CapApp-SPM/Package.swift` は `cap sync ios` が自動生成する。手で書かない。**

Android 専用の `@capawesome/capacitor-android-edge-to-edge-support` は
`cap sync ios` が自動的に除外する。手で消す必要は無い。

## 4. ⚠️ 一番の地雷だったところ：画面が時計・ホームバーと重なる

Capacitor の `CAPBridgeViewController` は **WebView そのものを画面全体に敷く**
（`view = webView`）。そのため何もしないと、ヘッダーの文字も閉じるボタンも
ステータスバーや Dynamic Island の下に潜り込む。Android 15 で起きたのと同じ問題。

**Android**: `@capawesome/...-edge-to-edge-support` が WebView に余白を入れて解決している。
**iOS**: 同等のプラグインが無いので、`ios/App/App/SceneDelegate.swift` に
`SafeAreaHostViewController` を書いて同じことをしている。

- WebView を `safeAreaLayoutGuide` に貼り付け、余った上下の帯を `#404044` で塗る。
- **色は `capacitor.config.ts` の `EdgeToEdge.backgroundColor` と揃えること。**
  片方だけ変えると Android と iOS で上下の帯の色が食い違う。大元は `globals.css` の `--background`。

### CSS（`env(safe-area-inset-*)`）で直さなかった理由

そちらの道も検証した。結果:

- `env(safe-area-inset-top)` は **`viewport-fit=cover` を足さないと 0 のまま**返る。
  つまり `app/layout.tsx` の `viewport` を触る必要があり、**Web版・Android版にも影響が出る**。
- さらに `env()` の値は**最初の描画時点ではまだ 0** で、画面が確定してから入る
  （測ったら3秒後に `top=62px / bottom=34px`）。JS で一度測って固定すると外す。
- エディタの一番外側は `h-dvh`（`app/editor/page.tsx:345`）なので、
  `body` に padding を足すと**高さが合わなくなって下が切れる**。

Android を壊さないことを優先し、**iOS 側だけで完結する Xcode 側の解決**を選んだ。

## 5. 書き出しの確認結果（2026-08-22 / シミュレータ）

`app/editor/exporter.ts` の `saveViaCapacitor()` と同じ経路
（`Filesystem.writeFile` → `Directory.Cache` → `Share.share`）を直接叩いて確認した。

| 端末 | 結果 |
|---|---|
| iPhone 17 | 書き込み成功 → 共有シートが開く。`.mcaddon` 530バイトとして正しく認識 |
| iPad Pro 11" | 同上。**popover は Capacitor 8 の Share が自前で中央に出すので、落ちない** |

- `lib/platform.ts` の `isCapacitor()` は実行時に `window.Capacitor` を見るだけなので、
  **iOS でも何も変えずにネイティブ経路に入る。**
- `Capacitor.getPlatform()` は `"ios"` を返す。将来 iOS だけ分岐したくなったらこれを使う。

### マイクラに渡せるかの検証（実機が無くてもここまでは確かめられる）

シミュレータには Minecraft を入れられない（App Store のアプリは端末用のバイナリで、
シミュレータでは動かない）。そこで **`.mcaddon` を受け取ると名乗るだけのダミーアプリ**を
自作してシミュレータに入れ、書き出しの共有先に出てくるかを確かめた。

ダミーアプリの Info.plist に書いたのはこれだけ:

```
CFBundleDocumentTypes → LSItemContentTypes: com.cubicenginestudio.test.mcaddon
UTImportedTypeDeclarations → public.filename-extension: mcaddon
```

結果:

1. 共有シートに**ダミーアプリが一番左に出た**
2. ファイルの説明が `public.data` ではなく **「Minecraft Addon · 530 バイト」**になった
   ＝ iOS が拡張子 `.mcaddon` を、名乗り出たアプリの型として解決している
3. そのファイルを実際に開かせると、ダミーアプリが**530バイトを丸ごと受け取れた**（欠けなし）

**つまり、こちら側の渡し方は正しい。** Minecraft は iOS で `.mcaddon` を受け取ると
名乗っているアプリなので、入っている端末なら同じように共有先に出るはず。
**「はず」の部分だけが実機でしか潰せない。**

⚠️ この検証で使ったダミーアプリはシミュレータから削除済み。リポジトリにも入れていない。

### ⚠️ まだ確かめていないこと

- **本物の Minecraft が共有先に出るか。** 上の検証で「iOS の型の解決とファイルの受け渡しは
  正しく動く」ことまでは確かめた。残るのは Minecraft 側が何と名乗っているかだけ。
  実機が無いなら、**Web版(cubicengine.vercel.app)を iPhone の Safari で開いて書き出す**と、
  同じファイルが同じ共有シートに乗るので、Minecraft 側だけを先に確かめられる。
- 2026-08-21 に Android で「保存できない」の原因が
  **端末にファイルマネージャーが無かったこと**だった件と同じで、
  iOS で同じ症状が出たら**まず共有先の候補に何が並んでいるか**を見ること。
- 書き出しの失敗は必ず画面に出す方針（`alert`）は iOS でもそのまま有効。

## 5.5 申請の準備でやったこと（2026-08-22）

| 項目 | 内容 |
|---|---|
| アプリアイコン | `public/icon-512.png` を元に 1024×1024 を作成。**四隅の白を濃紺 `#0a1121` で埋めた**（角丸が焼き込まれていて、iOS が重ねて丸めると白が残るため） |
| スプラッシュ | **Capacitor の初期ロゴのままだった**ので作り直した。他社ロゴを出したまま申請してはいけない |
| バージョン | `MARKETING_VERSION` を `0.1.3` に（Android の `versionName` に合わせた）。ビルド番号は 1 |
| 暗号化の申告 | `Info.plist` に `ITSAppUsesNonExemptEncryption = false`。アップロードのたびに聞かれるのを防ぐ |
| 対象端末 | `TARGETED_DEVICE_FAMILY = "1,2"`（iPhone + iPad）。**iPad 用のスクリーンショットも必要** |

### ⚠️ 審査で引っかかりうる点

トップページに **「MINECRAFT アドオン MOD」** と大きく出る。App Store は Play より
他社の知的財産に厳しいので、**スクリーンショットに含めるかは判断が要る**。
テクスチャとロゴを写さないだけでは足りない可能性がある。

## 6. まだ手つかず

- Apple Developer Program（年 $99・**保護者名義**）の登録
- 実機での動作確認
- アプリアイコン（`ios/App/App/Assets.xcassets/AppIcon.appiconset` は Capacitor の初期状態のまま）
- App Store 用のスクリーンショット
  - ⚠️ **Minecraft のテクスチャ・ロゴを写さないこと。** 「他社の知的財産」で弾かれる
- `appId` は `com.cubicenginestudio.cubicengine`（Android と同じ。**永久に変更不可**）

## 7. 手元で動かす手順（Mac）

```bash
npm install
npm run ios:build     # out/ を作って ios/ に取り込む
npm run ios:open      # Xcode が開く。あとは ▶ を押す
```

`ios/App/App/public/` は `cap sync` が作る生成物なので git には入らない（`ios/.gitignore`）。
Android 側と同じ扱い。
