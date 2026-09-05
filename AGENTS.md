# ⛔ このブランチ（feature/i18n-editor-auto）からビルドしないこと

**壊れています。** エディタの表示が崩れ、カードに `{arg0}` `{arg1}` がそのまま出ます。
2026-09-04、ここから作った Android 版をクローズドテストに上げてしまい実機で発覚。

原因は `scripts/refactor_fragments.ts` が JSX を翻訳関数の引数へ詰め込んだこと（47箇所）。
**型チェックもビルドも通るので、画面に出すまで分かりません。**

→ ビルドは `main` から。詳細と再開の手順は [README.md](README.md) の冒頭。

---

# 🚨 絶対に守ること

> # 配布物は、必ず CI で作る。
> # 手元でビルドしたものを、絶対に配らない。
>
> 対象：`.exe` / `.dmg` / `.appx` など、人に渡すファイルすべて。
>
> **このPCは Windows の Application Control ポリシーが `signtool.exe` をブロックする。**
> ビルド工程が途中で壊れ、**エラーを出さずに、壊れた実行ファイルが出来上がる。**
> サイズを見ても、ファイルが開けても、気づけない。**起動して初めて分かる。**
>
> **v0.1.0 は、この手順を飛ばして手作業でビルドされ、壊れたまま公開された。**
> ユーザーがダウンロードしても、起動した瞬間に落ちる状態で配られていた。
>
> ### 作り方
> タグを打つ（`v*`）か、GitHub の Actions から手動実行する。それ以外の方法で作らない。
>
> ### 「今回だけ手元で」は無し
> 2026-09-03、その「今回だけ」をやった。たまたま無事だっただけで、賭けていた。
>
> 📖 経緯と全事故：**[docs/RELEASE.md](docs/RELEASE.md)（配布物に触る前に必ず読む）**

---

# はじめに読むもの

- Microsoft Store へ出すなら → [docs/MICROSOFT_STORE.md](docs/MICROSOFT_STORE.md)
- 直近の作業の引き継ぎ → [HANDOVER.md](HANDOVER.md)（長いので、必要な節だけ）
- 何を守るべきか（負け筋） → [docs/WIN_STRATEGY.md](docs/WIN_STRATEGY.md)

> ⚠️ 同じ話を2か所に書かないこと。
> v0.1.0 の事故は、症状が `app/page.tsx` に、原因が `release.yml` に分かれて書かれていた。
> その結果、片方だけ読んだ担当が「原因は記録されていない」と誤判断した（2026-09-03）。
> 新しく分かったことは docs/ の該当ファイルに集約し、コード側からは**指すだけ**にする。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
