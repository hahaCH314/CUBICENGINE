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
import { t, tNode } from "@/lib/i18n";

export default function ModelImport({ onLoaded }: { onLoaded?: (ir: MobIR) => void }) {
    const locale = useEditorStore((s) => s.locale);
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
            setTimeout(() => reject(new Error(t(locale, "editor_3f8c61"))), 15000),
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
      setErrors([t(locale, "editor_82effe")]);
      return;
    }
    if (!ir.textures[0]?.dataUrl) {
      setErrors([t(locale, "editor_7456ee")]);
      return;
    }
    const w: string[] = [];
    if (ir.id === "voxel_mob") {
      w.push(`マイクラ内部の名前は「${ir.id}」になります（プロジェクト名に英字を入れると変えられます）`);
    }
    w.push(t(locale, "editor_85685b"));
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
      {tNode(locale, "editor_frag_1a05c06806c_24", { arg0: <div>
        <h2 className="text-lg font-bold">{t(locale, "editor_2ba947")}</h2>
        <p className="text-xs text-muted/70 mt-1">
          {tNode(locale, "editor_frag_1a05c06806f_25", { arg0: <code>.bbmodel</code> })}</p>
      </div>,  arg2: <div
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
        <div className="text-sm font-bold">{busy ? t(locale, "editor_4699f5") : t(locale, "editor_b7cab0")}</div>
        <div className="text-[11px] text-muted/60 mt-1">{t(locale, "editor_43b70e")}</div>
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
      </div>, })}</div>
  );
}
