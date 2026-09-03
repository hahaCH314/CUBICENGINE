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

// 署名なしのパッケージを Add-AppxPackage -AllowUnsigned で入れるには、
// Publisher の末尾にこの OID が要る。付いていないと 0x80073D2C
// 「発行元が未署名の名前空間にありません」で弾かれ、**手元で一度も試せない。**
// 逆にこれが付いたものは Store に出せない（Partner Center の Publisher と一致しないため）。
const UNSIGNED_TEST_OID = 'OID.2.25.311729368913984317654407730594956997722=1';

module.exports = async function appxManifestCreated(manifestPath) {
  const original = fs.readFileSync(manifestPath, 'utf8');
  let manifest = original;

  // 0) MMC_APPX_TEST=1 のときだけ、手元で動作確認できる形にする。
  //    ⚠️ これで作ったパッケージは **絶対に Partner Center へ出さないこと。**
  //       発行元が本番と違うので受け付けられないし、仮に通っても別アプリ扱いになる。
  //    中身（仮想化の設定・同梱ファイル）は本番と同じなので、
  //    「起動するか」「.minecraft に本当に書けるか」の確認はこれで足りる。
  if (process.env.MMC_APPX_TEST === '1') {
    manifest = manifest.replace(
      /(Publisher=')([^']+)(')/,
      (match, head, publisher, tail) =>
        publisher.includes(UNSIGNED_TEST_OID) ? match : `${head}${publisher}, ${UNSIGNED_TEST_OID}${tail}`
    );
    console.log('[appx-manifest] ⚠️ 試験用ビルド（署名なしで入れられる発行元）。配布・提出しないこと');
  }

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

  // 3) 仮想化を切るには unvirtualizedResources 機能の宣言が要る。
  //    ⚠️ これが無いと、パッケージ自体は作れてしまうが **インストールできない**。
  //       Windows が 0x80073CF0 で弾く：
  //       「指定された要素または属性または属性値には "unvirtualizedResources" 機能が必要です」
  //       makeappx は通るので、実際に入れてみるまで気づけない（2026-09-03 に踏んだ）。
  if (!manifest.includes('unvirtualizedResources')) {
    const anchor = '<rescap:Capability Name="runFullTrust"/>';
    if (!manifest.includes(anchor)) {
      throw new Error('AppxManifest に runFullTrust の宣言が見つかりません。');
    }
    manifest = manifest.replace(
      anchor,
      `${anchor}\n    <rescap:Capability Name="unvirtualizedResources"/>`
    );
  }

  // 4) desktop6 を使うので MinVersion を引き上げる。
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
