"use client";

/**
 * Blockbench の .bbmodel を取り込んで、中身を確かめる画面。
 *
 * ここは「読めたか / 何が落ちたか」を見せることに徹する。
 * 変換の中身は lib/devtab/ にあり、この画面はそれを呼んで結果を並べるだけ。
 * UI とロジックを混ぜると LogicPanel.tsx（5,000行超）と同じ道をたどる。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { disposeDevWorker, parseBbmodelAsync } from "../../../lib/devtab/client";
import { describeIR } from "../../../lib/devtab/bbmodel";
import type { MobIR } from "../../../lib/devtab/ir";
import { useEditorStore } from "../store";
import { MOB_MOTIONS, describeVoxels, voxelsToMobIR, type MobMotion } from "../../../lib/devtab/voxelToIr";

export default function ModelImport({ onLoaded }: { onLoaded?: (ir: MobIR) => void }) {
  const [busy, setBusy] = useState(false);
  const [ir, setIr] = useState<MobIR | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  // ボクセルをモブにするときの動き。root ボーン1本なので体ぜんぶが同じ動きになる
  const [motion, setMotion] = useState<MobMotion>("none");
  const fileRef = useRef<HTMLInputElement>(null);
  // モデルタブで積んだボクセル。これをそのままモブにできる
  const voxels = useEditorStore(s => s.blocks);
  const projectName = useEditorStore(s => s.projectName);
  const voxelStats = describeVoxels(voxels);

  // 画面を離れるときに Worker を残さない
  useEffect(() => () => disposeDevWorker(), []);

  const load = useCallback(
    async (file: File) => {
      setBusy(true);
      setErrors([]);
      setWarnings([]);
      try {
        const text = await file.text();
        // 拡張子を落とした名前を既定のモデル名にする（bbmodel 内に name が無い場合の保険）
        const fallback = file.name.replace(/\.(bbmodel|json)$/i, "");
        // client 側にも保険はあるが、ここでも必ず終わるようにしておく。
        // 「読み込み中…」のまま永久に止まるのが利用者にとって一番困る状態なので、
        // 原因が何であれ画面が返ってくることを優先する
        const res = await Promise.race([
          parseBbmodelAsync(text, fallback),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("時間内に読み込めませんでした")), 15000),
          ),
        ]);
        setWarnings(res.warnings);
        if (res.ok && res.value) {
          setIr(res.value);
          setErrors([]);
          onLoaded?.(res.value);
        } else {
          setIr(null);
          setErrors(res.errors);
        }
      } catch (e) {
        setIr(null);
        setErrors([`ファイルを読めませんでした（${e instanceof Error ? e.message : String(e)}）`]);
      } finally {
        setBusy(false);
      }
    },
    [onLoaded],
  );

  const fromVoxels = useCallback(() => {
    setErrors([]);
    setWarnings([]);
    // 名前はプロジェクト名を使う。モデルタブ側に「作品の名前」が無いため。
    // 識別子はここから作られるので、日本語なら voxel_mob に落ちる（警告は出す）
    const ir = voxelsToMobIR(voxels, projectName, motion);
    if (!ir) {
      setErrors(["モデルタブに立方体がありません"]);
      return;
    }
    if (!ir.textures[0]?.dataUrl) {
      setErrors(["色のテクスチャを作れませんでした"]);
      return;
    }
    const w: string[] = [];
    if (ir.id === "voxel_mob") {
      w.push(`マイクラ内部の名前は「${ir.id}」になります（プロジェクト名に英字を入れると変えられます）`);
    }
    w.push("面の色をそのまま貼っています。細かい模様を付けたいときは Blockbench を使ってください。");
    setWarnings(w);
    setIr(ir);
    onLoaded?.(ir);
  }, [voxels, projectName, motion, onLoaded]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) void load(f);
    },
    [load],
  );

  const stats = ir ? describeIR(ir) : null;

  return (
    // ⚠️ h-full / overflow-auto を付けないこと。
    // この画面だけで親の高さを使い切ってしまい、下に並ぶモブの設定が
    // 画面外へ押し出される（スクロールすれば見えるが、誰も気づけない）。
    // 縦スクロールは親の DeveloperPanel が持っている。
    <div className="flex flex-col gap-4 p-5">
      <div>
        <h2 className="text-lg font-bold">モデルを取り込む</h2>
        <p className="text-xs text-muted/70 mt-1">
          Blockbench で作った <code>.bbmodel</code> を読み込みます。テクスチャは
          「埋め込み」で保存されたものだけ取り込めます。
        </p>
      </div>

      {/* 置き場所。クリックでもドラッグでも入れられるようにする */}
      <div
        onDragOver={e => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className="rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors"
        style={{
          borderColor: dragOver ? "#3cd070" : "rgba(255,255,255,0.15)",
          background: dragOver ? "rgba(60,208,112,0.08)" : "rgba(255,255,255,0.02)",
        }}
      >
        <div className="text-3xl mb-2">📦</div>
        <div className="text-sm font-bold">{busy ? "読み込み中…" : ".bbmodel をここにドロップ"}</div>
        <div className="text-[11px] text-muted/60 mt-1">クリックしてファイルを選ぶこともできます</div>
        <input
          ref={fileRef}
          type="file"
          accept=".bbmodel,.json"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) void load(f);
            // 同じファイルを選び直せるようにする
            e.target.value = "";
          }}
        />
      </div>

      {/* モデルタブで積んだものを、そのままモブにできる。
          Blockbench を持っていない人でもモブが作れるようにするための入口 */}
      {voxelStats.cubes > 0 && (
        <div className="rounded-xl p-4 flex flex-wrap items-center gap-3" style={{ background: "rgba(60,208,112,0.08)", border: "1px solid rgba(60,208,112,0.3)" }}>
          <span className="text-2xl">📦</span>
          <div className="flex-1 text-xs">
            <b>モデルタブで作った形</b>をモブにできます
            <span className="block text-[10px] text-muted/60">
              立方体 {voxelStats.cubes} 個 ／ 色 {voxelStats.colors} 種。面の色はそのまま貼られます
            </span>
          </div>
            <label className="flex items-center gap-2 text-xs w-full">
              <span className="shrink-0">動き</span>
              <select
                className="flex-1 px-2 py-1 rounded text-xs bg-black/40 border border-white/15"
                value={motion}
                onChange={e => setMotion(e.target.value as MobMotion)}
              >
                {MOB_MOTIONS.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </label>
          <button
            onClick={fromVoxels}
            className="text-xs font-bold px-3 py-2 rounded-lg shrink-0"
            style={{ background: "#3cd070", color: "#06240f" }}
          >
            モブにする
          </button>
        </div>
      )}

      {errors.length > 0 && (
        <div className="rounded-lg p-3 text-xs" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.4)" }}>
          <div className="font-bold mb-1">読み込めませんでした</div>
          <ul className="list-disc pl-4 space-y-0.5">
            {errors.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-lg p-3 text-xs" style={{ background: "rgba(250,204,21,0.10)", border: "1px solid rgba(250,204,21,0.35)" }}>
          <div className="font-bold mb-1">読み込めましたが、気をつけてほしい点があります</div>
          <ul className="list-disc pl-4 space-y-0.5">
            {warnings.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </div>
      )}

      {ir && stats && (
        <div className="rounded-lg p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <div className="font-bold">{ir.displayName}</div>
            <code className="text-[11px] text-muted/70">{ir.geometry.identifier}</code>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center mb-4">
            {[
              ["ボーン", stats.bones],
              ["立方体", stats.cubes],
              ["テクスチャ", stats.textures],
            ].map(([label, n]) => (
              <div key={String(label)} className="rounded-lg py-2" style={{ background: "rgba(0,0,0,0.25)" }}>
                <div className="text-xl font-black">{n}</div>
                <div className="text-[10px] text-muted/60">{label}</div>
              </div>
            ))}
          </div>

          {ir.textures.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {ir.textures.map(t => (
                <figure key={t.name} className="text-center">
                  {/* テクスチャは16px等の極小画像。拡大時にぼかさない */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={t.dataUrl}
                    alt={t.name}
                    width={64}
                    height={64}
                    style={{ imageRendering: "pixelated", background: "rgba(0,0,0,0.4)", borderRadius: 6 }}
                  />
                  <figcaption className="text-[10px] text-muted/60 mt-1">
                    {t.name}
                    {t.width > 0 && <> ({t.width}×{t.height})</>}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
