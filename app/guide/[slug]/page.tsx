import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { RECIPES, getRecipe } from "../../../data/recipes";
import { SITE_URL } from "../../../lib/site";

/* 「〇〇するアドオンの作り方」の記事。中身は data/recipes.ts。
   記事はデータを足すだけで増える（増やすたびにページを書かない）。 */

export function generateStaticParams() {
  return RECIPES.map(r => ({ slug: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const r = getRecipe(slug);
  if (!r) return {};
  return {
    title: r.title,
    description: r.description,
    keywords: r.keywords,
    alternates: { canonical: `${SITE_URL}/guide/${r.slug}` },
    openGraph: { type: "article", title: r.title, description: r.description, url: `${SITE_URL}/guide/${r.slug}` },
  };
}

export default async function RecipePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = getRecipe(slug);
  if (!r) notFound();

  // 手順は「カードを置く」順そのもの。構造化データも本文と同じ配列から作る。
  const steps = r.cards.map((c, i) => ({
    "@type": "HowToStep",
    position: i + 1,
    name: `${c.label} のカードをおく`,
    text: c.why + (c.fields?.length ? ` 値は ${c.fields.map(([k, v]) => `${k}=${v}`).join("、")} にします。` : ""),
  }));

  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "HowTo",
        name: r.title,
        description: r.description,
        totalTime: "PT3M",
        estimatedCost: { "@type": "MonetaryAmount", currency: "JPY", value: "0" },
        step: steps,
      },
      ...(r.faq.length ? [{
        "@type": "FAQPage",
        mainEntity: r.faq.map(f => ({
          "@type": "Question", name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      }] : []),
    ],
  };

  return (
    <main className="min-h-screen px-6 py-14 pb-28 text-foreground">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      <article className="max-w-2xl mx-auto">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted mb-5">
          <Link href="/" className="hover:text-foreground transition-colors">ホーム</Link>
          <span className="opacity-40">›</span>
          <Link href="/guide" className="hover:text-foreground transition-colors">アドオンの作り方</Link>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold mb-4 leading-snug">
          <span className="mr-1.5">{r.emoji}</span>{r.shortTitle}アドオンの作り方
        </h1>

        {r.intro.map((p, i) => (
          <p key={i} className="text-sm leading-relaxed text-muted mb-3">{p}</p>
        ))}

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
        </div>

        <h2 className="text-lg font-bold mt-9 mb-3">つかうカード（{r.cards.length}枚）</h2>
        <ol className="space-y-4 mb-8">
          {r.cards.map((c, i) => (
            <li key={c.type} className="flex gap-3">
              <span
                className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: "#fbbf24", color: "#451a03" }}
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-foreground mb-1">
                  「{c.label}」のカードをおく
                </h3>
                <p className="text-sm leading-relaxed text-muted mb-2">{c.why}</p>
                {c.fields?.length ? (
                  <div className="rounded-lg border border-foreground/10 bg-foreground/[0.04] p-2.5">
                    {c.fields.map(([k, v]) => (
                      <div key={k} className="text-xs text-muted">
                        <span className="font-bold text-foreground">{k}</span>
                        <span className="opacity-50"> → </span>
                        <code className="font-mono text-[11px]">{v}</code>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ol>

        <div
          className="rounded-xl p-4 mb-9"
          style={{ background: "rgba(245,158,11,0.08)", border: "2px solid #f59e0b" }}
        >
          <p className="text-sm leading-relaxed text-muted">
            <strong className="text-foreground">かさねるのを忘れずに。</strong>
            カードは置いただけでは動きません。1枚目の上に2枚目をかさねて、ピタッとくっつけてください。
            くっつくとカードがキラキラ光ります。
          </p>
        </div>

        {r.notes.length > 0 && (
          <>
            <h2 className="text-lg font-bold mt-9 mb-3">遊ぶときのコツ</h2>
            <ul className="text-sm leading-relaxed text-muted list-disc pl-5 space-y-2 mb-8">
              {r.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          </>
        )}

        {r.faq.length > 0 && (
          <>
            <h2 className="text-lg font-bold mt-9 mb-3">こまったとき</h2>
            <div className="space-y-4 mb-9">
              {r.faq.map(f => (
                <div key={f.q}>
                  <h3 className="text-sm font-bold text-foreground mb-1">{f.q}</h3>
                  <p className="text-sm leading-relaxed text-muted">{f.a}</p>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="rounded-xl border border-foreground/10 p-4 mb-8">
          <p className="text-sm text-muted leading-relaxed">
            はじめての人は、先に
            <Link href="/guide" className="underline underline-offset-2 mx-1 text-foreground hover:opacity-80">
              アドオンの作り方
            </Link>
            を読むと、カードの置き方やマイクラへの入れ方がまとめて分かります。
          </p>
        </div>

        <p className="text-xs text-muted/60 leading-relaxed">
          ※ 本ツールは非公式です。Mojang Studios・Microsoft とは関係ありません。Minecraft は Mojang Studios の商標です。
        </p>
      </article>
    </main>
  );
}
