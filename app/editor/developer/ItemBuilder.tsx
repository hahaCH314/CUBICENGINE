"use client";

/**
 * アイテムを作る画面。
 *
 * モブと違って3Dモデルは要らない。**絵を1枚入れて名前を付ければできる。**
 * だから取り込みと設定を1つの画面にまとめている（モブのように分けると
 * かえって手数が増える）。
 */

import { useCallback, useRef, useState } from "react";
import { useEditorStore } from "../store";
import {
  WEAPON_EFFECTS,
  defaultFood,
  defaultWeapon,
  makeItem,
  validateItem,
  type ItemIR,
  type ItemWeapon,
  type WeaponEffect,
} from "../../../lib/devtab/itemIr";

const numberCls = "w-24 px-2 py-1 rounded text-xs bg-black/40 border border-white/15";

/**
 * 効果のリストを編集する部品。「殴った相手に」と「持っている自分に」で
 * 同じ形なので共通にしてある。
 *
 * ⚠️ 効果IDは自由入力にしないこと。マイクラは知らないIDを**黙って無視する**ので、
 *    打ち間違えると「効果が付かない」原因が分からなくなる。必ず選択肢から選ばせる。
 */
function EffectList({
  title,
  hint,
  forSelf,
  list,
  onChange,
}: {
  title: string;
  hint: string;
  forSelf: boolean;
  list: WeaponEffect[];
  onChange: (next: WeaponEffect[]) => void;
}) {
  // 相手に掛けるものと自分に掛けるものを分ける。
  // 「相手を速くする」は作れてしまうが、まず作りたいものではない
  const choices = WEAPON_EFFECTS.filter(e => e.forSelf === forSelf);

  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs font-bold">
        {title}
        <span className="block text-[10px] text-muted/50 font-normal">{hint}</span>
      </div>

      {list.map((e, i) => (
        <div key={i} className="flex items-center gap-1.5 text-xs">
          <select
            className="flex-1 px-2 py-1 rounded text-xs bg-black/40 border border-white/15"
            value={e.id}
            onChange={ev => {
              const next = [...list];
              next[i] = { ...e, id: ev.target.value };
              onChange(next);
            }}
          >
            {choices.map(c => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          {/* 秒数は「持っている間」には意味がない（掛け直し続けるため） */}
          {!forSelf && (
            <>
              <input type="number" min={1} className="w-14 px-2 py-1 rounded text-xs bg-black/40 border border-white/15"
                value={e.seconds}
                onChange={ev => {
                  const next = [...list];
                  next[i] = { ...e, seconds: Number(ev.target.value) };
                  onChange(next);
                }} />
              <span className="text-[10px] text-muted/50">秒</span>
            </>
          )}
          {/* 強さ。マイクラの表記より1小さいので、画面には見た目の数字を出す */}
          <input type="number" min={1} max={256} className="w-14 px-2 py-1 rounded text-xs bg-black/40 border border-white/15"
            value={e.amplifier + 1}
            onChange={ev => {
              const next = [...list];
              next[i] = { ...e, amplifier: Math.max(0, Number(ev.target.value) - 1) };
              onChange(next);
            }} />
          <span className="text-[10px] text-muted/50">の強さ</span>
          <button
            onClick={() => onChange(list.filter((_, j) => j !== i))}
            className="text-[11px] px-1.5 py-1 rounded hover:bg-white/10 text-muted/70"
          >
            ✕
          </button>
        </div>
      ))}

      <button
        onClick={() => onChange([...list, { id: choices[0].id, seconds: 5, amplifier: 0 }])}
        className="self-start text-[11px] px-2 py-1 rounded"
        style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.35)" }}
      >
        ＋ 効果を足す
      </button>
    </div>
  );
}

