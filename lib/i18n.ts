/* ══════════════════════════════════════════════════════════════════
   i18n.ts — 日本語/英語 ロケール辞書と翻訳ヘルパ
   ──────────────────────────────────────────────────────────────────
   方針（[[i18n_english_version]]）:
   - UI文字列は辞書化して t(locale, key) で引く。
   - ⚠️最重要: codegen が「値で分岐」するフィールド(ac_score/ac_tag の op)は
     保存値＝内部キー(=日本語のまま不変)。表示だけ optLabel() で翻訳する。
     こうすれば英語表示にしても codegen.ts / codegenJava.ts は無改変で動く。
   - 出力されるMODコード(JS/Java)自体は言語非依存。
   ══════════════════════════════════════════════════════════════════ */

export type Locale = "ja" | "en";

export const LOCALES: Locale[] = ["ja", "en"];
export const DEFAULT_LOCALE: Locale = "ja";

type Entry = { ja: string; en: string };

/** UI文字列辞書（key → {ja, en}）。新規UIはここに足してから t() で引く。 */
export const DICT: Record<string, Entry> = {
  // ── ランディング（app/page.tsx）──
  "nav.edition":      { ja: "LOCAL EDITION", en: "LOCAL EDITION" },
  "hero.sub":         { ja: "MINECRAFT add-on mod", en: "MINECRAFT add-on mod" },
  "hero.tagline":     { ja: "直感的に作る", en: "Build it intuitively" },
  "hero.desc1":       { ja: "楽しいビジュアル環境、コーディング不要。", en: "A fun visual workspace — no coding required." },
  "hero.desc2":       { ja: "アドオン・MODを設計・構築・エクスポート。", en: "Design, build, and export add-ons & mods." },
  "sprout.tag":       { ja: "統合版・アドオン", en: "Bedrock · Add-on" },
  "sprout.desc":      { ja: "統合版のブロックやアイテム、エンティティを\nノンコーディングで制作\n新しいビジュアル環境でアドオン開発", en: "Create blocks, items and entities in Bedrock with zero code.\nBuild add-ons in a new visual workspace." },
  "grove.tag":        { ja: "Java版・MOD", en: "Java · Mod" },
  "grove.desc":       { ja: "Java版のMODを強力なビジュアルエディタで開発。Gradle連携と高速自動ビルドをサポート。", en: "Build Java mods in a powerful visual editor. Gradle integration with fast auto-build." },
  "cta.tryWeb":       { ja: "🌐 ブラウザで試す", en: "🌐 Try in browser" },
  "dl.win":           { ja: "💻 Windows版 (.exe)", en: "💻 Windows (.exe)" },
  "dl.mac":           { ja: "🍎 macOS版 (.dmg)", en: "🍎 macOS (.dmg)" },
  "dl.go":            { ja: "⬇ DL", en: "⬇ DL" },
  "dl.soon":          { ja: "🔒 準備中", en: "🔒 Coming soon" },
  "dl.desktopSoon":   { ja: "💻 デスクトップ版（.exe）近日公開", en: "💻 Desktop app (.exe) coming soon" },
  "dl.soonTitle":     { ja: "近日公開予定です", en: "Coming soon" },
  "footer.note":      { ja: "ローカル/オフラインで動く・アカウント不要・Mac & Windows対応", en: "Runs locally & offline · No account needed · Mac & Windows" },
  "lang.toggle":      { ja: "EN", en: "日本語" },
};

/** 翻訳を引く。未登録キーは key をそのまま返す（開発中に気付ける）。 */
export function t(locale: Locale, key: string): string {
  return DICT[key]?.[locale] ?? key;
}

/* ──────────────────────────────────────────────────────────────────
   codegen安全な「操作」ラベル: 保存値＝内部キー(日本語不変)、表示だけ翻訳。
   data/templates.ts の ac_score op ["加算","減算","セット","リセット"] /
   ac_tag op ["追加","削除"] はこの内部キーのまま保存し、ドロップダウンの
   見た目だけ optLabel() で出し分ける。codegen は内部キーで照合し続ける。
   ────────────────────────────────────────────────────────────────── */
export const OP_LABELS: Record<string, Entry> = {
  "加算":     { ja: "加算", en: "Add" },
  "減算":     { ja: "減算", en: "Subtract" },
  "セット":   { ja: "セット", en: "Set" },
  "リセット": { ja: "リセット", en: "Reset" },
  "追加":     { ja: "追加", en: "Add" },
  "削除":     { ja: "削除", en: "Remove" },
};

/** 内部キー(保存値)→表示ラベル。未登録ならそのまま返す（＝普通の選択肢は無変換）。 */
export function optLabel(value: string, locale: Locale): string {
  return OP_LABELS[value]?.[locale] ?? value;
}
