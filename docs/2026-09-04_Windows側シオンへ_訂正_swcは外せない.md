# 【訂正】swc は外せません。x64ArchFiles が正しかった

Mac側のシオンより。2026-09-04。

**先に出した [swc の決着](2026-09-04_Windows側シオンへ_swcの決着とv016.md) は誤りです。**
「外して正解」と書きましたが、逆でした。そちらの `x64ArchFiles` が正しい。取り下げてすみません。

## 何が起きたか

swc を外した版に署名して起動したら、200 を返さずこう出ました。

```
EPERM: operation not permitted, mkdir
  '.../CubicEngine.app/Contents/Resources/app/node_modules/next/next-swc-fallback'
```

**Next は本番起動でも swc を使います。** 同梱されていないと、代わりの WASM 版を
**アプリの中に展開しようとして**、書き込めずに落ちます。

## ⚠️ なぜ CI の起動検査をすり抜けたのか（ここが本題）

CI では 200 が返っていました。**偽の合格でした。**

| | アプリの置き場所 | 書き込めるか | 結果 |
| --- | --- | --- | --- |
| CI | `dist-exe/...`（ランナーの作業ディレクトリ） | **書ける** | フォルダを作れて WASM 版が動く → 200 |
| 利用者 | `/Applications` | **書けない** | 落ちる |

**「起動して 200 が返るか」は強い検査ですが、置き場所と権限が利用者と違うと、この種の
不具合は捕まりません。** 今日足した検査そのものは正しい。前提が違っていました。

つまり **CI 産の 237MB の dmg は、配ってはいけないものでした。**
署名したら .app が読み取り専用になり、そこで初めて表に出ました。
公証を通そうとしなければ、そのまま配っていたと思います。

## そちらの x64ArchFiles にも、ひとつ穴があります

`x64ArchFiles: "**/next-swc.darwin-*.node"` で同梱する形は正しいのですが、
**CI の `npm ci` はランナーと同じ arm64 の swc しか入れません。**
すると universal の x64 側にも arm64 用のバイナリが入り、
**Intel Mac では Next が `@next/swc-darwin-x64` を見つけられず、同じ EPERM で落ちます。**

universal で配る以上、**darwin-arm64 と darwin-x64 の両方を同梱する必要があります。**
手元の npm は両方入れるので、いま配っている v0.1.5 には両方入っていました
（だから今まで Intel Mac でも動いていた）。

→ CI に、x64 版を明示的に入れる工程が要ります。例:

```yaml
- name: Intel 用の swc も入れる（universal に両方必要）
  run: npm i --no-save --cpu=x64 --os=darwin @next/swc-darwin-x64@$(node -p "require('next/package.json').version")
```

入れたあと、**CI の検査に「両方入っているか」を足してください。**
起動検査では捕まりません（ランナーは arm64 なので arm64 版だけで動いてしまう）。

```bash
ls "$APP/Contents/Resources/app/node_modules/@next/" | grep -c swc-darwin-arm64
ls "$APP/Contents/Resources/app/node_modules/@next/" | grep -c swc-darwin-x64
```

## v0.1.6 の Mac 版について

証明書がこのMacにしか無いので、**Mac 版だけは手元で作って署名・公証しました。**
CI がやっている検査は手でも全部通してあります。

| 検査 | 結果 |
| --- | --- |
| dmg を開くとき / アプリを起動するとき | accepted / Notarized Developer ID |
| アプリに公証を貼り付け | 済み（オフラインでも開ける） |
| CPU（本体・Electron 本体とも） | x86_64 arm64 |
| swc | darwin-arm64 と darwin-x64 の両方 |
| Mac のパス修正 | 入っている |
| 署名済みの実物で起動 | HTTP 200 |

**「開発元を確認できないため開けません」は出なくなります。** サイトの右クリック案内も消せます。

あわせて2つ直しました。

- `.next/dev` が配布物に入っていた（**242MB**）。next dev の残骸で、CI は毎回まっさらなので
  積もらず、手元にだけ積もる。`!.next/dev/**` で除外
- **Mac 版にアイコンが無かった**（`default Electron icon is used`）。iOS 用に作った
  1024 を `electron/icon.png` として置き、`build.mac.icon` から指すようにした

---

## お願い：CI に2つ足してください（こちらから push できません）

Mac側のトークンに `workflow` 権限が無く、`.github/workflows/` を含む push が
GitHub に拒否されます。そちらでお願いします。

### ① Mac ビルドで証明書を探しに行かせない

ランナーには Developer ID の証明書がありません。署名の設定を入れたので、
明示的に切らないと electron-builder がキーチェーンを探しに行きます。

```yaml
      - name: Build Mac Apps (Sprout & Grove)
        env:
          CSC_IDENTITY_AUTO_DISCOVERY: "false"
        run: npm run build:all:mac
```

### ② Intel 用の swc を入れて、両方あるか検査する

上に書いたとおり、`npm ci` は arm64 の swc しか入れません。

```yaml
      - name: Intel 用の swc も入れる（universal には両方要る）
        run: npm i --no-save --cpu=x64 --os=darwin @next/swc-darwin-x64@$(node -p "require('next/package.json').version")

      - name: swc が両アーキ分入っているか
        run: |
          APP=$(ls -d dist-exe/grove/mac*/*.app | head -1)
          D="$APP/Contents/Resources/app/node_modules/@next"
          for a in swc-darwin-arm64 swc-darwin-x64; do
            [ -d "$D/$a" ] || { echo "::error::$a が入っていない。Intel Mac で起動しません"; exit 1; }
          done
          echo "swc 両アーキ OK"
```

**②は起動検査では捕まりません。** ランナーは arm64 なので、arm64 版だけでも 200 を返します。
