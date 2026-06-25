/* ══════════════════════════════════════════════════════════
   interpret.ts — SPROUT を「本物の実行」にする小さなインタプリタ
   ──────────────────────────────────────────────────────────
   組んだカード（trigger→nextId / co_if→then/else / ct_rep→then）を
   ワールド状態 World に対して実際に評価し、上演順のビート列(Beat[])に
   ”展開”する。LiveStage はこの trace を順に上映するだけ。

   ★ ここが肝：
     - co_if は cond を World で評価し、真なら then・偽なら else *だけ* を積む
     - ct_rep は中身(then)を n 回 *実際に* 積む
     - 変数(vv_*)は World.vars を書き換え、条件はそれを読む
   ＝ 同じカードでも World（昼/夜・晴/雨・スニーク・HP）が変われば
     走る分岐が変わる＝「入力で振る舞いが変わるプログラム＝言語」になる。

   ※ 出力(codegen)には一切触らない純粋関数。条件の意味は codegen.ts の
     genCondFromField と一致させてある（ステージ＝書き出すアドオン）。
   ══════════════════════════════════════════════════════════ */

import { CBlock } from "../app/editor/_types";

/* ───────── ワールド状態（プログラムの“入力”） ───────── */
export type World = {
  sneaking: boolean;
  time: "day" | "night";
  weather: "clear" | "rain";
  hp: number; // 0..20
  vars: Record<string, number>;
};

export const DEFAULT_WORLD: World = {
  sneaking: false,
  time: "day",
  weather: "clear",
  hp: 20,
  vars: {},
};

/** Beat に持たせるワールドのスナップショット（このビート実行“後”の状態） */
export type WorldSnapshot = {
  time: "day" | "night";
  weather: "clear" | "rain";
  sneaking: boolean;
  hp: number;
  vars: Record<string, number>;
};

/* ───────── 上演の一手＝1ビート ───────── */
export type Beat = {
  id: string;
  type: string;
  label: string;
  category: string;
  fields: Record<string, string>;
  depth: number;
  /** どの枝として実行されたか（演出のヒント） */
  branch?: "then" | "else" | "loop";
  /** くりかえしの何回目か（1始まり） */
  iter?: number;
  /** 条件カードの判定結果（true=そうなら / false=ちがうなら） */
  decided?: boolean;
  /** 「夜だから実行」等の一言メモ */
  note?: string;
  /** このビート実行後のワールド状態（HUD表示用） */
  state: WorldSnapshot;
};

/* 暴走防止：トレース総数の上限 */
const MAX_BEATS = 400;

function fieldMap(b: CBlock): Record<string, string> {
  const m: Record<string, string> = {};
  b.fields.forEach(f => (m[f.id] = f.value));
  return m;
}

function num(v: string | undefined, fallback = 0): number {
  const n = parseFloat(v ?? "");
  return isNaN(n) ? fallback : n;
}

function snapshot(w: World): WorldSnapshot {
  return {
    time: w.time,
    weather: w.weather,
    sneaking: w.sneaking,
    hp: w.hp,
    vars: { ...w.vars },
  };
}

/* ───────── 条件の評価（codegen.genCondFromField と同義） ───────── */
function evalCond(b: CBlock, blocks: CBlock[], w: World): boolean {
  // 後方互換：内側に条件カードが挿してあればそれを評価
  if (b.innerId) {
    const inner = blocks.find(x => x.id === b.innerId);
    if (inner) return evalCondCard(inner, w);
  }
  // キラキラカード方式：co_if 自身の cond フィールド
  const cond = (b.fields.find(f => f.id === "cond")?.value) || "";
  switch (cond) {
    case "スニーク中":   return w.sneaking;
    case "夜間":        return w.time === "night";
    case "雨天":        return w.weather === "rain";
    case "HPが少ない":  return w.hp <= 10;
    default:           return true;
  }
}

/** 単体の条件カード（co_sneak 等・後方互換）をベストエフォートで評価 */
function evalCondCard(b: CBlock, w: World): boolean {
  switch (b.type) {
    case "co_sneak": return w.sneaking;
    case "co_night": return w.time === "night";
    case "co_rain":  return w.weather === "rain";
    case "co_hp":    return w.hp <= num(b.fields.find(f => f.id === "threshold")?.value, 10);
    // co_tag / co_item / co_and / co_or / co_not は状態モデル未整備 → とりあえず真
    default:         return true;
  }
}

