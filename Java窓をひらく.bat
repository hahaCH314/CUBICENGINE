@echo off
chcp 932 >nul
rem ============================================================
rem  CUBICENGINE - Java(GROVE)デスクトップ窓をダブルクリックで起動
rem ------------------------------------------------------------
rem  このファイルは必ず Shift-JIS(CP932) + CRLF で保存すること。
rem  cmd.exe は .bat を「システムANSIコードページ」で読む（このPCは932）。
rem  UTF-8 + LF で保存すると日本語コメントが改行を飲み込み、後続の行
rem  （call npm run desktop 等）が丸ごと実行されず窓が出ない。
rem  ※.gitattributes で *.bat を eol=crlf に固定してある。
rem ============================================================
cd /d "%~dp0"

echo ================================================
echo   CUBICENGINE  Java(GROVE) デスクトップを起動します
echo   ※初回は next build で少し時間がかかります
echo ================================================
echo.

rem 例のクラッシュ犯人(ELECTRON_RUN_AS_NODE)を消す。cmdでは set VAR= が「変数を削除」になる。
set "ELECTRON_RUN_AS_NODE="
rem GROVE(Java)で開く
set "MMC_EDITION=grove"

call npm run desktop

echo.
echo 窓を閉じました。このウィンドウは閉じてOKです。
pause
