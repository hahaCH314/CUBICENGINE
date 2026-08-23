import Link from "next/link";
import type { Metadata } from "next";
import { SITE_URL } from "../../lib/site";
import { RECIPES } from "../../data/recipes";

/* ══════════════════════════════════════════════════════════
   /guide — 「マイクラ アドオン 作り方」で検索した人が着く記事

   エディタ内のチュートリアルはモーダルなので検索エンジンに読まれない。
   同じ内容を静的なページとして置き、検索から人が来られるようにする。
   広告と違って止めても消えず、時間が経つほど効く導線。

   ※ここは読み物。手を動かす場所は /editor。
   ══════════════════════════════════════════════════════════ */

export const metadata: Metadata = {
  title: "マイクラのアドオンの作り方｜コードを書かずに無料で作る",
  description:
    "マインクラフトのアドオン（統合版）とMOD（Java版）を、プログラミングのコードを書かずに作る方法を解説。カードを並べるだけで .mcaddon が作れます。無料・登録不要・ブラウザでそのまま動きます。",
  keywords: ["マイクラ", "アドオン", "作り方", "MOD", "統合版", "Java版", "mcaddon", "コード不要", "無料", "子ども", "プログラミング"],
  alternates: { canonical: `${SITE_URL}/guide` },
  openGraph: {
    type: "article",
    title: "マイクラのアドオンの作り方｜コードを書かずに無料で作る",
    description: "カードを並べるだけでマイクラのアドオンが作れます。無料・登録不要。",
    url: `${SITE_URL}/guide`,
  },
};

/** 手順。構造化データと本文で同じものを使い、内容がズレないようにする。 */
const STEPS = [
  {
    name: "「きっかけ」のカードをおく",
    text: "何が起きたらアドオンが動くのかを決めます。「参加したとき」「ブロックをこわしたとき」「敵をたおしたとき」などから選びます。黄色いカードが「きっかけ」です。",
  },
  {
    name: "「すること」のカードをかさねる",
    text: "きっかけのカードの上に、青い「すること」のカードをかさねます。「メッセージを出す」「アイテムをわたす」「モブを出す」など。かさねてくっつくと1つの流れになります。はなれたまま置いても動かないので、ピタッとくっつくまでかさねてください。",
  },
  {
    name: "条件シールをはる（やらなくてもOK）",
    text: "「スニーク中のときだけ」「夜のときだけ」のように、動く条件をつけたいときは、カードに条件シールをはります。2枚はると「かつ」になり、めくると「〜じゃないとき」になります。",
  },
  {
    name: "「アドオン完成！」を押してマイクラへ",
    text: "完成ボタンを押すとファイルができます。統合版なら .mcaddon、Java版なら .jar です。あとはマイクラに読みこむだけで、本当に動きます。",
  },
];

const FAQ = [
  {
    q: "プログラミングの知識は必要ですか？",
    a: "必要ありません。カードを選んでかさねるだけで、中のコードは自動で作られます。作られたコードは画面で見ることもできるので、興味が出たら中身を読んで勉強することもできます。",
  },
  {
    q: "お金はかかりますか？",
    a: "かかりません。作る機能はすべて無料で、会員登録も必要ありません。運営は任意の寄付でまかなっています。",
  },
  {
    q: "アドオンとMODは何がちがうのですか？",
    a: "どちらもマイクラを作りかえるものです。名前がちがうのは遊んでいるマイクラの種類がちがうからで、統合版（スマホ・Switch・PC）では「アドオン」（.mcaddon）、Java版（パソコン）では「MOD」（.jar）と呼びます。",
  },
  {
    q: "スマホだけでも作れますか？",
    a: "作るのは、どちらもスマホのブラウザだけでできます。Java版のMOD（.jar）も、その場でダウンロードできます。ただし、できた .jar で遊べるのはパソコンのマイクラ（Java版）だけです。スマホのマイクラは統合版なので、.mcaddon のほうを使ってください。",
  },
  {
    q: "作ったデータはどこに保存されますか？",
    a: "お使いの端末の中だけです。サーバーには送られません。アカウントも作らないので、個人情報を集めることもありません。",
  },
  {
    q: "作ったアドオンを友達に見せられますか？",
    a: "できます。リンクを送るだけで、相手はマイクラを持っていなくても、作品が動くところを見られます。QRコードを読んでもらう方法もあります。",
  },
];

