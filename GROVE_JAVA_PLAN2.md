# 🌿 GROVE / Java 残作業 計画書（ヒマワリ向け・J2以降）

> 設計＝シオン。実装＝ヒマワリ。**コミット＆検証＝シオン**（編集は作業ツリーに残せばOK、合図くれたら拾う）。
> 前提：J1（積み木→Forge Java codegen）は実装＋javac検証済み。本書はその先。
> ⚠️ このNextは特殊版。コード前に `node_modules/next/dist/docs/` 確認（AGENTS.md）。`npm i` は `--legacy-peer-deps`。

---

## いまの状態（事実）
- ✅ `lib/codegenJava.ts` … `buildJavaModEventHandler(blocks, ctx)` ＝ CBlock[] → Forge1.20.1 Javaを生成。
- ✅ `app/editor/exporter.ts` の `exportJava` … `state.logicGraphJson` を parse → CBlock[] → 上記で本物の`@SubscribeEvent`生成。
- ✅ SPROUT(積み木)側は `LogicPanel.tsx:2567` が `setLogicGraphJson(JSON.stringify({blocks}))` 済 → SPROUTのJava書き出しは通る。
- ❌ **GROVE(`GrapePanel.tsx`)は未接続**：独自の `fruits`(on_join/say/give/effect/if/repeat…)を持つだけで、store にも export にも繋がってない。「マイクラへ放つ」は**演出アニメ専用**(`fruitsToCode`)。
- ❌ **実Forgeビルド未検証**（javacスタブはOKだが本物のForgeは未）。

---

## 🟡 タスクA（ヒマワリの主担当）＝GROVEを書き出しに繋ぐ（J2）

**ゴール：GROVEで組んだ内容が、SPROUTと同じ `exportJava` 経路で本物のMODになる。**

**触るファイル：** `app/editor/GrapePanel.tsx`、新規 `lib/grapeToCBlock.ts`。**`codegenJava.ts`/`exporter.ts`/`LogicPanel.tsx` は触らない**（シオンのcodegen資産。壊さない）。

### 手順
1. **新規 `lib/grapeToCBlock.ts`** に変換関数を作る：
   ```ts
   import { CBlock } from "../app/editor/_types";
   // GrapePanel の Fruit[] を CBlock[] に変換する
   export function grapeToCBlock(fruits: Fruit[]): CBlock[] { ... }
   ```
   - `Fruit` は `{ id, item:{type,...}, text, ... }`。`item.type` を CBlock の `type` に対応づける：
     | Grape type | CBlock type | 備考 |
     |---|---|---|
     | on_join | ev_join | trigger |
     | on_break | ev_break | trigger（block未指定なら既定stone） |
     | on_chat | ev_chat | trigger。`text`→ pat フィールド |
     | say | ac_msg | `text`→ msg |
     | give | ac_give | `text`("diamond ×1"等)→ item/count にパース |
     | effect | ac_effect | 既定 speed/10 |
     | if | co_if | `text`→ 条件(当面は co_night 等の簡易対応でも可) |
     | repeat | ct_rep | `text`(数値)→ n |
     | number | va_num | `text`→ v |
   - **trigger を先頭**にして、残り(すること系)を **nextId で縦に連結**（`LogicPanel` の CBlock と同じ形：`{id,type,emoji:"",label:"",sublabel:"",category,fields:[{id,label,value}],x,y,nextId,innerId,thenId,elseId}`）。
   - フィールドは `codegenJava.ts` が読むキー名に合わせる（例: ac_msg は `target`/`msg`、ac_give は `item`/`count`、ev_chat は `pat`）。`lib/codegen.ts`/`codegenJava.ts` の各 `gf(b,"...")` が正解キー。

2. **`GrapePanel.tsx` の「マイクラへ放つ」を実書き出しに繋ぐ**：
   - いまの演出(`fruitsToCode`の光るコード昇天)は**残してOK**。その後 or 同時に：
     ```ts
     const cblocks = grapeToCBlock(fruits);
     useEditorStore.getState().setLogicGraphJson(JSON.stringify({ blocks: cblocks }));
     useEditorStore.getState().setTargetPlatform("java");
     await exportProject(useEditorStore.getState(), "");  // exporter.ts の既存関数
     ```
   - import：`import { useEditorStore } from "./store"; import { exportProject } from "./exporter"; import { grapeToCBlock } from "../../lib/grapeToCBlock";`

3. **検証**：GROVEで「参加→メッセージ」「チャット→ダイヤ」等を組んで放つ → `.zip`(Forge)がDLされ、中の `ModEventHandler.java` に**コメントでなく実ハンドラ**が入ってること。

> 難易度：構造変換だけ＝**ヒマワリでいける**。詰まったら CBlock の形は `app/editor/_types.ts` と `lib/codegen.ts` を見本に。

---

## 🔵 タスクB（シオン担当推奨）＝実Forgeビルド検証
JDK17はあるがGradle/Forge MDKが要る。生成zipを実ビルドして、当てたAPI（`getRawText`/`getOrCreatePlayerScore`/`Inventory.items`/`ServerPlayer.connection`/`withPermission`/`TickEvent.phase`/`ForgeRegistries.getKey`）の実シグネチャ差を潰す。**API debugが要る＝シオン or 共同**。ヒマワリは触らない。

## ⚪ タスクC（後）＝網羅・i18n
`codegenJava.ts` の残ブロック網羅、`optLabel` 配線（[[i18n_english_version]] と整合：op保存値は内部キー不変）。

---

## 進め方
1. ヒマワリ：タスクA を `GrapePanel.tsx` ＋ `lib/grapeToCBlock.ts` で実装。**他ファイルに触れない**。
2. 終わったら合図 → **シオンが tsc 確認＆コミット**（Bedrock側=codegen.ts/exporter.ts は無傷であることを確認）。
3. タスクB/C はシオンが回す。

> 関連：`GROVE_JAVA_PLAN.md`（J1/全体図）/ メモリ [[java_grove_codegen_missing]] [[exe_build_status]]。
