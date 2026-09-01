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
import { t, tNode } from "@/lib/i18n";
import { useEditorStore } from "@/app/editor/store";

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
    const locale = useEditorStore((s) => s.locale);
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
      await navigator.share({ title: title.trim() || t(locale, "editor_dbfee0"), url });
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
        {tNode(locale, "editor_frag_1a05c067c06_3", { arg0: <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 26 }}>📣</span>
          <h2 style={{ fontSize: 19, fontWeight: 900, color: "#14532d" }}>{t(locale, "editor_2666b5")}</h2>
          <button onClick={onClose} style={{
            marginLeft: "auto", width: 30, height: 30, borderRadius: 9, cursor: "pointer",
            border: "2px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontWeight: 900,
          }}>✕</button>
        </div>, arg1: <p style={{ fontSize: 12, color: "#64748b", fontWeight: 700, marginBottom: 16, lineHeight: 1.6 }}>
          {tNode(locale, "editor_frag_1a05c067c0a_4", { arg0: <b>{t(locale, "editor_878b0b")}</b> })}</p>,  arg3: <Field label={t(locale, "editor_794beb")}>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder={t(locale, "editor_faf373")} style={input} />
        </Field>, arg4: <Field label={t(locale, "editor_95dd38")}>
          <input value={author} onChange={e => setAuthor(e.target.value)}
            placeholder={t(locale, "editor_eb1dfd")} maxLength={20} style={input} />
          <p style={{ fontSize: 10.5, color: "#94a3b8", fontWeight: 700, marginTop: 4, lineHeight: 1.5 }}>
            {t(locale, "editor_d5f6a4")}</p>
        </Field>,  arg6: <label style={{
          display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer",
          border: `2px solid ${remix ? "#f59e0b" : "#e2e8f0"}`, borderRadius: 12,
          background: remix ? "#fffbeb" : "#f8fafc", padding: "10px 12px", marginBottom: 16,
        }}>
          <input type="checkbox" checked={remix} onChange={e => setRemix(e.target.checked)}
            style={{ marginTop: 2, width: 18, height: 18, accentColor: "#f59e0b" }} />
          <span>
            <span style={{ fontSize: 13, fontWeight: 900, color: remix ? "#92400e" : "#475569" }}>
              {t(locale, "editor_0fe713")}</span>
            <span style={{ display: "block", fontSize: 10.5, color: "#94a3b8", fontWeight: 700, marginTop: 3, lineHeight: 1.5 }}>
              {tNode(locale, "editor_frag_1a05c067c0f_5", { arg0: <b>{t(locale, "editor_6a38b7")}</b>, arg1: t(locale, "punct.period") })}</span>
          </span>
        </label>, arg7: <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button onClick={copy} disabled={!url || tooBig} style={{ ...btn, flex: 1, opacity: url && !tooBig ? 1 : 0.5 }}>
            {copied ? t(locale, "editor_64cd3f") : t(locale, "editor_f1e1d8")}
          </button>
          {canShare && (
            <button onClick={send} disabled={!url || tooBig} style={{ ...btn, background: "linear-gradient(135deg,#93c5fd,#3b82f6)", boxShadow: "0 4px 0 #1d4ed8", color: "#fff", opacity: url && !tooBig ? 1 : 0.5 }}>
              {t(locale, "editor_943259")}</button>
          )}
        </div>,  arg9: <input id="share-url" readOnly value={url}
          onFocus={e => e.currentTarget.select()}
          style={{ ...input, fontSize: 10.5, color: "#64748b", fontFamily: "monospace" }} />, arg10: <p style={{ fontSize: 10.5, color: "#94a3b8", fontWeight: 700, marginTop: 10, lineHeight: 1.6 }}>
          {tooBig
            ? t(locale, "editor_513485")
            : t(locale, "editor_link_note").replace("{len}", String(url.length))}
        </p> })}</div>
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