function ItemCard({ item }: { item: ItemIR }) {
  const update = useEditorStore(s => s.updateDevItem);
  const remove = useEditorStore(s => s.removeDevItem);
  const problems = validateItem(item);
  const food = item.food;
  const weapon = item.weapon;
  const kind = weapon ? "weapon" : food ? "food" : "plain";

  return (
    <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)" }}>
      <div className="flex items-center gap-3">
        {/* ドット絵なので拡大時にぼかさない */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.iconDataUrl} alt="" width={48} height={48}
          style={{ imageRendering: "pixelated", background: "rgba(0,0,0,0.4)", borderRadius: 6 }} />
        <div className="flex-1">
          <input
            className="w-full px-2 py-1 rounded text-sm font-bold bg-black/40 border border-white/15"
            value={item.displayName}
            onChange={e => update(item.id, { displayName: e.target.value })}
          />
          <code className="text-[10px] text-muted/60">cubicengine:{item.id}</code>
        </div>
        <button onClick={() => remove(item.id)} className="text-[11px] px-2 py-1 rounded hover:bg-white/10 text-muted/70">
          取り消す
        </button>
      </div>

      {/* ⚠️ 重ねられる数だけは 1〜64 を外さないこと。マイクラのスロットは64個までで、
          65以上を書くとアイテムごと読み込まれない（他の数値と違い上限が要る） */}
      {!weapon && (
        <label className="flex items-center gap-3 text-xs">
          <span className="w-32 shrink-0">重ねられる数<span className="block text-[10px] text-muted/50">1〜64（マイクラの上限）</span></span>
          <input type="number" min={1} max={64} className={numberCls}
            value={item.maxStack}
            onChange={e => update(item.id, { maxStack: Number(e.target.value) })} />
        </label>
      )}

      {/* 種類は排他。食べられる剣は作れてしまうが、持ち替えるたびに
          食べる動作が出て使い物にならないので、選ばせる形にする */}
      <div className="flex flex-col gap-1">
        {([
          ["plain", "見た目だけ", "持てる・置ける。それだけ"],
          ["food", "食べられる", "回復量を決められます"],
          ["weapon", "剣", "攻撃力と耐久値を決められます"],
        ] as const).map(([k, label, hint]) => (
          <label key={k} className="flex items-start gap-2 text-xs cursor-pointer">
            <input type="radio" name={`kind-${item.id}`} className="mt-0.5"
              checked={kind === k}
              onChange={() => {
                if (k === "food") update(item.id, { food: defaultFood(), weapon: null, maxStack: 64 });
                else if (k === "weapon") update(item.id, { weapon: defaultWeapon(), food: null, maxStack: 1 });
                else update(item.id, { food: null, weapon: null, maxStack: 64 });
              }} />
            <span>
              {label}
              <span className="block text-[10px] text-muted/50">{hint}</span>
            </span>
          </label>
        ))}
      </div>

      {weapon && (
        <div className="pl-5 flex flex-col gap-1.5">
          {/* ⚠️ max を付けないこと。上限があると「最強の剣を作る」ができない。
              マイクラ側は大きい値をそのまま受け取るので、上限は要らない */}
          <label className="flex items-center gap-3 text-xs">
            <span className="w-32 shrink-0">攻撃力<span className="block text-[10px] text-muted/50">木の剣4 ダイヤ7 ／ 上限なし</span></span>
            <input type="number" min={1} className={numberCls}
              value={weapon.damage}
              onChange={e => update(item.id, { weapon: { ...weapon, damage: Number(e.target.value) } })} />
          </label>
          <label className="flex items-center gap-3 text-xs">
            <span className="w-32 shrink-0">耐久値<span className="block text-[10px] text-muted/50">木59 ダイヤ1561 ／ 0で無限</span></span>
            <input type="number" min={0} className={numberCls}
              value={weapon.durability}
              onChange={e => update(item.id, { weapon: { ...weapon, durability: Number(e.target.value) } })} />
          </label>
          {weapon.durability === 0 && (
            <p className="text-[10px]" style={{ color: "#fbbf24" }}>
              ⚡ 耐久値0 ＝ <b>絶対に壊れない剣</b>になります
            </p>
          )}
          {weapon.damage >= 100 && (
            <p className="text-[10px]" style={{ color: "#fbbf24" }}>
              ⚡ 攻撃力{weapon.damage} ＝ ほぼ何でも一撃です
            </p>
          )}
          {/* ── ここから「技」にあたる部分 ──
              JSON では書けないので、書き出すときにスクリプトが作られる。
              スクリプトが要るのはこの3つ（燃やす／相手に効果／自分に効果）だけで、
              何も設定しなければスクリプトは1行も足されない */}
          <div className="mt-2 pt-2 flex flex-col gap-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-xs font-bold" style={{ color: "#a78bfa" }}>
              ⚔ 特殊効果
              <span className="block text-[10px] text-muted/50 font-normal">
                設定するとスクリプトが作られます（ワールドの「ベータAPI」が要ります）
              </span>
            </div>

            <label className="flex items-center gap-3 text-xs">
              <span className="w-32 shrink-0">
                殴ると燃やす
                <span className="block text-[10px] text-muted/50">秒。0で燃やさない</span>
              </span>
              <input type="number" min={0} className={numberCls}
                value={weapon.fireSeconds ?? 0}
                onChange={e => update(item.id, { weapon: { ...weapon, fireSeconds: Number(e.target.value) } })} />
            </label>

            {/* ⚠️ ?? [] を外さないこと。この機能より前に保存された作品には
                effects / selfEffects が無く、undefined を .map して画面が落ちる */}
            <EffectList
              title="殴った相手に起きること"
              hint="毒・衰弱など。複数入れると同時に掛かります"
              forSelf={false}
              list={weapon.effects ?? []}
              onChange={next => update(item.id, { weapon: { ...weapon, effects: next } })}
            />

            <EffectList
              title="持っている間ずっと自分に"
              hint="足を速くする・力を上げるなど。手に持っている間だけ効きます"
              forSelf
              list={weapon.selfEffects ?? []}
              onChange={next => update(item.id, { weapon: { ...weapon, selfEffects: next } })}
            />
          </div>

          <p className="text-[10px] text-muted/50">
            剣は重ねられません。金床での修理はまだできません。
          </p>
        </div>
      )}

      {food && (
        <div className="pl-5 flex flex-col gap-1.5">
          {/* ここも上限なし。満腹度が最大20でも、それを超える値は無害に切り捨てられる */}
          <label className="flex items-center gap-3 text-xs">
            <span className="w-32 shrink-0">回復する量<span className="block text-[10px] text-muted/50">肉半分＝1 ／ 上限なし</span></span>
            <input type="number" min={0} className={numberCls}
              value={food.nutrition}
              onChange={e => update(item.id, { food: { ...food, nutrition: Number(e.target.value) } })} />
          </label>
          <label className="flex items-center gap-3 text-xs">
            <span className="w-32 shrink-0">腹持ち<span className="block text-[10px] text-muted/50">りんご0.3 肉0.8 ／ 上限なし</span></span>
            <input type="number" min={0} step={0.1} className={numberCls}
              value={food.saturation}
              onChange={e => update(item.id, { food: { ...food, saturation: Number(e.target.value) } })} />
          </label>
          <label className="flex items-center gap-3 text-xs">
            <span className="w-32 shrink-0">食べる時間<span className="block text-[10px] text-muted/50">秒。ふつう1.6 ／ 小さいほど速い</span></span>
            <input type="number" min={0.1} step={0.1} className={numberCls}
              value={food.useDuration}
              onChange={e => update(item.id, { food: { ...food, useDuration: Number(e.target.value) } })} />
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={food.canAlwaysEat}
              onChange={e => update(item.id, { food: { ...food, canAlwaysEat: e.target.checked } })} />
            お腹いっぱいでも食べられる（金のリンゴと同じ）
          </label>
        </div>
      )}

      {problems.length > 0 ? (
        <div className="rounded-lg p-2.5 text-xs" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)" }}>
          <ul className="list-disc pl-4 space-y-0.5">{problems.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </div>
      ) : (
        <div className="rounded-lg p-2.5 text-xs" style={{ background: "rgba(60,208,112,0.10)", border: "1px solid rgba(60,208,112,0.35)" }}>
          クリエイティブの持ち物に出ます。<code className="font-mono">/give @s cubicengine:{item.id}</code> でも出せます。
        </div>
      )}
    </div>
  );
}

