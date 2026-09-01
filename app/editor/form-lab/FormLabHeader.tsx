"use client";

import Link from "next/link";
import { t, tNode } from "@/lib/i18n";
import { useEditorStore } from "@/app/editor/store";

/* page.tsx は metadata を持つサーバコンポーネントなので、ロケールを購読できない
   （zustand の useSyncExternalStore はサーバ側に存在せず prerender で落ちる）。
   言語で変わる見出しだけをこちらのクライアント側に切り出している。 */
export default function FormLabHeader() {
  const locale = useEditorStore((s) => s.locale);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 900, letterSpacing: "0.02em" }}>{t(locale, "editor_a61f69")}</h1>
        <p style={{ fontSize: 12.5, color: "#8b93a1", marginTop: 4 }}>
          {tNode(locale, "editor_frag_1a05c068068_23", { arg0: <b>{t(locale, "editor_a4050e")}</b> })}</p>
      </div>
      <Link href="/editor" style={{ fontSize: 13, fontWeight: 800, color: "#60a5fa", textDecoration: "none" }}>{t(locale, "editor_af34d5")}</Link>
    </div>
  );
}
