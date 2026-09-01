import { Project, SyntaxKind, StringLiteral, JsxText, NoSubstitutionTemplateLiteral } from "ts-morph";
import * as fs from "fs";
import * as path from "path";

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
});

const sourceFiles = project.getSourceFiles("app/editor/**/*.{ts,tsx}");

const japaneseRegex = /[ぁ-んァ-ン一-龥]/;

interface ExtractedItem {
  file: string;
  line: number;
  text: string;
  type: string;
}

const results: ExtractedItem[] = [];

for (const sourceFile of sourceFiles) {
  const filePath = sourceFile.getFilePath();

  // console.log などの除外関数
  const ignoreCalls = ["console.log", "console.error", "console.warn", "Error"];

  sourceFile.forEachDescendant((node) => {
    let text = "";
    let type = "";

    if (node.isKind(SyntaxKind.StringLiteral)) {
      text = node.getLiteralValue();
      type = "StringLiteral";
      
      // 親が ImportDeclaration なら無視
      if (node.getParentIfKind(SyntaxKind.ImportDeclaration)) return;
      // 親が CallExpression で、ignoreCalls のいずれかなら無視
      const callExpr = node.getFirstAncestorByKind(SyntaxKind.CallExpression);
      if (callExpr) {
        const exp = callExpr.getExpression().getText();
        if (ignoreCalls.includes(exp)) return;
      }
    } else if (node.isKind(SyntaxKind.JsxText)) {
      text = node.getLiteralText();
      type = "JsxText";
    } else if (node.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)) {
      text = node.getLiteralValue();
      type = "TemplateLiteral";
    }

    if (text && japaneseRegex.test(text)) {
      const trimmed = text.trim();
      if (trimmed.length > 0) {
        results.push({
          file: path.relative(process.cwd(), filePath).replace(/\\/g, "/"),
          line: node.getStartLineNumber(),
          text: trimmed,
          type,
        });
      }
    }
  });
}

fs.writeFileSync("japanese_strings.json", JSON.stringify(results, null, 2));
console.log(`Extracted ${results.length} strings to japanese_strings.json`);
