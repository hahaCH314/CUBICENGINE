"use client";

/* ══════════════════════════════════════════════════════════
   /play — もらったリンクを開くと、いきなり作品が動いている画面。

   ねらい:
   作って → 見せて → 反応が返る、を数十秒で一周させる。ここが無いせいで
   「作ったのに誰にも見せられない」で終わっていた。

   方針:
   - 作品データは URL の # の後ろ。サーバーには何も送られず、何も預からない。
   - 開いた人はまず「見る」。エディタには入らない。
     丸ごとコピーできてしまうと、見せる理由そのものが無くなるため。
   - 「まねして作る」は作者が許可したときだけ出す（wire の r フラグ）。
   ══════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import Link from "next/link";
import LiveStage from "../editor/LiveStage";
import { fromWire, readWorkFromHash, type WireWork } from "../../lib/share";
import type { CBlock } from "../editor/_types";

type State =
  | { k: "loading" }
  | { k: "empty" }                                   // データが無い（直接来た人）
  | { k: "broken" }                                  // 壊れている／古い形式
  | { k: "ok"; work: WireWork; blocks: CBlock[] };

export default function PlayClient() {
  const [st, setSt] = useState<State>({ k: "loading" });

  useEffect(() => {
    let alive = true;
    (async () => {
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      if (!hash || hash.length < 3) { if (alive) setSt({ k: "empty" }); return; }
      const work = await readWorkFromHash(hash);
      if (!alive) return;
      if (!work || !Array.isArray(work.c) || work.c.length === 0) { setSt({ k: "broken" }); return; }
      setSt({ k: "ok", work, blocks: fromWire(work) });
    })();
    return () => { alive = false; };
  }, []);

  if (st.k === "loading") return <Center>よみこみ中…</Center>;

  if (st.k === "empty") {
    return (
      <Center>
        <p style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>
          ここは、もらったリンクで<br />ともだちの作品を見る場所だよ
        </p>
        <Cta href="/editor">✨ 自分で作ってみる</Cta>
      </Center>
    );
  }

  if (st.k === "broken") {
    return (
      <Center>
        <p style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>作品をひらけませんでした</p>
        <p style={{ fontSize: 12.5, color: "#94a3b8", marginBottom: 14, lineHeight: 1.6 }}>
          リンクが途中で切れているかもしれません。<br />
          送ってくれた人に、もう一度おくってもらってね。
        </p>
        <Cta href="/editor">✨ 自分で作ってみる</Cta>
      </Center>
    );
  }

  const { work, blocks } = st;
  const author = (work.a ?? "").trim();
  const title = (work.n ?? "").trim() || "なまえのないアドオン";

  return (
    <main style={{ minHeight: "100dvh", padding: "22px 16px 60px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* 誰の作品かを最初に出す。反応が返る相手がいる、と分かることが大事 */}
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <div className="font-pixel" style={{ fontSize: 10, letterSpacing: "0.1em", color: "#5eead4", marginBottom: 7 }}>
            SHARED WORK
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: "#f8fafc", lineHeight: 1.35 }}>{title}</h1>
          <p style={{ fontSize: 13, fontWeight: 800, color: "#fbbf24", marginTop: 5 }}>
            {author ? `${author} が作ったアドオン` : "だれかが作ったアドオン"}
          </p>
          {work.src && (
            // 出典。まねして作った作品は、元の人の名前が消えずに次の人にも見える
            <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
              🔁 {work.src} の作品をもとに作られました
            </p>
          )}
        </div>

        {/* 動いているところ。マイクラが無くても、入れなくても、ここで見られる */}
        <div style={{
          position: "relative", width: "100%", height: 640, maxWidth: 640, margin: "0 auto",
          borderRadius: 20, overflow: "hidden",
          background: "linear-gradient(#bfe9ff 0%, #a5dcf7 45%, #d8f1fb 100%)",
          border: "4px solid #0f766e", boxShadow: "0 16px 40px rgba(0,0,0,0.45)",
        }}>
          <LiveStage blocks={blocks} rightOffset={20} />
        </div>

        {/* ここから先の分かれ道。「見る」だけで終わらせない */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginTop: 22 }}>
          <Cta href="/editor">✨ 自分でも作ってみる</Cta>
          {work.r === 1 ? (
            <Cta
              href={`/editor#remix=${encodeURIComponent(window.location.hash.slice(1))}`}
              tone="amber"
            >
              🔁 まねして作る
            </Cta>
          ) : (
            <span style={{
              display: "inline-flex", alignItems: "center", padding: "12px 18px", borderRadius: 14,
              border: "2px dashed #475569", color: "#94a3b8", fontSize: 12.5, fontWeight: 800,
            }}>
              🔒 この作品は「見るだけ」に設定されています
            </span>
          )}
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: "#64748b", marginTop: 18, lineHeight: 1.7 }}>
          この作品はリンクの中に入っていて、どこにも保存されていません。<br />
          リンクを消せば、それで終わりです。
        </p>
      </div>
    </main>
  );
}

/* ── 小物 ─────────────────────────────────────────────── */

function Center({ children }: { children: React.ReactNode }) {
  return (
    <main style={{
      minHeight: "100dvh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", textAlign: "center", padding: 24,
      color: "#e2e8f0",
    }}>
      {children}
    </main>
  );
}

function Cta({ href, children, tone = "green" }: { href: string; children: React.ReactNode; tone?: "green" | "amber" }) {
  const bg = tone === "amber"
    ? "linear-gradient(135deg,#fde68a,#fbbf24)"
    : "linear-gradient(135deg,#bef264,#22c55e)";
  const shadow = tone === "amber" ? "0 5px 0 #b45309" : "0 5px 0 #15803d";
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: "12px 22px", borderRadius: 14, textDecoration: "none",
        background: bg, border: "3px solid #1e293b", boxShadow: shadow,
        color: tone === "amber" ? "#451a03" : "#052e16", fontWeight: 900, fontSize: 14,
      }}
    >
      {children}
    </Link>
  );
}
