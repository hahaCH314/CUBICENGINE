# 🌿 GROVE / JAVA 中身づくり計画書

> 担当メモ：設計＝シオン（この文書）／実装の主担当＝ヒマワリ。
> デリケートな判断箇所（ID解決・UIフォーム方針・i18nキー）は **シオンがレビュー**。
> 触る前に各 Phase 冒頭の「触るファイル」を確認 → Phase制で衝突回避。

---

## 0. これは何の計画か（ひとことで）

**「GROVE（Java版）で作ったMODが、実際には何も動かない」を直す計画。**

SPROUT（統合版/Bedrock）は動く。GROVE（Java/Forge）だけ中身が空っぽ。
原因はハッキリしている（下記 §1）。これを段階的（J1→J2→J3）に埋める。

---

## 1. 現状＝なぜ動かないか（事実）

調査して確定した「動かない理由」は **2つ別々**にある。

### ① exportJava は Bedrock用JSを「Javaのコメント」にしてるだけ
- `app/editor/exporter.ts:353 exportJava(state, jsCode)` は Forge 1.20.1 の雛形
  （build.gradle / `XxxMod.java` / `ModBlocks.java` / `ModItems.java` / `ModEventHandler.java` / mods.toml）を出力する。
- ところが肝心のロジック部 `ModEventHandler.java` が **`exporter.ts:574`** で

  ```ts
  ...jsCode.split("\n").map((l) => `    // ${l.replace(/\r/g, "")}`)
  ```

  ＝ **Bedrock用の JavaScript を丸ごと Java のコメントに変換**しているだけ。
  実際に動く Java ロジックは **onPlayerJoin の "Welcome" 1個だけ**。
  → 出力された .jar は「参加時にWelcomeと言う」以外、何もしない。

### ② そもそも CBlock グラフが exporter まで届いていない（根本）
- パイプラインは **文字列1本（`generatedJsCode`）で繋がっている**：

  ```
  LogicPanel(積み木=CBlock[]) ──genTrigger(codegen.ts)──► JS文字列
        └─ setGeneratedJsCode(store.generatedJsCode)
              └─ exportProject(state, state.generatedJsCode)
                    ├─ exportBedrock(state, jsCode)  ← JS文字列でOK（Bedrockの言語がJSだから）
                    └─ exportJava(state, jsCode)     ← JS文字列しか無い＝Javaに翻訳しようがない
  ```

- **CBlock[] グラフは LogicPanel のローカル `useState` に閉じている**。store にも exporter にも渡っていない。
- つまり Java を生むには、まず **構造（CBlock[）を exporter まで届ける**必要がある。これが根本。

### ③ GROVE（GrapePanel）は export に繋がってすらいない
- `app/editor/GrapePanel.tsx` は独自の簡易ブロック（fruits: on_join/on_break/on_chat/say/give/effect/if/repeat/number）。
- 「マイクラへ放つ」ボタンは **`fruitsToCode()`（演出用のJava風文字列）を画面に流すアニメだけ**。
  store にも保存されず、exportJava も呼ばない。＝ **GROVE には実export経路が存在しない**。
- ＝ SPROUT(LogicPanel) と GROVE(GrapePanel) は **別のブロック体系**で、今は分断されている。

---

## 2. 目指す形（ターゲット設計）

> 原則：**ロジックは1つ、codegen は2つ、見た目（編集UX）は別。**

```
        ┌────────────── ロジックグラフ CBlock[]（唯一の真実）───────────────┐
        │   SPROUT(積み木UX)        GROVE(ラジアルUX)   ← 見た目/編集方法が違うだけ │
        └───────────────────────────┬──────────────────────────────────────┘
                                     │ store.logicBlocks
                  ┌──────────────────┴───────────────────┐
        lib/codegen.ts (既存)                   lib/codegenJava.ts (新規)
        Bedrock JavaScript                      Forge 1.20.1 Java
                  │                                       │
        exportBedrock(.mcaddon)                 exportJava(Forge zip → .jar)
