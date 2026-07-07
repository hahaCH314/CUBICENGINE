"use client";

/* ══════════════════════════════════════════════════════════
   FormBuilder — 「UIをUIで作る」試作。
   Bedrock の3フォーム型（menu / input / confirm）を、要素を足して
   並べ替えるだけで設計 → 右側にライブプレビュー＆生成コード。
   ※自己完結（storeやキャンバスに未依存）。onSave で後から統合可能。
   ══════════════════════════════════════════════════════════ */

import { useMemo, useState } from "react";
import {
  type FormSpec, type FormKind, type MenuButton, type FormField, type FieldKind, type ActionType,
  genFormCode, defaultSpec, newButton, newField,
} from "../../lib/formSpec";

const KINDS: { key: FormKind; label: string; hint: string }[] = [
  { key: "menu",    label: "メニュー", hint: "ボタンを縦にならべる" },
  { key: "input",   label: "入力",     hint: "文字・トグル・スライダー等" },
  { key: "confirm", label: "かくにん", hint: "はい / いいえ の2択" },
];
const ACTIONS: { key: ActionType; label: string }[] = [
  { key: "message", label: "メッセージを送る" },
  { key: "command", label: "コマンドを実行" },
  { key: "none",    label: "なにもしない" },
];
const FIELD_KINDS: { key: FieldKind; label: string }[] = [
  { key: "text",     label: "テキスト" },
  { key: "toggle",   label: "ON/OFF" },
  { key: "slider",   label: "スライダー" },
  { key: "dropdown", label: "リスト選択" },
];

function move<T>(arr: T[], i: number, d: number): T[] {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const c = arr.slice();
  [c[i], c[j]] = [c[j], c[i]];
  return c;
}

