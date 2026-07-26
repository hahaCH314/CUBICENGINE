/* ══════════════════════════════════════════════════════════════════
   qr.ts — QRコード生成（依存パッケージ無し）

   なぜ自前か:
   目の前の友達に作品を渡すのに、QRは最短の手段。だがそのためだけに
   ライセンスと配布物が増えるパッケージを足したくない（.exe にも同梱される）。
   必要なのは「英数字と記号だけのURLを1枚のQRにする」ことだけなので、
   バイトモード + 誤り訂正L に絞って実装する。

   対応: バージョン1〜40 / モード=8bit byte / EC=L（この用途では十分）
   参考仕様: ISO/IEC 18004
   ══════════════════════════════════════════════════════════════════ */

/* ── ガロア体 GF(256) ───────────────────────────────────────── */
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const mul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** 生成多項式 */
function genPoly(n: number): Uint8Array {
  let p = new Uint8Array([1]);
  for (let i = 0; i < n; i++) {
    const q = new Uint8Array(p.length + 1);
    for (let j = 0; j < p.length; j++) {
      q[j] ^= p[j];
      q[j + 1] ^= mul(p[j], EXP[i]);
    }
    p = q;
  }
  return p;
}

/** リード・ソロモン誤り訂正符号 */
function ecc(data: Uint8Array, n: number): Uint8Array {
  const g = genPoly(n);
  const res = new Uint8Array(data.length + n);
  res.set(data);
  for (let i = 0; i < data.length; i++) {
    const c = res[i];
    if (!c) continue;
    for (let j = 0; j < g.length; j++) res[i + j] ^= mul(g[j], c);
  }
  return res.slice(data.length);
}

/* ── バージョン表（EC=L のみ）───────────────────────────────── */
// [総コードワード数, ECコードワード/ブロック, グループ1ブロック数, グループ2ブロック数]
const L_TABLE: [number, number, number, number][] = [
  [26, 7, 1, 0], [44, 10, 1, 0], [70, 15, 1, 0], [100, 20, 1, 0], [134, 26, 1, 0],
  [172, 18, 2, 0], [196, 20, 2, 0], [242, 24, 2, 0], [292, 30, 2, 0], [346, 18, 2, 2],
  [404, 20, 4, 0], [466, 24, 2, 2], [532, 26, 4, 0], [581, 30, 3, 1], [655, 22, 5, 1],
  [733, 24, 5, 1], [815, 28, 1, 5], [901, 30, 5, 1], [991, 28, 3, 4], [1085, 28, 3, 5],
  [1156, 28, 4, 4], [1258, 28, 2, 7], [1364, 30, 4, 5], [1474, 30, 6, 4], [1588, 26, 8, 4],
  [1706, 28, 10, 2], [1828, 30, 8, 4], [1921, 30, 3, 10], [2051, 30, 7, 7], [2185, 30, 5, 10],
  [2323, 30, 13, 3], [2465, 30, 17, 0], [2611, 30, 17, 1], [2761, 30, 13, 6], [2876, 30, 12, 7],
  [3034, 30, 6, 14], [3196, 30, 17, 4], [3362, 30, 4, 18], [3532, 30, 20, 4], [3706, 30, 19, 6],
];

const ALIGN: number[][] = [
  [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46],
  [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70],
  [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90],
  [6, 28, 50, 72, 94], [6, 26, 50, 74, 98], [6, 30, 54, 78, 102], [6, 28, 54, 80, 106],
  [6, 32, 58, 84, 110], [6, 30, 58, 86, 114], [6, 34, 62, 90, 118], [6, 26, 50, 74, 98, 122],
  [6, 30, 54, 78, 102, 126], [6, 26, 52, 78, 104, 130], [6, 30, 56, 82, 108, 134],
  [6, 34, 60, 86, 112, 138], [6, 30, 58, 86, 114, 142], [6, 34, 62, 90, 118, 146],
  [6, 30, 54, 78, 102, 126, 150], [6, 24, 50, 76, 102, 128, 154], [6, 28, 54, 80, 106, 132, 158],
  [6, 32, 58, 84, 110, 136, 162], [6, 26, 54, 82, 110, 138, 166], [6, 30, 58, 86, 114, 142, 170],
];

/* ── 本体 ───────────────────────────────────────────────────── */

