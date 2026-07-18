@echo off
chcp 65001 >nul
rem CUBICENGINE - Java(GROVE)デスクトップ窓をダブルクリックで起動するバッチ
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
