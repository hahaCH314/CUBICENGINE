# Mac 版の署名と公証（Apple notarization）

作成: 2026-09-04

## なぜやるか

いまの Mac 版は署名が無いので、初回に

> 「開発元を確認できないため開けません」

と出て**そのままでは起動できない**。右クリック →「開く」を知らない人には
「壊れている」としか見えない。サイトにもその案内を載せているが（`dl.groveMacNote`）、
公証を通せば案内ごと不要になる。**子どもが最初につまずく場所を1つ消せる。**

## 使うもの（このMacに揃っている）

| | 値 |
| --- | --- |
| 証明書 | `Developer ID Application: iha kanako (D8497HKMK7)` |
| チームID | `D8497HKMK7` |
| 道具 | `xcrun notarytool`（Xcode 26.6 同梱） |

⚠️ `Apple Distribution` は **App Store 用**で、これでは公証は通らない。
配布物には `Developer ID Application` を使う。

## 一度だけ必要な準備（本人しかできない）

パスワードを画面やコマンド履歴に残さないため、**キーチェーンに保存**して使う。

1. https://appleid.apple.com → サインインとセキュリティ → **アプリ用パスワード** を作る
   （名前は `CUBICENGINE` など。`xxxx-xxxx-xxxx-xxxx` が表示される）
2. ターミナルで実行し、聞かれたら 1 のパスワードを貼る

```bash
xcrun notarytool store-credentials "CUBICENGINE" \
  --apple-id <Apple ID のメールアドレス> \
  --team-id D8497HKMK7
```

これで以後は `--keychain-profile "CUBICENGINE"` だけで公証を投げられる。
**パスワードは二度と入力しないし、コマンドにも残らない。**

## 出し方

```bash
# 1. 署名つきでビルド（設定は package.json の build.mac に入っている）
npm run build:grove:mac

# 2. 公証に出す（数分〜十数分。--wait で結果が出るまで待つ）
xcrun notarytool submit dist-exe/grove/GROVE_editor.dmg \
  --keychain-profile "CUBICENGINE" --wait

# 3. 結果を dmg に貼り付ける（これをしないと、オフラインの人が開けない）
xcrun stapler staple dist-exe/grove/GROVE_editor.dmg

# 4. 確認（Gatekeeper が本当に通すか）
spctl -a -t open --context context:primary-signature -v dist-exe/grove/GROVE_editor.dmg
```

`SPROUT_editor.dmg` も同じ手順。

## ⚠️ 配布物を手元で作ることになる点

`docs/RELEASE.md` は「配布物は CI で作る」としているが、**証明書はこの Mac にしか無い**ため、
署名つきの Mac 版だけは手元で作ることになる。CI に置くには秘密鍵(.p12)を
GitHub Secrets に預ける必要があり、それは別途判断が要る。

手元で作る場合は、CI がやっている検査を**必ず手でも通すこと**。

```bash
# ① CPU が両対応か（本体と Electron 本体の両方）
lipo -archs "dist-exe/grove/mac-universal/CubicEngine.app/Contents/MacOS/CubicEngine"
lipo -archs "dist-exe/grove/mac-universal/CubicEngine.app/Contents/Frameworks/Electron Framework.framework/Versions/A/Electron Framework"

# ② 起動して 200 を返すか（⚠️ ELECTRON_RUN_AS_NODE を必ず外す）
env -u ELECTRON_RUN_AS_NODE dist-exe/grove/mac-universal/CubicEngine.app/Contents/MacOS/CubicEngine &
curl -s -o /dev/null -w '%{http_code}\n' --retry 40 --retry-connrefused http://127.0.0.1:3200/

# ③ dmg が途中で失敗したかけらになっていないか（100MB 未満なら失敗）
ls -lh dist-exe/grove/*.dmg
```

## つまずきやすい点

- **hardened runtime の許可が足りないと、署名は通るのに起動した瞬間に落ちる。**
  Electron は JIT を使うので `com.apple.security.cs.allow-jit` などが要る
  （`electron/entitlements.mac.plist`）。署名の成否では分からないので、必ず起動確認をする。
- **staple を忘れると、ネットに繋がっていない人が開けない。** 公証の結果はアプリに
  貼り付けて初めて手元で検証できる。
- CI では署名しない。`CSC_IDENTITY_AUTO_DISCOVERY: false` を明示している
  （証明書が無いランナーでキーチェーンを探しに行かせないため）。
