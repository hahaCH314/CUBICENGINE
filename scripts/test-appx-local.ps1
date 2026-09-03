# Store 用の .appx が「本当に動くか」を手元で確かめる。
#
#   使い方: PowerShell を**管理者として**開いて
#           powershell -ExecutionPolicy Bypass -File scripts\test-appx-local.ps1
#
# なぜ必要か:
#   .appx は MSIX という形式で、アプリを箱の中で動かす。GROVE はその箱の外にある
#   Minecraft のフォルダへ .jar を置く必要があるため、箱の制約を外す設定を入れている。
#   ⚠️ 設定が入っていることは中身を見れば分かるが、**Windows が本当にその通りに
#      動くかは、入れて動かすまで分からない。** ここが効いていないと、
#      「保存できたのにマイクラに出てこない」という、エラーの出ない壊れ方をする。
#
# なぜ管理者が要るか:
#   実行ファイルを含む MSIX は、署名なしではインストールできない
#   （0x80073D2B）。使い捨ての証明書で署名し、それを PC に信頼させる必要があり、
#   その登録に管理者権限が要る。
#
# 後片付け:
#   最後にアプリも証明書も消す。PC に残らない。
#
# 参考: docs/RELEASE.md / docs/MICROSOFT_STORE.md

$ErrorActionPreference = 'Stop'

$root      = Split-Path -Parent $PSScriptRoot
$appx      = Join-Path $root 'dist-exe\grove\GROVE_editor.appx'
$publisher = 'CN=87788BE5-5897-4593-8CAD-DA1FF10A252C'  # Partner Center の Publisher と完全一致させる
$appId     = 'CUBICENGINEGROVE'
$pkgName   = 'CUBICENGINEstudio.CUBICENGINEGROVE'

$work    = Join-Path $env:TEMP 'cubicengine-appx-test'
$signed  = Join-Path $work 'signed.appx'
$pfx     = Join-Path $work 'test.pfx'
$pfxPass = 'cubicengine-throwaway'

function Fail($msg) { Write-Host "`n  ✗ $msg" -ForegroundColor Red; exit 1 }
function Step($msg) { Write-Host "`n[$msg]" -ForegroundColor Cyan }

# ── 前提の確認 ───────────────────────────────────────────────
$id = [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Fail "管理者として実行してください（PowerShell を右クリック →「管理者として実行」）"
}
if (-not (Test-Path $appx)) { Fail "$appx が見つかりません。先に npm run build:grove:appx を実行してください" }

$signtool = Get-ChildItem "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign\*\windows-10\x64\signtool.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $signtool) { Fail "signtool.exe が見つかりません（electron-builder のキャッシュ内を探しています）" }

New-Item -ItemType Directory -Force $work | Out-Null
$cert = $null

