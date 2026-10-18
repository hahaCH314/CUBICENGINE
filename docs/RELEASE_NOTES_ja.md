# リリースノート（スマホ版）

Play Console / App Store Connect の「このリリースの新機能」に貼る文面。
**500文字以内**（Play の上限）。言語ごとに要る。

---

## v0.1.6（versionCode 25）

```
・エディタの表示が崩れていたのを直しました。カードに変な文字が出ていた問題です
・「アドオン完成！」でテーマ曲が流れるようになりました
・説明書を、横にスワイプして読む5枚組に作り直しました
・初心者モード以外では説明書が出ないようにしました
・細かい不具合を直しました
```

### English

```
・Fixed the editor display. Cards were showing stray text
・A theme song now plays when your add-on is complete
・The guide is now five swipeable cards
・The guide no longer appears outside beginner mode
・Various small fixes
```

---

## 書くときの決まり

- **利用者から見えることだけ**書く。内部の修正やCIの話は書かない
- 1行1項目。**「〜しました」で終える**
- ⚠️ 不具合を直したときは、**何が起きていたか**も書く。
  「直しました」だけだと、その不具合に遭った人が自分のことだと分からない
- 英語版も必ず用意する（掲載言語に英語を入れているため）

## 過去のぶん

### v0.1.6 で差し替えた版（versionCode 22）について

⚠️ **あれは壊れていました。** 誤って `feature/i18n-editor-auto` から作ったものを
クローズドテストに上げてしまい、エディタのカードに `{arg0}` という文字が
そのまま出る状態でした（2026-09-04 に実機で発覚）。
v0.1.6 はその差し替えです。リリースノートの1行目がそれにあたります。
