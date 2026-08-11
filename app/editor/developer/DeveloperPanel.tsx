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

import { useState } from "react";
import ModelImport from "./ModelImport";
import type { MobIR } from "../../../lib/devtab/ir";
import { getAiAdapter } from "../../../lib/devtab/ai";

export default function DeveloperPanel() {
  const [ir, setIr] = useState<MobIR | null>(null);
  const ai = getAiAdapter();

  return (
    <div className="h-full flex flex-col">
      <div className="px-5 pt-4 pb-2 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
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
          自分で作った3Dモデルを取り込んで、モブとして動かすための画面です。
        </p>
      </div>

      <div className="flex-1 overflow-hidden">
        <ModelImport onLoaded={setIr} />
      </div>

      {/* 次に何ができるようになるかを出しておく。押せない機能をタブとして並べるより、
          いま何が使えて何が使えないかがはっきりする */}
      <div className="px-5 py-3 border-t text-[11px] text-muted/50" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        {ir ? (
          <>
            <b className="text-muted/80">{ir.displayName}</b> を読み込み済み。
            次の段階で、挙動・アニメ・ドロップ品・スポーン条件を設定できるようになります。
          </>
        ) : (
          <>モデルを読み込むと、ここに次の手順が出ます。</>
        )}
        {!ai.ready && <>　／　自作AI連携: {ai.reason}</>}
      </div>
    </div>
  );
}
