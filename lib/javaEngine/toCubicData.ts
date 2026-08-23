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

import type { CBlock, Sticker } from "../../app/editor/_types";
import type { VoxelBlock, VoxelItem } from "../../app/editor/store";
import { normalizeAggression, type MobIR } from "../devtab/ir";
import {
  SPEC_VERSION,
  type CEAction,
  type CECondition,
  type CEBlock,
  type CEItem,
  type CEMob,
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

/**
 * 条件カード → CECondition。対応外なら null。
 *
 * ⚠️ かつ/または/〜じゃない は中に条件をぶら下げるので、**輪のように繋がれると
 *    自分を呼び続けて落ちる**。動作側の走査と同じく、たどった id を覚えて止める。
 *    利用者が輪を作ることは実際に起こる（落ちると ZIP フォールバックに落ちて、
 *    「なぜか .jar にならない」だけが残り、原因が分からなくなる）。
 */
function toCondition(
  b: CBlock | undefined,
  all: CBlock[],
  seen: ReadonlySet<string> = new Set(),
): CECondition | null {
  if (!b) return null;
  if (seen.has(b.id)) return null;   // 一周した。ここで打ち切る
  const inner = new Set(seen).add(b.id);
  switch (b.type) {
    case "co_tag":    return { type: "hasTag", tag: f(b, "tag", "vip") };
    case "co_item":   return { type: "hasItem", item: f(b, "item", "minecraft:diamond") };
    case "co_hp":     return { type: "hpBelow", value: num(f(b, "threshold", "10"), 10) };
    case "co_sneak":  return { type: "isSneaking" };
    case "co_night":  return { type: "isNight" };
    case "co_rain":   return { type: "isRaining" };
    case "co_and": {
      const xs = [toCondition(byId(all, b.innerId), all, inner), toCondition(byId(all, b.nextId), all, inner)]
        .filter(Boolean) as CECondition[];
      return xs.length ? { type: "and", all: xs } : null;
    }
    case "co_or": {
      const xs = [toCondition(byId(all, b.innerId), all, inner), toCondition(byId(all, b.nextId), all, inner)]
        .filter(Boolean) as CECondition[];
      return xs.length ? { type: "or", any: xs } : null;
    }
    case "co_not": {
      const of = toCondition(byId(all, b.innerId), all, inner);
      return of ? { type: "not", of } : null;
    }
    default: return null;
  }
}

/**
 * 条件シール1枚 → CECondition。めくってあれば「〜じゃないとき」。
 *
 * シールは条件カードと中身が同じなので、仮のカードを作って toCondition に通す
 * （統合版 lib/codegen.ts の stickerExpr と同じ考え方。条件の種類が増えても
 *  ここは直さなくてよい）。
 */
function stickerToCondition(s: Sticker, all: CBlock[]): CECondition | null {
  const fake: CBlock = {
    id: "__sticker__", type: s.type, emoji: "", label: "", sublabel: "",
    category: "ifelse", fields: s.fields ?? [],
    x: 0, y: 0, nextId: null, innerId: null, thenId: null, elseId: null,
  };
  const c = toCondition(fake, all);
  if (!c) return null;
  return s.neg ? { type: "not", of: c } : c;
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

/**
 * マイクラの識別子に使える形へ。
 * ⚠️ exporter.ts の sanitizeBlockName と**同じ規則**にすること。
 *    ここがズレると、設計図に書いた id とエンジンが登録する id が食い違い、
 *    ブロックはあるのに置けない状態になる（マイクラは何も言わない）。
 */
/** 改行を取り除く。lang ファイルに改行が入ると行が壊れる */
function oneLine(s: string): string {
  // 正規表現リテラルを使わない。生成スクリプト経由で書くと
  // \n がそのまま実改行に化けて構文が壊れるため（実際に2回壊した）。
  const LF = String.fromCharCode(10);
  const CR = String.fromCharCode(13);
  return s.split(LF).join(" ").split(CR).join(" ");
}

/**
 * マイクラの識別子に使える形へ。
 *
 * ⚠️ exporter.ts の sanitizeMcId と**まったく同じ規則**にすること。
 *    以前ここだけ toLowerCase していて、"MagicStone" が
 *    exporter 側は "agictone"（大文字を削除）、こちらは "magicstone" になり、
 *    設計図のIDとアセットのパスが食い違ってテクスチャが出なかった。
 *    大文字は落とす。小文字化しない。
 */
function toMcId(s: string, fb: string): string {
  return s.replace(/[^a-z0-9_-]/g, "") || fb;
}

/**
 * 同じIDが2つ以上できないようにする。
 *
 * ⚠️ 日本語だけの名前は全滅して既定値に潰れる（"魔法の石" → "block"）。
 *    2つ作ると同じIDになり、Forge の DeferredRegister が
 *    Duplicate registration を投げて**マイクラが起動時に落ちる**。
 *    落とすくらいなら連番を付けて必ず一意にする。
 */
function uniqueId(base: string, used: Set<string>): string {
  let id = base;
  let n = 2;
  while (used.has(id)) id = `${base}_${n++}`;
  used.add(id);
  return id;
}

/**
 * モデルタブのブロック → 設計図＋元のブロックの対。registered=ON のものだけ。
 *
 * ⚠️ **アセット（モデル・テクスチャ・lang）は必ずここが決めた id で書くこと。**
 *    exporter 側で名前から作り直すと、`uniqueId` が付ける連番（block / block_2）が
 *    再現できない。日本語だけの名前は英数字が全部落ちて同じ id になるので、
 *    2個目以降が必ずズレる。ズレた分は**紫と黒の四角**になり、名前も
 *    翻訳キーのまま出る（マイクラは何も言わない）。
 */
export function pairCEBlocks(blocks: readonly VoxelBlock[]): { ce: CEBlock; src: VoxelBlock }[] {
  const used = new Set<string>();
  return blocks
    .filter(b => b.registered)
    .map(b => ({
      src: b,
      ce: {
        id: uniqueId(toMcId(b.name, "block"), used),
        displayName: oneLine(b.displayName || b.name || "ブロック"),
        hardness: Number.isFinite(b.hardness) ? Math.max(0, b.hardness as number) : 1.5,
        // ⚠️ 0〜15 はマイクラの上限。16以上を書くと登録に失敗する
        lightLevel: Math.min(15, Math.max(0, Math.round(b.lightLevel ?? 0))),
      },
    }));
}

/** モデルタブのブロック → 設計図。registered=ON のものだけ出す */
export function toCEBlocks(blocks: readonly VoxelBlock[]): CEBlock[] {
  return pairCEBlocks(blocks).map(p => p.ce);
}

export function pairCEMobs(mobs: readonly MobIR[]): { ce: CEMob; src: MobIR }[] {
  const usedMobIds = new Set<string>();
  return mobs.map(m => {
    const b = m.behavior;
    // 性格から土台を選ぶ。おとなしい＝村人、襲う＝ゾンビ。
    // 見た目が挙動と食い違うと「なぜ襲ってくるのか」が分からなくなる
    const aggr = normalizeAggression(b.aggression);
    const base = aggr === "peaceful" ? "minecraft:villager" : "minecraft:zombie";
    return {
      src: m,
      ce: {
        id: uniqueId(toMcId(m.id, "mob"), usedMobIds),
        displayName: oneLine(m.displayName || m.id || "モブ"),
        base,
        health: Math.max(1, Math.round(b.health ?? 20)),
        attackDamage: Math.max(0, Math.round(b.attackDamage ?? 0)),
        movementSpeed: Math.max(0, b.movementSpeed ?? 0.25),
        drops: (b.drops ?? []).map(d => ({
          item: d.item,
          min: Math.max(0, Math.round(d.min ?? 1)),
          max: Math.max(0, Math.round(d.max ?? 1)),
        })),
      },
    };
  });
}

/**
 * デベロッパータブのモブ → 設計図。
 *
 * ⚠️ 3Dモデルは写せない。Forge のエンティティモデルは Java のコードで書くもので、
 *    JSON から動的に作れないため。土台にするバニラのモブを性格から選び、
 *    強さと名前だけを持たせる。形をそのまま出したい人は統合版を使う。
 */
export function toCEMobs(mobs: readonly MobIR[]): CEMob[] {
  return pairCEMobs(mobs).map(p => p.ce);
}

/**
 * モデルタブのアイテム → 設計図＋元のアイテムの対。
 * ⚠️ ブロックと同じ理由で、アセットは必ずここが決めた id で書くこと。
 */
export function pairCEItems(items: readonly VoxelItem[]): { ce: CEItem; src: VoxelItem }[] {
  const used = new Set<string>();
  return items
    .filter(i => i.registered)
    .map(i => ({
      src: i,
      ce: {
        id: uniqueId(toMcId(i.name, "item"), used),
        displayName: oneLine(i.displayName || i.name || "アイテム"),
        // ⚠️ 1〜64 はマイクラの上限。65以上はアイテムごと読み込まれない
        maxStack: 64,
      },
    }));
}

/** モデルタブのアイテム → 設計図 */
export function toCEItems(items: readonly VoxelItem[]): CEItem[] {
  return pairCEItems(items).map(p => p.ce);
}

/**
 * 積み木のつながりを「ルールの並び」に変換する道具一式。
 *
 * ■ なぜルールを分けるのか
 *   設計図の条件は **ルール1つに丸ごと掛かる**（エンジンは rule ごとに
 *   conditions を全部 AND で見てから actions を回す。base-mod.jar の
 *   onTrigger を javap で実測して確認、2026-08-23）。
 *   だから「もしも」の前後で条件の効く範囲が変わるものを1ルールに詰めると、
 *   **「もしも」より前に置いた動作まで条件で止まる**。
 *   条件が変わるたびにルールを切り、同じきっかけのルールを何本も出す。
 *   エンジンは一致するルールを**全部**回す（途中で抜けない）ので、
 *   並べた順にそのまま実行される。
 *
 * ■ ちがうなら（else）
 *   エンジンは「〜じゃないとき(not)」を持っているので、
 *   else 側は条件を反転したルールとして出せる。エンジンは触らなくてよい。
 */
interface Walk {
  trigger: CETrigger;
  blocks: CBlock[];
  out: CERule[];
  warnings: string[];
}

/**
 * カードを1枚ずつたどってルールに積む。
 *
 * @param startId たどり始めるカード
 * @param base    ここまでに掛かっている条件（「もしも」の中なら増えている）
 * @param seen    たどったカード。**枝ごとに複製する**。
 *                共有すると、そうなら側で通った id のせいで
 *                ちがうなら側が黙って空になる。
 */
function walkChain(startId: string | null | undefined, w: Walk, base: CECondition[], seen: Set<string>): void {
  let pending: CEAction[] = [];
  /** 溜めた動作を1ルールとして確定する。空なら何もしない */
  const flush = () => {
    if (pending.length === 0) return;
    w.out.push({ trigger: w.trigger, conditions: [...base], actions: pending });
    pending = [];
  };

  let cur = byId(w.blocks, startId);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    const b = cur;
    const name = b.label || b.type;
    const action = toAction(b, w.blocks);

    if (action) {
      // 条件シールは**貼られたその1枚にだけ**効く（統合版と同じ意味）。
      // 条件はルール単位なので、シール付きのカードは単独のルールにする。
      const stickers = b.stickers ?? [];
      const extra: CECondition[] = [];
      let broken = false;
      for (const s of stickers) {
        const c = stickerToCondition(s, w.blocks);
        if (c) extra.push(c);
        else broken = true;
      }
      if (broken) {
        // 効かない条件を黙って落とすと「条件を無視して必ず動く」になる。
        // それは利用者の意図と正反対なので、動作ごと出さずに必ず伝える。
        w.warnings.push(`「${name}」に貼った条件シールは Java版ではまだ使えません（このカードは出していません）`);
      } else if (extra.length > 0) {
        flush();
        w.out.push({ trigger: w.trigger, conditions: [...base, ...extra], actions: [action] });
      } else {
        pending.push(action);
      }
    } else if (b.type === "co_if") {
      const cond = toCondition(byId(w.blocks, b.innerId), w.blocks);
      flush();
      if (!cond) {
        // 条件が読めないまま中身を出すと、**条件を無視して必ず動く**ものになる。
        // 「キックする」などが無条件で走ると事故になるので、出さずに伝える。
        w.warnings.push(
          b.innerId
            ? `「もしも」の条件は Java版ではまだ使えません（そうなら／ちがうなら の中身は出していません）`
            : `「もしも」の穴が空のままです（そうなら／ちがうなら の中身は出していません）`,
        );
      } else {
        // そうなら：条件を足して、その枝を**最後まで**たどる
        walkChain(b.thenId, w, [...base, cond], new Set(seen));
        // ちがうなら：条件を反転して、その枝を最後まで
        walkChain(b.elseId, w, [...base, { type: "not", of: cond }], new Set(seen));
      }
      // 「もしも」を抜けた先は、また元の条件に戻る
    } else if (!b.type.startsWith("va_") && !b.type.startsWith("co_")) {
      w.warnings.push(`「${name}」は Java版ではまだ動きません`);
    }

    cur = byId(w.blocks, b.nextId);
  }
  flush();
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
export function toCubicData(
  blocks: CBlock[],
  projectName: string,
  voxelBlocks: readonly VoxelBlock[] = [],
  voxelItems: readonly VoxelItem[] = [],
  devMobs: readonly MobIR[] = [],
): ConvertResult {
  const warnings: string[] = [];
  const rules: CERule[] = [];

  for (const b of blocks) {
    const trigger = toTrigger(b);
    if (!trigger) continue;
    // きっかけカード自身を seen に入れて始める（輪になっていても止まる）
    walkChain(b.nextId, { trigger, blocks, out: rules, warnings }, [], new Set<string>([b.id]));
  }

  // モブは spec 2 のエンジンで出るようになった（2026-08-23）。
  // ⚠️ ただし**作った形は写らない**。Forge のエンティティモデルは Java のコードで
  //    書くもので、JSON から作れないため、バニラのモブを土台にして
  //    強さと名前だけを載せている（pairCEMobs 参照）。
  //    作った子は自分が描いた姿が出ると思っているので、ここを黙っていると
  //    「ちゃんと作ったのに違うものが出た」になる。必ず先に伝える。
  if (devMobs.length > 0) {
    warnings.push(
      `モブ${devMobs.length}体は Java版では姿が変わります（おとなしい子は村人、襲う子はゾンビの姿になります。名前・強さ・落とすものはそのままです）`,
    );
    warnings.push(
      `モブを出すときは、クリエイティブの持ち物にある「（モブの名前） スポーンエッグ」を使ってください`,
    );
  }

  return {
    data: {
      spec: SPEC_VERSION,
      projectName,
      blocks: toCEBlocks(voxelBlocks),
      items: toCEItems(voxelItems),
      mobs: toCEMobs(devMobs),
      rules,
    },
    warnings: [...new Set(warnings)],
  };
}
