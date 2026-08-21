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
import { defaultFood, defaultWeapon, makeItem, validateItem, type ItemIR } from "../../../lib/devtab/itemIr";

const numberCls = "w-24 px-2 py-1 rounded text-xs bg-black/40 border border-white/15";

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
