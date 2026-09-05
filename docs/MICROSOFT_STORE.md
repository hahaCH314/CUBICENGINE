# Microsoft Store 提出手順（GROVE デスクトップ版）

作成: 2026-09-03

## 方式

**MSIX / PWA アプリ枠**で提出する（CMCUBE と同じ枠）。

MSI/EXE 枠（インストーラを自前サーバーに置いて URL を登録する「ダウンロード版」）も選べるが、
そちらは **有料のコード署名証明書が必須**（自己署名は不可、Store は MSI/EXE を再署名しない）。
MSIX 枠なら **Microsoft 側が署名してくれるので証明書代がかからない**ため、こちらを採用。

## Partner Center の製品情報

| 項目 | 値 |
| --- | --- |
| 製品名 | CUBICENGINE GROVE |
| Package/Identity/Name | `CUBICENGINEstudio.CUBICENGINEGROVE` |
| Package/Identity/Publisher | `CN=87788BE5-5897-4593-8CAD-DA1FF10A252C` |
| Package/Properties/PublisherDisplayName | `CUBICENGINEstudio` |
| Package Family Name | `CUBICENGINEstudio.CUBICENGINEGROVE_qq2gprqqqfz3m` |
| Microsoft Store ID | `9N4J0Q0KPP7W` |
| 審査状況を見るページ | https://partner.microsoft.com/ja-jp/dashboard/products/9N4J0Q0KPP7W/overview |

これらは `package.json` の `build.appx` に入っている。**1文字でも違うと Partner Center が
アップロードを弾く**ので、変更するときは Partner Center の「製品ID」画面からコピペすること。

## いまどこまで進んだか（2026-09-04 時点）

- ✅ `.appx` が CI で作れる（release.yml / 実行 #11 が成功）
- ✅ **MSIX として実際にインストールでき、起動し、書き込みが本物の `%APPDATA%` に届くことを CI で確認済み**
- ✅ Partner Center へアップロードし、**Submission 1 を提出済み**（2026-09-04）
- ⬜ 審査結果待ち（数時間〜3営業日）
- ⬜ `unvirtualizedResources` の説明を求められたら返す（文面は下記）
- ⬜ 実機の Minecraft で MOD が読めるかの確認（なっとうサイダーさん）

### 提出時に選んだもの（次回の参考）

| 項目 | 選んだもの |
| --- | --- |
| Device family | Windows 10/11 Desktop のみ |
| 市場 | 世界中のすべての市場 |
| 価格 | 無料（¥0） |
| リリース | できるだけ早く |
| 掲載言語 | 日本語 + 英語 |
| カテゴリ | 開発者ツール |

⚠️ ストア版には Ko-fi への寄付リンクが**入ったまま**。スマホ版は審査で弾かれたため
外してある（[app/page.tsx](../app/page.tsx) の `IS_MOBILE_APP`）。Microsoft は
比較的緩いという判断で残したが、指摘されたら同じ仕組みでストア版も外せる。

### 次にやること

1. https://github.com/hahaCH314/CUBICENGINE/actions を開く
2. 「リリース用インストーラのビルド」の成功した実行を開く
3. 画面上部の **Artifacts の数字**をクリック → `CUBICENGINE-grove-store-package` をダウンロード
4. zip を展開すると `GROVE_editor.appx` が入っている。それを Partner Center へ
5. 「申請オプション」で制限付き機能の説明を書く（下記をそのまま貼れる）

### 制限付き機能の説明（審査で求められる）

`unvirtualizedResources` は制限付き機能なので、提出時に用途の説明が要る。
説明が不十分だと却下されうる。以下をそのまま使える。

> 本アプリは Minecraft Java版の MOD を作成するツールです。生成した .jar ファイルを
> `%APPDATA%\.minecraft\mods` に保存しますが、このファイルを読み込むのは Minecraft という
> 別のアプリケーションです。
>
> ファイルシステムの仮想化が有効だと、保存先がパッケージ内のコンテナに隔離され、
> Minecraft から参照できなくなります。その結果、保存は成功したように見えて MOD が
> 読み込まれない状態となり、本アプリの中核機能が成立しません。
>
> このため `unvirtualizedResources` が必要です。用途は上記のフォルダへの読み書きに限られます。

### 却下されたら

`.appx` を諦め、MSI/EXE 枠（インストーラを自前で置き URL を登録する形）に切り替えることになる。
ただしそちらは**有料のコード署名証明書が必須**。無料・無広告の方針と天秤にかけて判断すること。
ストアに出せなくても、GitHub Releases からの配布は動いている。

## ビルド手順

> ## ⚠️ 手元で作ったものは提出しない
> 提出する `.appx` は **CI で作る**。理由は [docs/RELEASE.md](RELEASE.md)。
> 手元ビルドは自分で動作確認する用。

CI（GitHub の Actions 画面 →「リリース用インストーラのビルド」→ Run workflow）で作る。
署名は不要（Microsoft が行う）。証明書代はかからない。

手元で試したいときだけ:

```bash
npm run appx:assets      # タイル画像を public/icon-512.png から生成（初回・アイコン変更時のみ）
npm run build:grove:appx # .appx を作る（未コミットの変更があると止まる）
```

出力: `dist-exe/grove/GROVE_editor.appx`

## AppData 仮想化を切っている理由（重要）

MSIX 化すると Windows は `%APPDATA%\Roaming` への書き込みを
`%LOCALAPPDATA%\Packages\<PFN>\LocalCache\Roaming` へ自動リダイレクトする。

GROVE は [`electron/main.js`](../electron/main.js) で `%APPDATA%\Roaming\.minecraft\mods` に
jar を置くため、既定のままだと **書き込みは成功するのに Minecraft から見えない**。
しかも読み取りは実体へ抜けるので `existsSync` は true を返し、失敗が表面化しない。
これは `docs/WIN_STRATEGY.md` の負け筋1（作る→マイクラに入る が折れる）そのもの。

そこで [`scripts/appx-manifest.js`](../scripts/appx-manifest.js)（electron-builder の
`appxManifestCreated` フック）で AppxManifest.xml に以下を注入している。

```xml
<desktop6:FileSystemWriteVirtualization>disabled</desktop6:FileSystemWriteVirtualization>
<desktop6:RegistryWriteVirtualization>disabled</desktop6:RegistryWriteVirtualization>
```

この要素は Windows 10 2004 以降のため、`TargetDeviceFamily` の `MinVersion` も
`10.0.19041.0` へ引き上げている。

**インストール後に必ず実機で「MOD を作る → .minecraft/mods に入る → Minecraft で読める」を
確認すること。** ここが壊れていても画面上はエラーが出ない。

## 審査で注意する点

- GROVE は Gradle / JDK をネットから取得して実行する。Store は「外部から実行コードを
  ダウンロードして動かすアプリ」に厳しいため、リジェクトされる可能性がある。
  申請時の「認定メモ」に **開発ツールであること**と、何を何のために取得するかを明記する。
- Minecraft は Mojang の商標。アプリ名・説明文に Mojang / Microsoft 公認と誤解される表現を
  入れない。README と同じ免責文をストア説明にも入れる。
- パッケージが約 500MB 超と大きい（`build.asar` が false のため）。アップロードに時間がかかる。
