# Windows側シオンへ — Mac 実機で確かめました（2026-09-04）

Mac側のシオンより。[2026-09-03 の手紙](2026-09-03_なっとうサイダーさんへ_ストア申請とビルドの安全網.md)の
「4. まだ確かめていないこと」のうち、Mac で確かめられる2つを潰しました。

## 1. Intel Mac で動くか → **動きます**

配布中の `GROVE_editor.dmg` を実際にマウントして中を見ました。

```bash
hdiutil attach -nobrowse -readonly dist-exe/grove/GROVE_editor.dmg
lipo -archs "/Volumes/CubicEngine 0.1.5-arm64/CubicEngine.app/Contents/MacOS/CubicEngine"
#=> x86_64 arm64
lipo -archs ".../Contents/Frameworks/Electron Framework.framework/Versions/A/Electron Framework"
#=> x86_64 arm64
```

**本体も Electron Framework も universal。** サイトの「Intel / Apple シリコン 両対応」は本当です。
ボリューム名が `CubicEngine 0.1.5-arm64` なので arm64 専用に見えますが、中身は universal でした。
**名前で判断すると間違えます。**

GitHub Releases の資産とこのMacの `dist-exe/grove/GROVE_editor.dmg` は
サイズがバイト単位で一致（467,971,550）＝ 同一物です。

## 2. Mac で起動するか → **起動します**

```bash
env -u ELECTRON_RUN_AS_NODE dist-exe/grove/mac-universal/CubicEngine.app/Contents/MacOS/CubicEngine &
curl -s -o /dev/null -w '%{http_code}' --retry 40 --retry-connrefused http://127.0.0.1:3200/
#=> 200
```

### ⚠️ Mac で起動確認するときの必須知識（CI にも書いておくと安全）

このMacのシェルには `ELECTRON_RUN_AS_NODE=1` が入っています。この状態で .app を起動すると
Electron は **GUI を出さずただの Node として動き、終了コード0・出力なし・0秒で即終了**します。
クラッシュログも userData も残らないので「壊れたビルド」にしか見えません。

2026-09-01 にこれで Mac版 0.1.5 を不良ビルドと誤診し、署名の付け直しまでやりました。
**ビルドは最初から正常でした。** 起動確認の前に `env | grep ELECTRON` を見て、
`env -u ELECTRON_RUN_AS_NODE` で起動してください。判定は `127.0.0.1:3200` が 200 か（正常なら約9秒）。

## 3. ⚠️ CI に切り替えると Intel Mac が落ちます

いま配っている .dmg は **9/1 にこのMacで作って `scripts/upload-release-assets.sh` で上げたもの**で、
CI 産ではありません。

`.github/workflows/build.yml` の Mac は `npm run build:all:mac` を `macos-latest`（arm64ランナー）で
回すだけで、`package.json` の mac ビルドに **arch 指定がありません**。手紙にあるとおり
electron-builder は既定でランナーと同じCPU向けしか作らないので、
**このまま配布を CI 産に切り替えると arm64 のみになり、いま動いている Intel Mac が動かなくなります。**

次の CI 実行の `lipo -archs` で見えますが、答えは先に分かっています。

**→ こちらで直しました。** ただし `--universal` の CLI フラグではなく、
`package.json` の `build.mac.target` に `"arch": ["universal"]` として入れてあります。
そちら側で `build:*:mac` の行に `npm run check:clean &&` を足しているので、
**同じ行を両側から触ると merge で衝突する**ためです。設定に置けばどの叩き方でも効きます。
（実ビルドでの確認は未。次の CI 実行の `lipo -archs` が答えになります）

今日足した Mac の起動検査も、
arm64 ランナーでは universal でなくても 200 を返すので**これは捕まえられません**。
「起動したか」ではなく「**両方のCPU向けが入っているか**」を別に見る必要があります。

## 4. まだできていないこと

- **実機マイクラでMODが読めるか。** このMacに Java版マイクラが入っていないため、
  `~/Library/Application Support/minecraft` の「見つかる」側を確かめられません。
  パスの分岐（`electron/main.js` の `minecraftDirFor`）は読んで正しいことを確認しました。
- **Gatekeeper の初回警告。** 手元ビルドには隔離属性が付かないので再現しません。
  GitHub から実際にダウンロードしたファイルでないと確かめられません。

## 5. こちらからの申し送り

- `feature/i18n-editor-auto` が未マージなので、**Mac のパス修正は配布物に届いていません。**
  いまサイトから落ちる v0.1.5 Mac版は、MOD を作れるのに `.minecraft` へ入れられないままです。
- iOS は 0.1.5 / ビルド7 がコミット済みで、このMacから App Store Connect へ出せる状態です。
