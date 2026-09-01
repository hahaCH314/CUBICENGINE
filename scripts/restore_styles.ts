import * as fs from "fs";
import * as path from "path";

const dictPath = "generated_dict.json";
const dict = JSON.parse(fs.readFileSync(dictPath, "utf-8"));

const targets = [
  { file: "app/editor/LogicPanel.tsx", key: "editor_a750e9" },
  { file: "app/editor/LogicPanel.tsx", key: "editor_6f242a" },
  { file: "app/editor/LiveStage.tsx", key: "editor_7999f1" },
  { file: "app/editor/TutorialOverlay.tsx", key: "editor_74aa97" },
];

for (const target of targets) {
  if (fs.existsSync(target.file)) {
    let content = fs.readFileSync(target.file, "utf-8");
    const originalText = dict[target.key].ja;
    // <style>{t(locale, "key")}</style> などを検索
    const regex1 = new RegExp(`<style>\\s*\\{\\s*t\\([^,]+,\\s*"${target.key}"\\s*\\)\\s*\\}\\s*<\\/style>`, "g");
    const regex2 = new RegExp(`<style>\\s*\\{\\s*i18nT\\([^,]+,\\s*"${target.key}"\\s*\\)\\s*\\}\\s*<\\/style>`, "g");
    
    // 元のテキストをバッククォートで囲む（元のリテラルもバッククォートだった）
    // CSS文字列の中に \ がある場合はエスケープが必要かも？
    // ts-morphで抽出したときにエスケープが解除されている可能性があるので、元のまま出力してみる。
    // \ や ` をエスケープする
    const escapedText = originalText.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
    const replacement = `<style>{\`${escapedText}\`}</style>`;

    content = content.replace(regex1, replacement);
    content = content.replace(regex2, replacement);
    
    fs.writeFileSync(target.file, content, "utf-8");
    console.log(`Restored style for ${target.key} in ${target.file}`);
  }
}
