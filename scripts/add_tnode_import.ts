import * as fs from "fs";

const files = [
  "app/editor/card-lab/CardLabHeader.tsx",
  "app/editor/CodeRevealOverlay.tsx",
  "app/editor/developer/DeveloperPanel.tsx",
  "app/editor/developer/ItemBuilder.tsx",
  "app/editor/developer/MobBuilder.tsx",
  "app/editor/developer/ModelImport.tsx",
  "app/editor/form-lab/FormLabHeader.tsx",
  "app/editor/GrapePanel.tsx",
  "app/editor/HowToInstallModal.tsx",
  "app/editor/LogicPanel.tsx",
  "app/editor/ModelPanel.tsx",
  "app/editor/SettingsPanel.tsx",
  "app/editor/ShareDialog.tsx",
  "app/editor/TutorialOverlay.tsx"
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, "utf-8");
  
  const importRegex = /import\s*\{([^}]*)\}\s*from\s*["']@\/lib\/i18n["']/g;
  content = content.replace(importRegex, (match, imports) => {
    if (imports.includes("tNode")) return match;
    return `import { ${imports.trim()}, tNode } from "@/lib/i18n"`;
  });
  fs.writeFileSync(file, content, "utf-8");
  console.log(`Updated imports in ${file}`);
}
