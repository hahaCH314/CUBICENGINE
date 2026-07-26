/* ══════════════════════════════════════════════════════════════════
   share.ts — 作品を「みせる」ためのURL変換

   方針:
   - 作品データは URL の # の後ろに丸ごと入れる。# より後ろは
     ブラウザがサーバーへ送信しないので、こちらは何も預からない。
     ＝「完全ローカル・アカウント不要」を崩さずに共有が成立する。
   - 送るのは「カードの種類」「既定から変えた値」「つながり」だけ。
     見た目(emoji/label/sublabel/category)とフィールドの定義は type から
     パレット(data/templates.ts)を引いて復元する。プリセット読み込みで
     既にやっている手口と同じ。
     実測: 50枚の作品で 生JSON 19,851B → URL 431文字。
     カードが増えるほど繰り返しが効いて圧縮率が上がる。
   - 圧縮は CompressionStream('deflate-raw')。使えない環境では
     無圧縮にフォールバックする（読めなくなるより長いほうがマシ）。

   ⚠️ これは鍵ではない。URLの中身を覗けばデータは読める。
      「盗めなくする」のではなく「普通に使う人が自然と礼儀正しくなる」ための
      仕組みとして扱うこと（まねしてOKの可否・出典の焼き付けは表示側の責務）。
   ══════════════════════════════════════════════════════════════════ */

import type { CBlock, FieldDef } from "../app/editor/_types";
import { TEMPLATES } from "../data/templates";

/** URLフラグメントのキー。 例: https://.../play#w=v1.xxxx */
export const SHARE_PARAM = "w";
const V_DEFLATE = "v1.";
const V_PLAIN = "v1u.";

/** 1枚のカード（送信用の最小形）。キーを1文字にしているのは、
 *  枚数分だけ繰り返されるので効きが大きいため。 */
interface WireCard {
  t: string;                          // type
  v?: Record<string, string>;         // 既定から変えたフィールドだけ
  s?: [string, 0 | 1, Record<string, string>?][]; // 条件シール [type, めくったか, 変えた値]
  x?: number; y?: number;             // 置いた位置（丸めた整数）
  nx?: number; in?: number; th?: number; el?: number; // つながり（配列の番号）
}

/** 作品まるごと（送信用） */
export interface WireWork {
  n?: string;   // 作品名
  a?: string;   // 作った人の名前（任意・端末内にのみ保存し、本人が入れたときだけ載る）
  r?: 1;        // まねしてOK（無ければ「見るだけ」）
  src?: string; // リミックス元の作者名（出典。まねして作ったときに焼き付く）
  c: WireCard[];
}

const tmplOf = (type: string) => TEMPLATES.find(t => t.type === type);

/* ── 詰める ───────────────────────────────────────────────── */

/** 既定値から変わったフィールドだけを拾う（同じ値なら送らない＝これが一番効く） */
function changedFields(type: string, fields: FieldDef[]): Record<string, string> | undefined {
  const base = tmplOf(type)?.fields ?? [];
  const out: Record<string, string> = {};
  for (const f of fields) {
    const def = base.find(b => b.id === f.id)?.value;
    if (f.value !== def) out[f.id] = f.value;
  }
  return Object.keys(out).length ? out : undefined;
}

export function toWire(blocks: CBlock[], meta: Omit<WireWork, "c"> = {}): WireWork {
  // id 文字列は長いので、配列の番号に置き換える
  const idx = new Map(blocks.map((b, i) => [b.id, i]));
  const ref = (id: string | null) => (id != null && idx.has(id) ? idx.get(id) : undefined);

  const c: WireCard[] = blocks.map(b => {
    const w: WireCard = { t: b.type };
    const v = changedFields(b.type, b.fields);
    if (v) w.v = v;
    if (b.stickers?.length) {
      w.s = b.stickers.map(s => {
        const sv = changedFields(s.type, s.fields);
        return sv ? [s.type, s.neg ? 1 : 0, sv] : [s.type, s.neg ? 1 : 0];
      }) as WireCard["s"];
    }
    w.x = Math.round(b.x); w.y = Math.round(b.y);
    const nx = ref(b.nextId); if (nx !== undefined) w.nx = nx;
    const ic = ref(b.innerId); if (ic !== undefined) w.in = ic;
    const th = ref(b.thenId); if (th !== undefined) w.th = th;
    const el = ref(b.elseId); if (el !== undefined) w.el = el;
    return w;
  });

  return { ...meta, c };
}

