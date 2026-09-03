// 配布物をビルドする前に、コミットされていない変更が無いか確かめる。
//
// なぜ必要か（2026-09-03 の実例）:
//   Microsoft Store 用の .appx をビルドしたところ、なっとうサイダーさんが作業中で
//   まだコミットしていなかった変更が 14 ファイル分、そのまま中に入っていた。
//     ・寄付ページを消した変更（スマホ版の審査対策。Web版から消すつもりは無かった）
//     ・NeoForge エンジンの修正
//     ・差し替え途中の base-mod.jar
//   「これを世に出す」と誰も決めていないコードが、あと一歩で公開されるところだった。
//
//   ビルドは成功する。中身の検査も通る。**誰も気づけない。**
//   気づいたのは、たまたま git status を見たからだった。偶然に頼っている状態。
//
// 何を守るか:
//   出来上がったファイルが、**どのコミットから作られたか言えること。**
//   言えなければ、不具合が出ても何を直せばいいか分からないし、
//   同じものをもう一度作ることもできない。
//
// 参考: docs/RELEASE.md

const { execSync } = require('child_process');

function git(args) {
  return execSync(`git ${args}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function main() {
  let status;
  try {
    status = git('status --porcelain');
  } catch {
    // git が無い／リポジトリ外。CI のランナー等で起こりうるので、ここでは止めない。
    console.warn('[check-clean-tree] git が使えないので確認を飛ばす');
    return;
  }

  if (status === '') {
    const branch = git('rev-parse --abbrev-ref HEAD');
    const commit = git('rev-parse --short HEAD');
    console.log(`[check-clean-tree] OK  ${branch} @ ${commit} から作ります`);
    return;
  }

  const lines = status.split('\n');
  // 先頭2文字が状態。'??' は未追跡（新規作成してまだ git に入れていないファイル）。
  const untracked = lines.filter(l => l.startsWith('??')).length;

  console.error('');
  console.error('  コミットされていない変更があります。このままでは配布物を作れません。');
  console.error('');
  for (const line of lines) {
    console.error(`    ${line}`);
  }
  console.error('');
  console.error(`  変更 ${lines.length} 件（うち未追跡 ${untracked} 件）`);
  console.error('');
  console.error('  出来上がるファイルが「どのコミットのものか」言えなくなります。');
  console.error('  不具合が出ても原因を追えず、同じものを作り直すこともできません。');
  console.error('');
  console.error('  どうするか:');
  console.error('    ・出していい変更なら → コミットしてから、もう一度');
  console.error('    ・まだ途中なら      → git stash で退避してから、もう一度');
  console.error('    ・手元で試すだけなら → MMC_ALLOW_DIRTY=1 を付ける（配ってはいけない）');
  console.error('');

  if (process.env.MMC_ALLOW_DIRTY === '1') {
    console.error('  ⚠️  MMC_ALLOW_DIRTY=1 が指定されたので続行します。');
    console.error('  ⚠️  これは手元で確認するためだけのものです。**絶対に配らないこと。**');
    console.error('');
    return;
  }

  process.exit(1);
}

main();
