import * as fs from "fs";

const dictPath = "lib/i18n.ts";
const genDictPath = "generated_dict.json";
const fragDictPath = "fragments_dict.json";

const i18nContent = fs.readFileSync(dictPath, "utf-8");
const generatedDict = JSON.parse(fs.readFileSync(genDictPath, "utf-8"));
const fragDict = JSON.parse(fs.readFileSync(fragDictPath, "utf-8"));

// generated_dict.json にマージ
Object.assign(generatedDict, fragDict);
fs.writeFileSync(genDictPath, JSON.stringify(generatedDict, null, 2), "utf-8");
console.log("Merged fragments into generated_dict.json");

// lib/i18n.ts にマージ
let newEntries = "";
for (const [key, value] of Object.entries(fragDict)) {
  newEntries += `  "${key}": { ja: ${JSON.stringify((value as any).ja)}, en: ${JSON.stringify((value as any).en)} },\n`;
}

const match = i18nContent.match(/export const DICT: Record<string, Entry> = \{([\s\S]*?)\n\};/);
if (match) {
  const inner = match[1];
  const newDictString = `export const DICT: Record<string, Entry> = {${inner}\n  // ── Auto Reconstructed Fragments ──\n${newEntries}};`;
  const newContent = i18nContent.replace(match[0], newDictString);
  fs.writeFileSync(dictPath, newContent, "utf-8");
  console.log("Merged fragments safely into lib/i18n.ts");
} else {
  console.error("Could not find DICT in lib/i18n.ts");
}
