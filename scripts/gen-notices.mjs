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
- **Outfit** © Smartsheet Inc. — SIL Open Font License 1.1
- **Nunito** © The Nunito Project Authors — SIL Open Font License 1.1

※ここは app/layout.tsx の next/font 読み込みと一致させること。フォントは .exe に同梱して
再配布されるため、OFL 1.1 は著作権表示の同梱を義務づけている（増やしたらこの表を必ず更新）。
`;

// デスクトップ版(.exe/.dmg)にだけ同梱されるランタイム。npm の dependencies には出てこないが、
// 実体はアプリと一緒に再配布されるので表記義務がある（特に Chromium の BSD-3-Clause）。
// ⚠️ npm の依存ではないが、**生成物に入れて配っている**もの。
//    この生成器は package.json の dependencies しか見ないので、
//    ここに手で書かないと表記が丸ごと抜ける（2026-08-23 に抜けているのを発見）。
//    lib/gradleWrapper.ts に base64 で持っている Gradle の Wrapper は
//    Apache-2.0 で、再配布にはライセンスの明示が必要。
const GENERATED_ARTIFACTS = `## 生成物に同梱されるもの / Bundled in generated output

CUBICENGINE が書き出す Java版のソースコード ZIP には、以下が含まれます。

- **Gradle Wrapper** \`8.8\` © Gradle Inc. and the original authors — Apache License 2.0
  （\`gradlew\` / \`gradlew.bat\` / \`gradle/wrapper/gradle-wrapper.jar\` / \`gradle-wrapper.properties\`。
  Forge 1.20.1 MDK 由来。実体は \`lib/gradleWrapper.ts\` に base64 で保持）
  <https://www.apache.org/licenses/LICENSE-2.0>

※ ブラウザから直接書き出す \`.jar\`（base-mod.jar への注入方式）には Gradle は含まれません。
   Minecraft 本体・Minecraft Forge は再配布しておらず、利用者が各自で用意します。
   本ツールおよび生成物は非公式で、Mojang Studios・Microsoft とは関係ありません。
`;

function runtimeSection() {
  let ver = "(未インストール)";
  try {
    ver = JSON.parse(readFileSync(join(root, "node_modules", "electron", "package.json"), "utf8")).version;
  } catch { /* noop */ }
  return `## デスクトップ版に同梱されるランタイム / Bundled runtimes (desktop build)

Web版には含まれません。デスクトップ版（\`.exe\` / \`.dmg\`）はアプリ実行のため以下を同梱して再配布しています。

- **Electron** \`${ver}\` — MIT License
- **Chromium** — BSD-3-Clause ほか（ライセンス全文は配布物内の \`LICENSES.chromium.html\`）
- **Node.js / V8** — MIT License / BSD-3-Clause

Electron 由来の \`LICENSE\` と \`LICENSES.chromium.html\` は electron-builder が配布物へそのまま
同梱するため、全文はインストール先フォルダに含まれます。
`;
}

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
  GENERATED_ARTIFACTS,
  "---",
  "",
  runtimeSection(),
  "---",
  "",
  "## 各ライセンス全文 / Full license texts",
  "",
  ...sections,
].join("\n");

writeFileSync(join(root, "THIRD_PARTY_NOTICES.md"), out + "\n", "utf8");
console.log(`Wrote THIRD_PARTY_NOTICES.md (${deps.length} production dependencies).`);