/* ───────── アクションの副作用（ワールドを書き換える） ───────── */
function applyEffect(b: CBlock, w: World) {
  const f = (id: string) => b.fields.find(x => x.id === id)?.value;
  switch (b.type) {
    case "vv_set":   w.vars[f("name") || "var"] = num(f("val")); break;
    case "vv_add":   { const k = f("name") || "var"; w.vars[k] = (w.vars[k] || 0) + num(f("val")); break; }
    case "vv_sub":   { const k = f("name") || "var"; w.vars[k] = (w.vars[k] || 0) - num(f("val")); break; }
    case "vv_mul":   { const k = f("name") || "var"; w.vars[k] = (w.vars[k] || 0) * num(f("val"), 1); break; }
    case "vv_div":   { const k = f("name") || "var"; const d = num(f("val"), 1) || 1; w.vars[k] = (w.vars[k] || 0) / d; break; }
    case "vv_inc":   { const k = f("name") || "var"; w.vars[k] = (w.vars[k] || 0) + 1; break; }
    case "vv_dec":   { const k = f("name") || "var"; w.vars[k] = (w.vars[k] || 0) - 1; break; }
    case "vv_reset": w.vars[f("name") || "var"] = 0; break;
    // ac_score もスコアボードを“変数”として可視化（演出用の近似）
    case "ac_score": {
      const k = f("obj") || "score";
      const op = f("op") || "加算";
      const v = num(f("val"), 1);
      if (op === "加算") w.vars[k] = (w.vars[k] || 0) + v;
      else if (op === "減算") w.vars[k] = (w.vars[k] || 0) - v;
      else if (op === "セット") w.vars[k] = v;
      else if (op === "リセット") w.vars[k] = 0;
      break;
    }
    default: break; // メッセージ/付与/音などは状態を変えない（演出のみ）
  }
}

/* ───────── 起点（trigger）を探す ───────── */
function findRoot(blocks: CBlock[]): CBlock | null {
  if (!blocks.length) return null;
  const childIds = new Set<string>();
  blocks.forEach(b =>
    [b.nextId, b.thenId, b.elseId, b.innerId].forEach(c => c && childIds.add(c))
  );
  return (
    blocks.find(b => b.category === "trigger" && !childIds.has(b.id)) ??
    blocks.find(b => b.category === "trigger") ??
    blocks.find(b => !childIds.has(b.id)) ??
    null
  );
}

/* ───────── 本体：解釈して trace を作る ───────── */
export function interpret(
  blocks: CBlock[],
  world: World = DEFAULT_WORLD
): { trace: Beat[]; finalWorld: World } {
  const root = findRoot(blocks);
  const w: World = { ...world, vars: { ...world.vars } };
  const trace: Beat[] = [];
  if (!root) return { trace, finalWorld: w };

  const byId = (id: string | null) => (id ? blocks.find(b => b.id === id) ?? null : null);

  function pushBeat(b: CBlock, depth: number, extra?: Partial<Beat>) {
    trace.push({
      id: b.id,
      type: b.type,
      label: b.label,
      category: b.category,
      fields: fieldMap(b),
      depth,
      state: snapshot(w),
      ...extra,
    });
  }

  function walk(startId: string | null, depth: number, iter?: number) {
    let cur = byId(startId);
    while (cur && trace.length < MAX_BEATS) {
      const b = cur;

      if (b.type === "co_if") {
        const decided = evalCond(b, blocks, w);
        const condLabel = b.fields.find(f => f.id === "cond")?.value || b.label;
        pushBeat(b, depth, {
          branch: iter !== undefined ? "loop" : undefined,
          iter,
          decided,
          note: `${condLabel} → ${decided ? "そうなら" : "ちがうなら"}`,
        });
        // 真なら then・偽なら else *だけ* を実行
        walk(decided ? b.thenId : b.elseId, depth + 1, iter);
      } else if (b.type === "ct_rep") {
        const n = Math.max(0, Math.min(50, Math.round(num(b.fields.find(f => f.id === "n")?.value, 3))));
        pushBeat(b, depth, { iter, note: `×${n} くりかえし` });
        for (let i = 1; i <= n && trace.length < MAX_BEATS; i++) {
          walk(b.thenId, depth + 1, i);
        }
      } else {
        applyEffect(b, w);
        pushBeat(b, depth, { branch: iter !== undefined ? "loop" : undefined, iter });
      }

      cur = byId(b.nextId);
    }
  }

  walk(root.id, 0);
  return { trace, finalWorld: w };
}
