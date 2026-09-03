# Microsoft Store (AppX/MSIX) 用のタイル画像を public/icon-512.png から生成する。
# electron-builder は build/appx/ に置いた画像を assets\ としてパッケージへ入れる。
#   使い方: powershell -ExecutionPolicy Bypass -File scripts\make-appx-assets.ps1

Add-Type -AssemblyName System.Drawing

$root   = Split-Path -Parent $PSScriptRoot
$src    = Join-Path $root 'public\icon-512.png'
$outDir = Join-Path $root 'build\appx'

if (-not (Test-Path $src)) { throw "アイコンが見つかりません: $src" }
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Force $outDir | Out-Null }

# app/manifest.ts の background_color に合わせる
$bg = [System.Drawing.ColorTranslator]::FromHtml('#0a0a0c')

# 正方形でないタイルはアイコンを中央に置き、余白は背景色で埋める（潰さない）
$targets = @(
  @{ name = 'StoreLogo.png';          w = 50;  h = 50  },
  @{ name = 'Square44x44Logo.png';    w = 44;  h = 44  },
  @{ name = 'SmallTile.png';          w = 71;  h = 71  },
  @{ name = 'Square150x150Logo.png';  w = 150; h = 150 },
  @{ name = 'LargeTile.png';          w = 310; h = 310 },
  @{ name = 'Wide310x150Logo.png';    w = 310; h = 150 },
  @{ name = 'SplashScreen.png';       w = 620; h = 300 }
)

$source = [System.Drawing.Image]::FromFile($src)
try {
  foreach ($t in $targets) {
    $bmp = New-Object System.Drawing.Bitmap($t.w, $t.h)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    try {
      $g.CompositingQuality = 'HighQuality'
      $g.InterpolationMode  = 'HighQualityBicubic'
      $g.SmoothingMode      = 'HighQuality'
      $g.PixelOffsetMode    = 'HighQuality'
      $g.Clear($bg)

      # アスペクト比を保ったまま、はみ出さない最大サイズで中央に描く
      $scale = [Math]::Min($t.w / $source.Width, $t.h / $source.Height)
      $dw    = [int][Math]::Round($source.Width  * $scale)
      $dh    = [int][Math]::Round($source.Height * $scale)
      $dx    = [int][Math]::Round(($t.w - $dw) / 2)
      $dy    = [int][Math]::Round(($t.h - $dh) / 2)
      $g.DrawImage($source, $dx, $dy, $dw, $dh)

      $dest = Join-Path $outDir $t.name
      $bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
      Write-Host ("生成: {0} ({1}x{2})" -f $t.name, $t.w, $t.h)
    } finally {
      $g.Dispose(); $bmp.Dispose()
    }
  }
} finally {
  $source.Dispose()
}

Write-Host "`n完了 -> $outDir"
