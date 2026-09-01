const fs = require('fs');
const path = require('path');
const results = [];

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
        // 1. style タグに t() や i18nT() が残っていないか
        if (/<style>.*t\(/.test(line) || /<style>.*i18nT\(/.test(line)) {
          results.push({ file: full, line: i+1, type: 'CSS_IN_DICT', text: line.trim().slice(0,100) });
        }
        // 2. 1文字日本語キー（助詞）の検出
        const m1 = line.match(/t\(["'][\u3041-\u3096\u30A1-\u30FA\u4E00-\u9FAF]["']\)/);
        if (m1) {
          results.push({ file: full, line: i+1, type: 'SINGLE_CHAR_KEY', text: line.trim().slice(0,100) });
        }
        // 3. 辞書を通さない生の日本語がJSXに含まれているか（コメント・文字列・翻訳済みを除外）
        const codePart = line.split('//')[0];
        const jpMatch = codePart.match(/[\u3041-\u30FF\u4E00-\u9FAF]/);
        if (jpMatch && /[<>{}]/.test(codePart) && !codePart.includes('editor_') && !codePart.includes('t(') && !codePart.includes('i18nT(') && !codePart.includes('tNode(')) {
          results.push({ file: full, line: i+1, type: 'RAW_JP_IN_JSX', text: line.trim().slice(0,100) });
        }
      });
    }
  }
}

walk('app/editor');

const byType = {};
for (const r of results) {
  if (!byType[r.type]) byType[r.type] = [];
  byType[r.type].push(r);
}

for (const [type, items] of Object.entries(byType)) {
  console.log('\n=== ' + type + ' (' + items.length + ') ===');
  items.slice(0, 10).forEach(r => console.log(r.file.replace('E:\\MMC\\CUBIC_ENGINE\\', '') + ':' + r.line + '  ' + r.text));
  if (items.length > 10) console.log('  ... and ' + (items.length - 10) + ' more');
}

console.log('\n=== TOTAL ===');
for (const [type, items] of Object.entries(byType)) {
  console.log(type + ': ' + items.length);
}
if (Object.keys(byType).length === 0) console.log('No issues found!');