try {
  # ── 1. 使い捨ての証明書を作って署名する ────────────────────
  Step "使い捨ての証明書で署名する"
  # Subject はパッケージの Publisher と1文字も違ってはいけない（違うと 0x8007000B で弾かれる）
  $cert = New-SelfSignedCertificate -Type Custom -Subject $publisher `
    -KeyUsage DigitalSignature -CertStoreLocation 'Cert:\CurrentUser\My' `
    -FriendlyName 'CUBICENGINE MSIX ローカル検証用（使い捨て）' `
    -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3', '2.5.29.19={text}Subject Type:End Entity')

  $pw = ConvertTo-SecureString -String $pfxPass -Force -AsPlainText
  Export-PfxCertificate -Cert $cert -FilePath $pfx -Password $pw | Out-Null

  Copy-Item $appx $signed -Force
  & $signtool.FullName sign /fd SHA256 /f $pfx /p $pfxPass $signed | Out-Null
  if ($LASTEXITCODE -ne 0) { Fail "署名に失敗しました（終了コード $LASTEXITCODE）" }

  # 署名した証明書を「信頼された発行元」として登録する（ここに管理者権限が要る）
  $cer = Join-Path $work 'test.cer'
  Export-Certificate -Cert $cert -FilePath $cer | Out-Null
  Import-Certificate -FilePath $cer -CertStoreLocation 'Cert:\LocalMachine\TrustedPeople' | Out-Null
  Write-Host "  署名 OK"

  # ── 2. インストール ────────────────────────────────────────
  Step "インストールする"
  Get-AppxPackage -Name $pkgName -ErrorAction SilentlyContinue | Remove-AppxPackage -ErrorAction SilentlyContinue
  Add-AppxPackage -Path $signed
  $pkg = Get-AppxPackage -Name $pkgName
  if (-not $pkg) { Fail "インストールできたはずなのに見つかりません" }
  Write-Host "  OK  $($pkg.PackageFullName)"

  # ── 3. 起動して画面が返るか ────────────────────────────────
  # ここが本丸。v0.1.0 は「ファイルは落ちるのに起動した瞬間に落ちる」だった。
  Step "起動して画面が返るか"
  # パッケージ版として起動する。exe を直接叩くと箱の外で動いてしまい、
  # 確かめたい「箱の中での書き込み先」が分からなくなる。
  Start-Process "shell:appsFolder\$($pkg.PackageFamilyName)!$appId"

  $ok = $false
  $deadline = (Get-Date).AddMinutes(3)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 5
    try {
      if ((Invoke-WebRequest 'http://127.0.0.1:3200/' -UseBasicParsing -TimeoutSec 10).StatusCode -eq 200) { $ok = $true; break }
    } catch { }
  }
  if (-not $ok) { Fail "3分待っても画面が返りませんでした（起動していないか、中身が壊れています）" }
  Write-Host "  OK  HTTP 200 が返りました"

  # ── 4. 書き込みが横流しされていないか ──────────────────────
  # アプリは起動時に userData へ boot-state.json を書く（electron/main.js）。
  # それが**本物の %APPDATA% に出るか、箱の中に出るか**で判定できる。
  # Minecraft は箱の外のアプリなので、箱の中に出るなら MOD は永遠に届かない。
  Step "書き込み先が横流しされていないか"
  $real      = Join-Path $env:APPDATA 'CubicEngine\boot-state.json'
  $redirected = Join-Path $env:LOCALAPPDATA "Packages\$($pkg.PackageFamilyName)\LocalCache\Roaming\CubicEngine\boot-state.json"
  Write-Host "  本物の場所 : $real"
  Write-Host "  箱の中     : $redirected"

  $verdict = 'unknown'
  if (Test-Path $redirected) { $verdict = 'redirected' }
  elseif (Test-Path $real)   { $verdict = 'real' }

  switch ($verdict) {
    'real'       { Write-Host "`n  ✓ 本物の場所に書かれました。仮想化オフが効いています" -ForegroundColor Green }
    'redirected' { Write-Host "`n  ✗ 箱の中に横流しされました。このままでは MOD がマイクラに届きません" -ForegroundColor Red }
    default      { Write-Host "`n  ? どちらにも見つかりません。起動直後で書かれる前かもしれません" -ForegroundColor Yellow }
  }

  Write-Host "`n──────── 結果 ────────"
  Write-Host "  インストール : OK"
  Write-Host "  起動        : OK"
  Write-Host "  書き込み先  : $verdict"

} finally {
  # ── 後片付け。PC に何も残さない ────────────────────────────
  Step "後片付け"
  Get-Process -Name 'CubicEngine' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Get-AppxPackage -Name $pkgName -ErrorAction SilentlyContinue | Remove-AppxPackage -ErrorAction SilentlyContinue
  if ($cert) {
    Remove-Item "Cert:\CurrentUser\My\$($cert.Thumbprint)" -Force -ErrorAction SilentlyContinue
    Remove-Item "Cert:\LocalMachine\TrustedPeople\$($cert.Thumbprint)" -Force -ErrorAction SilentlyContinue
  }
  Remove-Item $work -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host "  アプリと証明書を削除しました"
}