/* ── 戻す ─────────────────────────────────────────────────── */

let seq = 0;
const newId = () => `b_sh_${Date.now().toString(36)}_${(seq++).toString(36)}`;

export function fromWire(work: WireWork): CBlock[] {
  const ids = work.c.map(() => newId());
  const at = (i: number | undefined) => (i === undefined || i < 0 || i >= ids.length ? null : ids[i]);

  return work.c.map((w, i) => {
    const t = tmplOf(w.t);
    // 見た目とフィールド定義はパレットから復元する。ここが最小形の要。
    const fields: FieldDef[] = (t?.fields ?? []).map(f => ({
      ...f,
      value: w.v?.[f.id] ?? f.value,
    }));
    return {
      id: ids[i],
      type: w.t,
      emoji: t?.emoji ?? "",
      label: t?.label ?? w.t,
      sublabel: t?.sublabel ?? "",
      category: t?.category ?? "action",
      fields,
      x: w.x ?? 100 + i * 10,
      y: w.y ?? 600 - i * 130,
      nextId: at(w.nx), innerId: at(w.in), thenId: at(w.th), elseId: at(w.el),
      stickers: w.s?.map(([type, neg, sv], si) => {
        const st = tmplOf(type);
        return {
          id: `s_sh_${i}_${si}`,
          type,
          fields: (st?.fields ?? []).map(f => ({ ...f, value: sv?.[f.id] ?? f.value })),
          neg: neg === 1,
        };
      }),
    } satisfies CBlock;
  });
}

/* ── 文字列化（圧縮 + URL安全なbase64）───────────────────────── */

const toB64Url = (bytes: Uint8Array) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64Url = (s: string) => {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
};

async function squeeze(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === "undefined") return null;
  try {
    const cs = new CompressionStream("deflate-raw");
    const buf = await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(cs)).arrayBuffer();
    return new Uint8Array(buf);
  } catch { return null; }
}

async function unsqueeze(bytes: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const buf = await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(ds)).arrayBuffer();
  return new Uint8Array(buf);
}

/** 作品 → URLフラグメントに載せる文字列 */
export async function encodeWork(work: WireWork): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(work));
  const z = await squeeze(raw);
  // 圧縮できない環境でも「読めない」より「長い」ほうがマシなので素通しする
  return z ? V_DEFLATE + toB64Url(z) : V_PLAIN + toB64Url(raw);
}

/** URLフラグメントの文字列 → 作品。壊れていたら null（黙って落とさない） */
export async function decodeWork(s: string): Promise<WireWork | null> {
  try {
    if (s.startsWith(V_DEFLATE)) {
      const raw = await unsqueeze(fromB64Url(s.slice(V_DEFLATE.length)));
      return JSON.parse(new TextDecoder().decode(raw)) as WireWork;
    }
    if (s.startsWith(V_PLAIN)) {
      return JSON.parse(new TextDecoder().decode(fromB64Url(s.slice(V_PLAIN.length)))) as WireWork;
    }
    return null;
  } catch { return null; }
}

/** 「みせる」リンクを組み立てる。データは # の後ろ＝サーバーには送られない。 */
export async function buildShareUrl(origin: string, work: WireWork): Promise<string> {
  return `${origin}/play#${SHARE_PARAM}=${await encodeWork(work)}`;
}

/** 現在のURLから作品を取り出す（/play 側で使う） */
export async function readWorkFromHash(hash: string): Promise<WireWork | null> {
  const m = new RegExp(`(?:^#|&)${SHARE_PARAM}=([^&]+)`).exec(hash);
  return m ? decodeWork(m[1]) : null;
}
