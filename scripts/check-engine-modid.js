// 同梱している base-mod*.jar に焼かれている modId と、
// lib/javaEngine/spec.ts の ENGINE_MOD_ID が一致しているか確かめる。
//
// なぜ必要か:
//   docs/ヒマワリへ_Java注入方式の引き継ぎ.md にこう書かれている。
//
//     ⚠️ もし今後エンジンを再ビルドして別の modId にするときは、
//        lib/javaEngine/spec.ts の ENGINE_MOD_ID も**同時に**直してください。
//        1文字違うだけで、MODは起動するのに何も動きません。
//
//   「起動するのに何も動かない」＝エラーが出ない。ログにも出ない。
//   マイクラで遊んでみて「あれ、何も起きない」で初めて気づく。人間には追えない。
//   ズレようがない形にはできないので、**ズレたら止まる**ようにする。
//
//   エンジンの .jar は別リポジトリ(generic_engine / generic_engine_neo)で
//   ビルドして public/ に置く運用なので、片方だけ更新される瞬間が必ず存在する。
//
//   使い方: npm run check:modid

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const root = path.join(__dirname, '..');

// 検査するjar。無いものは飛ばす（neo はまだ無い時期があった）。
const JARS = ['public/base-mod.jar', 'public/base-mod-neo.jar'];

function readEngineModId() {
  const specPath = path.join(root, 'lib/javaEngine/spec.ts');
  const src = fs.readFileSync(specPath, 'utf8');
  const m = src.match(/ENGINE_MOD_ID\s*=\s*["']([^"']+)["']/);
  if (!m) throw new Error(`lib/javaEngine/spec.ts から ENGINE_MOD_ID を読めません`);
  return m[1];
}

async function main() {
  const modId = readEngineModId();
  console.log(`spec.ts の ENGINE_MOD_ID: ${modId}`);

  let checked = 0;
  let failed = false;

  for (const rel of JARS) {
    const jarPath = path.join(root, rel);
    if (!fs.existsSync(jarPath)) {
      console.log(`  - ${rel} は無いので飛ばす`);
      continue;
    }

    const zip = await JSZip.loadAsync(fs.readFileSync(jarPath));
    const classNames = Object.keys(zip.files).filter(n => n.endsWith('.class') && !zip.files[n].dir);
    if (classNames.length === 0) {
      console.error(`  ✗ ${rel} に .class が1つも入っていない。jar が壊れている`);
      failed = true;
      continue;
    }

    // .class のどれかに、その文字列がそのまま焼かれていれば一致とみなす。
    // （定数プールに UTF-8 でそのまま入っているので、バイト列を探せば足りる）
    const needle = Buffer.from(modId, 'utf8');
    let hit = false;
    for (const name of classNames) {
      const buf = Buffer.from(await zip.files[name].async('uint8array'));
      if (buf.includes(needle)) { hit = true; break; }
    }

    if (hit) {
      console.log(`  ✓ ${rel}（.class ${classNames.length}個）`);
      checked++;
    } else {
      console.error(`  ✗ ${rel} に "${modId}" が入っていない`);
      failed = true;
    }
  }

  if (checked === 0 && !failed) {
    console.error('検査対象の jar が1つも無い');
    process.exit(1);
  }

  if (failed) {
    console.error('');
    console.error('  同梱の jar と spec.ts の ENGINE_MOD_ID がズレています。');
    console.error('  このまま出すと、MODは起動しますが**何も動きません**（エラーも出ません）。');
    console.error('');
    console.error('  エンジンを再ビルドしたなら、lib/javaEngine/spec.ts の ENGINE_MOD_ID を');
    console.error('  新しい jar に焼かれている値に合わせてください。');
    console.error('');
    process.exit(1);
  }

  console.log('一致しています');
}

main().catch(e => { console.error(e.message); process.exit(1); });
