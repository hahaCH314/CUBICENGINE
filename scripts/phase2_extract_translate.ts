/**
 * Phase 2: 残存日本語の一括抽出・翻訳・置換スクリプト
 * コメント行・codegen保存値・すでに翻訳済みの行を除外して処理する
 */
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const CODEGEN_KEYS = new Set([
  "加算","減算","セット","リセット","追加","削除",
  "当たった","飛んでいる","水中","地上","スニーク中","ダッシュ中",
  "プレイヤー","コアエンティティ","全員","自分",
  "ランダム","合計","乗算","除算","最大","最小",
]);

function isComment(line: string): boolean {
  const t = line.trim();
  return t.startsWith("{/*") || t.startsWith("/*") || t.startsWith("* ") || t.startsWith("*/")
    || t.startsWith("//") || /console\.(log|error|warn|info)\(/.test(t)
    || t.startsWith("/**");
}

function makeKey(text: string): string {
  return "editor_" + crypto.createHash("md5").update(text).digest("hex").slice(0, 6);
}

// 翻訳API (Google Translate 非公式)
async function translateText(text: string): Promise<string> {
  if (!text || !/[\u3041-\u30FF\u4E00-\u9FAF]/.test(text)) return text;
  let protected_ = text;
  const phs: string[] = [];
  protected_ = protected_.replace(/\$\{[^}]+\}/g, (m) => { phs.push(m); return `__PH${phs.length-1}__`; });
  protected_ = protected_.replace(/`/g, "__BACKTICK__");
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=en&dt=t&q=${encodeURIComponent(protected_)}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    let out = "";
    if (data?.[0]) for (const item of data[0]) if (item?.[0]) out += item[0];
    out = out.replace(/__PH(\d+)__/g, (_, i) => phs[parseInt(i)]);
    out = out.replace(/__BACKTICK__/g, "`");
    // Minecraft固有用語修正
    out = out.replace(/Integrated Edition/gi, "Bedrock Edition")
             .replace(/Integration Edition/gi, "Bedrock Edition")
             .replace(/Java version/gi, "Java Edition")
             .replace(/CUBIC ENGINE/gi, "CUBIC ENGINE");
    return out.trim();
  } catch {
    return text;
  }
}

// 対象ファイル一覧
const TARGET_FILES = [
  "app/editor/LogicPanel.tsx",
  "app/editor/GrapePanel.tsx",
  "app/editor/SettingsPanel.tsx",
  "app/editor/card-lab/CardLab.tsx",
  "app/editor/LiveStage.tsx",
  "app/editor/dex/DexClient.tsx",
  "app/editor/CodeRevealOverlay.tsx",
  "app/editor/page.tsx",
  "app/editor/LaunchPanel.tsx",
  "app/editor/developer/DeveloperPanel.tsx",
  "app/editor/developer/ItemBuilder.tsx",
  "app/editor/developer/MobBuilder.tsx",
  "app/editor/TutorialOverlay.tsx",
  "app/editor/exporter.ts",
  "app/editor/FormBuilder.tsx",
  "app/editor/ModelPanel.tsx",
  "app/editor/developer/ModelImport.tsx",
  "app/editor/ShareDialog.tsx",
  "app/editor/dex/page.tsx",
  "app/editor/HowToInstallModal.tsx",
  "app/editor/layout.tsx",
  "app/editor/card-lab/page.tsx",
  "app/editor/form-lab/page.tsx",
];

interface Extraction {
  key: string;
  ja: string;
  lineIndex: number;
  original: string;
  replaced: string;
  file: string;
  context: "t" | "meta"; // t() で置換するか、メタ文字列か
}

