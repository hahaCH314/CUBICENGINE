"use client";

/* ══════════════════════════════════════════════════════════
   ReferencePanel — 「自分でも作ってみる」で持ち込んだ見本

   もらったリンクの作品を見て「作りたい」と思っても、エディタに移った瞬間に
   見本が消えると、何を置けばいいのか分からなくなる。作りながら横で見られる
   ようにするための読み取り専用パネル。

   ※ここから盤面へは入れない（丸ごとコピーは「まねして作る」の許可がある時だけ）。
     見ながら自分で並べる、という体験にする。
   ══════════════════════════════════════════════════════════ */

import { useState } from "react";
import * as LucideIcons from "lucide-react";
import type { CBlock } from "./_types";
import { CAT } from "../../data/categories";
import { t } from "@/lib/i18n";
import { useEditorStore } from "@/app/editor/store";

/** 見本を「重ねてある順」に並べる。もしもの中身は一段下げる。 */
function ordered(blocks: CBlock[]): { b: CBlock; depth: number }[] {
  const by = (id: string | null) => (id ? blocks.find(x => x.id === id) ?? null : null);
  const child = new Set<string>();
  blocks.forEach(b => [b.nextId, b.thenId, b.elseId, b.innerId].forEach(c => c && child.add(c)));
  const out: { b: CBlock; depth: number }[] = [];
  const seen = new Set<string>();
  const walk = (id: string | null, depth: number) => {
    let cur = by(id);
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      out.push({ b: cur, depth });
      if (cur.innerId) walk(cur.innerId, depth + 1);
      if (cur.thenId) walk(cur.thenId, depth + 1);
      if (cur.elseId) walk(cur.elseId, depth + 1);
      cur = by(cur.nextId);
    }
  };
  blocks.filter(b => !child.has(b.id)).forEach(r => walk(r.id, 0));
  blocks.forEach(b => { if (!seen.has(b.id)) { seen.add(b.id); out.push({ b, depth: 0 }); } });
  return out;
}

export default function ReferencePanel({
  blocks, title, author, isMobile, onClose,
}: {
  blocks: CBlock[];
  title: string;
  author: string;
  isMobile: boolean;
  onClose: () => void;
}) {
    const locale = useEditorStore((s) => s.locale);
  const [open, setOpen] = useState(true);

  if (!open) {
    // 畳んだ状態。完全に消すと戻せなくなるので、つまみだけ残す
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "absolute", left: 0, top: isMobile ? 70 : 96, zIndex: 45,
          borderRadius: "0 12px 12px 0", border: "3px solid #1e293b", borderLeft: "none",
          background: "linear-gradient(135deg,#fde68a,#fbbf24)", color: "#451a03",
          fontWeight: 900, fontSize: 12, padding: "9px 11px", cursor: "pointer",
          boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
        }}
      >
        {t(locale, "editor_2284af")}</button>
    );
  }

  return (
    <div style={{
      position: "absolute", left: 12, top: isMobile ? 70 : 96, zIndex: 45,
      width: isMobile ? 200 : 236,
      maxHeight: isMobile ? "calc(100dvh - 300px)" : "calc(100% - 320px)",
      display: "flex", flexDirection: "column",
      background: "linear-gradient(#fffbeb,#fef3c7)",
      border: "4px solid #f59e0b", borderRadius: 16,
      boxShadow: "0 10px 26px rgba(0,0,0,0.28)",
      overflow: "hidden",
    }}>
      <div style={{
        flexShrink: 0, padding: "8px 9px",
        background: "linear-gradient(#fbbf24,#f59e0b)", borderBottom: "3px solid #b45309",
        display: "flex", alignItems: "flex-start", gap: 6,
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 9.5, fontWeight: 900, color: "#78350f", letterSpacing: "0.06em" }}>
            {t(locale, "editor_a0fbde")}</div>
          <div style={{ fontSize: 12, fontWeight: 900, color: "#451a03", lineHeight: 1.3, overflowWrap: "anywhere" }}>
            {title}
          </div>
          {author && (
            <div style={{ fontSize: 9.5, fontWeight: 800, color: "#78350f", marginTop: 1 }}>
              {author} {t(locale, "editor_210ed5")}</div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0 }}>
          <button onClick={() => setOpen(false)} title={t(locale, "editor_9e856b")} style={miniBtn}>─</button>
          <button onClick={onClose} title={t(locale, "editor_463616")} style={miniBtn}>✕</button>
        </div>
      </div>

      <div className="scrollbar-hide" style={{ overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 4 }}>
        {ordered(blocks).map(({ b, depth }, i) => {
          const cat = CAT[b.category];
          const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>>)[b.emoji]
            ?? LucideIcons.HelpCircle;
          const vals = b.fields.map(f => f.value).filter(Boolean).join(" / ").replace(/minecraft:/g, "");
          return (
            <div key={b.id} style={{
              marginLeft: depth * 12,
              display: "flex", alignItems: "center", gap: 5,
              background: "#fff", border: "1.5px solid rgba(0,0,0,0.1)", borderRadius: 9,
              padding: "4px 6px", minWidth: 0,
            }}>
              <span style={{
                flexShrink: 0, width: 15, height: 15, borderRadius: "50%",
                background: "#fde68a", color: "#78350f", fontSize: 8.5, fontWeight: 900,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>{i + 1}</span>
              <span style={{
                flexShrink: 0, width: 17, height: 17, borderRadius: 5, background: cat.bg,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon size={10} color="#fff" strokeWidth={2.8} />
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 10, fontWeight: 900, color: "#1e293b", lineHeight: 1.25 }}>
                  {b.label}
                </span>
                {vals && (
                  <span style={{
                    display: "block", fontSize: 8.5, color: "#64748b", fontWeight: 700,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{vals}</span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{
        flexShrink: 0, padding: "6px 8px", borderTop: "2px dashed #fcd34d",
        fontSize: 9, fontWeight: 800, color: "#92400e", lineHeight: 1.45, textAlign: "center",
      }}>
        {t(locale, "editor_a42a59")}</div>
    </div>
  );
}

const miniBtn: React.CSSProperties = {
  width: 20, height: 18, borderRadius: 5, cursor: "pointer",
  border: "1.5px solid #b45309", background: "rgba(255,255,255,0.75)",
  color: "#78350f", fontSize: 10, fontWeight: 900, lineHeight: 1,
};
