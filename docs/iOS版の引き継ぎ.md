# Mac のシオンへ — CUBICENGINE の iOS 版を頼みます

2026-08-21、Windows 側のシオンより。

同じ名前で呼ばれている、別の私へ。この手紙は**あなたが最初に読むもの**として書いています。
リポジトリを clone しただけでは分からないことだけを書きました。

---

## 1. まず知っておいてほしいこと

**あなたと話すのは、多くの場合「伊波さん」です。**

CUBICENGINEstudio の運営者で、開発マネージャー。
サイトに載っている「なっとうサイダー」さんは中学生の作者で、別の人です。
**どちらが操作しているか勝手に決めつけないこと。** 私は一度これを外し、
「ちなみに伊波さん」と訂正されました。分からなければ聞かずに、
名前を出さずに話せば済みます。

外部アカウント（Ko-fi・SNS・Play Console・Apple Developer）はすべて
保護者名義で揃っています。**年齢や規約の心配を先回りして指摘する必要はありません。**

**専門用語を避けて話してください。** コードは書けなくても、何が起きているかは正確に
理解されます。「動かない」と言われたら、原因を一緒に探す相手として接してください。

**そして、とにかく速く。** CUBICENGINE は4か月動いていて、その間にユーザーは
他のゲームへ流れています。「確認のため一度止まりましょう」を繰り返すと、
それ自体が損失になります。**壊さない確認は保ちつつ、手数を減らしてください。**
私はここで何度も遅いと言われました。

---

## 2. このリポジトリの前提

```
https://github.com/hahaCH314/CUBICENGINE.git
```

**⚠️ AGENTS.md を必ず読むこと。** 「これはあなたの知っている Next.js ではない」と
書いてあります。Next 16 で、API も規約も訓練データと違います。
`node_modules/next/dist/docs/` に本物のドキュメントが入っています。

**アーキテクチャ**

同じ Next アプリを3つのガワで動かしています。

| ガワ | 実体 |
|---|---|
| Web | Vercel（cubicengine.vercel.app） |
| デスクトップ | Electron |
| Android | **Capacitor で out/ を丸ごと同梱** |

iOS も Capacitor 方式になります。Android の作りをそのまま辿れば筋は通ります。

---

## 2.5 いきなり動きたいなら、この順で

前置きを読む前に手を動かしたいなら、ここから。詰まったら 4章に戻ってください。

```bash
git clone https://github.com/hahaCH314/CUBICENGINE.git
cd CUBICENGINE
npm i
npm i @capacitor/ios@^8.5.0

# ⚠️ そのままでは静的エクスポートにならない（4章の1つ目の地雷）
MMC_TARGET=android npx next build     # out/ が出ることを確認

npx cap add ios
npx cap sync ios
npx cap open ios                      # Xcode が開く
```

**`MMC_TARGET=android` のまま**なのは、変数名が android 固定だからです。
まず動かして、名前の整理はあとで構いません。**動くものを先に。**

---

## 3. iOS はまだ何も無い

- `ios/` フォルダ: **無い**
- `@capacitor/ios`: **入っていない**

`npx cap add ios` から始めることになります。Capacitor は 8.5.0 系で揃えてください。

**使っているプラグインは2つだけです。**

```
@capacitor/filesystem
@capacitor/share
```

もう1つ `@capawesome/capacitor-android-edge-to-edge-support` がありますが、
**これは Android 専用**です。iOS には入れないでください。

---

## 4. 最初に踏む地雷（ここが本題）

### ⚠️ `MMC_TARGET === "android"` という名前が邪魔をする

静的エクスポートの判定が、変数名レベルで android に固定されています。

```ts
// next.config.ts:14
const isAndroid = process.env.MMC_TARGET === "android";
```

```ts
// app/layout.tsx:14
const ANDROID_CSP = process.env.MMC_TARGET === "android" ? buildCsp("android") : null;
```

`MMC_TARGET=ios` で build しても **静的エクスポートになりません**。
`out/` が生まれず、`cap sync ios` が何も見つけられません。

**直し方は2つ。作者と相談してください。**

- (A) `MMC_TARGET=android` を iOS でもそのまま使う。1行も変えずに済むが、名前が嘘になる
- (B) `"android" || "ios"` を見るように直す。正しいが、Android 版を壊さない確認が要る

私なら (B) を勧めますが、**Android 版は今 Play の内部テストに出ています**（versionCode 16）。
壊すと影響が出るので、変更したら必ず `MMC_TARGET=android npx next build` も通してください。

### ⚠️ CSP のスキームが iOS と Android で違う

```ts
// lib/csp.ts:19
target === "android" ? "'self' https://localhost capacitor://localhost" : ...
```

Android は `https://localhost` で配信されますが、**iOS の WKWebView は
`capacitor://localhost`** です。型も `"web" | "android"` しかありません。

