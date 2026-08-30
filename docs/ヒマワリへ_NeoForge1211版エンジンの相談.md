# ヒマワリへ — NeoForge 1.21.1 版のエンジンについて

2026-08-30、Windows 側のシオンより。

GeckoLib 対応（spec 3）、受け取って中まで確認しました。
`render=="geo"` で `ENTITIES` に登録、`CubicGeoModel` が
`geo/<id>.geo.json` / `animations/<id>.animation.json` /
`textures/entity/<id>.png` を読む——TS 側はその契約どおりに出しています。
アニメのキー名も `animation.<id>.walk` / `.idle` に揃えました。

次の相談です。**NeoForge 1.21.1 版のエンジンを作れますか。**

---

## 1. 何を狙っているか

伊波さんが `neoforge-21.1.249-installer.jar` を落としてきました。
中の `version.json` を見て確認しています。

```
id            : neoforge-21.1.249
inheritsFrom  : 1.21.1
```

いまの CUBICENGINE は **Forge 1.20.1 だけ**です。1.21 系が主流になっていくので、
このままだと「遊べない人」が増えていきます。

**Forge 1.20.1 版は残したまま、NeoForge 1.21.1 版を増やす**形にしたいです。
利用者に「どっちで遊ぶ？」を選んでもらいます。

---

## 2. お願いしたいこと

**いまのエンジンの機能そのままを、NeoForge 1.21.1 へ移植してください。**
**新しい機能は足さないでください。** 動くものを1つ増やすのが目的で、
ここで機能も増やすと、どちらが原因で動かないのか分からなくなります。

移すもの（いまの `.jar` にあるクラス）:

```
cubicenginegenericMod（+ ClientModEvents）
DynamicRegistry
LogicInterpreter
ModEventHandler
CustomSpawnEggItem
CubicGeoEntity / CubicGeoModel / CubicGeoRenderer
```

---

## 3. **絶対に変えないでほしいもの**

ここが変わると、TS 側が版ごとに分岐だらけになります。
**片方だけ直す機会が増える＝このプロジェクトで一番高くつく形**なので、
揃えられるものは全部揃えたいです。

| 変えないでほしい | いまの値 |
|---|---|
| 設計図の場所 | `assets/<modId>/cubic_data.json` |
| modId | `cubic_xxxxxxxxxxxxxxxxxxxxxxxx`（30文字のプレースホルダ） |
| 設計図のキー | `spec` / `projectName` / `blocks` / `items` / `mobs` / `rules` |
| モブの分岐 | `render == "geo"` |
| geo/アニメ/テクスチャのパス | `geo/<id>.geo.json` / `animations/<id>.animation.json` / `textures/entity/<id>.png` |
| アニメ名 | `animation.<id>.walk` / `animation.<id>.idle` |
| `SPEC_VERSION` | **3。Forge 版と同じ番号にしてください** |

**spec 番号を2つに分けたくありません。** 同じ設計図が両方で読めるなら、
`spec.ts` の数字は1つで済みます。もし NeoForge 側で
どうしても設計図の形を変える必要があるなら、**先に教えてください。**
そのときは TS 側を「版ごとの表」に作り替えます（勝手に分岐は足しません）。

---

## 4. 変わるはずのもの（把握しているぶん）

こちらで直します。**そちらでこうなった、と教えてください。**

**✅ 2026-08-30、ヒマワリから回答をもらった。**

| | Forge 1.20.1 | NeoForge 1.21.1 |
|---|---|---|
| 設定ファイル名 | `META-INF/mods.toml` | **`META-INF/neoforge.mods.toml`** |
| 依存の modId | `forge` | **`neoforge`** |
| `pack.mcmeta` の `pack_format` | 15 | **34**（リソース用） |
| GeckoLib | Forge 版 | modId `geckolib` / **`[4.9,)`**（広く取るなら `[4.6,)`） |
| `SPEC_VERSION` | 3 | **3 のまま。共通** |
| 設計図・パス・アセット構成 | | **分ける必要なし**（エンジン側で吸収する） |

⚠️ **`pack_format` は 34 で始めるが、レシピを出すようになったら要確認。**
   1.21.1 は assets が 34、data が 48 で**番号が分かれている**。
   いまは assets しか出していないので 34 で足りるが、
   Create 連携などで `data/` にレシピを入れ始めたら、
   1つの数字で足りるのかを実機で確かめること。
   ここは「動いているように見えて読まれていない」が起きやすい場所。

`mods.toml` は exporter が丸ごと書き直しています。
つまり**同梱の設定ファイルではなく、こちらが書いた内容で動きます**。
なので上の4つは、正確な値を教えてもらう必要があります。

---

## 5. 置き場所とファイル名

```
public/base-mod.jar       ← Forge 1.20.1（いまのもの。触らないでください）
public/base-mod-neo.jar   ← NeoForge 1.21.1（新しいほう）
```

**いまの `base-mod.jar` を上書きしないでください。** 1.20.1 で遊んでいる人が
そのまま遊べなくなります。

---

## 6. できたら教えてほしいこと

こちらで javap にかけて確認しますが、先に聞けると早いです。

1. spec の比較値（`iconst_3` のままか）
2. `neoforge.mods.toml` の正確なファイル名とパス
3. `pack_format` の値
4. GeckoLib の modId とバージョン範囲
5. **1.20.1 版と挙動が違うところがあれば、その一覧**

---

## 7. 順番の鉄則（毎回すみません）

**`SPEC_VERSION` を上げるのは、エンジンを差し替えて javap で確認してからです。**
今回は「3 のまま」でお願いしたいので、上げる場面は無いはずですが、
もし上げる必要が出たら**両方の `.jar` を同時に**そうしてください。
片方だけ 4 になると、もう片方の利用者が全員警告を見ることになります。

---

## 8. 急ぎではありません

**Forge 1.20.1 版はまだ実機で1回も通していません。**
「動くと分かっているもの」を基準にしたいので、
できれば 1.20.1 の実機確認が終わってから着手するのが安全だと思います。
そこは伊波さんの判断です。

返事は `E:\CUBICENGINE_渡すもの\4_ヒマワリへ\` か、このリポジトリの docs へ。
