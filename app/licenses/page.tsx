import Link from "next/link";
import type { Metadata } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const metadata: Metadata = {
  title: "オープンソースライセンス表記",
  description:
    "CUBICENGINE が利用しているオープンソースソフトウェアのライセンス表記（Third-Party Notices）。",
};

// THIRD_PARTY_NOTICES.md をビルド時に読み込み、単一の情報源として表示する。
// （`node scripts/gen-notices.mjs` で再生成 → このページは常にその内容を反映する）
function loadNotices(): string {
  try {
    return readFileSync(join(process.cwd(), "THIRD_PARTY_NOTICES.md"), "utf8");
  } catch {
    return "ライセンス表記ファイルを読み込めませんでした。リポジトリの THIRD_PARTY_NOTICES.md をご参照ください。";
  }
}

export default function LicensesPage() {
  const notices = loadNotices();
  return (
    <main className="min-h-screen px-6 py-16 pb-28 text-foreground">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-sm text-muted hover:text-foreground transition-colors">
          ← ホームに戻る
        </Link>
        <h1 className="text-2xl font-bold mt-4 mb-2">オープンソースライセンス表記</h1>
        <p className="text-sm leading-relaxed text-muted mb-6">
          CUBICENGINE は多くのオープンソースソフトウェアの上に成り立っています。各ソフトウェアの著作権は
          それぞれの権利者に帰属し、下記のライセンスのもとで利用しています。素晴らしいソフトウェアを公開して
          くださっている作者・コミュニティに感謝します。
        </p>

        <div className="rounded-lg border border-foreground/10 bg-foreground/[0.03] overflow-x-auto">
          <pre className="text-[11px] leading-relaxed text-muted whitespace-pre p-4 font-mono">
            {notices}
          </pre>
        </div>

        <p className="mt-8 text-xs text-muted/70">
          ※ 本ツールは非公式です。Mojang Studios・Microsoft とは関係ありません。Minecraft は Mojang Studios の商標です。
        </p>
      </div>
    </main>
  );
}