export default function ItemBuilder() {
  const items = useEditorStore(s => s.devItems);
  const upsert = useEditorStore(s => s.upsertDevItem);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  const add = useCallback(
    async (file: File) => {
      setError("");
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onerror = () => reject(r.error);
          r.onload = () => resolve(String(r.result));
          r.readAsDataURL(file);
        });
        const name = file.name.replace(/\.(png|jpg|jpeg)$/i, "");
        // 既存の id を渡して一意性を保証させる。渡さないと日本語名のアイテムが
        // 全部 custom_item に潰れて上書きし合う
        upsert(makeItem(name, dataUrl, items.map(x => x.id)));
      } catch (e) {
        setError(`画像を読めませんでした（${e instanceof Error ? e.message : String(e)}）`);
      }
    },
    [items, upsert],
  );

  return (
    <div className="flex flex-col gap-4 p-5">
      <div>
        <h2 className="text-lg font-bold">アイテムを作る</h2>
        <p className="text-xs text-muted/70 mt-1">
          絵を1枚入れるだけで作れます。<b>16×16</b> のPNGがおすすめです。
        </p>
      </div>

      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) void add(f);
        }}
        className="rounded-xl border-2 border-dashed p-6 text-center cursor-pointer"
        style={{ borderColor: "rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.02)" }}
      >
        <div className="text-2xl mb-1">🍎</div>
        <div className="text-sm font-bold">アイテムの絵をここにドロップ</div>
        <div className="text-[11px] text-muted/60 mt-1">クリックして選ぶこともできます</div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) void add(f);
            e.target.value = "";
          }} />
      </div>

      {error && (
        <div className="rounded-lg p-3 text-xs" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)" }}>
          {error}
        </div>
      )}

      {items.map(it => <ItemCard key={it.id} item={it} />)}
    </div>
  );
}
