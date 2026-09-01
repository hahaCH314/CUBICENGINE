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
// 入力欄を空にすると Number("") が NaN になり、そのまま JSON に入ると
// マイクラが読み込みに失敗する。必ずこれを通す（理由は itemIr.ts のコメント）
import { toNumber } from "../../../lib/devtab/itemIr";
import type { MobIR } from "../../../lib/devtab/ir";
import { t } from "@/lib/i18n";

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
  { id: "minecraft:diamond", label: t(useEditorStore.getState().locale, "editor_017964") },
  { id: "minecraft:emerald", label: t(useEditorStore.getState().locale, "editor_7be5c1") },
  { id: "minecraft:gold_ingot", label: t(useEditorStore.getState().locale, "editor_d5003f") },
  { id: "minecraft:iron_ingot", label: t(useEditorStore.getState().locale, "editor_e713fb") },
  { id: "minecraft:bone", label: t(useEditorStore.getState().locale, "editor_aeac48") },
  { id: "minecraft:string", label: t(useEditorStore.getState().locale, "editor_eb162d") },
  { id: "minecraft:leather", label: t(useEditorStore.getState().locale, "editor_9dac8c") },
  { id: "minecraft:feather", label: t(useEditorStore.getState().locale, "editor_389b8c") },
  { id: "minecraft:gunpowder", label: t(useEditorStore.getState().locale, "editor_550947") },
  { id: "minecraft:rotten_flesh", label: t(useEditorStore.getState().locale, "editor_9308cc") },
  { id: "minecraft:apple", label: t(useEditorStore.getState().locale, "editor_208aae") },
  { id: "minecraft:beef", label: t(useEditorStore.getState().locale, "editor_6c721a") },
] as const;