```

- **編集UI（SPROUT積み木 / GROVE ラジアル）は“スキン”**。中身は同じ CBlock グラフを編集しているだけにする。
- **出力ターゲット（Bedrock / Java）で codegen バックエンドを切り替える**。
- ※ いきなり全部統一はリスク大。下の Phase で「まず Java を本物にする → GROVE を繋ぐ」の順で進める。

---

## 3. Phase 計画（この順でやる）

### 🟢 Phase J1 — Java を“本物”にする（最優先・影響範囲が狭い）

**ゴール：SPROUT で組んだロジックが、動く Forge MOD として出力される。**

**触るファイル：**
- 新規 `lib/codegenJava.ts`（シオンの中身ゾーン）
- `app/editor/store.ts`（`logicBlocks: CBlock[]` 追加）
- `app/editor/exporter.ts`（`exportJava` を書き換え）
- `app/editor/LogicPanel.tsx` ← **1行だけ**（`setGeneratedJsCode` の隣で `setLogicBlocks(blocks)`）。
  ※ここだけヒマワリのファイルに触る＝**事前に声かけ**。他は触らない。

**手順：**

1. **store に構造を載せる**（§1②の根本対策）
   - `store.ts`：`logicBlocks: CBlock[]`（初期 `[]`）と `setLogicBlocks` を追加。
   - `LogicPanel.tsx`：今 `setGeneratedJsCode(code)` している箇所のすぐ隣で `setLogicBlocks(blocks)` も呼ぶ（`blocks` はその場の CBlock 配列）。**ロジックは変えない。横に1本足すだけ。**

2. **`lib/codegenJava.ts` を新規実装**（`codegen.ts` の鏡像）
   - 関数構成も `codegen.ts` と1:1で揃える：
     `genTriggerJava / genChainJava / genBlockJava / genExprJava / genCondJava` ＋ 上位 `genProjectJava(blocks): { handlers, imports }`。
   - 出力は **`@SubscribeEvent` ハンドラ群**（§4の対応表）。
   - インデント／エスケープ（`escJava`）は exporter.ts の既存ヘルパを流用 or codegenJava 内に持つ。

3. **`exportJava` を書き換え**
   - シグネチャを `exportJava(state, jsCode)` → `state.logicBlocks` を読むように。
     （`jsCode` は「参考JS」として末尾コメントに残してもよいが、**ロジックの実体は Java 側で生成**する。）
   - `exporter.ts:574` の「JSをコメント化」を削除し、`genProjectJava(state.logicBlocks)` が返す **本物の `@SubscribeEvent` メソッド**を `ModEventHandler.java` に差し込む。
   - import は使った API に応じて動的に足す（重複排除）。

4. **動作確認（最低ライン）**
   - 「参加したとき → メッセージ」「チャット → アイテムを渡す」「ブロック破壊 → 効果」の3本が
     生成 .java として **コンパイル可能な形**になっていること（手元 javac か目視 + 構文）。

**J1完了の定義：** SPROUTで組んだ代表3パターンが、コメントでなく実Javaハンドラとして出力される。

---

### 🟡 Phase J2 — GROVE を同じパイプラインに繋ぐ

**ゴール：GROVE で組んだものが、J1 の codegenJava を通って実 MOD になる。**

**触るファイル：** `app/editor/GrapePanel.tsx`（ヒマワリゾーン）、必要なら薄い変換層 `lib/grapeToCBlock.ts`（新規）。

**やること（2案・どちらか）：**
- **案A（推奨・将来きれい）**：GrapePanel が編集対象を **CBlock グラフそのもの**にする。fruits を CBlock の見た目違いとして扱い、store.logicBlocks を直接更新。
- **案B（つなぎ・速い）**：fruits → CBlock への **変換関数 `grapeToCBlock(fruits)`** を1個作り、「マイクラへ放つ」時に変換 → store.logicBlocks → 通常の export 経路へ。

- 「マイクラへ放つ」ボタンを **実際の export 呼び出し**に繋ぐ（今は演出だけ）。演出アニメは残してOK、ただし出力は本物に。
- `fruitsToCode/actionToJava`（演出用Java風文字列）は **「見せ用」と明記**して残すか、本物の codegenJava プレビューに置換。

**J2完了の定義：** GROVE の「放つ」で、画面の演出と一致する実 Forge MOD が出力される。

---

### 🔵 Phase J3 — 網羅・i18n・難所つぶし

**触るファイル：** `lib/codegenJava.ts` 中心。

1. **ブロック全網羅**（§4 対応表をすべて埋める）。`codegen.ts` の `switch` 全 case が基準リスト。
2. **難所①：アイテム/ブロックID変換**
   - Bedrock：`"minecraft:diamond"` 文字列。Forge：`Items.DIAMOND` 等 or `ResourceLocation` ルックアップ。
   - 推奨＝**データ駆動の ResourceLocation 解決**：
     `ForgeRegistries.ITEMS.getValue(new ResourceLocation("minecraft","diamond"))`。
     列挙に頼らずユーザー入力IDをそのまま安全に通せる（要 null ガード）。
3. **難所②：UIフォーム（ui_action/ui_message/ui_textinput/ui_toggle/ui_slider/ui_dropdown/ui_mixed）**
   - これらは Bedrock `@minecraft/server-ui` 専用。**Forge に綺麗な等価が無い**。
   - 方針を決める（シオン判断）：
     - (a) **スキップ＋明示コメント**：`// （このブロックは統合版専用：Java版では未対応）` を出す。＝安全・正直。
     - (b) チャットUI等での簡易フォールバック（コスト高、後回し）。
   - **当面は (a) 推奨。** 「動かないのに動くフリ」は §（イザコザ回避）にも反する。
