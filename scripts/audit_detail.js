const fs = require('fs');
const path = require('path');

// codegen で使われる保存値（翻訳してはいけないキー）
const CODEGEN_KEYS = new Set([
  '加算', '減算', 'セット', 'リセット', '追加', '削除',
  '当たった', '飛んでいる', '水中', '地上', 'スニーク中', 'ダッシュ中',
  'プレイヤー', 'コアエンティティ', '全員', '自分',
  'ランダム', '合計', '乗算', '除算', '最大', '最小',
]);

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
        const jpMatch = codePart.match(/[\u3041-\u30FF\u4E00-\u9FAF]+/g);
        if (!jpMatch) return;
        if (!/[<>{}=:,"]/.test(codePart)) return;
        if (codePart.includes('editor_') || codePart.includes('t(') || codePart.includes('i18nT(') || codePart.includes('tNode(')) return;
        
        // codegenキーのみ含む行はスキップ
        const allJp = jpMatch.every(m => CODEGEN_KEYS.has(m));
        if (allJp) return;

        const fname = full.replace('E:\\MMC\\CUBIC_ENGINE\\', '');
        if (!results[fname]) results[fname] = [];
        results[fname].push({ line: i+1, text: line.trim().slice(0, 100) });
      });
    }
  }
}

walk('app/editor');

// ファイルごとのサンプルを表示
const sorted = Object.entries(results).sort((a, b) => b[1].length - a[1].length);
let total = 0;
console.log('=== codegen保存値を除外した残存日本語 ===\n');
for (const [file, items] of sorted) {
  console.log(`\n[${items.length}件] ${file}`);
  items.slice(0, 5).forEach(r => console.log(`  L${r.line}: ${r.text}`));
  if (items.length > 5) console.log(`  ... ${items.length - 5}件省略`);
  total += items.length;
}
console.log('\nTOTAL: ' + total + ' 件 / ' + sorted.length + ' ファイル');
