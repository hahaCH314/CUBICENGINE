import type { Metadata } from "next";

// metadata はビルド時にサーバで1回だけ評価されるので、閲覧者のロケールでは出し分けられない。
// t() を通すとサーバ側では常に既定(ja)になるうえ、エディタのストアがサーババンドルに入る。
export const metadata: Metadata = {
  title: "Editor — CUBICENGINEstudio",
  description: "CUBICENGINEstudio のメインエディター画面。",
};

export default function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
