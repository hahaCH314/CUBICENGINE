import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MineModCraft Studio',
    short_name: 'MMC Studio',
    description: 'Visual Minecraft Modding IDE — コーディング不要でMinecraft Modを作成',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0c',
    theme_color: '#8b5cf6',
    icons: [
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
