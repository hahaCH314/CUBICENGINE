import { Project, SyntaxKind, StringLiteral, JsxText, NoSubstitutionTemplateLiteral, FunctionDeclaration, ArrowFunction, Block, Node } from "ts-morph";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const project = new Project({
  tsConfigFilePath: "tsconfig.json",
});

const sourceFiles = project.getSourceFiles("app/editor/**/*.{ts,tsx}");
const japaneseRegex = /[ぁ-んァ-ン一-龥]/;
const ignoreCalls = ["console.log", "console.error", "console.warn", "Error"];

// 生成された辞書
const dictionary: Record<string, { ja: string; en: string }> = {};

function generateKey(text: string): string {
  // ハッシュを使って一意なキーにする (editor_xxxx)
  const hash = crypto.createHash("md5").update(text).digest("hex").slice(0, 6);
  return `editor_${hash}`;
}

// Reactコンポーネント/フック関数を探す
function findReactFunctionEnclosing(node: Node): FunctionDeclaration | ArrowFunction | undefined {
  let current: Node | undefined = node.getParent();
  while (current) {
    if (current.isKind(SyntaxKind.FunctionDeclaration) || current.isKind(SyntaxKind.ArrowFunction)) {
      // コンポーネント（大文字始まり）またはフック（use始まり）なら採用
      const name = current.isKind(SyntaxKind.FunctionDeclaration) ? current.getName() : undefined;
      // ArrowFunctionの場合は変数宣言を親に持つか確認
      let varName: string | undefined;
      if (current.isKind(SyntaxKind.ArrowFunction)) {
         const varDecl = current.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
         if (varDecl) varName = varDecl.getName();
      }

      const fnName = name || varName;
      if (fnName && (fnName.match(/^[A-Z]/) || fnName.startsWith("use"))) {
        return current;
      }
    }
    current = current.getParent();
  }
  return undefined;
}

// 関数のブロックの先頭に const locale = ... を挿入
function injectLocaleHook(funcNode: FunctionDeclaration | ArrowFunction) {
  const body = funcNode.getBody();
  if (body && body.isKind(SyntaxKind.Block)) {
    const block = body as Block;
    const statements = block.getStatements();
    const hasLocale = statements.some(s => s.getText().includes("const locale = useEditorStore"));
    if (!hasLocale) {
      block.insertStatements(0, "const locale = useEditorStore((s) => s.locale);");
    }
  }
}

// インポートを追加
function addImports(sourceFile: any) {
  const importDecls = sourceFile.getImportDeclarations();
  const hasI18n = importDecls.some((i: any) => i.getModuleSpecifierValue().includes("lib/i18n"));
  const hasStore = importDecls.some((i: any) => i.getModuleSpecifierValue().includes("store"));

  if (!hasI18n) {
    sourceFile.addImportDeclaration({
      namedImports: ["t"],
      moduleSpecifier: "@/lib/i18n",
    });
  }
  if (!hasStore) {
    sourceFile.addImportDeclaration({
      namedImports: ["useEditorStore"],
      moduleSpecifier: "@/app/editor/store",
    });
  }
}

for (const sourceFile of sourceFiles) {
  const filePath = sourceFile.getFilePath();
  if (filePath.includes("store.ts") || filePath.includes("exporter.ts") || filePath.includes("page.tsx")) {
    // 複雑なファイルは手動対応推奨のため今回はスキップするかどうか...
    // exporter.tsはReactコンポーネントではないので hooks が使えない
    // 今回はそのまま走らせてみる。
  }

  let requireImports = false;

  // 後ろから置換していく（インデックスずれを防ぐため）
  const nodesToReplace: { node: Node; text: string; type: string }[] = [];

  sourceFile.forEachDescendant((node) => {
    let text = "";
    let type = "";

    if (node.isKind(SyntaxKind.StringLiteral)) {
      text = node.getLiteralValue();
      type = "StringLiteral";
      if (node.getParentIfKind(SyntaxKind.ImportDeclaration)) return;
      const callExpr = node.getFirstAncestorByKind(SyntaxKind.CallExpression);
      if (callExpr && ignoreCalls.includes(callExpr.getExpression().getText())) return;
      
      // オブジェクトのキー(PropertyAssignmentのname部分)は置換できない
      if (node.getParentIfKind(SyntaxKind.PropertyAssignment)) {
        const prop = node.getParentIfKind(SyntaxKind.PropertyAssignment);
        if (prop && prop.getNameNode() === node) return; // キーの場合はスキップ
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
        nodesToReplace.push({ node, text: trimmed, type });
      }
    }
  });

  // ノードの後ろから処理する
  nodesToReplace.reverse().forEach(({ node, text, type }) => {
    const key = generateKey(text);
    if (!dictionary[key]) {
      dictionary[key] = { ja: text, en: text }; // とりあえずenも同じにしておく
    }

    const reactFunc = findReactFunctionEnclosing(node);
    let useHook = false;
    if (reactFunc) {
      injectLocaleHook(reactFunc);
      useHook = true;
    }

    // React外の関数の場合は locale="ja" と仮定するか、Zustandから直接取るなどの工夫が必要
    const localeRef = useHook ? "locale" : "useEditorStore.getState().locale";
    
    try {
      if (type === "JsxText") {
        const parent = node.getParent();
        if (parent && (parent.isKind(SyntaxKind.JsxElement) || parent.isKind(SyntaxKind.JsxFragment))) {
           node.replaceWithText(`{t(${localeRef}, "${key}")}`);
        } else {
           node.replaceWithText(`t(${localeRef}, "${key}")`); // JSXAttributeなどの場合
        }
      } else if (type === "StringLiteral" || type === "TemplateLiteral") {
        // StringLiteralがJSX属性の値である場合、JSXExpressionにラップする必要がある
        const parent = node.getParent();
        if (parent && parent.isKind(SyntaxKind.JsxAttribute)) {
          node.replaceWithText(`{t(${localeRef}, "${key}")}`);
        } else {
          node.replaceWithText(`t(${localeRef}, "${key}")`);
        }
      }
      requireImports = true;
    } catch (e) {
      console.error(`Failed to replace text in ${filePath}:`, e);
    }
  });

  if (requireImports) {
    addImports(sourceFile);
  }
}

// 変更を保存
project.saveSync();
console.log("Successfully replaced strings in files.");

// 辞書をJSONとして出力
fs.writeFileSync("generated_dict.json", JSON.stringify(dictionary, null, 2));
console.log(`Generated dictionary with ${Object.keys(dictionary).length} keys to generated_dict.json`);
