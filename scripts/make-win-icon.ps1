# Windows 用の .ico を public/icon-512.png から作る。
# electron-builder は build/icon.ico があればそれを exe に焼き込む。
# 無いと「default Electron icon is used」となり、Electron の既定アイコンのまま出てしまう。
#   使い方: powershell -ExecutionPolicy Bypass -File scripts\make-win-icon.ps1

Add-Type -AssemblyName System.Drawing

$root   = Split-Path -Parent $PSScriptRoot
$src    = Join-Path $root 'public\icon-512.png'
$outDir = Join-Path $root 'build'
$dest   = Join-Path $outDir 'icon.ico'

if (-not (Test-Path $src)) { throw "アイコンが見つかりません: $src" }
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Force $outDir | Out-Null }

# 小さいサイズも入れておく。Windows は用途ごとに一番近いサイズを選ぶので、
# 16/32 が無いと大きい絵を縮小して使われ、タスクバーでぼやける。
$sizes = @(16, 24, 32, 48, 64, 128, 256)

$source = [System.Drawing.Image]::FromFile($src)
$pngs = @()
try {
  foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    try {
      $g.CompositingQuality = 'HighQuality'
      $g.InterpolationMode  = 'HighQualityBicubic'
      $g.SmoothingMode      = 'HighQuality'
      $g.PixelOffsetMode    = 'HighQuality'
      $g.Clear([System.Drawing.Color]::Transparent)
      $g.DrawImage($source, 0, 0, $size, $size)
    } finally { $g.Dispose() }

    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $pngs += ,@{ size = $size; bytes = $ms.ToArray() }
    $ms.Dispose()
  }
} finally { $source.Dispose() }

# ICO を手で組み立てる。.NET の Icon クラスは複数サイズの ico を書き出せないため。
# 構造: ICONDIR(6) + ICONDIRENTRY(16 x 枚数) + 各画像データ（PNG のまま入れてよい）
$fs = [System.IO.File]::Create($dest)
$bw = New-Object System.IO.BinaryWriter($fs)
try {
  $bw.Write([UInt16]0)              # reserved
  $bw.Write([UInt16]1)              # type: 1 = icon
  $bw.Write([UInt16]$pngs.Count)

  $offset = 6 + (16 * $pngs.Count)
  foreach ($p in $pngs) {
    # 256px は 0 と書く決まり（1バイトに収まらないため）
    $dim = if ($p.size -ge 256) { 0 } else { $p.size }
    $bw.Write([Byte]$dim)           # width
    $bw.Write([Byte]$dim)           # height
    $bw.Write([Byte]0)              # パレット色数（32bit なので 0）
    $bw.Write([Byte]0)              # reserved
    $bw.Write([UInt16]1)            # color planes
    $bw.Write([UInt16]32)           # bits per pixel
    $bw.Write([UInt32]$p.bytes.Length)
    $bw.Write([UInt32]$offset)
    $offset += $p.bytes.Length
  }
  foreach ($p in $pngs) { $bw.Write($p.bytes) }
} finally {
  $bw.Dispose(); $fs.Dispose()
}

Write-Host ("生成: {0} ({1} サイズ / {2:N0} バイト)" -f $dest, $pngs.Count, (Get-Item $dest).Length)
