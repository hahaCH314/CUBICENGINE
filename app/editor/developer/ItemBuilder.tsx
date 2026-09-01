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
  ARMOR_SLOTS,
  SKILL_KINDS,
  TOOL_KINDS,
  WEAPON_EFFECTS,
  defaultArmor,
  defaultFood,
  defaultSkill,
  defaultWeapon,
  makeItem,
  toNumber,
  validateItem,
  type ArmorSlot,
  type ItemIR,
  type SkillKind,
  type ToolKind,
  type WeaponEffect,
} from "../../../lib/devtab/itemIr";
import { t, tNode } from "@/lib/i18n";

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
    const locale = useEditorStore((s) => s.locale);
  // 相手に掛けるものと自分に掛けるものを分ける。
  // 「相手を速くする」は作れてしまうが、まず作りたいものではない
  const base = WEAPON_EFFECTS.filter(e => e.forSelf === forSelf);
  // ⚠️ いま入っている効果が候補に無いと、<select> は先頭の項目を表示してしまう。
  //    画面には「毒」と出ているのに書き出されるのは別物、という食い違いが起きる
  //    （古い作品や、あとで分類を変えたときに実際に起きる）。
  //    実際に入っている値は必ず候補に混ぜる
  const extra = WEAPON_EFFECTS.filter(
    e => e.forSelf !== forSelf && list.some(x => x.id === e.id),
  );
  const choices = [...base, ...extra];

  return (
    <div className="flex flex-col gap-1">
      {tNode(locale, "editor_frag_1a05c06809b_31", { arg0: <div className="text-xs font-bold">
        {title}
        <span className="block text-[10px] text-muted/50 font-normal">{hint}</span>
      </div>, arg1: {/* ⚠️ choices が空だと choices[0].id で落ちる。今の分類では起きないが、
          効果を足したり分類を変えたときに空になりうる */} })}</div>
  );
}

function ItemCard({ item }: { item: ItemIR }) {
    const locale = useEditorStore((s) => s.locale);
  const update = useEditorStore(s => s.updateDevItem);
  const remove = useEditorStore(s => s.removeDevItem);
  const problems = validateItem(item);
  const food = item.food;
  const weapon = item.weapon;
  const armor = item.armor;
  const skill = item.skill;
  const kind = weapon ? "weapon" : armor ? "armor" : food ? "food" : "plain";

  return (
    <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)" }}>
      {tNode(locale, "editor_frag_1a05c06809f_32", { arg0: <div className="flex items-center gap-3">
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
          {t(locale, "editor_873613")}</button>
      </div>, arg1: {/* ⚠️ 重ねられる数だけは 1〜64 を外さないこと。マイクラのスロットは64個までで、
          65以上を書くとアイテムごと読み込まれない（他の数値と違い上限が要る） */}, arg2: {/* 種類は排他。食べられる剣は作れてしまうが、持ち替えるたびに
          食べる動作が出て使い物にならないので、選ばせる形にする */}, arg3: <div className="flex flex-col gap-1">
        {([
          ["plain", t(locale, "editor_3e9a04"), t(locale, "editor_e75a4d")],
          ["food", t(locale, "editor_d60079"), t(locale, "editor_b56691")],
          ["weapon", t(locale, "editor_b2f261"), t(locale, "editor_6f4b12")],
          ["armor", t(locale, "editor_20d7a7"), t(locale, "editor_a3f261")],
        ] as const).map(([k, label, hint]) => (
          <label key={k} className="flex items-start gap-2 text-xs cursor-pointer">
            <input type="radio" name={`kind-${item.id}`} className="mt-0.5"
              checked={kind === k}
              onChange={() => {
                // ⚠️ 既にその種類なら何もしない。同じラジオを押し直しただけで
                //    default…() に戻ると、設定した攻撃力も効果もすべて消える
                if (kind === k) return;
                // 種類を変えたら他は必ず null にする。残っていると
                // 「剣なのに食べる動作が出る」ような組み合わせができてしまう
                // ⚠️ 技は防具にも付けられるので消さない。ただし食べ物だけは
                //    右クリックを奪い合うため必ず外す
                if (k === "food") update(item.id, { food: defaultFood(), weapon: null, armor: null, skill: null, maxStack: 64 });
                else if (k === "weapon") update(item.id, { weapon: defaultWeapon(), food: null, armor: null, maxStack: 1 });
                else if (k === "armor") update(item.id, { armor: defaultArmor(), food: null, weapon: null, maxStack: 1 });
                else update(item.id, { food: null, weapon: null, armor: null, maxStack: 64 });
              }} />
            <span>
              {label}
              <span className="block text-[10px] text-muted/50">{hint}</span>
            </span>
          </label>
        ))}
      </div>, arg4: {/* ── 技。武器・防具・ただのアイテムに付けられる ──
          ⚠️ 食べ物には付けられない。どちらも右クリックを使うため、
             use_modifiers を奪い合って技が黙って効かなくなる */}, arg5: <div className="flex flex-col gap-2">
        <label className={`flex items-center gap-2 text-xs ${food ? "opacity-40" : "cursor-pointer"}`}>
          <input type="checkbox" checked={!!skill} disabled={!!food}
            onChange={e => update(item.id, { skill: e.target.checked ? defaultSkill() : null })} />
          <span className="font-bold" style={{ color: "#a78bfa" }}>
            {t(locale, "editor_3b6a85")}<span className="block text-[10px] text-muted/50 font-normal">
              {food
                ? t(locale, "editor_85001c")
                : t(locale, "editor_0d81fc")}
            </span>
          </span>
        </label>

        {skill && (() => {
          const def = SKILL_KINDS.find(k => k.id === skill.kind);
          return (
            <div className="pl-5 flex flex-col gap-1.5">
              {tNode(locale, "editor_frag_1a05c0680a2_33", { arg0: <label className="flex items-center gap-3 text-xs">
                <span className="w-32 shrink-0">{t(locale, "editor_8f4d37")}</span>
                <select
                  className="flex-1 px-2 py-1 rounded text-xs bg-black/40 border border-white/15"
                  value={skill.kind}
                  onChange={e => update(item.id, { skill: { ...skill, kind: e.target.value as SkillKind } })}
                >
                  {SKILL_KINDS.map(k => (
                    <option key={k.id} value={k.id}>{k.label}</option>
                  ))}
                </select>
              </label>, arg1: def && <p className="text-[10px] text-muted/50 pl-1">{def.hint}</p>, arg2: <label className="flex items-center gap-3 text-xs">
                <span className="w-32 shrink-0">{t(locale, "editor_3ce972")}<span className="block text-[10px] text-muted/50">{t(locale, "editor_3197ec")}</span></span>
                <input type="number" min={0} className={numberCls}
                  value={skill.cooldownSeconds}
                  onChange={e => update(item.id, { skill: { ...skill, cooldownSeconds: toNumber(e.target.value) } })} />
              </label> })}</div>
          );
        })()}
      </div> })}</div>
  );
}

export default function ItemBuilder() {
    const locale = useEditorStore((s) => s.locale);
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
        <h2 className="text-lg font-bold">{t(locale, "editor_d4bb31")}</h2>
        <p className="text-xs text-muted/70 mt-1">
          {tNode(locale, "editor_frag_1a05c0680a7_34", { arg0: <b>16×16</b> })}</p>
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
        <div className="text-sm font-bold">{t(locale, "editor_6a3d69")}</div>
        <div className="text-[11px] text-muted/60 mt-1">{t(locale, "editor_a4db1b")}</div>
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