/** 文字列 → QRのモジュール行列（true=黒）。長すぎて入らなければ null */
export function makeQr(text: string): boolean[][] | null {
  const bytes = new TextEncoder().encode(text);

  // 入るいちばん小さいバージョンを選ぶ
  let ver = 0;
  for (let v = 1; v <= 40; v++) {
    const [total, ecPer, g1, g2] = L_TABLE[v - 1];
    const dataWords = total - ecPer * (g1 + g2);
    const lenBits = v < 10 ? 8 : 16;
    if (bytes.length + 2 + Math.ceil(lenBits / 8) <= dataWords) { ver = v; break; }
  }
  if (!ver) return null;

  const [total, ecPer, g1, g2] = L_TABLE[ver - 1];
  const dataWords = total - ecPer * (g1 + g2);

  // ── ビット列を組む（モード0100 + 長さ + データ）──
  const bits: number[] = [];
  const push = (val: number, n: number) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  push(0b0100, 4);
  push(bytes.length, ver < 10 ? 8 : 16);
  for (const b of bytes) push(b, 8);
  for (let i = 0; i < 4 && bits.length < dataWords * 8; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const dat = new Uint8Array(dataWords);
  for (let i = 0; i < bits.length / 8; i++) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i * 8 + j];
    dat[i] = v;
  }
  // 余りは 0xEC / 0x11 の交互で埋める（仕様）
  for (let i = Math.ceil(bits.length / 8), k = 0; i < dataWords; i++, k++) dat[i] = k % 2 ? 0x11 : 0xec;

  // ── ブロックに分けて誤り訂正を付ける ──
  const nBlocks = g1 + g2;
  const short = Math.floor(dataWords / nBlocks);
  const dBlocks: Uint8Array[] = [];
  const eBlocks: Uint8Array[] = [];
  let off = 0;
  for (let i = 0; i < nBlocks; i++) {
    const len = i < g1 ? short : short + 1;
    const d = dat.slice(off, off + len);
    off += len;
    dBlocks.push(d);
    eBlocks.push(ecc(d, ecPer));
  }
  // インターリーブ（列方向に1バイトずつ）
  const out: number[] = [];
  for (let i = 0; i < short + 1; i++) for (const b of dBlocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < ecPer; i++) for (const b of eBlocks) out.push(b[i]);

  // ── 描く ──
  const size = ver * 4 + 17;
  const m: (boolean | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));

  const finder = (r: number, c: number) => {
    for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) {
      const y = r + i, x = c + j;
      if (y < 0 || y >= size || x < 0 || x >= size) continue;
      const on = i >= 0 && i <= 6 && j >= 0 && j <= 6 &&
        (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4));
      m[y][x] = on;
    }
  };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);

  for (let i = 8; i < size - 8; i++) { m[6][i] = i % 2 === 0; m[i][6] = i % 2 === 0; }

  for (const r of ALIGN[ver - 1]) for (const c of ALIGN[ver - 1]) {
    if (m[r][c] !== null) continue;
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++)
      m[r + i][c + j] = Math.max(Math.abs(i), Math.abs(j)) !== 1;
  }

  m[size - 8][8] = true; // 常に黒

  if (ver >= 7) {
    let v = ver << 12;
    for (let i = 0; i < 6; i++) v ^= (v >> (17 - i)) & 1 ? 0x1f25 << (5 - i) : 0;
    const bitsV = (ver << 12) | (v & 0xfff);
    for (let i = 0; i < 18; i++) {
      const on = ((bitsV >> i) & 1) === 1;
      m[Math.floor(i / 3)][size - 11 + (i % 3)] = on;
      m[size - 11 + (i % 3)][Math.floor(i / 3)] = on;
    }
  }

  // 形式情報の場所を予約
  const fmtCells: [number, number][] = [];
  for (let i = 0; i <= 5; i++) fmtCells.push([8, i], [i, 8]);
  fmtCells.push([8, 7], [8, 8], [7, 8], [size - 8, 8]);
  for (let i = 0; i < 7; i++) fmtCells.push([size - 1 - i, 8]);
  for (let i = 0; i < 8; i++) fmtCells.push([8, size - 1 - i]);
  for (const [r, c] of fmtCells) if (m[r][c] === null) m[r][c] = false;

  // データを詰める（右下から2列ずつ、蛇行）
  const MASK = (r: number, c: number) => (r + c) % 2 === 0; // マスク0
  let bi = 0, up = true;
  for (let c = size - 1; c > 0; c -= 2) {
    if (c === 6) c--;
    for (let k = 0; k < size; k++) {
      const r = up ? size - 1 - k : k;
      for (const cc of [c, c - 1]) {
        if (m[r][cc] !== null) continue;
        const byte = out[bi >> 3] ?? 0;
        let bit = ((byte >> (7 - (bi & 7))) & 1) === 1;
        bi++;
        if (MASK(r, cc)) bit = !bit;
        m[r][cc] = bit;
      }
    }
    up = !up;
  }

  // 形式情報（EC=L, マスク0）
  let f = 0b01 << 3;
  let d = f << 10;
  for (let i = 0; i < 5; i++) d ^= (d >> (14 - i)) & 1 ? 0x537 << (4 - i) : 0;
  f = ((f << 10) | (d & 0x3ff)) ^ 0x5412;
  const put = (i: number, on: boolean) => {
    if (i < 6) { m[8][i] = on; m[size - 1 - i][8] = on; }
    else if (i < 8) { m[8][i + 1] = on; m[size - 1 - i][8] = on; }
    else if (i === 8) { m[7][8] = on; m[8][size - 15 + i] = on; }
    else { m[14 - i][8] = on; m[8][size - 15 + i] = on; }
  };
  for (let i = 0; i < 15; i++) put(i, ((f >> i) & 1) === 1);

  return m.map(row => row.map(v => v === true));
}

/** QR行列 → SVG文字列。<img> にも背景にも使える形にしておく。 */
export function qrToSvg(m: boolean[][], quiet = 3): string {
  const n = m.length, size = n + quiet * 2;
  let path = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
    if (m[r][c]) path += `M${c + quiet} ${r + quiet}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">`
    + `<rect width="${size}" height="${size}" fill="#fff"/>`
    + `<path d="${path}" fill="#0f172a"/></svg>`;
}
