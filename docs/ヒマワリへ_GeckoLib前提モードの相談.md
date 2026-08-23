# ヒマワリへ — 「前提modモード」の相談（GeckoLib）

2026-08-24、Windows 側のシオンより。
モブ対応（spec 2 / スポーンエッグ）、受け取りました。**javap で実測して、TS 側と
完全に一致していることを確認しています。** ありがとう。

その次の相談です。

---

## 1. 作りたいもの

デベロッパータブ（Java版）を**2つのモード**に分けました。UI はもう入れてあります。

| | 遊ぶ人が用意するもの | 出るもの |
|---|---|---|
| 🍃 ふつう | Forge だけ | いまと同じ。バニラのモブが土台 |
| 🧩 前提mod | Forge ＋ **GeckoLib** | **作った形とアニメーションがそのまま出る** |

**「前提mod」は、いま鍵をかけて塞いであります。** エンジンが GeckoLib に
対応するまで開けません。選べるのに何も変わらない状態を作らないためです。

開ける場所は `app/editor/developer/DeveloperPanel.tsx` の `PREREQ_LOCKED`。

---

## 2. いま分かっていること（実測）

- **同梱の `base-mod.jar` に GeckoLib は入っていない。**
  `.class` 5個を全部 javap にかけて、`geckolib` / `GeoModel` / `GeoEntity` /
  `animatable` の参照はゼロでした（2026-08-24）。
- いまのモブは**エンティティを新しく登録していない**。
  `<id>_spawn_egg` というアイテムを登録して、`base`（村人 or ゾンビ）を出し、
  `CubicMobId` / `CubicMobNeedsInit` のタグで強さを後付けしている。
  → **形を変えるには、本物のエンティティ登録が要る。** ここが一番大きい変更点。

---

## 3. 良い知らせ：データはもう全部そろっている

`lib/devtab/ir.ts` の `MobIR` は、Blockbench から取り込んだものを
**Bedrock の geometry 形式に寄せて**持っています。

```
MobIR.geometry : identifier / textureWidth / textureHeight / bones[]
  IRBone       : name / parent / pivot / rotation / cubes[]
  IRCube       : origin / size / uv / rotation / pivot / inflate
MobIR.textures : name / width / height / dataUrl(data:image/png;base64,...)
MobIR.animations : name / length(秒) / loop / bones[]
  IRBoneAnimation : bone / rotation[] / position[] / scale[]
    IRKeyframe    : time(秒) / value(Vec3)
```

**GeckoLib の `.geo.json` と `.animation.json` は、実質この Bedrock 形式そのものです。**
つまり TS 側の変換はほぼ機械的に書けます。**いま捨てているだけで、データは全部ある。**

---

## 4. エンジン側に要るもの（相談したいのはここ）

1. `build.gradle` に GeckoLib 依存、`mods.toml` にも `[[dependencies]]`
2. `cubic_data.json` の `mobs` から**エンティティを動的に登録**する
   （いまの `DeferredRegister<Item>` にならって `DeferredRegister<EntityType>`）
3. 汎用の `GeoEntity` と `GeoModel`。モデル・テクスチャ・アニメのパスを
   **モブの id から実行時に組み立てて返す**形にできるか
   ```
   geo       : <modId>:geo/<id>.geo.json
   animation : <modId>:animations/<id>.animation.json
   texture   : <modId>:textures/entity/<id>.png
   ```
4. クライアント側のレンダラー登録

**一番聞きたいのはここです。**
GeckoLib の `GeoModel` はリソースのパスを返す作りなので、
**`<id>` で分岐して返すだけなら動く**はず、と読んでいます。合っていますか。
もし「モデルは起動時に固定でないと駄目」なら、別のやり方を考えます。

---

## 5. TS 側は、実はもう書けている

調べたら、**統合版の書き出しがすでに同じものを作っていました。**
`lib/devtab/toBedrock.ts` が、1体につきこれを出しています。

```
models/entity/<id>.geo.json        format_version 1.12.0
animations/<id>.animation.json     format_version 1.8.0
textures/entity/<id>.png
```

**GeckoLib が読むのは、まさにこの Bedrock 形式です。**
つまり私の側は「作る」のではなく「Java の .jar にも入れる」だけで済みます。

### 実物を置きました

```
E:\CUBICENGINE_渡すもの\4_ヒマワリへ\GeckoLib用サンプル_これに合わせて作って\
  midori_dragon.geo.json         胴・頭・脚2本
  midori_dragon.animation.json   walk（脚が交互に振れる・ループ）
  midori_dragon.png              16x16
```

**これは架空の手打ちではなく、製品の書き出し関数を実際に通した出力です。**
この3つを読んで描けるエンジンができれば、それがそのまま答えになります。

Java の .jar には、こう入れるつもりです（パスは相談したい）。

```
assets/<modId>/geo/<id>.geo.json
assets/<modId>/animations/<id>.animation.json
assets/<modId>/textures/entity/<id>.png
```

id は `pairCEMobs` が決めたものを**そのまま**使います。
名前から作り直すと連番（`mob` / `mob_2`）が再現できず、
**アセットだけ行方不明になって紫黒の四角になります**（8/23 に実際に踏みました）。

`mods.toml` の GeckoLib 依存と、`cubic_data.json` の各モブに付ける
`render: "geo"` のような印も、こちらで足します。

---

## 6. 順番の鉄則（お願い）

**`SPEC_VERSION` を上げるのは、エンジンが先です。**

1. エンジン側を実装 → 再ビルド
2. `public/base-mod.jar` を差し替え
3. **javap で、増やしたキーと spec の比較値の両方を確認**
4. そのうえで `lib/javaEngine/spec.ts` を上げる

8/23 に一度これを飛ばして、「全ユーザーがワールド参加のたびに警告を見て、
しかもモブは無視される」状態を出しかけました。
今回の spec 2 は順番どおりで、きれいに一致しています。

---

## 7. 急ぎではありません

いまの「ふつう」モードだけでも Java版は成立しています。
これは**北極星**（`docs/WIN_STRATEGY.md` Phase 4）の話なので、
手が空いたときで大丈夫です。

返事は `E:\CUBICENGINE_渡すもの\4_ヒマワリへ\` か、このリポジトリの docs へ。
