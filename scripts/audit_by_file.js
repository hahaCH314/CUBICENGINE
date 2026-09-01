const fs = require('fs');
const path = require('path');
const results = {};

function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch(e) { return; }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === '.next') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (/\.(tsx?|js)$/.test(e.name)) {
      const content = fs.readFileSync(full, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, i) => {
        const codePart = line.split('//')[0];
        const jpMatch = codePart.match(/[\u3041-\u30FF\u4E00-\u9FAF]/);
        if (jpMatch && /[<>{}]/.test(codePart) && !codePart.includes('editor_') && !codePart.includes('t(') && !codePart.includes('i18nT(') && !codePart.includes('tNode(')) {
          const fname = full.replace('E:\\MMC\\CUBIC_ENGINE\\', '');
          if (!results[fname]) results[fname] = [];
          results[fname].push({ line: i+1, text: line.trim().slice(0, 100) });
        }
      });
    }
  }
}

walk('app/editor');

let total = 0;
const sorted = Object.entries(results).sort((a, b) => b[1].length - a[1].length);
console.log('=== 未翻訳日本語が残るファイル (RAW_JP_IN_JSX) ===\n');
for (const [file, items] of sorted) {
  console.log(`[${items.length}件] ${file}`);
  total += items.length;
}
console.log('\nTOTAL: ' + total + ' 件 / ' + sorted.length + ' ファイル');
