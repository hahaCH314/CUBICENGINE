"use client";

import Link from "next/link";
import { t } from "@/lib/i18n";
import { useEditorStore } from "@/app/editor/store";

/* page.tsx は metadata を持つサーバコンポーネントなので、ロケールを購読できない
   （zustand の useSyncExternalStore はサーバ側に存在せず prerender で落ちる）。
   言語で変わる見出しだけをこちらのクライアント側に切り出している。 */
export default function DexHeader() {
  const locale = useEditorStore((s) => s.locale);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 28 }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: "0.02em", color: "#0f172a", margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <span>🃏</span>
          <span>{t(locale, "editor_7979b3")}</span>
        </h1>
        <p style={{ fontSize: 13.5, color: "#475569", marginTop: 8, lineHeight: 1.6, fontWeight: 700 }}>
          {t(locale, "editor_700ccb")}<br />
          {t(locale, "editor_2513c1")}</p>
      </div>
      <Link
        href="/editor"
        style={{
          flexShrink: 0,
          fontSize: 14,
          fontWeight: 800,
          color: "#ffffff",
          background: "#0284c7",
          textDecoration: "none",
          padding: "9px 18px",
          borderRadius: 9999,
          boxShadow: "0 3px 6px rgba(2, 132, 199, 0.25)",
          border: "2px solid #38bdf8",
          transition: "transform 0.1s"
        }}
      >
        {t(locale, "editor_0023de")}</Link>
    </div>
  );
}
