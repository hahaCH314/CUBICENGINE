import * as fs from "fs";

const dictPath = "lib/i18n.ts";
const genDictPath = "generated_dict.json";

const i18nContent = fs.readFileSync(dictPath, "utf-8");
const generatedDict = JSON.parse(fs.readFileSync(genDictPath, "utf-8"));

// 辞書オブジェクトを文字列として安全に構築
let newEntries = "";
for (const [key, value] of Object.entries(generatedDict)) {
  newEntries += `  ${JSON.stringify(key)}: { ja: ${JSON.stringify((value as any).ja)}, en: ${JSON.stringify((value as any).en)} },\n`;
}

// DICTの末尾（}; の直前）に挿入する
const match = i18nContent.match(/export const DICT: Record<string, Entry> = \{([\s\S]*?)\n\};/);

if (match) {
  const inner = match[1];
  const newDictString = `export const DICT: Record<string, Entry> = {${inner}\n  // ── Auto Extracted Editor Strings ──\n${newEntries}};`;
  const newContent = i18nContent.replace(match[0], newDictString);
  fs.writeFileSync(dictPath, newContent, "utf-8");
  console.log("Merged dictionary safely into lib/i18n.ts");
} else {
  console.error("Could not find DICT in lib/i18n.ts");
}
