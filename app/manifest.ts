import { MetadataRoute } from 'next'

// Android版(output: 'export')ではビルド時に静的ファイルとして書き出す必要がある。
// これが無いと「force-static が未設定」で静的エクスポートが失敗する。
export const dynamic = 'force-static'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CUBICENGINEstudio',
    short_name: 'CUBICENGINE',
    description: 'コーディング不要のビジュアル開発環境。非公式（Mojang/Microsoftとは無関係）。',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0c',
    theme_color: '#8b5cf6',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  }
}
