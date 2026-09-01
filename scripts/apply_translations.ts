import * as fs from "fs";

const dictPath = "lib/i18n.ts";
const genDictPath = "generated_dict.json";

const i18nContent = fs.readFileSync(dictPath, "utf-8");
const dict = JSON.parse(fs.readFileSync(genDictPath, "utf-8"));

let newEntries = "";
for (const [key, value] of Object.entries(dict)) {
  const ja = JSON.stringify((value as any).ja);
  const en = JSON.stringify((value as any).en);
  newEntries += `  "${key}": { ja: ${ja}, en: ${en} },\n`;
}

// 既存の DICT の中身を丸ごと置き換える
const match = i18nContent.match(/export const DICT: Record<string, Entry> = \{[\s\S]*?\};/);
if (match) {
  const newDictString = `export const DICT: Record<string, Entry> = {\n${newEntries}};`;
  const newContent = i18nContent.replace(match[0], newDictString);
  fs.writeFileSync(dictPath, newContent, "utf-8");
  console.log("Successfully applied all translations to lib/i18n.ts");
} else {
  console.error("Could not find DICT in lib/i18n.ts");
}
