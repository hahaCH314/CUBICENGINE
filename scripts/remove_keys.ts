import * as fs from "fs";

const dictPath = "lib/i18n.ts";
const genDictPath = "generated_dict.json";
const keysToRemove = ["editor_a750e9", "editor_6f242a", "editor_7999f1", "editor_74aa97"];

// generated_dict.json から削除
const genDict = JSON.parse(fs.readFileSync(genDictPath, "utf-8"));
for (const key of keysToRemove) {
  delete genDict[key];
}
fs.writeFileSync(genDictPath, JSON.stringify(genDict, null, 2));
console.log("Removed keys from generated_dict.json");

// lib/i18n.ts から削除
let i18nContent = fs.readFileSync(dictPath, "utf-8");
for (const key of keysToRemove) {
  // 正規表現で "editor_xxxx": { ja: "...", en: "..." }, を削除（複数行にまたがる可能性も考慮）
  // ただし、i18n.ts に出力されたのは1行でした。
  const regex = new RegExp(`^\\s*"${key}":\\s*\\{.*?\\},\\n`, "gm");
  i18nContent = i18nContent.replace(regex, "");
}
fs.writeFileSync(dictPath, i18nContent);
console.log("Removed keys from lib/i18n.ts");