export default function GuidePage() {
  // 検索結果に手順とQ&Aを出すための構造化データ
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "HowTo",
        name: "マイクラのアドオンの作り方",
        description: "コードを書かずにマインクラフトのアドオン（.mcaddon）とMOD（.jar）を作る手順。",
        totalTime: "PT3M",
        estimatedCost: { "@type": "MonetaryAmount", currency: "JPY", value: "0" },
        step: STEPS.map((s, i) => ({
          "@type": "HowToStep",
          position: i + 1,
          name: s.name,
          text: s.text,
        })),
      },
      {
        "@type": "FAQPage",
        mainEntity: FAQ.map(f => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <main className="min-h-screen px-6 py-14 pb-28 text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      <article className="max-w-2xl mx-auto">
        <Link href="/" className="text-sm text-muted hover:text-foreground transition-colors">
          ← ホームに戻る
        </Link>

        <h1 className="text-2xl sm:text-3xl font-bold mt-5 mb-4 leading-snug">
          マイクラのアドオンの作り方
          <span className="block text-base sm:text-lg text-muted font-bold mt-2">
            コードを書かずに、無料で作る
          </span>
        </h1>

        <p className="text-sm leading-relaxed text-muted mb-3">
          マインクラフトの<strong className="text-foreground">アドオン</strong>は、ゲームに新しいルールや遊び方を足すためのものです。
          ふつうはプログラミングのコードを書いて作りますが、<strong className="text-foreground">CUBICENGINE</strong> なら
          カードを並べてかさねるだけで作れます。
        </p>
        <p className="text-sm leading-relaxed text-muted mb-8">
          お金はかかりません。会員登録もいりません。ブラウザを開けば、そのまま作りはじめられます。
        </p>

        <Cta />

        <H2>アドオンとMODのちがい</H2>
        <p className="text-sm leading-relaxed text-muted mb-3">
          どちらも<strong className="text-foreground">マイクラを作りかえるもの</strong>です。
          名前がちがうのは、遊んでいるマイクラの種類がちがうからです。
        </p>
        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <Box tone="green" title="アドオン（統合版）">
            スマホ・Switch・PC版で遊んでいる人はこちら。できるファイルは <code className="font-mono">.mcaddon</code>。
            ブラウザだけで作れます。
          </Box>
          <Box tone="amber" title="MOD（Java版）">
            パソコンのJava版で遊んでいる人はこちら。できるファイルは <code className="font-mono">.jar</code>。
            作るときはパソコン版のアプリが必要です。
          </Box>
        </div>
        <p className="text-xs text-muted/70 mb-8">
          どちらか分からなくても大丈夫です。作り方はまったく同じです。
        </p>

        <H2>用意するもの</H2>
        <ul className="text-sm leading-relaxed text-muted list-disc pl-5 space-y-1.5 mb-2">
          <li>マインクラフト（統合版またはJava版）</li>
          <li>ブラウザが動く端末（スマホ・タブレット・パソコン）</li>
          <li>Java版のMODで遊ぶ場合は、パソコンと <strong className="text-foreground">Forge 1.20.1</strong></li>
        </ul>
        {/* 「JDKが要る」と思われると、作れる人がここで帰ってしまう。必ず打ち消す */}
        <p className="text-xs text-muted/70 mb-8">
          ※ 作るのに開発ソフトの用意は要りません。JDK も Gradle も不要で、ボタンを押すとその場で
          <code className="font-mono"> .jar </code>ができます。
        </p>

        <H2>作り方（4ステップ）</H2>
        <ol className="space-y-4 mb-8">
          {STEPS.map((s, i) => (
            <li key={s.name} className="flex gap-3">
              <span
                className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: "#fbbf24", color: "#451a03" }}
              >
                {i + 1}
              </span>
              <div>
                <h3 className="text-sm font-bold text-foreground mb-1">{s.name}</h3>
                <p className="text-sm leading-relaxed text-muted">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <H2>できたファイルをマイクラに入れる</H2>
        <p className="text-sm leading-relaxed text-muted mb-3">
          <strong className="text-foreground">統合版（.mcaddon）</strong>は、ダウンロードしたファイルを開くだけです。
          スマホなら共有メニューから「Minecraft」を選ぶと、マイクラが自動で起動して取りこまれます。
          あとはワールド設定の「ビヘイビアーパック」でONにすれば遊べます。
        </p>
        <p className="text-sm leading-relaxed text-muted mb-2">
          <strong className="text-foreground">Java版（.jar）</strong>は、
          <strong className="text-foreground">Forge 1.20.1</strong> を入れたマイクラの
          <code className="font-mono"> mods </code>フォルダに、ファイルのままコピーします
          （開いたり展開したりしないでください）。
        </p>
        <ul className="text-sm leading-relaxed text-muted list-disc pl-5 space-y-1.5 mb-8">
          <li>Windows … <code className="font-mono">%appdata%\.minecraft\mods</code></li>
          <li>Mac … <code className="font-mono">~/Library/Application Support/minecraft/mods</code></li>
          <li>そのあとランチャーで遊び方を「forge」にして起動します。</li>
        </ul>

        <H2>作ったものを友達に見せる</H2>
        <p className="text-sm leading-relaxed text-muted mb-8">
          リンクを送るだけで、相手は<strong className="text-foreground">マイクラを持っていなくても</strong>
          作品が動くところを見られます。目の前の友達には、画面のQRコードを読んでもらう方法もあります。
          作品はリンクの中に入っていて、どこにも保存されません。
        </p>

        <H2>作りかたの例</H2>
        <p className="text-sm leading-relaxed text-muted mb-4">
          具体的な作り方を、1つずつ手順にしています。まねして作るところから始めるのがいちばん早いです。
        </p>
        <div className="space-y-2 mb-9">
          {RECIPES.map(r => (
            <Link
              key={r.slug}
              href={`/guide/${r.slug}`}
              className="flex items-center gap-3 rounded-xl border border-foreground/10 hover:border-foreground/25 p-3 transition-colors group"
            >
              <span className="text-2xl shrink-0">{r.emoji}</span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-foreground group-hover:opacity-80">
                  {r.shortTitle}アドオンの作り方
                </span>
                <span className="block text-xs text-muted mt-0.5">
                  カード{r.cards.length}枚・コードなし
                </span>
              </span>
              <span className="ml-auto text-muted/50 shrink-0">›</span>
            </Link>
          ))}
        </div>

        <H2>よくある質問</H2>
        <div className="space-y-4 mb-9">
          {FAQ.map(f => (
            <div key={f.q}>
              <h3 className="text-sm font-bold text-foreground mb-1">{f.q}</h3>
              <p className="text-sm leading-relaxed text-muted">{f.a}</p>
            </div>
          ))}
        </div>

        <Cta />

        <p className="mt-10 text-xs text-muted/60 leading-relaxed">
          ※ 本ツールは非公式です。Mojang Studios・Microsoft とは関係ありません。Minecraft は Mojang Studios の商標です。
        </p>
      </article>
    </main>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-bold text-foreground mt-9 mb-3">{children}</h2>;
}

function Box({ tone, title, children }: { tone: "green" | "amber"; title: string; children: React.ReactNode }) {
  const c = tone === "green"
    ? { bg: "rgba(16,185,129,0.08)", bd: "#10b981", tx: "#34d399" }
    : { bg: "rgba(245,158,11,0.08)", bd: "#f59e0b", tx: "#fbbf24" };
  return (
    <div style={{ background: c.bg, border: `2px solid ${c.bd}`, borderRadius: 12, padding: "12px 14px" }}>
      <div className="text-sm font-bold mb-1" style={{ color: c.tx }}>{title}</div>
      <p className="text-xs leading-relaxed text-muted">{children}</p>
    </div>
  );
}

function Cta() {
  return (
    <div className="flex flex-wrap gap-3 my-6">
      <Link
        href="/editor"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.03]"
        style={{
          background: "linear-gradient(135deg,#bef264,#22c55e)",
          border: "3px solid #1e293b", boxShadow: "0 4px 0 #15803d", color: "#052e16",
        }}
      >
        ✨ さっそく作ってみる
      </Link>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm border border-foreground/15 text-muted hover:text-foreground transition-colors"
      >
        CUBICENGINE について
      </Link>
    </div>
  );
}
