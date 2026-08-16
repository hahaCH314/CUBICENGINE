import type { CapacitorConfig } from '@capacitor/cli';

// Android(Google Play)版の設定。
// webDir は `MMC_TARGET=android next build` が吐く out/ をそのまま同梱する。
// サーバーを見に行かず端末内で完結する（＝オフラインで動く）構成。
//
// appId は tinyCUBE (com.cubicenginestudio.tinycube) と同じ名前空間に揃える。
// ⚠️ 一度 Play に公開したら appId は永久に変更できない。
const config: CapacitorConfig = {
  appId: 'com.cubicenginestudio.cubicengine',
  appName: 'CUBICENGINE',
  webDir: 'out',
};

export default config;
