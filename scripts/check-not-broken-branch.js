// このブランチ（feature/i18n-editor-auto）からの配布物ビルドを止める。
//
// なぜ必要か（2026-09-04 の実例）:
//   このブランチから作った Android 版をクローズドテストに上げてしまい、
//   実機でエディタの表示が崩れているのが見つかった。
//   カードに {arg0} {arg1} という文字がそのまま出る状態だった。
//
//   原因は scripts/refactor_fragments.ts が JSX を翻訳関数の引数へ詰め込んだこと。
//   **型チェックもビルドも通る。** 画面に出すまで分からない。
//   README と AGENTS.md にも書いたが、文書は読まれないことがある（実際に読まれなかった）。
//   だから機械で止める。
//
// 判定は「ブランチ名」ではなく「壊れている中身があるか」で行う。
// ブランチ名を変えても、中身が壊れていれば止まる。

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

// 辞書に {argN} を含む項目があれば、JSX を引数へ詰め込む変換が当たっている。
// main には 0 件。
const dictPath = path.join(root, 'lib/i18n.ts');
let hits = 0;
try {
  const src = fs.readFileSync(dictPath, 'utf8');
  hits = (src.match(/\{arg\d+\}/g) || []).length;
} catch {
  console.warn('[check-not-broken-branch] lib/i18n.ts を読めないので確認を飛ばす');
  process.exit(0);
}

if (hits === 0) {
  console.log('[check-not-broken-branch] OK  壊れた i18n 変換は入っていません');
  process.exit(0);
}

console.error('');
console.error('  ⛔ このコードからは配布物を作れません。');
console.error('');
console.error(`  辞書に {argN} を含む項目が ${hits} 件あります。`);
console.error('  JSX を翻訳関数の引数へ詰め込む変換（refactor_fragments.ts）が当たっています。');
console.error('');
console.error('  この状態でビルドすると、エディタのカードに {arg0} {arg1} がそのまま出ます。');
console.error('  ⚠️ 型チェックもビルドも通ります。画面に出すまで分かりません。');
console.error('     2026-09-04、これに気づかず Android 版をクローズドテストに上げました。');
console.error('');
console.error('  どうするか:');
console.error('    ・配布物を作るなら → main から作ってください');
console.error('    ・やり直すなら     → README.md の冒頭を読んでください');
console.error('');
process.exit(1);