4. **難所③：i18n キー分離**（[[i18n_english_version]] と同じ轍を踏まない）
   - 値で分岐するフィールドは **表示ラベルでなく内部キーで判定**する：
     `ac_score` の op（"加算"/"減算"/"セット"/"リセット"）、`ac_tag` の op（"追加"/"削除"）。
   - codegenJava でも **codegen.ts と同じ判定ロジック**にする（英語化で壊れない形）。
5. **コマンドフォールバック**：title/sound/scoreboard など API が重い物は
   `player.server.getCommands().performPrefixedCommand(player.createCommandSourceStack(), "...")`
   で `/command` 実行に逃がしてよい（Bedrock の runCommandAsync と同じ発想）。

---

## 4. ブロック → Forge Java 対応表（実装の地図）

> 基準は `lib/codegen.ts` の全 case。代表マッピングを示す。残りは同パターンで埋める。
> 対象：**Forge 1.20.1 / 47.3.0 / Java17**（exportJava の build.gradle と一致）。

### きっかけ（trigger）→ `@SubscribeEvent`
| ブロック | Bedrock(現) | Forge 1.20.1 |
|---|---|---|
| `ev_join` | playerJoin | `PlayerEvent.PlayerLoggedInEvent` |
| `ev_break` | playerBreakBlock | `BlockEvent.BreakEvent`（ブロックIDで絞り込み）|
| `ev_item` | itemUse | `PlayerInteractEvent.RightClickItem`（アイテムIDで絞り込み）|
| `ev_tick` | runInterval(1) | `TickEvent.ServerTickEvent`（phase==END で全プレイヤーloop）|
| `ev_chat` | chatSend | `ServerChatEvent`（合言葉一致／`setCanceled(true)`）|
| `ev_hurt` | entityHurt | `LivingHurtEvent`（entity が ServerPlayer か判定）|
| `ev_place` | playerPlaceBlock | `BlockEvent.EntityPlaceEvent` |