export default function MobBuilder({ mob }: { mob: MobIR }) {
    const locale = useEditorStore((s) => s.locale);
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
          {t(locale, "editor_873613")}</button>
      </div>

      <MobPreview ir={mob} />

      {mob.animations.length > 0 && (
        <p className="text-[11px] text-muted/60">
          {t(locale, "editor_272138")}{mob.animations.length} {t(locale, "editor_7096d2")}{mob.animations.map(a => `${a.name}${a.loop ? t(locale, "editor_cf533a") : ""}`).join(" / ")}
          <br />
          <span className="text-muted/45">
            {t(locale, "editor_019604")}</span>
        </p>
      )}

      <section>
        <h3 className="text-xs font-bold mb-1 text-muted/80">{t(locale, "editor_4092ed")}</h3>
        {/* ⚠️ max を付けないこと。「倒せないボス」を作れることが価値なので、
            上限を設けると作りたいものが作れなくなる */}
        <Row label={t(locale, "editor_fd5f39")} hint={t(locale, "editor_6afcaa")}>
          <input type="number" min={1} className={numberCls}
            value={b.health}
            onChange={e => update(mob.id, { health: toNumber(e.target.value) })} />
        </Row>
        <Row label={t(locale, "editor_4868ee")} hint={t(locale, "editor_5452cb")}>
          <input type="number" min={0} step={0.05} className={numberCls}
            value={b.movementSpeed}
            onChange={e => update(mob.id, { movementSpeed: toNumber(e.target.value) })} />
        </Row>
        {b.movementSpeed >= 1 && (
          <p className="text-[10px] pl-1" style={{ color: "#fbbf24" }}>
            {t(locale, "editor_6de9f9")}{b.movementSpeed} {t(locale, "editor_9880af")}</p>
        )}
        {b.health >= 1000 && (
          <p className="text-[10px] pl-1" style={{ color: "#fbbf24" }}>
            {t(locale, "editor_388123")}{b.health} {t(locale, "editor_f5fc7a")}{Math.floor(b.health / 2)}{t(locale, "editor_c25388")}</p>
        )}
      </section>

      <section>
        <h3 className="text-xs font-bold mb-1 text-muted/80">{t(locale, "editor_689150")}</h3>
        <div className="flex flex-col gap-1 py-1">
          {([
            ["peaceful", t(locale, "editor_57a339"), t(locale, "editor_db3298")],
            ["player", t(locale, "editor_ba78fd"), t(locale, "editor_2d1948")],
            ["berserk", t(locale, "editor_ce5fd0"), t(locale, "editor_d6f0b3")],
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
          <Row label={t(locale, "editor_1ad535")} hint={t(locale, "editor_6afcaa")}>
            <input type="number" min={1} className={numberCls}
              value={b.attackDamage}
              onChange={e => update(mob.id, { attackDamage: toNumber(e.target.value) })} />
          </Row>
        )}
        {aggr !== "peaceful" && b.attackDamage >= 50 && (
          <p className="text-[10px] pl-1" style={{ color: "#fbbf24" }}>
            {t(locale, "editor_8b099c")}{b.attackDamage} {t(locale, "editor_60a25a")}</p>
        )}
        {aggr === "berserk" && (
          <p className="text-[10px] pl-1" style={{ color: "rgba(251,191,36,0.8)" }}>
            {t(locale, "editor_d54921")}</p>
        )}
      </section>

      <section>
        <h3 className="text-xs font-bold mb-1 text-muted/80">{t(locale, "editor_4b852d")}</h3>
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
                drops[i] = { ...d, min: toNumber(e.target.value) };
                update(mob.id, { drops });
              }} />
            <span className="text-[10px] text-muted/50">〜</span>
            <input type="number" min={1} className="w-14 px-2 py-1 rounded text-xs bg-black/40 border border-white/15"
              value={d.max}
              onChange={e => {
                const drops = [...b.drops];
                drops[i] = { ...d, max: toNumber(e.target.value) };
                update(mob.id, { drops });
              }} />
            <button className="text-[11px] px-2 text-muted/60 hover:text-white"
              onClick={() => update(mob.id, { drops: b.drops.filter((_, j) => j !== i) })}>×</button>
          </div>
        ))}
        {/* 入力欄の候補。自作アイテムを先に出す（探しに来る理由がこちらのため） */}
        <datalist id={`drops-${mob.id}`}>
          {myItems.map(it => (
            <option key={it.id} value={`cubicengine:${it.id}`}>{it.displayName}{t(locale, "editor_29f7f3")}</option>
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
            {t(locale, "editor_405537")}</button>
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
            {t(locale, "editor_53ca7f")}</p>
        )}
      </section>

      <section>
        <h3 className="text-xs font-bold mb-1 text-muted/80">{t(locale, "editor_d23e69")}</h3>
        <label className="flex items-center gap-2 text-xs py-1">
          <input type="checkbox" checked={b.spawnEgg.enabled}
            onChange={e => update(mob.id, { spawnEgg: { ...b.spawnEgg, enabled: e.target.checked } })} />
          {t(locale, "editor_ed24cd")}</label>
        {b.spawnEgg.enabled ? (
          <>
            <Row label={t(locale, "editor_d659d2")} hint={t(locale, "editor_7b8d1a")}>
              <input type="color" className="w-10 h-7 rounded bg-transparent border border-white/15"
                value={b.spawnEgg.baseColor}
                onChange={e => update(mob.id, { spawnEgg: { ...b.spawnEgg, baseColor: e.target.value } })} />
              <input type="color" className="w-10 h-7 rounded bg-transparent border border-white/15"
                value={b.spawnEgg.overlayColor}
                onChange={e => update(mob.id, { spawnEgg: { ...b.spawnEgg, overlayColor: e.target.value } })} />
              {/* 実物と同じ見え方を出しておく。マイクラを開かずに色を決められる */}
              <span
                className="inline-block w-5 h-6 ml-1"
                title={t(locale, "editor_e0adcc")}
                style={{
                  background: b.spawnEgg.baseColor,
                  borderRadius: "50% 50% 45% 45% / 60% 60% 40% 40%",
                  boxShadow: `inset 0 -3px 0 ${b.spawnEgg.overlayColor}, inset 3px 2px 0 ${b.spawnEgg.overlayColor}`,
                }}
              />
            </Row>
            <p className="text-[10px] text-muted/50 pl-1">
              {t(locale, "editor_3414a0")}</p>
          </>
        ) : (
          <p className="text-[10px] text-muted/50 pl-1">
            {t(locale, "editor_740047")}<code className="font-mono">/summon</code> {t(locale, "editor_b25c0d")}</p>
        )}
      </section>

      <section>
        <h3 className="text-xs font-bold mb-1 text-muted/80">{t(locale, "editor_8034f6")}</h3>
        <label className="flex items-center gap-2 text-xs py-1">
          <input type="checkbox" checked={b.spawn.enabled}
            onChange={e => update(mob.id, { spawn: { ...b.spawn, enabled: e.target.checked } })} />
          {t(locale, "editor_18378a")}</label>
        {b.spawn.enabled && (
          <>
            {/* ⚠️ ここは 0〜15 を外さないこと。マイクラの明るさは16段階しかなく、
                16以上を書くとスポーンルールごと読み込まれない（他と違い上限が要る） */}
            <Row label={t(locale, "editor_dfa86e")} hint={t(locale, "editor_5632c8")}>
              <input type="number" min={0} max={15} className={numberCls}
                value={b.spawn.minLightLevel}
                onChange={e => update(mob.id, { spawn: { ...b.spawn, minLightLevel: toNumber(e.target.value) } })} />
              <span className="text-[10px] text-muted/50">〜</span>
              <input type="number" min={0} max={15} className={numberCls}
                value={b.spawn.maxLightLevel}
                onChange={e => update(mob.id, { spawn: { ...b.spawn, maxLightLevel: toNumber(e.target.value) } })} />
            </Row>
            <Row label={t(locale, "editor_41200c")} hint={t(locale, "editor_8b26d1")}>
              <input type="number" min={1} className={numberCls}
                value={b.spawn.weight}
                onChange={e => update(mob.id, { spawn: { ...b.spawn, weight: toNumber(e.target.value) } })} />
            </Row>
            {b.spawn.weight >= 500 && (
              <p className="text-[10px] pl-1" style={{ color: "#fbbf24" }}>
                {t(locale, "editor_1c26e8")}{b.spawn.weight} {t(locale, "editor_5127ea")}</p>
            )}
          </>
        )}
      </section>

      {problems.length > 0 ? (
        <div className="rounded-lg p-3 text-xs" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)" }}>
          <div className="font-bold mb-1">{t(locale, "editor_75c6d8")}</div>
          <ul className="list-disc pl-4 space-y-0.5">
            {problems.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
        </div>
      ) : (
        <div className="rounded-lg p-3 text-xs" style={{ background: "rgba(60,208,112,0.10)", border: "1px solid rgba(60,208,112,0.35)" }}>
          {t(locale, "editor_db51c3")}<br />
          {t(locale, "editor_1fc61f")}<code className="font-mono">/summon cubicengine:{mob.id}</code> {t(locale, "editor_fbc795")}</div>
      )}
    </div>
  );
}
