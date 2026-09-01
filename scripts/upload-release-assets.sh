#!/usr/bin/env bash
# upload-release-assets.sh — GitHub Releases に配布物(.dmg/.exe など)を添付する。
#
# 使い方: bash scripts/upload-release-assets.sh <タグ> <ファイル> [ファイル...]
#   例:   bash scripts/upload-release-assets.sh v0.1.5 dist-exe/grove/GROVE_editor.dmg
#
# なぜ要るか:
#   gh CLI が入っていない環境（Macなど）でもリリースに資産を上げられるようにするため。
#   ブラウザへのドラッグ&ドロップができない場合の代替でもある。
#
# 認証:
#   git push で使っているのと同じ資格情報を git credential から借りる。
#   トークンをファイルに書いたり画面に出したりはしない。
set -euo pipefail

REPO="hahaCH314/CUBICENGINE"
TAG="${1:?タグを指定してください（例: v0.1.5）}"
shift
[ $# -ge 1 ] || { echo "アップロードするファイルを1つ以上指定してください" >&2; exit 1; }

TOKEN=$(printf "protocol=https\nhost=github.com\n\n" | git credential fill | sed -n 's/^password=//p')
[ -n "$TOKEN" ] || { echo "GitHub の資格情報が取得できませんでした（git push は通りますか？）" >&2; exit 1; }

RID=$(curl -fsS -H "Authorization: token $TOKEN" \
        "https://api.github.com/repos/$REPO/releases/tags/$TAG" \
      | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])')
echo "リリース $TAG (id=$RID) に添付します"

for f in "$@"; do
  [ -f "$f" ] || { echo "  ✗ $f が見つかりません" >&2; exit 1; }
  N=$(basename "$f")
  echo "  → $N ($(du -h "$f" | cut -f1)) を送信中..."
  CODE=$(curl -sS -o /tmp/gh_upload_resp.json -w "%{http_code}" -X POST \
    -H "Authorization: token $TOKEN" \
    -H "Content-Type: application/octet-stream" \
    --data-binary @"$f" \
    "https://uploads.github.com/repos/$REPO/releases/$RID/assets?name=$N")
  if [ "$CODE" = "201" ]; then
    echo "  ✓ $N 完了"
  else
    echo "  ✗ $N 失敗 (HTTP $CODE)" >&2
    head -c 400 /tmp/gh_upload_resp.json >&2; echo >&2
    exit 1
  fi
done

echo "=== $TAG の現在の資産 ==="
curl -fsS -H "Authorization: token $TOKEN" \
  "https://api.github.com/repos/$REPO/releases/tags/$TAG" \
| python3 -c 'import sys,json
for a in json.load(sys.stdin)["assets"]:
    print("  %-26s %13d bytes  %s" % (a["name"], a["size"], a["state"]))'
