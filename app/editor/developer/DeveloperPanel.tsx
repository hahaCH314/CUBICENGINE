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

import { useCallback, useRef, useState } from "react";
import ModelImport from "./ModelImport";
import MobBuilder from "./MobBuilder";
import ItemBuilder from "./ItemBuilder";
import { useEditorStore } from "../store";
import { getAiAdapter } from "../../../lib/devtab/ai";
import type { MobIR } from "../../../lib/devtab/ir";

export default function DeveloperPanel() {
  // 取り込んだモブは store に置く。exporter が書き出し時にここを見るので、
  // タブを離れても、ページ内の他の操作をしても設定が消えない
  const mobs = useEditorStore(s => s.devMobs);
  const upsert = useEditorStore(s => s.upsertDevMob);
  const ai = getAiAdapter();
  const mobsRef = useRef<HTMLDivElement>(null);
  // モブとアイテムは作るものが全く違うので画面を分ける。
  // 1画面に混ぜると、どちらを作っているのか分からなくなる
  const [mode, setMode] = useState<"mob" | "item">("mob");
  const itemCount = useEditorStore(s => s.devItems.length);
  // ⚠️ Java版で作れるのは**モブだけ**。
  //    アイテム・道具・防具・技は Bedrock 専用の書き出し経路しか無く、
  //    Java の .jar には一切入らない（＝作っても無言で消える）。
  //    タブごと隠すのではなく、押せなくして理由を出す。
  //    Java 側の設計図に items を足せたら、この分岐を外す。
  const isJava = useEditorStore(s => s.targetPlatform) === "java";

  /* Java版の作り方は2通りある。要求されるものが違うので、先に選んでもらう。
   *   ふつう   … 前提MODなし。エンジン(base-mod.jar)だけで完結する。見た目はバニラのモブ。
   *   前提mod  … GeckoLib を入れてもらう代わりに、作った形とアニメーションがそのまま出る。
   *
   * 2026-08-24、エンジンが GeckoLib に対応した（spec 3）ので開けた。
   * 実測: DynamicRegistry が render=="geo" で ENTITIES に登録し、
   *       CubicGeoModel が geo/animations/textures を読む。
   *
   * ⚠️ 状態は store に置く。exporter がこれを見て
   *    「設計図の render」「アセットの同梱」「mods.toml の GeckoLib 依存」を
   *    まとめて切り替える。**画面の見た目だけ変えて出力が変わらない**のが
   *    このプロジェクトで一番高くつく形なので、持ち場所を分けない。 */
  const modMode = useEditorStore(s => s.javaModMode);
  const setModMode = useEditorStore(s => s.setJavaModMode);

  // 取り込んだ直後に、下に出たモブの設定まで送る。
  // 取り込み画面は縦に大きいので、放っておくと結果が画面外のままになり
  // 「取り込めたのに何も起きない」ように見える
  const handleLoaded = useCallback(
    (ir: MobIR) => {
      upsert(ir);
      requestAnimationFrame(() => {
        mobsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
    [upsert],
  );

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
        {/* ⚠️ Java版は3Dモデルを持てない（Forgeのエンティティモデルは
            Javaのコードで書くもので、JSONから作れない）。
            「3Dモデルを取り込んで」と書いたままだと、取り込んだ形が
            出てこないときに「壊れている」と思われる。先に伝える */}
        <p className="text-[11px] text-muted/60 mt-1">
          {isJava
            ? "モブの強さや落とすものを決められます。見た目はバニラのモブを土台にします。"
            : "自分で作った3Dモデルを取り込んで、マイクラで動くモブにします。"}
        </p>
      </div>

      {/* ── Java版だけ：前提MODを使うかどうか ── */}
      {isJava && (
        <div className="px-5 pt-3 shrink-0">
          <div className="text-[10px] font-bold text-muted/50 mb-1.5">どう作る？</div>
          <div className="flex gap-1">
            {([["normal", "🍃 ふつう"], ["prereq", "🧩 前提mod"]] as const).map(([k, label]) => {
              const on = modMode === k;
              return (
                <button
                  key={k}
                  onClick={() => setModMode(k)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                  style={
                    on
                      ? { background: "rgba(52,211,153,0.20)", color: "#a7f3d0" }
                      : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.55)" }
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
          {/* 2つの違いを、遊ぶ人が何を用意するかで書く。
              「GeckoLib対応」とだけ書いても、何が変わるのか伝わらない */}
          <div className="mt-2 grid grid-cols-2 gap-2 text-[10.5px] leading-relaxed">
            <div
              className="rounded-lg p-2.5"
              style={modMode === "normal"
                ? { background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.35)" }
                : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", opacity: 0.6 }}
            >
              <div className="font-bold text-emerald-200">🍃 ふつう</div>
              <div className="text-muted/70 mt-0.5">
                遊ぶ人は <b>Forge だけ</b>。<br />
                見た目はバニラのモブ。<br />
                強さ・名前・落とすものは反映。
              </div>
            </div>
            <div
              className="rounded-lg p-2.5"
              style={modMode === "prereq"
                ? { background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.35)" }
                : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", opacity: 0.6 }}
            >
              <div className="font-bold text-emerald-200">🧩 前提mod</div>
              <div className="text-muted/70 mt-0.5">
                遊ぶ人は <b>Forge ＋ GeckoLib</b>。<br />
                <b>作った形とアニメがそのまま出る。</b><br />
                入れてもらう手間が増えます。
              </div>
            </div>
          </div>
          {/* ⚠️ 前提MODは**遊ぶ側**に手間を増やす選択。作った本人がそれを
              分かっていないまま配ると、相手は「起動しない」としか言えない。 */}
          {modMode === "prereq" && (
            <div
              className="mt-2 rounded-lg p-2.5 text-[10.5px] leading-relaxed"
              style={{ background: "rgba(250,204,21,0.10)", border: "1px solid rgba(250,204,21,0.3)" }}
            >
              <b>遊ぶ人は GeckoLib を入れる必要があります。</b>
              <span className="block text-muted/70 mt-0.5">
                入れていない人は、マイクラが起動しません。作品を渡すときは
                「GeckoLib も入れてね」と一緒に伝えてください。
              </span>
              {/* 先に言わないと、動きを作り込んでから「再生されない」と分かることになる */}
              <span className="block text-muted/70 mt-1.5">
                <b>動きの名前は <code>walk</code> と <code>idle</code> だけ</b>が再生されます。
                Blockbench で別の名前を付けていると、書き出せてもゲームでは棒立ちになります。
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-1 px-5 pt-3 shrink-0">
        {([["mob", "🧟 モブ"], ["item", "🍎 アイテム"]] as const).map(([k, label]) => {
          const locked = isJava && k === "item";
          return (
            <button
              key={k}
              onClick={() => { if (!locked) setMode(k); }}
              disabled={locked}
              title={locked ? "アイテムは統合版だけで作れます" : undefined}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
              style={
                locked
                  ? { background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.25)", cursor: "not-allowed" }
                  : mode === k
                    ? { background: "rgba(167,139,250,0.22)", color: "#ddd6fe" }
                    : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.55)" }
              }
            >
              {locked ? "🔒 " + label : label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-auto">
        {/* ⚠️ タブを押せなくするだけでは足りない。Bedrock でアイテムを開いたまま
            ?mode=grape に切り替えると mode が "item" のまま残る。
            そのまま作らせると .jar には入らないので、ここでも塞ぐ */}
        {mode === "item" && isJava ? (
          <div className="p-8 flex flex-col items-center justify-center text-center gap-3">
            <div className="text-4xl">🔒</div>
            <div className="text-sm font-bold">アイテムは統合版だけで作れます</div>
            <p className="text-xs text-muted/70 leading-relaxed max-w-xs">
              いま Java版（パソコン）を作るモードです。<br />
              Java版で作れるのは <b>モブ</b> だけです。
            </p>
            <button
              onClick={() => setMode("mob")}
              className="mt-1 text-xs font-bold px-4 py-2 rounded-lg"
              style={{ background: "rgba(167,139,250,0.22)", color: "#ddd6fe" }}
            >
              モブづくりへ
            </button>
          </div>
        ) : mode === "item" ? <ItemBuilder /> : <>
        {/* ⚠️ Java版では取り込んだ形は反映されない（見た目はバニラのモブになる）。
            ModelImport はモブを作る入口も兼ねているので残すが、
            黙っていると「取り込んだのに違う見た目で出た」と思われるので先に伝える */}
        {isJava && modMode === "normal" && (
          <div
            className="mx-5 mt-3 rounded-lg p-3 text-[11px] leading-relaxed"
            style={{ background: "rgba(250,204,21,0.10)", border: "1px solid rgba(250,204,21,0.3)" }}
          >
            <b>いまは「🍃 ふつう」なので、取り込んだ形は出ません。</b>
            <span className="block text-muted/70 mt-0.5">
              見た目はバニラのモブ（おとなしい＝村人／襲う＝ゾンビ）になります。
              強さ・名前・落とすものは設定どおりに反映されます。
              形をそのまま出したいときは「🧩 前提mod」を選んでください。
            </span>
          </div>
        )}
        <ModelImport onLoaded={handleLoaded} />

        {mobs.length > 0 && (
          <div ref={mobsRef} className="px-5 pb-6 flex flex-col gap-5">
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
        </>}
      </div>

      <div className="px-5 py-2 border-t text-[11px] text-muted/50 shrink-0" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        {mobs.length + itemCount > 0
          ? <>書き出しに含めます: モブ {mobs.length} 体 ／ アイテム {itemCount} 個</>
          : <>モデルや絵を読み込むと、ここで設定できます。</>}
        {!ai.ready && <>　／　自作AI連携: {ai.reason}</>}
      </div>
    </div>
  );
}
