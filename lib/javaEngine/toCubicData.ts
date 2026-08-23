/**
 * 積み木グラフ（CBlock[]）→ 設計図（cubic_data.json）。
 *
 * ■ なぜ codegenJava.ts と別に作るのか
 *   codegenJava.ts は「Java のソースコードを文字列で作る」もので、
 *   使うには JDK と gradle が要る。こちらは「JSON を作る」だけなので
 *   ブラウザで完結し、base-mod.jar にねじ込めば **そのまま mods に入る**。
 *   既存は Electron 側で使い続けるため、消さずに並行して置く。
 *
 * ■ 対応範囲
 *   codegenJava.ts が扱う 34 種（実測）に合わせる。
 *   ⚠️ ここで対応していないカードは**黙って無視される**。マイクラ側は
 *      何も言わないので、変換できなかったものは warnings で返して
 *      画面に出すこと。「置いたのに動かない」を無言にしない。
 */

import type { CBlock } from "../../app/editor/_types";
import {
  SPEC_VERSION,
  type CEAction,
  type CECondition,
  type CERule,
  type CETrigger,
  type CEValue,
  type CubicData,
} from "./spec";

/** フィールドの値を取る。無ければ既定値 */
function f(b: CBlock, id: string, fb = ""): string {
  return b.fields?.find(x => x.id === id)?.value ?? fb;
}

function num(s: string, fb: number): number {
  const n = Number(s);
  return Number.isFinite(n) ? n : fb;
}

/** id からブロックを引く */
function byId(blocks: CBlock[], id: string | null | undefined): CBlock | undefined {
  return id ? blocks.find(b => b.id === id) : undefined;
}

/** 値カード → CEValue。解決できないものは文字列として扱う */
function toValue(b: CBlock | undefined, raw: string): CEValue {
  if (!b) {
    const n = Number(raw);
    return Number.isFinite(n) && raw.trim() !== "" ? { kind: "num", value: n } : { kind: "text", value: raw };
  }
  switch (b.type) {
    case "va_name": return { kind: "var", name: "playerName" };
    case "va_hp":   return { kind: "var", name: "playerHp" };
    case "va_pos":  return { kind: "var", name: "playerPos" };
    case "va_score": return { kind: "var", name: "score", arg: f(b, "obj", "points") };
    case "va_rand": return { kind: "rand", max: num(f(b, "max", "10"), 10) };
    case "va_num":  return { kind: "num", value: num(f(b, "value", "0"), 0) };
    default:        return { kind: "text", value: f(b, "value", raw) };
  }
}

/** きっかけカード → CETrigger。対応外なら null */
function toTrigger(b: CBlock): CETrigger | null {
  switch (b.type) {
    case "ev_join":  return { type: "join" };
    case "ev_tick":  return { type: "tick" };
    case "ev_break": return { type: "break", block: f(b, "block") || undefined };
    case "ev_place": return { type: "place", block: f(b, "block") || undefined };
    case "ev_item":  return { type: "useItem", item: f(b, "item") || undefined };
    case "ev_hurt":  return { type: "hurt" };
    case "ev_chat":  return { type: "chat", pattern: f(b, "pat", "!hi") };
    default:         return null;
  }
}

/** 条件カード → CECondition。対応外なら null */
function toCondition(b: CBlock | undefined, all: CBlock[]): CECondition | null {
  if (!b) return null;
  switch (b.type) {
    case "co_tag":    return { type: "hasTag", tag: f(b, "tag", "vip") };
    case "co_item":   return { type: "hasItem", item: f(b, "item", "minecraft:diamond") };
    case "co_hp":     return { type: "hpBelow", value: num(f(b, "threshold", "10"), 10) };
    case "co_sneak":  return { type: "isSneaking" };
    case "co_night":  return { type: "isNight" };
    case "co_rain":   return { type: "isRaining" };
    case "co_and": {
      const xs = [toCondition(byId(all, b.innerId), all), toCondition(byId(all, b.nextId), all)]
        .filter(Boolean) as CECondition[];
      return xs.length ? { type: "and", all: xs } : null;
    }
    case "co_or": {
      const xs = [toCondition(byId(all, b.innerId), all), toCondition(byId(all, b.nextId), all)]
        .filter(Boolean) as CECondition[];
      return xs.length ? { type: "or", any: xs } : null;
    }
    case "co_not": {
      const inner = toCondition(byId(all, b.innerId), all);
      return inner ? { type: "not", of: inner } : null;
    }
    default: return null;
  }
}

