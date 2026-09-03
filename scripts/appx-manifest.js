// electron-builder の appxManifestCreated フック。
//
// なぜ必要か:
//   MSIX/AppX にすると、Windows は %APPDATA%\Roaming への書き込みを
//   %LOCALAPPDATA%\Packages\<PFN>\LocalCache\Roaming へ自動リダイレクトする。
//   GROVE は electron/main.js で %APPDATA%\Roaming\.minecraft\mods に jar を置くので、
//   既定のままだと「書けたのに Minecraft から見えない」状態になり、
//   docs/WIN_STRATEGY.md の負け筋1（作る→マイクラに入る が折れる）を踏む。
//   読み取りはリダイレクト先に無ければ実体へ抜けるため existsSync は true を返し、
//   失敗が表に出ない。だから必ず仮想化を切る。
//
// 参考: https://learn.microsoft.com/windows/msix/desktop/flexible-virtualization

const fs = require('fs');

const DESKTOP6_NS = 'http://schemas.microsoft.com/appx/manifest/desktop/windows10/6';

// desktop6 の仮想化プロパティは Windows 10 2004 (10.0.19041.0) 以降。
const MIN_VERSION = '10.0.19041.0';

// MaxVersionTested は MinVersion 以上である必要がある。Windows 11 22H2 を上限として申告する。
const MAX_VERSION_TESTED = '10.0.22621.0';

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff < 0 ? -1 : 1;
  }
  return 0;
}

module.exports = async function appxManifestCreated(manifestPath) {
  const original = fs.readFileSync(manifestPath, 'utf8');
  let manifest = original;

  // 1) desktop6 名前空間を宣言する。
  //    あわせて IgnorableNamespaces に入れる。electron-builder が同梱する makeappx は古く、
  //    desktop6 を知らないため、これが無いと "package manifest is not valid" で pack に失敗する。
  //    IgnorableNamespaces は「この名前空間を知らない処理系は読み飛ばしてよい」という指定なので、
  //    desktop6 を知っている Windows 10 2004 以降では通常どおり適用される。
  if (!manifest.includes(DESKTOP6_NS)) {
    const anchor = 'xmlns:rescap=';
    if (!manifest.includes(anchor)) {
      throw new Error(`AppxManifest に ${anchor} が見つかりません。electron-builder のテンプレートが変わった可能性があります。`);
    }
    manifest = manifest.replace(anchor, `xmlns:desktop6="${DESKTOP6_NS}"\n   ${anchor}`);
  }

  if (!/IgnorableNamespaces=/.test(manifest)) {
    const rescapAnchor = /(xmlns:rescap="[^"]*")/;
    if (!rescapAnchor.test(manifest)) {
      throw new Error('AppxManifest に xmlns:rescap の宣言が見つかりません。');
    }
    manifest = manifest.replace(rescapAnchor, '$1\n   IgnorableNamespaces="desktop6"');
  } else if (!/IgnorableNamespaces="[^"]*desktop6/.test(manifest)) {
    manifest = manifest.replace(/IgnorableNamespaces="([^"]*)"/, 'IgnorableNamespaces="$1 desktop6"');
  }

  // 2) ファイル/レジストリ書き込みの仮想化を切る（Properties の末尾に置く必要がある）
  if (!manifest.includes('FileSystemWriteVirtualization')) {
    if (!manifest.includes('</Properties>')) {
      throw new Error('AppxManifest に </Properties> が見つかりません。');
    }
    manifest = manifest.replace(
      '</Properties>',
      '  <desktop6:FileSystemWriteVirtualization>disabled</desktop6:FileSystemWriteVirtualization>\n' +
      '    <desktop6:RegistryWriteVirtualization>disabled</desktop6:RegistryWriteVirtualization>\n' +
      '  </Properties>'
    );
  }

  // 3) desktop6 を使うので MinVersion を引き上げる。
  //    MaxVersionTested は electron-builder の既定が 10.0.14316.0 と古く、
  //    そのままだと MaxVersionTested < MinVersion の矛盾で makeappx が pack に失敗するので併せて上げる。
  const minVersionPattern = /(<TargetDeviceFamily\b[^>]*\bMinVersion=")([^"]+)(")/;
  if (!minVersionPattern.test(manifest)) {
    throw new Error('AppxManifest に TargetDeviceFamily の MinVersion が見つかりません。');
  }
  manifest = manifest.replace(minVersionPattern, `$1${MIN_VERSION}$3`);

  const maxVersionPattern = /(<TargetDeviceFamily\b[^>]*\bMaxVersionTested=")([^"]+)(")/;
  if (!maxVersionPattern.test(manifest)) {
    throw new Error('AppxManifest に TargetDeviceFamily の MaxVersionTested が見つかりません。');
  }
  manifest = manifest.replace(maxVersionPattern, (match, head, current, tail) => {
    return compareVersions(current, MAX_VERSION_TESTED) >= 0 ? match : `${head}${MAX_VERSION_TESTED}${tail}`;
  });

  if (manifest === original) {
    console.log('[appx-manifest] 変更なし（すでに適用済み）');
    return;
  }

  fs.writeFileSync(manifestPath, manifest);
  console.log(`[appx-manifest] 仮想化を無効化し MinVersion を ${MIN_VERSION} にしました: ${manifestPath}`);
};
