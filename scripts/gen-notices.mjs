#!/usr/bin/env node
/**
 * gen-notices.mjs — 生産依存(dependencies)のOSSライセンス表記を生成する。
 *   出力: THIRD_PARTY_NOTICES.md（リポ直下）
 *
 * 使い方: node scripts/gen-notices.mjs
 *   ※ .exe 配布前など、依存を更新したら再実行してコミットする。
 *
 * 方針: package.json の "dependencies"（=配布物に含まれうる本番依存）を対象に、
 *   各パッケージの version / license / LICENSE 本文 を node_modules から収集して列挙する。
 *   （devDependencies はビルド時のみで配布されないため対象外）
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const deps = Object.keys(pkg.dependencies ?? {}).sort();

const LICENSE_FILES = ["LICENSE", "LICENSE.md", "LICENSE.txt", "LICENCE", "LICENCE.md", "COPYING", "COPYING.md"];

function readLicenseText(pkgDir) {
  try {
    for (const f of readdirSync(pkgDir)) {
      if (LICENSE_FILES.some((n) => f.toUpperCase() === n.toUpperCase()) || /^LICEN[CS]E/i.test(f)) {
        const t = readFileSync(join(pkgDir, f), "utf8").trim();
        if (t) return t;
      }
    }
  } catch { /* noop */ }
  return null;
}

function licenseStr(p) {
  if (typeof p.license === "string") return p.license;
  if (p.license?.type) return p.license.type;
  if (Array.isArray(p.licenses)) return p.licenses.map((l) => l.type || l).join(" OR ");
  return "UNKNOWN";
}

function repoUrl(p) {
  const r = p.repository;
  if (typeof r === "string") return r;
  if (r?.url) return r.url.replace(/^git\+/, "").replace(/\.git$/, "");
  return p.homepage || "";
}

const sections = [];
const summary = [];
for (const name of deps) {
  const pkgDir = join(root, "node_modules", name);
  const pjPath = join(pkgDir, "package.json");
  if (!existsSync(pjPath)) {
    summary.push(`| ${name} | (未インストール) | - |`);
    continue;
  }
  const pj = JSON.parse(readFileSync(pjPath, "utf8"));
  const lic = licenseStr(pj);
  const ver = pj.version ?? "?";
  const url = repoUrl(pj);
  summary.push(`| ${name} | ${ver} | ${lic} |`);

  const text = readLicenseText(pkgDir);
  sections.push(
    [
      `### ${name} \`${ver}\` — ${lic}`,
      url ? `<${url}>` : "",
      "",
      text ? "```\n" + text + "\n```" : `License: ${lic}（全文は node_modules/${name}/ のライセンスファイルを参照）`,
      "",
    ]
      .filter((l) => l !== "")
      .join("\n"),
  );
}

const FONTS = `## フォント / Fonts

本アプリは Google Fonts 提供の以下のフォントを next/font 経由でセルフホストして使用しています。
いずれもオープンソースライセンス（SIL Open Font License 1.1 / Apache-2.0 等）で提供されています。

- **Geist / Geist Mono** © Vercel — SIL Open Font License 1.1
- **Press Start 2P** © CodeMan38 — SIL Open Font License 1.1
- **M PLUS Rounded 1c** © The M+ FONTS Project — SIL Open Font License 1.1
`;

const out = [
  "# Third-Party Notices / オープンソースライセンス表記",
  "",
  "CUBICENGINE は以下のオープンソースソフトウェアを利用しています。各ソフトウェアの著作権は各権利者に帰属し、それぞれのライセンスのもとで配布されています。",
  "",
  "This product (**CUBICENGINE**) includes the third-party open-source software listed below. Each component remains the property of its respective owners and is distributed under its own license.",
  "",
  `> このファイルは \`node scripts/gen-notices.mjs\` で自動生成されています（最終生成: ${new Date().toISOString().slice(0, 10)}）。`,
  "> 本番依存(dependencies)のみを対象。実際の配布物にはこれらの推移的依存も含まれ、いずれも各OSSライセンスに従います。",
  "",
  "## 一覧 / Summary",
  "",
  "| Package | Version | License |",
  "| :--- | :--- | :--- |",
  ...summary,
  "",
  "---",
  "",
  FONTS,
  "---",
  "",
  "## 各ライセンス全文 / Full license texts",
  "",
  ...sections,
].join("\n");

writeFileSync(join(root, "THIRD_PARTY_NOTICES.md"), out + "\n", "utf8");
console.log(`Wrote THIRD_PARTY_NOTICES.md (${deps.length} production dependencies).`);
