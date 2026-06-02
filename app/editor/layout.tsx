import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Editor — CUBICENGINE Studio",
  description: "CUBICENGINE Studio のメインエディター画面。",
};

export default function EditorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
