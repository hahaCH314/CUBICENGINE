import * as fs from "fs";
import * as path from "path";
import { Project, Node } from "ts-morph";

const dictPath = "generated_dict.json";
const dict = JSON.parse(fs.readFileSync(dictPath, "utf-8"));

function getJa(key: string) {
  if (dict[key]) return dict[key].ja;
  return key; // fallback
}

const project = new Project({ tsConfigFilePath: "tsconfig.json" });

const files = [
  "app/editor/TutorialOverlay.tsx", "app/editor/ShareDialog.tsx", "app/editor/page.tsx", 
  "app/editor/ModelPanel.tsx", "app/editor/LogicPanel.tsx", "app/editor/HowToInstallModal.tsx", 
  "app/editor/GrapePanel.tsx", "app/editor/form-lab/FormLabHeader.tsx", "app/editor/developer/ModelImport.tsx", 
  "app/editor/developer/MobBuilder.tsx", "app/editor/developer/ItemBuilder.tsx", 
  "app/editor/developer/DeveloperPanel.tsx", "app/editor/CodeRevealOverlay.tsx", 
  "app/editor/card-lab/CardLabHeader.tsx"
];

let newDict: any = {};
let counter = 1;

for (const file of files) {
  if (!fs.existsSync(file)) continue;

  let fileContent = fs.readFileSync(file, "utf-8");
  let fileModified = false;

  let maxIter = 50;
  while (maxIter-- > 0) {
    // 毎度ソースファイルをパースし直す
    const sourceFile = project.createSourceFile("temp.tsx", fileContent, { overwrite: true });
    
    let targetFound = false;
    let replaceStart = -1;
    let replaceEnd = -1;
    let replacement = "";
    let newKey = "";
    let jaTemplate = "";

    function visit(node: Node) {
      if (targetFound) return;
      if (Node.isJsxElement(node) || Node.isJsxFragment(node)) {
        const children = Node.isJsxElement(node) ? node.getJsxChildren() : node.getJsxChildren();
        
        let tCount = 0;
        for (const child of children) {
          if (Node.isJsxExpression(child)) {
            const text = child.getText();
            if (text.includes("t(locale") || text.includes("i18nT(locale") || text.includes("t(useEditorStore")) tCount++;
          }
        }

        if (tCount >= 2 && children.length > 2) {
          jaTemplate = "";
          let argsCode = "";
          let argIndex = 0;
          let canReplace = true;
          let foundT = false;

          for (const child of children) {
            if (Node.isJsxExpression(child)) {
              const exprText = child.getText();
              const match = exprText.match(/(?:t|i18nT)\([^,]+,\s*"([^"]+)"\s*\)/);
              if (match && match[1].startsWith("editor_")) {
                jaTemplate += getJa(match[1]);
                foundT = true;
              } else if (exprText.includes("tNode(")) {
                canReplace = false;
              } else {
                const argName = `arg${argIndex++}`;
                jaTemplate += `{${argName}}`;
                argsCode += `${argName}: ${child.getExpression()?.getText() || child.getText()}, `;
              }
            } else if (Node.isJsxText(child)) {
              const text = child.getFullText();
              if (text.trim() === "" && text.includes("\\n")) {
              } else {
                jaTemplate += text.trim();
              }
            } else if (Node.isJsxElement(child) || Node.isJsxSelfClosingElement(child)) {
              const argName = `arg${argIndex++}`;
              jaTemplate += `{${argName}}`;
              argsCode += `${argName}: ${child.getText()}, `;
            } else {
              canReplace = false;
            }
          }

          if (canReplace && foundT) {
            newKey = "editor_frag_" + Date.now().toString(16) + "_" + (counter++);
            const tNodeName = fileContent.includes("i18nT") ? "tNode" : "tNode";
            replacement = `{${tNodeName}(locale, "${newKey}"`;
            if (argsCode) replacement += `, { ${argsCode.slice(0, -2)} }`;
            replacement += `)}`;

            replaceStart = children[0].getStart();
            replaceEnd = children[children.length - 1].getEnd();
            targetFound = true;
          }
        }
      }
      if (!targetFound) node.forEachChild(visit);
    }

    sourceFile.forEachChild(visit);

    if (targetFound) {
      newDict[newKey] = { ja: jaTemplate, en: jaTemplate };
      fileContent = fileContent.substring(0, replaceStart) + replacement + fileContent.substring(replaceEnd);
      fileModified = true;
    } else {
      break;
    }
  }

  if (fileModified) {
    // import tNode
    if (!fileContent.includes("tNode") && (fileContent.includes('import { t }') || fileContent.includes('import { t as i18nT }'))) {
       fileContent = fileContent.replace(/import\s*\{\s*(t(\s+as\s+i18nT)?)\s*\}/, "import { $1, tNode }");
    }
    fs.writeFileSync(file, fileContent, "utf-8");
    console.log(`Replaced fragments in ${file}`);
  }
}

fs.writeFileSync("fragments_dict.json", JSON.stringify(newDict, null, 2), "utf-8");
console.log("Done generating fragments_dict.json");