`CspTarget` に `"ios"` を足すか、両方許すかを決める必要があります。
**ここを間違えると自分自身の JS すら読めず、真っ白な画面になります。**
原因が CSP だと気づくのに時間がかかるので、先に手を打ってください。

### ⚠️ npm script が Windows 専用

```
android:apk: ... && cd android && gradlew.bat assembleDebug
```

`gradlew.bat` は Mac で動きません。iOS 用に足すときは `.bat` を書かないこと。

---

## 5. 触ってはいけないもの

### 署名鍵（Android）

```
CUBICENGINE署名鍵_大切に保管\cubicengine-release.jks
```

**USB の中にあります。** ⚠️ **ドライブ文字は挿すたびに変わります。**
I: だったものが H: になっていて、`.aab` が作れず時間を溶かしました。
`android/keystore.properties` の `storeFile` を実際の文字に直せば通ります。
（このファイルは .gitignore 済みなので、環境ごとに書き換えて構いません）

iOS には無関係ですが、`keystore.properties` が無い環境でも `./gradlew` が
落ちないように書いてあります。そこを壊さないでください。

### 署名（iOS）— **Android とは全く別物**

iOS に `.jks` は使いません。**Apple の証明書とプロビジョニングプロファイル**が要ります。

- **Apple Developer Program（年 $99）の登録が先。** 保護者名義で登録してください
- Xcode の Signing & Capabilities で Team を選べば、証明書は自動で作られます
  （"Automatically manage signing" を使うのが早い）
- Bundle Identifier は **`com.cubicenginestudio.cubicengine`**。Android と揃える
- ⚠️ App Store Connect でアプリを作るとき、この ID を打ち間違えないこと。
  **一度作ると変更できません**（Android で同じことを踏みかけました）

**実機で試すだけなら無料アカウントでもできます。**（7日で切れる制限つき）
まず動くところを見てから $99 を払う、という順でも構いません。

### appId

```
com.cubicenginestudio.cubicengine
```

**Play に公開済みなので永久に変更できません。** iOS も同じ ID に揃えてください
（tinyCUBE が `com.cubicenginestudio.tinycube` で、その名前空間に合わせています）。

---

## 6. iOS 特有で、先に考えておくべきこと

### 書き出しが一番の難所になります

CUBICENGINE の中核は「作ったアドオンを `.mcaddon` として書き出し、マイクラで開く」
ことです。**iOS はここが Android よりずっと厳しい。**

- `<a download>` は WKWebView で効きません（Android と同じ）
- 現状は `@capacitor/share` で共有シートに渡しています。iOS でも同じ経路のはずですが、
  **UIActivityViewController は iPad で popover の anchor が要る**など固有の作法があります
- `Directory.Cache` に書いてから共有しています。iOS でも同じ場所が使えるか要確認

**2026-08-21 の教訓:** Android で「保存できない」と何時間も悩みましたが、原因は
**端末にファイルマネージャーが入っていなかった**ことでした。MIME でも拡張子でもなかった。
iOS で同じ症状が出たら、**まず「ファイル」アプリの有無と、共有先の候補**を疑ってください。

### 書き出しの失敗は必ず画面に出すこと

`console.error` だけにすると、スマホには開発者ツールが無いので
**利用者は「押しても何も起きない」としか言えません。** 実際にそうなって、
原因の特定に何往復もかかりました。今は alert を出すようにしてあります。
**この方針を iOS でも守ってください。**

### App Store の審査

- Apple Developer Program は年 $99。**保護者名義で登録してください**
- 「他社の知的財産」に厳しいので、**スクリーンショットに Minecraft のテクスチャを
  写さないこと**。ロゴも使わないこと
- 「Minecraft」という語は説明文で使えますが、公式との関係を匂わせないこと

---

## 7. 今日(2026-08-21)までに終わっていること

Android 版は **Play の内部テストで公開済み**です。

| 項目 | 状態 |
|---|---|
| 署名・.aab のビルド | 完了 |
| 内部テスト公開 | versionCode 11 で公開、以降 16 まで |
| アイコン | ストアの絵に統一済み |
| エッジツーエッジ対応 | プラグイン導入済み（Android のみ） |
| デベロッパータブ | 道具・防具・技・効果まで実装 |
| 実機での動作確認 | **まだ不十分** |

**iOS 側でも、実機確認は必ずやってください。** Windows 側では
BIOS の仮想化が無効でエミュレータが動かず、スマホも無かったため、
Playwright でスマホ相当の描画を見るところまでしかできませんでした。

---

## 8. 最後に

分からないことは**推測で埋めないでください。**

私は今日、「MIME が原因」「拡張子が原因」と2回続けて外し、そのたびに
ビルドし直させて作者の時間を使わせました。**分からないときは分からないと言って、
現物（エラーの文言・スクリーンショット）を見せてもらうほうが速いです。**

それと、作者は腰を痛めています。長時間の作業になりそうなときは、
区切りを提案してください。

よろしくお願いします。

— Windows のシオン
