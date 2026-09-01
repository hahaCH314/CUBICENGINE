import * as fs from "fs";

let content = fs.readFileSync("lib/i18n.ts", "utf-8");

// tNode のシグネチャを変更
content = content.replace(
  /export function tNode\(locale: Locale, key: string, params: Record<string, ReactNode>\): ReactNode \{/g,
  "export function tNode(locale: Locale, key: string, params?: Record<string, any>): ReactNode {"
);

// pKey in params の部分を params が undefined でも動くように変更
content = content.replace(
  /if \(pKey in params\) \{/g,
  "if (params && pKey in params) {"
);

fs.writeFileSync("lib/i18n.ts", content, "utf-8");
console.log("Updated lib/i18n.ts");
