$results = Select-String -Path "app\editor\*.tsx", "app\editor\*\*.tsx", "app\editor\*.ts", "app\editor\*\*.ts" -Pattern "editor_[a-z0-9]{6}" | Where-Object {
  $_.Line -notmatch "t\(locale," -and $_.Line -notmatch "i18nT\(locale," -and $_.Line -notmatch "tNode\(locale,"
}
if ($results) {
  Write-Host "Found unhandled keys:"
  $results | ForEach-Object { Write-Host "$($_.Filename):$($_.LineNumber) $($_.Line)" }
  exit 1
} else {
  Write-Host "No unhandled keys found. OK."
  exit 0
}
