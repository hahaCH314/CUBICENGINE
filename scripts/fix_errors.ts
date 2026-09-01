import * as fs from "fs";
import * as path from "path";

// 1. exporter.ts の修正
const exporterPath = "app/editor/exporter.ts";
if (fs.existsSync(exporterPath)) {
  let content = fs.readFileSync(exporterPath, "utf-8");
  if (!content.includes("import { useEditorStore }")) {
    // インポートを追加
    content = 'import { useEditorStore } from "./store";\n' + content;
    fs.writeFileSync(exporterPath, content);
    console.log("Fixed exporter.ts");
  }
}

// 2. GrapePanel.tsx, LiveStage.tsx の t 変数衝突を i18nT に変更
const filesToFixT = ["app/editor/GrapePanel.tsx", "app/editor/LiveStage.tsx"];
for (const file of filesToFixT) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, "utf-8");
    // インポート文を修正
    content = content.replace(/import { t } from "@\/lib\/i18n";/g, 'import { t as i18nT } from "@/lib/i18n";');
    content = content.replace(/import { t } from "\.\.\/\.\.\/lib\/i18n";/g, 'import { t as i18nT } from "../../lib/i18n";');
    content = content.replace(/import { t } from "\.\.\/lib\/i18n";/g, 'import { t as i18nT } from "../lib/i18n";');
    
    // t(locale, を i18nT(locale, に置換
    // 正規表現で、t( の前が単語でない（ドットや文字でない）ことを確認
    content = content.replace(/(?<!\w)t\s*\(\s*(locale|useEditorStore\.getState\(\)\.locale)/g, "i18nT($1");
    
    fs.writeFileSync(file, content);
    console.log(`Fixed t conflict in ${file}`);
  }
}

// 3. CardLab.tsx を元に戻す
const cardLabPath = "app/editor/card-lab/CardLab.tsx";
// git checkout する方が確実
