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
  plugins: {
    // Android 15 以降、targetSdk 35+ のアプリは画面の端まで描画される（エッジツーエッジ強制）。
    // 対応しないと上部のタブがステータスバーに、下部がジェスチャーバーに隠れる。
    // エディタは上下に操作UIがあるので直撃する。
    //
    // このプラグインは **入れるだけ** で WebView に余白を入れ、
    // Android 15 以前と同じ見え方に戻す。Web版(Vercel)には一切影響しない。
    //
    // 色は globals.css の --background（#404044）に合わせる。
    // ⚠️ themeColor の #fb7185 は PWA のブラウザUI用であって画面の背景色ではない。
    //    ここに使うと上下だけピンクの帯が出る。
    EdgeToEdge: {
      backgroundColor: '#404044',
    },
  },
};

export default config;
