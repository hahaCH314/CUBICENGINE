"use client";

/**
 * デベロッパータブの入れ物。
 *
 * 中身は段階的に増える。**まだ動かないものはここに並べない。**
 * 押せるのに何も起きないタブがあると、壊れているのか未実装なのか区別がつかない。
 *
 * 増やすときの決まり:
 *   画面は app/editor/developer/ に、処理は lib/devtab/ に置く。
 *   lib 側は UI を import しない。そうしておくとテストが書けるし、
 *   Worker からも同じものを呼べる。
 */

import ModelImport from "./ModelImport";
import MobBuilder from "./MobBuilder";
import { useEditorStore } from "../store";
import { getAiAdapter } from "../../../lib/devtab/ai";

export default function DeveloperPanel() {
  // 取り込んだモブは store に置く。exporter が書き出し時にここを見るので、
  // タブを離れても、ページ内の他の操作をしても設定が消えない
  const mobs = useEditorStore(s => s.devMobs);
  const upsert = useEditorStore(s => s.upsertDevMob);
  const ai = getAiAdapter();

  return (
    <div className="h-full flex flex-col">
      <div className="px-5 pt-4 pb-2 border-b shrink-0" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-2">
          <span className="text-lg">🛠</span>
          <h1 className="font-black tracking-tight">デベロッパー</h1>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full"
            style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}
          >
            上級者向け
          </span>
        </div>
        <p className="text-[11px] text-muted/60 mt-1">
          自分で作った3Dモデルを取り込んで、マイクラで動くモブにします。
        </p>
      </div>

      <div className="flex-1 overflow-auto">
        <ModelImport onLoaded={upsert} />

        {mobs.length > 0 && (
          <div className="px-5 pb-6 flex flex-col gap-5">
            {mobs.map(m => (
              <div
                key={m.id}
                className="rounded-xl p-4"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <MobBuilder mob={m} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-5 py-2 border-t text-[11px] text-muted/50 shrink-0" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        {mobs.length > 0 ? <>モブ {mobs.length} 体を書き出しに含めます。</> : <>モデルを読み込むと、ここで設定できます。</>}
        {!ai.ready && <>　／　自作AI連携: {ai.reason}</>}
      </div>
    </div>
  );
}
