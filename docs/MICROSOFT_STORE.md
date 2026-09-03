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

これらは `package.json` の `build.appx` に入っている。**1文字でも違うと Partner Center が
アップロードを弾く**ので、変更するときは Partner Center の「製品ID」画面からコピペすること。

## ビルド手順

```bash
npm run appx:assets      # タイル画像を public/icon-512.png から生成（初回・アイコン変更時のみ）
npm run build:grove:appx # .appx を作る
```

出力: `dist-exe/grove/GROVE_editor.appx`

これを Partner Center の「パッケージ」でアップロードする。署名は不要（Microsoft が行う）。

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