export default function FormBuilder({
  initial, onSave,
}: { initial?: FormSpec; onSave?: (spec: FormSpec) => void }) {
  const [spec, setSpec] = useState<FormSpec>(initial ?? defaultSpec("menu"));
  const [showCode, setShowCode] = useState(false);
  const code = useMemo(() => genFormCode(spec, "  "), [spec]);

  const patch = (p: Partial<FormSpec>) => setSpec(s => ({ ...s, ...p }));
  const patchBtn = (i: number, p: Partial<MenuButton>) =>
    setSpec(s => ({ ...s, buttons: s.buttons.map((b, k) => k === i ? { ...b, ...p } : b) }));
  const patchField = (i: number, p: Partial<FormField>) =>
    setSpec(s => ({ ...s, fields: s.fields.map((f, k) => k === i ? { ...f, ...p } : f) }));

  return (
    <div style={S.wrap}>
      {/* ───────── 左：エディタ ───────── */}
      <div style={S.editor}>
        <div style={S.h}>フォームを組む</div>

        {/* 型えらび */}
        <div style={S.seg}>
          {KINDS.map(k => (
            <button key={k.key} onClick={() => patch({ kind: k.key })}
              style={{ ...S.segBtn, ...(spec.kind === k.key ? S.segOn : {}) }} title={k.hint}>
              {k.label}
            </button>
          ))}
        </div>
        <div style={S.hintRow}>{KINDS.find(k => k.key === spec.kind)?.hint}</div>

        {/* タイトル・本文 */}
        <Label t="タイトル" />
        <input style={S.input} value={spec.title} onChange={e => patch({ title: e.target.value })} />
        {spec.kind !== "input" && (<>
          <Label t="説明文" />
          <input style={S.input} value={spec.body} onChange={e => patch({ body: e.target.value })} />
        </>)}

        {/* menu: ボタン一覧 */}
        {spec.kind === "menu" && (
          <div style={{ marginTop: 14 }}>
            <div style={S.sectionHead}>
              <span>ボタン（{spec.buttons.length}）</span>
              <button style={S.add} onClick={() => patch({ buttons: [...spec.buttons, newButton()] })}>＋ 追加</button>
            </div>
            {spec.buttons.map((b, i) => (
              <div key={b.id} style={S.card}>
                <div style={S.cardTop}>
                  <span style={S.num}>{i + 1}</span>
                  <input style={{ ...S.input, margin: 0, flex: 1 }} value={b.label}
                    onChange={e => patchBtn(i, { label: e.target.value })} placeholder="ボタンの文字" />
                  <Reorder onUp={() => patch({ buttons: move(spec.buttons, i, -1) })}
                           onDown={() => patch({ buttons: move(spec.buttons, i, 1) })}
                           onDel={() => patch({ buttons: spec.buttons.filter((_, k) => k !== i) })} />
                </div>
                <div style={S.actionRow}>
                  <select style={S.select} value={b.action.type}
                    onChange={e => patchBtn(i, { action: { ...b.action, type: e.target.value as ActionType } })}>
                    {ACTIONS.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                  </select>
                  {b.action.type !== "none" && (
                    <input style={{ ...S.input, margin: 0, flex: 1 }} value={b.action.value}
                      onChange={e => patchBtn(i, { action: { ...b.action, value: e.target.value } })}
                      placeholder={b.action.type === "command" ? "例: say クリア！" : "送るメッセージ"} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* input: 入力欄一覧 */}
        {spec.kind === "input" && (
          <div style={{ marginTop: 14 }}>
            <div style={S.sectionHead}>
              <span>入力欄（{spec.fields.length}）</span>
              <button style={S.add} onClick={() => patch({ fields: [...spec.fields, newField()] })}>＋ 追加</button>
            </div>
            {spec.fields.map((f, i) => (
              <div key={f.id} style={S.card}>
                <div style={S.cardTop}>
                  <span style={S.num}>{i + 1}</span>
                  <select style={S.select} value={f.kind}
                    onChange={e => patchField(i, { kind: e.target.value as FieldKind })}>
                    {FIELD_KINDS.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
                  </select>
                  <Reorder onUp={() => patch({ fields: move(spec.fields, i, -1) })}
                           onDown={() => patch({ fields: move(spec.fields, i, 1) })}
                           onDel={() => patch({ fields: spec.fields.filter((_, k) => k !== i) })} />
                </div>
                <input style={{ ...S.input, marginTop: 6 }} value={f.label}
                  onChange={e => patchField(i, { label: e.target.value })} placeholder="ラベル" />
                {f.kind === "toggle" && (
                  <select style={{ ...S.select, marginTop: 6, width: "100%" }} value={f.def}
                    onChange={e => patchField(i, { def: e.target.value })}>
                    <option value="OFF">初期: OFF</option>
                    <option value="ON">初期: ON</option>
                  </select>
                )}
                {f.kind === "slider" && (
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    {(["min", "max", "step", "def"] as const).map(k => (
                      <input key={k} style={{ ...S.input, margin: 0 }} value={f[k]}
                        onChange={e => patchField(i, { [k]: e.target.value } as Partial<FormField>)}
                        placeholder={k} />
                    ))}
                  </div>
                )}
                {f.kind === "dropdown" && (
                  <input style={{ ...S.input, marginTop: 6 }} value={f.options}
                    onChange={e => patchField(i, { options: e.target.value })} placeholder="選択肢（カンマ区切り）" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* confirm: 2ボタン */}
        {spec.kind === "confirm" && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}><Label t="はい ボタン" />
                <input style={S.input} value={spec.yes} onChange={e => patch({ yes: e.target.value })} /></div>
              <div style={{ flex: 1 }}><Label t="いいえ ボタン" />
                <input style={S.input} value={spec.no} onChange={e => patch({ no: e.target.value })} /></div>
            </div>
            <Label t="「はい」を押したとき" />
            <div style={S.actionRow}>
              <select style={S.select} value={spec.onYes.type}
                onChange={e => patch({ onYes: { ...spec.onYes, type: e.target.value as ActionType } })}>
                {ACTIONS.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
              </select>
              {spec.onYes.type !== "none" && (
                <input style={{ ...S.input, margin: 0, flex: 1 }} value={spec.onYes.value}
                  onChange={e => patch({ onYes: { ...spec.onYes, value: e.target.value } })}
                  placeholder={spec.onYes.type === "command" ? "例: time set day" : "送るメッセージ"} />
              )}
            </div>
          </div>
        )}

        {onSave && (
          <button style={S.save} onClick={() => onSave(spec)}>このフォームを使う</button>
        )}
      </div>

      {/* ───────── 右：プレビュー＆コード ───────── */}
      <div style={S.side}>
        <div style={S.h}>プレビュー</div>
        <Preview spec={spec} />
        <button style={S.codeToggle} onClick={() => setShowCode(v => !v)}>
          {showCode ? "▲ コードをかくす" : "▼ 生成コードを見る"}
        </button>
        {showCode && <pre style={S.code}>{code}</pre>}
        <div style={S.note}>
          ※ Bedrockのフォームは自由レイアウト不可。この3型の範囲で作れます。
        </div>
      </div>
    </div>
  );
}

/* ───────── プレビュー（Minecraftのフォーム風モック） ───────── */
function Preview({ spec }: { spec: FormSpec }) {
  return (
    <div style={S.mcForm}>
      <div style={S.mcTitle}>{spec.title || "（タイトル）"}</div>
      {spec.kind !== "input" && spec.body && <div style={S.mcBody}>{spec.body}</div>}
      {spec.kind === "menu" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(spec.buttons.length ? spec.buttons : [newButton("OK")]).map(b => (
            <div key={b.id} style={S.mcBtn}>{b.label || "（ボタン）"}</div>
          ))}
        </div>
      )}
      {spec.kind === "confirm" && (
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ ...S.mcBtn, flex: 1 }}>{spec.yes || "はい"}</div>
          <div style={{ ...S.mcBtn, flex: 1 }}>{spec.no || "いいえ"}</div>
        </div>
      )}
      {spec.kind === "input" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(spec.fields.length ? spec.fields : [newField("text")]).map(f => (
            <div key={f.id}>
              <div style={S.mcLabel}>{f.label || "こうもく"}</div>
              {f.kind === "toggle" ? (
                <div style={{ ...S.mcToggle, justifyContent: f.def === "ON" ? "flex-end" : "flex-start" }}>
                  <span style={S.mcKnob} />
                </div>
              ) : f.kind === "slider" ? (
                <div style={S.mcSlider}><span style={S.mcSliderFill} /></div>
              ) : f.kind === "dropdown" ? (
                <div style={S.mcInput}>{(f.options.split(",")[0] || "A").trim()} ▾</div>
              ) : (
                <div style={S.mcInput}>{f.def || "…"}</div>
              )}
            </div>
          ))}
          <div style={S.mcBtn}>OK</div>
        </div>
      )}
    </div>
  );
}

/* ───────── 小さな部品 ───────── */
function Label({ t }: { t: string }) { return <div style={S.label}>{t}</div>; }
function Reorder({ onUp, onDown, onDel }: { onUp: () => void; onDown: () => void; onDel: () => void }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      <button style={S.mini} onClick={onUp} title="上へ">▲</button>
      <button style={S.mini} onClick={onDown} title="下へ">▼</button>
      <button style={{ ...S.mini, color: "#f87171" }} onClick={onDel} title="削除">✕</button>
    </div>
  );
}

/* ───────── スタイル ───────── */
const S: Record<string, React.CSSProperties> = {
  wrap: { display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap", width: "100%", maxWidth: 900 },
  editor: { flex: "1 1 400px", minWidth: 320, background: "#1b1f27", border: "1px solid #2b3240", borderRadius: 16, padding: 18 },
  side: { flex: "1 1 300px", minWidth: 280, background: "#12151b", border: "1px solid #2b3240", borderRadius: 16, padding: 18 },
  h: { fontSize: 14, fontWeight: 900, color: "#e5e7eb", marginBottom: 12, letterSpacing: "0.04em" },
  seg: { display: "flex", gap: 6, background: "#12151b", padding: 4, borderRadius: 12 },
  segBtn: { flex: 1, padding: "9px 0", borderRadius: 9, border: "none", background: "transparent", color: "#9aa4b2", fontWeight: 800, fontSize: 13, cursor: "pointer" },
  segOn: { background: "#3b82f6", color: "#fff", boxShadow: "0 2px 8px rgba(59,130,246,0.4)" },
  hintRow: { fontSize: 11, color: "#6b7280", margin: "6px 2px 2px" },
  label: { fontSize: 11, fontWeight: 800, color: "#94a3b8", margin: "12px 2px 4px" },
  input: { width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 9, border: "1px solid #333c4a", background: "#0d0f14", color: "#e5e7eb", fontSize: 13, outline: "none", margin: "0 0 2px" },
  select: { padding: "9px 10px", borderRadius: 9, border: "1px solid #333c4a", background: "#0d0f14", color: "#e5e7eb", fontSize: 12.5, fontWeight: 700, outline: "none", cursor: "pointer" },
  sectionHead: { display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5, fontWeight: 900, color: "#cbd5e1", margin: "4px 2px 8px" },
  add: { padding: "6px 12px", borderRadius: 8, border: "none", background: "#22c55e", color: "#052e16", fontWeight: 900, fontSize: 12, cursor: "pointer" },
  card: { background: "#0f1218", border: "1px solid #262d38", borderRadius: 11, padding: 10, marginBottom: 8 },
  cardTop: { display: "flex", alignItems: "center", gap: 8 },
  num: { width: 20, height: 20, borderRadius: 6, background: "#3b82f6", color: "#fff", fontSize: 11, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  actionRow: { display: "flex", gap: 6, marginTop: 6 },
  mini: { width: 26, height: 26, borderRadius: 6, border: "1px solid #333c4a", background: "#1a1e26", color: "#9aa4b2", fontSize: 10, cursor: "pointer" },
  save: { width: "100%", marginTop: 16, padding: "12px 0", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff", fontWeight: 900, fontSize: 14, cursor: "pointer" },
  codeToggle: { width: "100%", marginTop: 12, padding: "8px 0", borderRadius: 9, border: "1px solid #333c4a", background: "#1a1e26", color: "#9aa4b2", fontWeight: 800, fontSize: 12, cursor: "pointer" },
  code: { marginTop: 8, padding: 12, background: "#07090d", border: "1px solid #262d38", borderRadius: 9, color: "#a5f3c0", fontSize: 11, lineHeight: 1.5, overflowX: "auto", whiteSpace: "pre" },
  note: { marginTop: 10, fontSize: 10.5, color: "#6b7280", lineHeight: 1.5 },
  /* Minecraft form 風 */
  mcForm: { background: "#313233", border: "2px solid #1d1e1f", borderRadius: 6, padding: 14, boxShadow: "inset 0 0 0 2px #48494a" },
  mcTitle: { color: "#fff", fontWeight: 900, fontSize: 15, textAlign: "center", marginBottom: 10, textShadow: "1px 1px 0 #000" },
  mcBody: { color: "#e0e0e0", fontSize: 12, marginBottom: 12, lineHeight: 1.5, textShadow: "1px 1px 0 #000" },
  mcBtn: { background: "#8f8f8f", border: "2px solid #000", color: "#fff", textAlign: "center", padding: "9px 6px", fontWeight: 800, fontSize: 12.5, textShadow: "1px 1px 0 #3a3a3a", boxShadow: "inset 0 2px 0 rgba(255,255,255,0.25), inset 0 -2px 0 rgba(0,0,0,0.35)" },
  mcLabel: { color: "#e0e0e0", fontSize: 11.5, marginBottom: 4, textShadow: "1px 1px 0 #000" },
  mcInput: { background: "#000", border: "1px solid #6b6b6b", color: "#dcdcdc", padding: "7px 9px", fontSize: 12, borderRadius: 2 },
  mcToggle: { width: 46, height: 22, borderRadius: 12, background: "#000", border: "1px solid #6b6b6b", display: "flex", alignItems: "center", padding: 2 },
  mcKnob: { width: 18, height: 18, borderRadius: "50%", background: "#8f8f8f", border: "1px solid #000" },
  mcSlider: { height: 8, borderRadius: 4, background: "#000", border: "1px solid #6b6b6b", position: "relative" },
  mcSliderFill: { position: "absolute", left: 0, top: 0, bottom: 0, width: "50%", background: "#8f8f8f", borderRadius: 4 },
};
