"use client";

import Link from "next/link";
import { t } from "@/lib/i18n";
import { useEditorStore } from "@/app/editor/store";

/* page.tsx は metadata を持つサーバコンポーネントなので、ロケールを購読できない
   （zustand の useSyncExternalStore はサーバ側に存在せず prerender で落ちる）。
   言語で変わる見出しだけをこちらのクライアント側に切り出している。 */
export default function CardLabHeader() {
  const locale = useEditorStore((s) => s.locale);
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 900, letterSpacing: "0.02em" }}>{t(locale, "editor_5e69e2")}</h1>
        <p style={{ fontSize: 12.5, color: "#8b93a1", marginTop: 5, lineHeight: 1.6 }}>
          {t(locale, "editor_dfedc8")}<b>{t(locale, "editor_29698c")}</b>{t(locale, "editor_41a9fa")}<br />
          {t(locale, "editor_4186a0")}</p>
      </div>
      <Link href="/editor" style={{ flexShrink: 0, fontSize: 13, fontWeight: 800, color: "#60a5fa", textDecoration: "none" }}>{t(locale, "editor_af34d5")}</Link>
    </div>
  );
}
