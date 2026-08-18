"use client";

/**
 * 取り込んだモブの挙動を決める画面。
 *
 * 値は store に置く（devMobs）。exporter が書き出し時にそこを見るので、
 * この画面を閉じても設定は残るし、「マイクラへ」を押すだけでアドオンに入る。
 */

import dynamic from "next/dynamic";
import { useEditorStore } from "../store";
import { validateMob } from "../../../lib/devtab/toBedrock";
import { normalizeAggression } from "../../../lib/devtab/ir";
import type { MobIR } from "../../../lib/devtab/ir";

// three.js は SSR 不可。ModelPanel と同じ扱いにする
const MobPreview = dynamic(() => import("./MobPreview"), { ssr: false });

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-3 py-1.5">
      <span className="w-32 shrink-0 text-xs">
        {label}
        {hint && <span className="block text-[10px] text-muted/50">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

const numberCls = "w-24 px-2 py-1 rounded text-xs bg-black/40 border border-white/15";

/**
 * ドロップ品の入力候補（バニラ）。
 * 全部載せる意味はないので、モブが落としそうなものだけに絞ってある。
 * ここに無いものも入力欄に直接打てば使える。
 */
const VANILLA_DROPS = [
  { id: "minecraft:diamond", label: "ダイヤモンド" },
  { id: "minecraft:emerald", label: "エメラルド" },
  { id: "minecraft:gold_ingot", label: "金インゴット" },
  { id: "minecraft:iron_ingot", label: "鉄インゴット" },
  { id: "minecraft:bone", label: "骨" },
  { id: "minecraft:string", label: "糸" },
  { id: "minecraft:leather", label: "革" },
  { id: "minecraft:feather", label: "羽" },
  { id: "minecraft:gunpowder", label: "火薬" },
  { id: "minecraft:rotten_flesh", label: "腐った肉" },
  { id: "minecraft:apple", label: "リンゴ" },
  { id: "minecraft:beef", label: "生の牛肉" },
] as const;

export default function MobBuilder({ mob }: { mob: MobIR }) {
  const update = useEditorStore(s => s.updateDevMobBehavior);
  const remove = useEditorStore(s => s.removeDevMob);
  // 自分で作ったアイテムをドロップ品にできるようにする。
  // 識別子を手で打たせると綴りを間違えても気づけず、倒しても何も落ちない
  const myItems = useEditorStore(s => s.devItems);
  const b = mob.behavior;
  // 古い形（hostile: boolean）で保存されたモブも読めるようにする
  const aggr = normalizeAggression(b.aggression);
  const problems = validateMob(mob, myItems.map(i => `cubicengine:${i.id}`));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="font-bold">{mob.displayName}</div>
          <code className="text-[10px] text-muted/60">cubicengine:{mob.id}</code>
        </div>
        <button
          onClick={() => remove(mob.id)}
          className="text-[11px] px-2 py-1 rounded hover:bg-white/10 text-muted/70"
        >
          取り消す
        </button>
      </div>

      <MobPreview ir={mob} />

      {mob.animations.length > 0 && (
        <p className="text-[11px] text-muted/60">
          動き {mob.animations.length} 個: {mob.animations.map(a => `${a.name}${a.loop ? "（くり返し）" : ""}`).join(" / ")}
          <br />
          <span className="text-muted/45">
            くり返す動きはマイクラで自動再生されます。プレビューには出ません。
          </span>
        </p>
      )}

      <section>
        <h3 className="text-xs font-bold mb-1 text-muted/80">基本</h3>
        <Row label="体力" hint="ハート半分＝1">
          <input type="number" min={1} max={1024} className={numberCls}
            value={b.health}
            onChange={e => update(mob.id, { health: Number(e.target.value) })} />
        </Row>
        <Row label="歩く速さ" hint="0.25でふつう">
          <input type="number" min={0} max={2} step={0.05} className={numberCls}
            value={b.movementSpeed}
            onChange={e => update(mob.id, { movementSpeed: Number(e.target.value) })} />
        </Row>
      </section>

      <section>
        <h3 className="text-xs font-bold mb-1 text-muted/80">性格</h3>
        <div className="flex flex-col gap-1 py-1">
          {([
            ["peaceful", "おとなしい", "襲いません。殴られると逃げます"],
            ["player", "プレイヤーを襲う", "ふつうの敵モブ"],
            ["berserk", "なんでも襲う（戦闘狂）", "プレイヤーも動物も、同じ種類も襲います"],
          ] as const).map(([v, label, hint]) => (
            <label key={v} className="flex items-start gap-2 text-xs cursor-pointer">
              <input type="radio" name={`aggr-${mob.id}`} checked={aggr === v} className="mt-0.5"
                onChange={() => update(mob.id, {
                  aggression: v,
                  // おとなしい以外にするとき攻撃力0のままだと殴っても効かない。
                  // 検査で弾かれるので、切り替えた時点で最低限の値を入れておく
                  ...(v !== "peaceful" && b.attackDamage <= 0 ? { attackDamage: 3 } : {}),
                })} />
              <span>
                {label}
                <span className="block text-[10px] text-muted/50">{hint}</span>
              </span>
            </label>
          ))}
        </div>
        {aggr !== "peaceful" && (
          <Row label="攻撃力" hint="ハート半分＝1">
            <input type="number" min={1} max={100} className={numberCls}
              value={b.attackDamage}
              onChange={e => update(mob.id, { attackDamage: Number(e.target.value) })} />
          </Row>
        )}
        {aggr === "berserk" && (
          <p className="text-[10px] pl-1" style={{ color: "rgba(251,191,36,0.8)" }}>
            ⚠️ 同じ種類同士も襲います。2匹以上出すと共食いして1匹になります。
          </p>
        )}
      </section>

      <section>
        <h3 className="text-xs font-bold mb-1 text-muted/80">たおしたとき落とすもの</h3>
        {b.drops.map((d, i) => (
          <div key={i} className="flex items-center gap-2 py-1">
            {/* 自作アイテムを一覧から選べるようにする。手打ちだと綴りを間違えても
                気づけず、倒しても何も落ちないモブになる。
                バニラのアイテムも使えるよう、入力欄自体は残す（datalist 方式） */}
            <input
              list={`drops-${mob.id}`}
              className="flex-1 px-2 py-1 rounded text-xs bg-black/40 border border-white/15 font-mono"
              value={d.item} placeholder="minecraft:diamond"
              onChange={e => {
                const drops = [...b.drops];
                drops[i] = { ...d, item: e.target.value };
                update(mob.id, { drops });
              }} />
            <input type="number" min={1} className="w-14 px-2 py-1 rounded text-xs bg-black/40 border border-white/15"
              value={d.min}
              onChange={e => {
                const drops = [...b.drops];
                drops[i] = { ...d, min: Number(e.target.value) };
                update(mob.id, { drops });
              }} />
            <span className="text-[10px] text-muted/50">〜</span>
            <input type="number" min={1} className="w-14 px-2 py-1 rounded text-xs bg-black/40 border border-white/15"
              value={d.max}
              onChange={e => {
                const drops = [...b.drops];
                drops[i] = { ...d, max: Number(e.target.value) };
                update(mob.id, { drops });
              }} />
            <button className="text-[11px] px-2 text-muted/60 hover:text-white"
              onClick={() => update(mob.id, { drops: b.drops.filter((_, j) => j !== i) })}>×</button>
          </div>
        ))}
        {/* 入力欄の候補。自作アイテムを先に出す（探しに来る理由がこちらのため） */}
        <datalist id={`drops-${mob.id}`}>
          {myItems.map(it => (
            <option key={it.id} value={`cubicengine:${it.id}`}>{it.displayName}（自分で作ったもの）</option>
          ))}
          {VANILLA_DROPS.map(v => (
            <option key={v.id} value={v.id}>{v.label}</option>
          ))}
        </datalist>

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <button
            className="text-[11px] px-2 py-1 rounded"
            style={{ background: "rgba(255,255,255,0.07)" }}
            onClick={() => update(mob.id, { drops: [...b.drops, { item: "minecraft:diamond", min: 1, max: 1, chance: 1 }] })}
          >
            ＋ 落とすものを足す
          </button>
          {/* 作ったアイテムはワンタッチで足せるようにする。
              識別子を覚えていなくても繋げられるのが狙い */}
          {myItems.map(it => (
            <button
              key={it.id}
              className="text-[11px] px-2 py-1 rounded flex items-center gap-1"
              style={{ background: "rgba(167,139,250,0.18)", color: "#ddd6fe" }}
              title={`cubicengine:${it.id} を落とすものに足す`}
              onClick={() =>
                update(mob.id, {
                  drops: [...b.drops, { item: `cubicengine:${it.id}`, min: 1, max: 1, chance: 1 }],
                })
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.iconDataUrl} alt="" width={14} height={14} style={{ imageRendering: "pixelated" }} />
              ＋ {it.displayName}
            </button>
          ))}
        </div>

        {myItems.length === 0 && (
          <p className="text-[10px] text-muted/50 mt-1">
            🍎 アイテム で作ったものは、ここから直接えらべるようになります。
          </p>
        )}
      </section>

      <section>
        <h3 className="text-xs font-bold mb-1 text-muted/80">スポーンエッグ</h3>
        <label className="flex items-center gap-2 text-xs py-1">
          <input type="checkbox" checked={b.spawnEgg.enabled}
            onChange={e => update(mob.id, { spawnEgg: { ...b.spawnEgg, enabled: e.target.checked } })} />
          クリエイティブに卵を出す
        </label>
        {b.spawnEgg.enabled ? (
          <>
            <Row label="卵の色" hint="下地と斑点">
              <input type="color" className="w-10 h-7 rounded bg-transparent border border-white/15"
                value={b.spawnEgg.baseColor}
                onChange={e => update(mob.id, { spawnEgg: { ...b.spawnEgg, baseColor: e.target.value } })} />
              <input type="color" className="w-10 h-7 rounded bg-transparent border border-white/15"
                value={b.spawnEgg.overlayColor}
                onChange={e => update(mob.id, { spawnEgg: { ...b.spawnEgg, overlayColor: e.target.value } })} />
              {/* 実物と同じ見え方を出しておく。マイクラを開かずに色を決められる */}
              <span
                className="inline-block w-5 h-6 ml-1"
                title="でき上がりの見た目"
                style={{
                  background: b.spawnEgg.baseColor,
                  borderRadius: "50% 50% 45% 45% / 60% 60% 40% 40%",
                  boxShadow: `inset 0 -3px 0 ${b.spawnEgg.overlayColor}, inset 3px 2px 0 ${b.spawnEgg.overlayColor}`,
                }}
              />
            </Row>
            <p className="text-[10px] text-muted/50 pl-1">
              画像は要りません。色から自動で卵の絵が作られます。
            </p>
          </>
        ) : (
          <p className="text-[10px] text-muted/50 pl-1">
            卵を出さない場合、<code className="font-mono">/summon</code> か自然発生でしか出せません。
          </p>
        )}
      </section>

      <section>
        <h3 className="text-xs font-bold mb-1 text-muted/80">自然にわいてくる</h3>
        <label className="flex items-center gap-2 text-xs py-1">
          <input type="checkbox" checked={b.spawn.enabled}
            onChange={e => update(mob.id, { spawn: { ...b.spawn, enabled: e.target.checked } })} />
          ワールドに自然発生させる
        </label>
        {b.spawn.enabled && (
          <>
            <Row label="明るさ" hint="0=真っ暗 15=昼">
              <input type="number" min={0} max={15} className={numberCls}
                value={b.spawn.minLightLevel}
                onChange={e => update(mob.id, { spawn: { ...b.spawn, minLightLevel: Number(e.target.value) } })} />
              <span className="text-[10px] text-muted/50">〜</span>
              <input type="number" min={0} max={15} className={numberCls}
                value={b.spawn.maxLightLevel}
                onChange={e => update(mob.id, { spawn: { ...b.spawn, maxLightLevel: Number(e.target.value) } })} />
            </Row>
            <Row label="出やすさ" hint="大きいほど多い">
              <input type="number" min={1} max={100} className={numberCls}
                value={b.spawn.weight}
                onChange={e => update(mob.id, { spawn: { ...b.spawn, weight: Number(e.target.value) } })} />
            </Row>
          </>
        )}
      </section>

      {problems.length > 0 ? (
        <div className="rounded-lg p-3 text-xs" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)" }}>
          <div className="font-bold mb-1">このままだと出力できません</div>
          <ul className="list-disc pl-4 space-y-0.5">
            {problems.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      ) : (
        <div className="rounded-lg p-3 text-xs" style={{ background: "rgba(60,208,112,0.10)", border: "1px solid rgba(60,208,112,0.35)" }}>
          準備できています。「🚀 マイクラへ」からアドオンを書き出すと、このモブが入ります。<br />
          ゲーム内では <code className="font-mono">/summon cubicengine:{mob.id}</code> で呼び出せます。
        </div>
      )}
    </div>
  );
}
