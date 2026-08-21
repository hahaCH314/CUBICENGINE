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
                  next[i] = { ...e, seconds: toNumber(ev.target.value) };
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
              next[i] = { ...e, amplifier: Math.max(0, toNumber(ev.target.value) - 1) };
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

      {/* ⚠️ choices が空だと choices[0].id で落ちる。今の分類では起きないが、
          効果を足したり分類を変えたときに空になりうる */}
      {choices.length > 0 && (
        <button
          onClick={() => onChange([...list, { id: choices[0].id, seconds: 5, amplifier: 0 }])}
          className="self-start text-[11px] px-2 py-1 rounded"
          style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.35)" }}
        >
          ＋ 効果を足す
        </button>
      )}
    </div>
  );
}

function ItemCard({ item }: { item: ItemIR }) {
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
      {!weapon && !armor && (
        <label className="flex items-center gap-3 text-xs">
          <span className="w-32 shrink-0">重ねられる数<span className="block text-[10px] text-muted/50">1〜64（マイクラの上限）</span></span>
          <input type="number" min={1} max={64} className={numberCls}
            value={item.maxStack}
            onChange={e => update(item.id, { maxStack: toNumber(e.target.value) })} />
        </label>
      )}

      {/* 種類は排他。食べられる剣は作れてしまうが、持ち替えるたびに
          食べる動作が出て使い物にならないので、選ばせる形にする */}
      <div className="flex flex-col gap-1">
        {([
          ["plain", "見た目だけ", "持てる・置ける。それだけ"],
          ["food", "食べられる", "回復量を決められます"],
          ["weapon", "道具・武器", "剣・ツルハシ・斧・シャベル・クワ"],
          ["armor", "防具", "防御力と、着ている間ずっと効く力"],
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
      </div>

      {weapon && (
        <div className="pl-5 flex flex-col gap-1.5">
          <label className="flex items-center gap-3 text-xs">
            <span className="w-32 shrink-0">道具の種類</span>
            <select
              className="flex-1 px-2 py-1 rounded text-xs bg-black/40 border border-white/15"
              value={weapon.kind ?? "sword"}
              onChange={e => update(item.id, { weapon: { ...weapon, kind: e.target.value as ToolKind } })}
            >
              {TOOL_KINDS.map(k => (
                <option key={k.id} value={k.id}>{k.label}</option>
              ))}
            </select>
          </label>
          <p className="text-[10px] text-muted/50 pl-1">
            {TOOL_KINDS.find(k => k.id === (weapon.kind ?? "sword"))?.hint}
          </p>

          {/* 剣は「掘る道具」ではないので速さを出さない。
              出しても意味が無いうえ、何の速さか分からず迷わせる */}
          {(weapon.kind ?? "sword") !== "sword" && (
            <label className="flex items-center gap-3 text-xs">
              <span className="w-32 shrink-0">掘る速さ<span className="block text-[10px] text-muted/50">ダイヤ8 ／ 上限なし</span></span>
              <input type="number" min={0} className={numberCls}
                value={weapon.digSpeed ?? 8}
                onChange={e => update(item.id, { weapon: { ...weapon, digSpeed: toNumber(e.target.value) } })} />
            </label>
          )}
          {(weapon.digSpeed ?? 8) >= 100 && (weapon.kind ?? "sword") !== "sword" && (
            <p className="text-[10px]" style={{ color: "#fbbf24" }}>
              ⚡ 速さ{weapon.digSpeed} ＝ 触れた瞬間に壊れます
            </p>
          )}

          {/* ⚠️ max を付けないこと。上限があると「最強の剣を作る」ができない。
              マイクラ側は大きい値をそのまま受け取るので、上限は要らない */}
          <label className="flex items-center gap-3 text-xs">
            <span className="w-32 shrink-0">攻撃力<span className="block text-[10px] text-muted/50">木の剣4 ダイヤ7 ／ 上限なし</span></span>
            <input type="number" min={1} className={numberCls}
              value={weapon.damage}
              onChange={e => update(item.id, { weapon: { ...weapon, damage: toNumber(e.target.value) } })} />
          </label>
          <label className="flex items-center gap-3 text-xs">
            <span className="w-32 shrink-0">耐久値<span className="block text-[10px] text-muted/50">木59 ダイヤ1561 ／ 0で無限</span></span>
            <input type="number" min={0} className={numberCls}
              value={weapon.durability}
              onChange={e => update(item.id, { weapon: { ...weapon, durability: toNumber(e.target.value) } })} />
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
                onChange={e => update(item.id, { weapon: { ...weapon, fireSeconds: toNumber(e.target.value) } })} />
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

      {armor && (
        <div className="pl-5 flex flex-col gap-1.5">
          <label className="flex items-center gap-3 text-xs">
            <span className="w-32 shrink-0">どこに着るか</span>
            <select
              className="flex-1 px-2 py-1 rounded text-xs bg-black/40 border border-white/15"
              value={armor.slot}
              onChange={e => update(item.id, { armor: { ...armor, slot: e.target.value as ArmorSlot } })}
            >
              {ARMOR_SLOTS.map(s => (
                <option key={s.id} value={s.id}>{s.label}（{s.example}）</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3 text-xs">
            <span className="w-32 shrink-0">防御力<span className="block text-[10px] text-muted/50">ダイヤ一式で20 ／ 上限なし</span></span>
            <input type="number" min={0} className={numberCls}
              value={armor.protection}
              onChange={e => update(item.id, { armor: { ...armor, protection: toNumber(e.target.value) } })} />
          </label>
          <label className="flex items-center gap-3 text-xs">
            <span className="w-32 shrink-0">耐久値<span className="block text-[10px] text-muted/50">0で無限</span></span>
            <input type="number" min={0} className={numberCls}
              value={armor.durability}
              onChange={e => update(item.id, { armor: { ...armor, durability: toNumber(e.target.value) } })} />
          </label>
          {armor.protection >= 20 && (
            <p className="text-[10px]" style={{ color: "#fbbf24" }}>
              ⚡ 防御力{armor.protection} ＝ これ1つでダイヤ一式を超えます
            </p>
          )}

          <div className="mt-2 pt-2 flex flex-col gap-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <EffectList
              title="着ている間ずっと自分に"
              hint="手に何を持っていても効きます"
              forSelf
              list={armor.wearEffects ?? []}
              onChange={next => update(item.id, { armor: { ...armor, wearEffects: next } })}
            />
          </div>

          {/* 見た目を作らない判断は itemToBedrock.ts のコメント参照。
              ここで黙っていると「バグでは」と思われるので必ず伝える */}
          <p className="text-[10px]" style={{ color: "rgba(251,191,36,0.8)" }}>
            ⚠️ 着ても体には表示されません（持ち物の絵だけ）。防御力と効果はちゃんと効きます。
          </p>
        </div>
      )}

      {/* ── 技。武器・防具・ただのアイテムに付けられる ──
          ⚠️ 食べ物には付けられない。どちらも右クリックを使うため、
             use_modifiers を奪い合って技が黙って効かなくなる */}
      <div className="flex flex-col gap-2">
        <label className={`flex items-center gap-2 text-xs ${food ? "opacity-40" : "cursor-pointer"}`}>
          <input type="checkbox" checked={!!skill} disabled={!!food}
            onChange={e => update(item.id, { skill: e.target.checked ? defaultSkill() : null })} />
          <span className="font-bold" style={{ color: "#a78bfa" }}>
            ✨ 右クリックで技を出す
            <span className="block text-[10px] text-muted/50 font-normal">
              {food
                ? "食べ物には付けられません（右クリックが食べる動作に使われるため）"
                : "スクリプトが作られます（ワールドの「ベータAPI」が要ります）"}
            </span>
          </span>
        </label>

        {skill && (() => {
          const def = SKILL_KINDS.find(k => k.id === skill.kind);
          return (
            <div className="pl-5 flex flex-col gap-1.5">
              <label className="flex items-center gap-3 text-xs">
                <span className="w-32 shrink-0">どんな技</span>
                <select
                  className="flex-1 px-2 py-1 rounded text-xs bg-black/40 border border-white/15"
                  value={skill.kind}
                  onChange={e => update(item.id, { skill: { ...skill, kind: e.target.value as SkillKind } })}
                >
                  {SKILL_KINDS.map(k => (
                    <option key={k.id} value={k.id}>{k.label}</option>
                  ))}
                </select>
              </label>
              {def && <p className="text-[10px] text-muted/50 pl-1">{def.hint}</p>}

              {def?.hasPower && (
                <label className="flex items-center gap-3 text-xs">
                  <span className="w-32 shrink-0">
                    威力
                    <span className="block text-[10px] text-muted/50">
                      {skill.kind === "heal" ? "回復する量" : skill.kind === "dash" ? "飛ぶ勢い" : "ダメージ量"} ／ 上限なし
                    </span>
                  </span>
                  <input type="number" min={0} className={numberCls}
                    value={skill.power}
                    onChange={e => update(item.id, { skill: { ...skill, power: toNumber(e.target.value) } })} />
                </label>
              )}
              {def?.hasRange && (
                <label className="flex items-center gap-3 text-xs">
                  <span className="w-32 shrink-0">範囲<span className="block text-[10px] text-muted/50">ブロック ／ 上限なし</span></span>
                  <input type="number" min={0} className={numberCls}
                    value={skill.range}
                    onChange={e => update(item.id, { skill: { ...skill, range: toNumber(e.target.value) } })} />
                </label>
              )}
              <label className="flex items-center gap-3 text-xs">
                <span className="w-32 shrink-0">次に使えるまで<span className="block text-[10px] text-muted/50">秒。0で連打できる</span></span>
                <input type="number" min={0} className={numberCls}
                  value={skill.cooldownSeconds}
                  onChange={e => update(item.id, { skill: { ...skill, cooldownSeconds: toNumber(e.target.value) } })} />
              </label>
              {skill.cooldownSeconds === 0 && (
                <p className="text-[10px]" style={{ color: "rgba(251,191,36,0.8)" }}>
                  ⚠️ 0だと押しっぱなしで連発されます。1以上にすると使いやすくなります。
                </p>
              )}
            </div>
          );
        })()}
      </div>

      {food && (
        <div className="pl-5 flex flex-col gap-1.5">
          {/* ここも上限なし。満腹度が最大20でも、それを超える値は無害に切り捨てられる */}
          <label className="flex items-center gap-3 text-xs">
            <span className="w-32 shrink-0">回復する量<span className="block text-[10px] text-muted/50">肉半分＝1 ／ 上限なし</span></span>
            <input type="number" min={0} className={numberCls}
              value={food.nutrition}
              onChange={e => update(item.id, { food: { ...food, nutrition: toNumber(e.target.value) } })} />
          </label>
          <label className="flex items-center gap-3 text-xs">
            <span className="w-32 shrink-0">腹持ち<span className="block text-[10px] text-muted/50">りんご0.3 肉0.8 ／ 上限なし</span></span>
            <input type="number" min={0} step={0.1} className={numberCls}
              value={food.saturation}
              onChange={e => update(item.id, { food: { ...food, saturation: toNumber(e.target.value) } })} />
          </label>
          <label className="flex items-center gap-3 text-xs">
            <span className="w-32 shrink-0">食べる時間<span className="block text-[10px] text-muted/50">秒。ふつう1.6 ／ 小さいほど速い</span></span>
            <input type="number" min={0.1} step={0.1} className={numberCls}
              value={food.useDuration}
              onChange={e => update(item.id, { food: { ...food, useDuration: toNumber(e.target.value) } })} />
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
