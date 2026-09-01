import { Project, SyntaxKind, Node, JsxElement, JsxFragment, JsxExpression } from "ts-morph";
import * as fs from "fs";

const dictPath = "lib/i18n.ts";
const genDictPath = "generated_dict.json";
const dict = JSON.parse(fs.readFileSync(genDictPath, "utf-8"));

// lib/i18n.ts から元の日本語を探すフォールバック
let i18nContent = fs.readFileSync(dictPath, "utf-8");
function getJa(key: string) {
  if (dict[key]) return dict[key].ja;
  const match = i18nContent.match(new RegExp(`"${key}":\\s*\\{\\s*ja:\\s*"([^"]+)"`));
  if (match) return match[1];
  return key;
}

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
});

let newEntries = "";
let counter = 1;

// 対象ファイルを追加
const files = [
  "app/editor/TutorialOverlay.tsx", "app/editor/ShareDialog.tsx", "app/editor/SettingsPanel.tsx", 
  "app/editor/page.tsx", "app/editor/ModelPanel.tsx", "app/editor/LogicPanel.tsx", 
  "app/editor/HowToInstallModal.tsx", "app/editor/GrapePanel.tsx", "app/editor/form-lab/FormLabHeader.tsx", 
  "app/editor/developer/ModelImport.tsx", "app/editor/developer/MobBuilder.tsx", 
  "app/editor/developer/ItemBuilder.tsx", "app/editor/developer/DeveloperPanel.tsx", 
  "app/editor/CodeRevealOverlay.tsx", "app/editor/card-lab/CardLabHeader.tsx"
];

for (const file of files) {
  if (fs.existsSync(file)) project.addSourceFileAtPath(file);
}

for (const sourceFile of project.getSourceFiles()) {
  let modified = false;

  // JsxElement や JsxFragment の children を走査する再帰関数
  function processNode(node: Node) {
    node.forEachChild(processNode);

    if (Node.isJsxElement(node) || Node.isJsxFragment(node)) {
      // 内部に JsxElement 等が含まれる場合があるが、ここでは children を見る
      // Node.isJsxElement の場合、getChildren() ではなく getJsxChildren()
      const children = Node.isJsxElement(node) ? node.getJsxChildren() : node.getJsxChildren();
      
      // childrenの中に {t(...)} が2つ以上あるかチェック
      let tCount = 0;
      for (const child of children) {
        if (Node.isJsxExpression(child)) {
          const text = child.getText();
          if (text.includes("t(locale") || text.includes("i18nT(locale")) tCount++;
        }
      }

      // tCount >= 2 かつ childrenに他の要素も混ざっている場合、結合する
      if (tCount >= 2) {
        let jaTemplate = "";
        let argsCode = "";
        let argIndex = 0;
        let canReplace = true;
        let foundT = false;

        for (const child of children) {
          if (Node.isJsxExpression(child)) {
            const exprText = child.getText();
            const match = exprText.match(/(?:t|i18nT)\(\s*(?:locale|useEditorStore\.getState\(\)\.locale),\s*"([^"]+)"\s*\)/);
            if (match && match[1].startsWith("editor_")) {
              jaTemplate += getJa(match[1]);
              foundT = true;
            } else {
              // t(...) 以外の {変数} など
              const argName = `arg${argIndex++}`;
              jaTemplate += `{${argName}}`;
              argsCode += `${argName}: ${child.getExpression()?.getText() || child.getText()}, `;
            }
          } else if (Node.isJsxText(child)) {
            const text = child.getFullText();
            // 単なる改行やスペースだけの場合は残すか無視する
            if (text.trim() === "") {
               // jaTemplate += text; // 空白は無視するか
            } else {
               jaTemplate += text.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "").trim();
            }
          } else if (Node.isJsxElement(child) || Node.isJsxSelfClosingElement(child)) {
            const argName = `arg${argIndex++}`;
            jaTemplate += `{${argName}}`;
            argsCode += `${argName}: ${child.getText()}, `;
          } else {
            // 解析できない要素があれば中止
            canReplace = false;
          }
        }

        if (canReplace && foundT) {
          const newKey = "editor_frag_" + Date.now().toString(16) + "_" + (counter++);
          const tNodeName = sourceFile.getText().includes("i18nT") ? "tNode" : "tNode";
          
          let replacement = `{${tNodeName}(locale, "${newKey}"`;
          if (argsCode) replacement += `, { ${argsCode.slice(0, -2)} }`;
          replacement += `)}`;

          // 辞書への追加準備
          newEntries += `  "${newKey}": { ja: "${jaTemplate}", en: "${jaTemplate}" },\n`;
          dict[newKey] = { ja: jaTemplate, en: jaTemplate };

          // node の中身を丸ごと置き換えることは ts-morph では複雑。
          // JSXElementの場合、開始タグと終了タグの間に置き換えたテキストをセットするAPIはないため、
          // text replacement で無理やり行う
          
          // ts-morphで childrenを一括置換する関数:
          // めんどくさいので、ファイル全体としてテキスト置換する情報を集めるのが安全。
          // ここでは直接 text 置換する
        }
      }
    }
  }
}