/** 動作カード → CEAction。対応外なら null */
function toAction(b: CBlock, all: CBlock[]): CEAction | null {
  switch (b.type) {
    case "ac_msg":
      return {
        type: "message",
        text: toValue(byId(all, b.innerId), f(b, "msg", "こんにちは")),
        target: f(b, "target", "@a") === "@a" ? "all" : "self",
      };
    case "ac_give":
      return { type: "give", item: f(b, "item", "minecraft:diamond"), count: num(f(b, "count", "1"), 1) };
    case "ac_effect":
      return { type: "effect", effect: f(b, "eff", "speed"), seconds: num(f(b, "dur", "10"), 10), amplifier: 0 };
    case "ac_sound":
      return { type: "sound", sound: f(b, "snd", "random.orb"), volume: num(f(b, "vol", "1"), 1) };
    case "ac_title":
      return { type: "title", title: f(b, "title", ""), sub: f(b, "sub", "") };
    case "ac_tp":
      return { type: "teleport", x: num(f(b, "x", "0"), 0), y: num(f(b, "y", "64"), 64), z: num(f(b, "z", "0"), 0) };
    case "ac_cmd":
      return { type: "command", command: f(b, "cmd", "say hi") };
    case "ac_tag":
      return { type: "tag", tag: f(b, "tag", "vip"), add: f(b, "op", "add") !== "remove" };
    case "ac_score": {
      const op = f(b, "op", "add");
      return {
        type: "score",
        objective: f(b, "obj", "points"),
        op: op === "set" ? "set" : op === "remove" ? "remove" : "add",
        value: num(f(b, "value", "1"), 1),
      };
    }
    case "ac_kick":
      return { type: "kick", reason: f(b, "msg", "ルール違反") };
    default:
      return null;
  }
}

export interface ConvertResult {
  data: CubicData;
  /** 変換できなかったカード。画面に出して「無言で消える」のを防ぐ */
  warnings: string[];
}

/**
 * 積み木グラフを設計図に変換する。
 *
 * きっかけカードを起点に、nextId をたどって動作を集める。
 * ⚠️ 循環参照でも止まるよう、たどった id を覚えておくこと。
 *    利用者が輪のように繋ぐことは実際に起こりうる。
 */
export function toCubicData(blocks: CBlock[], projectName: string): ConvertResult {
  const warnings: string[] = [];
  const rules: CERule[] = [];

  for (const b of blocks) {
    const trigger = toTrigger(b);
    if (!trigger) continue;

    const actions: CEAction[] = [];
    const conditions: CECondition[] = [];
    const seen = new Set<string>([b.id]);

    let cur = byId(blocks, b.nextId);
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      const a = toAction(cur, blocks);
      if (a) {
        actions.push(a);
      } else if (cur.type === "co_if") {
        // もしも：条件を集め、then 側の動作を続けて拾う
        const c = toCondition(byId(blocks, cur.innerId), blocks);
        if (c) conditions.push(c);
        const thenB = byId(blocks, cur.thenId);
        if (thenB) {
          const ta = toAction(thenB, blocks);
          if (ta) actions.push(ta);
        }
      } else if (!cur.type.startsWith("va_") && !cur.type.startsWith("co_")) {
        warnings.push(`「${cur.label || cur.type}」は Java版ではまだ動きません`);
      }
      cur = byId(blocks, cur.nextId);
    }

    if (actions.length > 0) rules.push({ trigger, conditions, actions });
  }

  return {
    data: { spec: SPEC_VERSION, projectName, blocks: [], items: [], rules },
    warnings: [...new Set(warnings)],
  };
}
