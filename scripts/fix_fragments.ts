import * as fs from "fs";
import * as path from "path";

const dictPath = "lib/i18n.ts";
const genDictPath = "generated_dict.json";
const editorDir = "app/editor";

const dict = JSON.parse(fs.readFileSync(genDictPath, "utf-8"));
let i18nContent = fs.readFileSync(dictPath, "utf-8");
let newEntries = "";

// 探索対象
const filesToScan = [
  "TutorialOverlay.tsx", "ShareDialog.tsx", "SettingsPanel.tsx", "page.tsx",
  "ModelPanel.tsx", "LogicPanel.tsx", "HowToInstallModal.tsx", "GrapePanel.tsx",
  "form-lab/FormLabHeader.tsx", "developer/ModelImport.tsx", "developer/MobBuilder.tsx",
  "developer/ItemBuilder.tsx", "developer/DeveloperPanel.tsx", "CodeRevealOverlay.tsx",
  "card-lab/CardLabHeader.tsx"
];

function getOriginalJa(key: string) {
  if (dict[key]) return dict[key].ja;
  // Fallback if not found
  const match = i18nContent.match(new RegExp(`"${key}":\\s*\\{\\s*ja:\\s*"([^"]+)"`));
  if (match) return match[1];
  return key;
}

// プレースホルダーを生成するためのヘルパー
function generateHash(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
  }
  return "editor_c" + Math.abs(hash).toString(16).substring(0, 6);
}

for (const relPath of filesToScan) {
  const filePath = path.join(editorDir, relPath);
  if (!fs.existsSync(filePath)) continue;
  
  let content = fs.readFileSync(filePath, "utf-8");
  let modified = false;
  
  // 1行ずつパースする簡単な方法
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // t(locale, や i18nT(locale, が3回以上あるかチェック
    const tCount = (line.match(/(t|i18nT)\([^,]+,\s*"editor_/g) || []).length;
    if (tCount >= 3) {
      console.log(`Found fragmented line in ${relPath}:${i + 1}`);
      
      // 行全体を一つのコンポーネント列とみなしてパース
      // 例: <code>...</code> {t(locale, "key")} <b>...</b>
      // 正規表現で {t(...)} と それ以外のタグ（またはテキスト）を分ける
      // かなり強引だが、今回はタグのネストが1行内で完結しているケースがほとんど。
      
      const parts = [];
      let currentText = line;
      let argCount = 0;
      const argsMap: Record<string, string> = {};
      let jaTemplate = "";
      
      // {t(locale, "editor_xxx")} を見つけて置換していく
      const tRegex = /\{(?:t|i18nT)\([^,]+,\s*"([^"]+)"\)\}/g;
      
      // 元の行から {t...} 以外の部分を引数として抽出する。
      // JSXでは <b>...</b> や {変数} が並んでいる。
      // これを正しく分割するのは正規表現では限界がある。
      // そこで、今回は "t(locale, "xxx") を除いた部分全体" をうまくパースする。
      
      // 簡易的アプローチ：
      // 行内にあるJSX要素（<...>...</...> や {変数}）と {t(...)} を順に配列化する。
      const tokenRegex = /(<[a-zA-Z0-9]+[^>]*>.*?<\/[a-zA-Z0-9]+>|\{[a-zA-Z0-9_\.]+\}|\{(?:t|i18nT)\([^,]+,\s*"[^"]+"\)\})/g;
      
      let newJaTemplate = "";
      let newArgsStr = "";
      
      // トークン分割でうまくいかないケース（プレーンテキストが含まれているなど）を考慮し、
      // 実際には手作業で修正した方が安全かもしれないが、ここではスクリプトでできる限り試みる。
    }
  }
}
