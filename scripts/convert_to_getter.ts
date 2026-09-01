import * as fs from "fs";
import * as path from "path";

const files = [
  "app/editor/worldThemes.ts",
  "app/editor/page.tsx",
  "app/editor/ModelPanel.tsx",
  "app/editor/LogicPanel.tsx",
  "app/editor/LiveStage.tsx",
  "app/editor/GrapePanel.tsx",
  "app/editor/FormBuilder.tsx",
  "app/editor/exporter.ts",
  "app/editor/developer/MobBuilder.tsx"
];

let totalReplaced = 0;

for (const relPath of files) {
  const filePath = path.resolve(relPath);
  if (!fs.existsSync(filePath)) continue;
  
  if (relPath.includes("exporter.ts")) {
    // 指示により exporter.ts はスキップ
    continue;
  }

  let content = fs.readFileSync(filePath, "utf-8");
  
  // 置換する正規表現：
  // propName: t(useEditorStore.getState().locale, "editor_xxx")
  // これを get propName() { return t(...); } にする
  // i18nT も考慮
  const regex = /([a-zA-Z0-9_]+)\s*:\s*((?:t|i18nT)\(useEditorStore\.getState\(\)\.locale,\s*"[^"]+"\))/g;
  
  const newContent = content.replace(regex, (match, propName, tCall) => {
    totalReplaced++;
    return `get ${propName}() { return ${tCall}; }`;
  });

  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, "utf-8");
    console.log(`Replaced in ${relPath}`);
  }
}

console.log(`Total replaced: ${totalReplaced}`);
