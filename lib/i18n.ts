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
  "hero.sub":         { ja: "MINECRAFT アドオン MOD", en: "MINECRAFT Add-on & Mod" },
  "hero.tagline":     { ja: "新しいビジュアルプログラミング言語で作ろう！！", en: "Let's build with a new visual programming language!!" },
  "hero.desc1":       { ja: "作るって、こんなに楽しい。", en: "Making things is this much fun." },
  "hero.desc2":       { ja: "君のアイデアを、マイクラに。", en: "Bring your idea into Minecraft." },
  // ── 作者の声（トップの心臓・[[founder_origin_natto_cider]]）本人の言葉。飾らずそのまま ──
  "founder.eyebrow":  { ja: "これを作ってる人", en: "The person behind this" },
  "founder.quote":    { ja: "ずっと学校に行けなかった、苦しかった。\nでも作る楽しさに出会えて、僕は1歩踏み出せた。\n作る楽しさを、くだらないことでも一緒に笑える仲間に届きますように。", en: "For a long time I couldn't go to school. It was painful.\nBut I found the joy of making things, and I took one step forward.\nMay that joy reach friends I can laugh with — even over the silliest little things." },
  "founder.name":     { ja: "なっとうサイダー", en: "Nattō Cider" },
  "founder.role":     { ja: "つくった人", en: "Creator" },
  "founder.follow":   { ja: "活動を見る・つながる", en: "Follow along & say hi" },
  "founder.intro1":   { ja: "このアプリでアホほどダイヤ出せます\n作る楽しさを\nくだらないことで一緒に笑える仲間へ届きますように(o^―^o)ﾆｺ", en: "This app lets you spawn a ridiculous amount of diamonds.\nMay the joy of making things reach\nfriends I can laugh with over the silliest stuff (o^―^o)" },
  "founder.intro2":   { ja: "ずっと学校に行けなかった\n苦しい地獄の時間だった\nでもね、作る楽しさに出会えて\n僕は１歩踏み出せた", en: "For a long time I couldn't go to school.\nIt was a painful, hellish time.\nBut then I found the joy of making things,\nand I took my first step forward." },
  // 2枚のカードの前に置く"向き先"の問い（独自名SPROUT/GROVEの前に初見を迷わせない）
  "cards.pick":       { ja: "君のマイクラは、どっち？", en: "Which Minecraft do you play?" },
  "support.title":      { ja: "✨ 開発・運営を応援してください", en: "✨ Support our development" },
  "support.story1":     { ja: "「自分のアドオンでマイクラに無限ダイヤを！」\nという夢から始まりました。\nその夢を形にし実現させたのが\n本サイト（CUBICENGINE）です。", en: "It all started with the dream: \"Infinite Diamonds in Minecraft with my own addon!\"\nHe shaped that dream into reality,\ncreating this website (CUBICENGINE)." },
  "support.story2":     { ja: "なっとうサイダーは今12歳です。\n「同じようにマイクラや、プログラミングが好きな人に、作る楽しさを共有したい」\nとの思いから本人の希望によりコア機能は全て無料でご利用いただけます。", en: "Nattō Cider is now 12 years old.\nOut of his wish to \"share the joy of creating with others who love Minecraft and programming,\"\nall core features are completely free to use." },
  "support.story3":     { ja: "まだまだ未熟な開発マネージャーですが、お小遣いを全て開発費用にあててきました。頂いた寄付は今後の運営費、新たな開発費用として使わせていただきます。\nよろしくお願いいたします", en: "Though still an inexperienced development manager, he has spent all of his allowance on development costs. Donations received will be used for future operations and new development costs.\nThank you for your support." },
  "support.management": { ja: "CUBICENGINE studioは保護者が運営しております。寄付の受け取り・管理はCUBICENGINE studioが行います。", en: "CUBICENGINE studio is operated by parents. Donation reception and management are handled by CUBICENGINE studio." },
  "support.cta":        { ja: "💎 この挑戦を応援する（寄付ページへ）", en: "💎 Support this challenge (Donate)" },
  "support.note":       { ja: "※寄付は完全に任意です。全機能をいつでも無料でご利用いただけます。", en: "*Donations are completely optional. All features are always free." },
  "sprout.tag":       { ja: "統合版・教育版用", en: "Bedrock & Education" },
  "sprout.desc":      { ja: "統合版（スマホ・Switch・PC）で遊ぶ人はこっち。", en: "Bedrock edition — phone, Switch & PC." },
  "grove.tag":        { ja: "Java版用", en: "For Java" },
  "grove.desc":       { ja: "JAVA版（パソコン）で作る人はこっち。", en: "Java edition — PC." },
  "cta.tryWeb":       { ja: "✨ さっそく作る", en: "✨ Start creating" },
  "dl.win":           { ja: "💻 Windows版 (.exe)", en: "💻 Windows (.exe)" },
  "dl.mac":           { ja: "🍎 macOS版 (.dmg)", en: "🍎 macOS (.dmg)" },
  "dl.go":            { ja: "⬇ DL", en: "⬇ DL" },
  "dl.soon":          { ja: "🔒 準備中", en: "🔒 Coming soon" },
  "dl.desktopSoon":   { ja: "💻 デスクトップ版（.exe）近日公開", en: "💻 Desktop app (.exe) coming soon" },
  "dl.soonTitle":     { ja: "近日公開予定です", en: "Coming soon" },
  "grove.soon":       { ja: "🌿 Java版 近日公開！", en: "🌿 Java edition — Coming soon!" },
  "grove.soonSub":    { ja: "おたのしみに ✨", en: "Stay tuned ✨" },
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
