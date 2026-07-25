@echo off
chcp 65001 >nul
rem ============================================================
rem  CUBICENGINE - Java(GROVE)デスクトップ窓をダブルクリックで起動
rem ------------------------------------------------------------
rem  ⚠ このファイルは必ず CRLF 改行で保存すること（文字コードはUTF-8のままでOK）。
rem     LF単独で保存すると cmd が行を正しく切れず、日本語コメントが次の行を
rem     飲み込んで結合する。実際 2026-07-25 に
rem       rem CUBICENGINE - Java(GROVE)デスクトップ窓を…
rem     が結合して java コマンドとして実行され(ClassNotFoundException: (GROVE))、
rem     肝心の call npm run desktop が実行されず窓が出なかった。
rem     CRLFなら2行目の chcp 65001 が効いてUTF-8のまま正しく解釈される。
rem     ※.gitattributes で *.bat を eol=crlf に固定してある。
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