### すること（action）
| ブロック | Forge Java（要点）|
|---|---|
| `ac_msg` | `player.sendSystemMessage(Component.literal("..."))`（@a は server.getPlayerList() をloop）|
| `ac_give` | `player.getInventory().add(new ItemStack(<ID解決>, count))` |
| `ac_tp` | `player.teleportTo(x, y, z)` |
| `ac_cmd` | `performPrefixedCommand(player.createCommandSourceStack(), "<cmd>")` |
| `ac_sound` | `level.playSound(null, player.blockPosition(), <SoundEvent>, ...)` or `/playsound` フォールバック |
| `ac_title` | `/title @s title {...}` をコマンドフォールバック（パケット直書きは重い）|
| `ac_effect` | `player.addEffect(new MobEffectInstance(<効果解決>, durationTicks, amp))` |
| `ac_score` | scoreboard API or `/scoreboard players <add/remove/set> ...`（op はキー判定）|
| `ac_tag` | `player.addTag("..")` / `player.removeTag("..")`（op はキー判定）|
| `ac_kick` | `player.connection.disconnect(Component.literal(".."))` |

### 制御・変数・条件・値
| ブロック | Forge Java |
|---|---|
| `co_if` | `if (<genCondJava>) { … } else { … }` |
| `ct_rep` | `for (int _ri=0; _ri<n; _ri++) { … }` |
| `ct_wait` | `// Forgeは即時 runTimeout 等価が無い → server tick スケジューラ or 当面コメント` |
| `ct_log` | `LOGGER.info("[MMCログ] " + <expr>)` |
| `vv_*` | ハンドラ内 `int` ローカル/フィールド（set/add/inc/dec/reset/get…）|
| `co_tag` | `player.getTags().contains("..")` |
| `co_sneak` | `player.isShiftKeyDown()` |
| `co_hp` | `player.getHealth() <= n` |
| `co_night` | `!player.level().isDay()`（or time 判定）|
| `co_rain` | `player.level().isRaining()` |
| `co_item` | インベントリ走査で typeId 一致を探す |
| `co_and/or/not` | `&&` / `||` / `!`（空オペランドは true/false ガード、codegen.ts と同じ）|
| `va_name` | `player.getName().getString()` |
| `va_hp` | `player.getHealth()` |
| `va_pos` | `player.getBlockX()/getBlockY()/getBlockZ()`（axis で分岐）|
| `va_rand` | `player.level().random.nextInt(...)` |
| `ca_*`（演算）| `Math.*` / 文字列メソッド（codegen.ts の JS とほぼ同形・Java構文に直すだけ）|
| `ui_*`（フォーム）| **Java版は未対応 → 明示コメント**（§3-3 難所②）|

---

## 5. 進め方・約束ごと（衝突回避）

- **Phase制を死守**。J1 で `LogicPanel.tsx` に触るのは **1行だけ**（`setLogicBlocks`）。それ以外は触らない。互いのファイルを同時に編集しない。
- このリポジトリの Next.js は特殊版。**コードを書く前に `node_modules/next/dist/docs/` を読む**（AGENTS.md）。※ codegenJava は純TSライブラリなので Next API依存は薄いが、exporter/store 周りは注意。
- `npm install` は **`--legacy-peer-deps` 必須**（[[feedback_legacy_peer_deps]]）。
- 出力 MOD は **「動くこと」が絶対**。動かないのに動くフリ（コメントだけ・偽フォーム）は禁止。出来ない物は正直に「Java版未対応」と明示する（イザコザ回避 [[feedback_avoid_user_disputes]]）。
- 切替前に commit／引き継ぎは HANDOVER.md 経由（[[workflow_claude_gemini_split]]）。

---

## 6. まず最初の一歩（J1の着手順）

1. シオン：`lib/codegenJava.ts` の骨組み（trigger/chain/block/expr/cond + genProjectJava）を作る。
2. シオン：`store.ts` に `logicBlocks/setLogicBlocks` を追加。
3. ヒマワリ＆シオン：`LogicPanel.tsx` の `setGeneratedJsCode` 隣に `setLogicBlocks(blocks)` を1行（声かけ後）。
4. シオン：`exporter.ts:574` のコメント化を撤去 → `genProjectJava` の実ハンドラ差し込み。
5. 代表3本で出力 → コンパイル可能性を確認 → commit。

> 関連メモリ：[[java_grove_codegen_missing]] / [[i18n_english_version]] / [[feedback_avoid_user_disputes]] / [[workflow_claude_gemini_split]] / [[session_2026_06_16]]
