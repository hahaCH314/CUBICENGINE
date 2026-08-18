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

export default function MobBuilder({ mob }: { mob: MobIR }) {
  const update = useEditorStore(s => s.updateDevMobBehavior);
  const remove = useEditorStore(s => s.removeDevMob);
  const b = mob.behavior;
  const problems = validateMob(mob);

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
        <label className="flex items-center gap-2 text-xs py-1">
          <input type="checkbox" checked={b.hostile}
            onChange={e => update(mob.id, { hostile: e.target.checked })} />
          プレイヤーを襲う
        </label>
        {b.hostile && (
          <Row label="攻撃力" hint="ハート半分＝1">
            <input type="number" min={1} max={100} className={numberCls}
              value={b.attackDamage}
              onChange={e => update(mob.id, { attackDamage: Number(e.target.value) })} />
          </Row>
        )}
        {!b.hostile && (
          <p className="text-[10px] text-muted/50 pl-1">襲わないモブは、殴られると逃げます。</p>
        )}
      </section>

      <section>
        <h3 className="text-xs font-bold mb-1 text-muted/80">たおしたとき落とすもの</h3>
        {b.drops.map((d, i) => (
          <div key={i} className="flex items-center gap-2 py-1">
            <input
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
        <button
          className="text-[11px] px-2 py-1 rounded mt-1"
          style={{ background: "rgba(255,255,255,0.07)" }}
          onClick={() => update(mob.id, { drops: [...b.drops, { item: "minecraft:diamond", min: 1, max: 1, chance: 1 }] })}
        >
          ＋ 落とすものを足す
        </button>
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
