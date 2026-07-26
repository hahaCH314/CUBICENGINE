import type { Metadata } from "next";
import PlayClient from "./PlayClient";

export const metadata: Metadata = {
  title: "作品をみる",
  description: "もらったリンクで、ともだちが作ったアドオンが動くところを見られます。",
  // 作品データは URL の # の後ろにあり、サーバー側には何も無い。
  // 中身の無いページを検索結果に出しても意味がないので載せない。
  robots: { index: false, follow: false },
};

export default function PlayPage() {
  return <PlayClient />;
}
