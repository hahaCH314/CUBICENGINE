"use client";

/* ══════════════════════════════════════════════════════════
   ShareDialog — 作品を「みせる」ためのリンクを作る画面

   ・作品データはリンクの中（# の後ろ）に入る。どこにも保存しない。
   ・名前は任意。入れなければ「だれか」として出る。個人情報は集めない方針なので、
     本名を書かせない・端末の外に出ないことを画面上でも言い切る。
   ・「まねしてOK」は既定オフ。丸ごとコピーされると見せる理由が無くなるので、
     許可は作者が自分で選ぶ。
   ══════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useState } from "react";
import type { CBlock } from "./_types";
import { buildShareUrl, toWire } from "../../lib/share";
import { makeQr, qrToSvg } from "../../lib/qr";

const NAME_KEY = "mmc-share-name";

export default function ShareDialog({
  blocks, projectName, remixSrc = "", onClose,
}: {
  blocks: CBlock[];
  projectName: string;
  /** まねして作った作品なら、元の作者名。消せない形で次の人まで運ぶ。 */
  remixSrc?: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(projectName || "");
  const [author, setAuthor] = useState("");
  const [remix, setRemix] = useState(false);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  // 名前は毎回入れ直させない。端末の中だけに置く（サーバーへは送らない）
  useEffect(() => {
    try { setAuthor(localStorage.getItem(NAME_KEY) ?? ""); } catch { }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const work = toWire(blocks, {
        n: title.trim() || undefined,
        a: author.trim() || undefined,
        ...(remix ? { r: 1 as const } : {}),
        ...(remixSrc ? { src: remixSrc } : {}),
      });
      const u = await buildShareUrl(window.location.origin, work);
      if (alive) { setUrl(u); setCopied(false); }
    })();
    return () => { alive = false; };
  }, [blocks, title, author, remix, remixSrc]);

  const save = () => { try { localStorage.setItem(NAME_KEY, author.trim()); } catch { } };

  const copy = async () => {
    save();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // クリップボードが使えない環境では、選択してコピーしてもらう
      const el = document.getElementById("share-url") as HTMLInputElement | null;
      el?.select();
    }
  };

  // スマホは OS の共有シートに投げるのが一番早い（LINE/Discord/AirDropへ直行）
  const send = async () => {
    save();
    try {
      await navigator.share({ title: title.trim() || "ぼくのアドオン", url });
    } catch { /* 閉じただけ。何もしない */ }
  };

  const canShare = typeof navigator !== "undefined" && !!navigator.share;
  const tooBig = url.length > 8000; // さすがに送れない大きさ

  // QRは長いほど細かくなって読みにくくなる。実用的に読める範囲だけ出す。
  const qr = useMemo(() => {
    if (!url || url.length > 1800) return null;
    const m = makeQr(url);
    return m ? qrToSvg(m) : null;
  }, [url]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 99999, padding: 16,
        background: "rgba(2,6,23,0.78)", backdropFilter: "blur(3px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "min(460px, 100%)", maxHeight: "88vh", overflowY: "auto",
          background: "#fff", borderRadius: 20, border: "4px solid #22c55e",
          boxShadow: "0 24px 60px rgba(0,0,0,0.45)", padding: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 26 }}>📣</span>
          <h2 style={{ fontSize: 19, fontWeight: 900, color: "#14532d" }}>作品をみせる</h2>
          <button onClick={onClose} style={{
            marginLeft: "auto", width: 30, height: 30, borderRadius: 9, cursor: "pointer",
            border: "2px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontWeight: 900,
          }}>✕</button>
        </div>
        <p style={{ fontSize: 12, color: "#64748b", fontWeight: 700, marginBottom: 16, lineHeight: 1.6 }}>
          リンクを送るだけで、ともだちが<b>マイクラを持っていなくても</b>作品が動くところを見られるよ。
        </p>

        {/* 出典が付くことは本人にも見せる。黙って名前を入れるのは不誠実だし、
            「ちゃんと元の人の名前が残る」と分かるほうが安心して真似できる。 */}
        {remixSrc && (
          <div style={{
            display: "flex", gap: 8, alignItems: "flex-start",
            border: "2px solid #fbbf24", background: "#fffbeb", borderRadius: 12,
            padding: "9px 11px", marginBottom: 14,
          }}>
            <span style={{ fontSize: 16 }}>🔁</span>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: "#92400e", lineHeight: 1.55 }}>
              この作品には <b>{remixSrc}</b> の名前がいっしょに入ります。
              <span style={{ display: "block", color: "#b45309", fontWeight: 700, marginTop: 2 }}>
                まねさせてもらった人の名前は、みせるときに必ずついていくよ。
              </span>
            </span>
          </div>
        )}

        <Field label="作品のなまえ">
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="ばくはつニワトリ" style={input} />
        </Field>

        <Field label="つくった人（いれなくてもOK）">
          <input value={author} onChange={e => setAuthor(e.target.value)}
            placeholder="ニックネーム" maxLength={20} style={input} />
          <p style={{ fontSize: 10.5, color: "#94a3b8", fontWeight: 700, marginTop: 4, lineHeight: 1.5 }}>
            ほんとうの名前は書かないでね。この名前はリンクの中に入るだけで、どこにも保存されないよ。
          </p>
        </Field>

        {/* 丸ごとコピーを許すかどうかは、作った本人が決める */}
        <label style={{
          display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer",
          border: `2px solid ${remix ? "#f59e0b" : "#e2e8f0"}`, borderRadius: 12,
          background: remix ? "#fffbeb" : "#f8fafc", padding: "10px 12px", marginBottom: 16,
        }}>
          <input type="checkbox" checked={remix} onChange={e => setRemix(e.target.checked)}
            style={{ marginTop: 2, width: 18, height: 18, accentColor: "#f59e0b" }} />
          <span>
            <span style={{ fontSize: 13, fontWeight: 900, color: remix ? "#92400e" : "#475569" }}>
              🔁 まねして作ってもいい
            </span>
            <span style={{ display: "block", fontSize: 10.5, color: "#94a3b8", fontWeight: 700, marginTop: 3, lineHeight: 1.5 }}>
              オフなら「見るだけ」。オンにすると相手が中身をひらけるようになり、
              その作品には<b>あなたの名前が残ります</b>。
            </span>
          </span>
        </label>

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button onClick={copy} disabled={!url || tooBig} style={{ ...btn, flex: 1, opacity: url && !tooBig ? 1 : 0.5 }}>
            {copied ? "✓ コピーした！" : "🔗 リンクをコピー"}
          </button>
          {canShare && (
            <button onClick={send} disabled={!url || tooBig} style={{ ...btn, background: "linear-gradient(135deg,#93c5fd,#3b82f6)", boxShadow: "0 4px 0 #1d4ed8", color: "#fff", opacity: url && !tooBig ? 1 : 0.5 }}>
              📤 おくる
            </button>
          )}
        </div>

        {/* 目の前の友達に渡すならこれが最短。画面を見せるだけで済む。 */}
        {qr && (
          <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "4px 0 12px" }}>
            <div
              style={{ width: 116, height: 116, flexShrink: 0, borderRadius: 10, overflow: "hidden", border: "2px solid #e2e8f0" }}
              dangerouslySetInnerHTML={{ __html: qr }}
            />
            <p style={{ fontSize: 11.5, fontWeight: 800, color: "#475569", lineHeight: 1.6 }}>
              📷 目の前のともだちには、これを読んでもらうのが早いよ。
              <span style={{ display: "block", color: "#94a3b8", fontWeight: 700, marginTop: 3 }}>
                カメラを向けるだけ。ネットにつながっていなくても渡せる。
              </span>
            </p>
          </div>
        )}

        <input id="share-url" readOnly value={url}
          onFocus={e => e.currentTarget.select()}
          style={{ ...input, fontSize: 10.5, color: "#64748b", fontFamily: "monospace" }} />

        <p style={{ fontSize: 10.5, color: "#94a3b8", fontWeight: 700, marginTop: 10, lineHeight: 1.6 }}>
          {tooBig
            ? "⚠️ 作品が大きすぎてリンクにできませんでした。カードを減らすか、分けて送ってね。"
            : `この作品はリンクの中（${url.length} 文字）に入っています。サーバーには何も送られません。`}
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ fontSize: 11.5, fontWeight: 900, color: "#334155", marginBottom: 5 }}>{label}</div>
      {children}
    </div>
  );
}

const input: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 10,
  border: "2px solid #cbd5e1", fontSize: 13, fontWeight: 700, color: "#1e293b", outline: "none",
};

const btn: React.CSSProperties = {
  padding: "11px 16px", borderRadius: 12, cursor: "pointer",
  border: "3px solid #1e293b", background: "linear-gradient(135deg,#bef264,#22c55e)",
  boxShadow: "0 4px 0 #15803d", color: "#052e16", fontWeight: 900, fontSize: 13.5,
};
