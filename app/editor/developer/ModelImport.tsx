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

export default function ModelImport({ onLoaded }: { onLoaded?: (ir: MobIR) => void }) {
  const [busy, setBusy] = useState(false);
  const [ir, setIr] = useState<MobIR | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
        const res = await parseBbmodelAsync(text, fallback);
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
    <div className="flex flex-col gap-4 p-5 overflow-auto h-full">
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