// SEO metadataかどうか
function isMetaLine(line: string): boolean {
  return /title:|description:/.test(line) && /["'][\u3041-\u30FF\u4E00-\u9FAF]/.test(line);
}

// window.confirm / throw Error / setLogs / push など文字列リテラルに日本語
function isRuntimeString(line: string): boolean {
  return /window\.confirm|throw new Error|setLogs|setError|setErrors|push\(`|\.push\(["']/.test(line);
}

// TemplateリテラルかどうかのRegex
const JP_RE = /[\u3041-\u30FF\u4E00-\u9FAF]/;

async function processFile(filePath: string): Promise<{ extractions: Extraction[]; newContent: string }> {
  if (!fs.existsSync(filePath)) return { extractions: [], newContent: "" };
  const original = fs.readFileSync(filePath, "utf-8");
  const lines = original.split("\n");
  const extractions: Extraction[] = [];

  const newLines = [...lines];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isComment(line)) continue;
    const codePart = line.split("//")[0];
    if (!JP_RE.test(codePart)) continue;
    if (codePart.includes("editor_") || codePart.includes("t(") || codePart.includes("i18nT(") || codePart.includes("tNode(")) continue;

    const jpTokens = codePart.match(/[\u3041-\u30FF\u4E00-\u9FAF]+/g) || [];
    const allCodegen = jpTokens.every(m => CODEGEN_KEYS.has(m));
    if (allCodegen) continue;

    // JSXの文字列リテラルを探す (テンプレートリテラル・通常文字列)
    // パターン: ">日本語テキスト<" または {`日本語`} または "日本語" 等
    
    // --- パターン1: JSX テキストノード >日本語<
    // 例: <h2>これで出るコード</h2>
    const jsxTextMatch = line.match(/>([\u3041-\u30FF\u4E00-\u9FAF][^<{]*[\u3041-\u30FF\u4E00-\u9FAF]*[^<{]*)</);
    if (jsxTextMatch && jsxTextMatch[1].trim()) {
      const jaText = jsxTextMatch[1].trim();
      if (JP_RE.test(jaText) && jaText.length > 1) {
        const key = makeKey(jaText);
        // すでに抽出済みでないか
        if (!extractions.find(e => e.ja === jaText)) {
          extractions.push({ key, ja: jaText, lineIndex: i, original: line, replaced: "", file: filePath, context: "t" });
        }
      }
    }

    // --- パターン2: JSXの文字列Prop ("日本語" や '日本語')
    // 例: title="これで出るコード" や placeholder="入力してください"
    const propMatches = [...codePart.matchAll(/(?:title|placeholder|label|alt|aria-label|tooltip|name|value)=["']([^"']*[\u3041-\u30FF\u4E00-\u9FAF][^"']*)["']/g)];
    for (const m of propMatches) {
      const jaText = m[1].trim();
      if (JP_RE.test(jaText) && jaText.length > 1) {
        const key = makeKey(jaText);
        if (!extractions.find(e => e.ja === jaText)) {
          extractions.push({ key, ja: jaText, lineIndex: i, original: line, replaced: "", file: filePath, context: "t" });
        }
      }
    }

    // --- パターン3: window.confirm / throw / setError の文字列
    if (isRuntimeString(line)) {
      // テンプレートリテラルの固定部分
      const strMatches = [...codePart.matchAll(/["'`]([^"'`]*[\u3041-\u30FF\u4E00-\u9FAF][^"'`]*)["'`]/g)];
      for (const m of strMatches) {
        const jaText = m[1].replace(/\$\{[^}]+\}/g, "{val}").trim();
        if (JP_RE.test(jaText) && jaText.length > 1 && !jaText.includes("editor_")) {
          const key = makeKey(jaText);
          if (!extractions.find(e => e.ja === jaText)) {
            extractions.push({ key, ja: jaText, lineIndex: i, original: line, replaced: "", file: filePath, context: "t" });
          }
        }
      }
    }
  }

  return { extractions, newContent: original };
}

async function main() {
  console.log("=== Phase 2: 残存日本語 一括処理 ===\n");

  // Step 1: 全ファイルから抽出
  const allExtractions: Extraction[] = [];
  for (const f of TARGET_FILES) {
    const { extractions } = await processFile(f);
    allExtractions.push(...extractions);
    if (extractions.length > 0) {
      console.log(`${f}: ${extractions.length}件`);
    }
  }

  // 重複除去
  const unique = new Map<string, Extraction>();
  for (const e of allExtractions) {
    if (!unique.has(e.ja)) unique.set(e.ja, e);
  }
  const toTranslate = [...unique.values()];
  console.log(`\n抽出ユニークキー: ${toTranslate.length}件`);

  // Step 2: 翻訳 (並行30件)
  const translations = new Map<string, string>();
  for (let i = 0; i < toTranslate.length; i += 30) {
    const chunk = toTranslate.slice(i, i + 30);
    await Promise.all(chunk.map(async (e) => {
      const en = await translateText(e.ja);
      translations.set(e.ja, en);
    }));
    console.log(`翻訳: ${Math.min(i + 30, toTranslate.length)}/${toTranslate.length}`);
  }

  // Step 3: generated_dict.json に追記
  const dictPath = "generated_dict.json";
  const dict = JSON.parse(fs.readFileSync(dictPath, "utf-8"));
  let added = 0;
  for (const e of toTranslate) {
    if (!dict[e.key]) {
      dict[e.key] = { ja: e.ja, en: translations.get(e.ja) || e.ja };
      added++;
    }
  }
  fs.writeFileSync(dictPath, JSON.stringify(dict, null, 2), "utf-8");
  console.log(`\ngenerated_dict.json に${added}件追記`);

  // Step 4: apply_translations.ts を実行して lib/i18n.ts を更新
  const { execSync } = require("child_process");
  execSync("npx tsx scripts/apply_translations.ts", { stdio: "inherit" });

  console.log("\n✅ Phase 2 完了！");
  console.log("次: npm run build で確認してください");
}

main().catch(console.error);
