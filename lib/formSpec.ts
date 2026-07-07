/* ══════════════════════════════════════════════════════════
   FormSpec — 「UIをUIで作る」ためのフォーム定義とコード生成。
   Bedrock のスクリプトフォームは3型のみ（自由レイアウト不可）:
     menu    = ActionFormData  … タイトル＋説明＋縦にボタン
     input   = ModalFormData   … タイトル＋縦に入力欄
     confirm = MessageFormData … タイトル＋本文＋2ボタン
   ここではフォームの「設計データ(FormSpec)」から、player が
   スコープにある前提の Bedrock コード文字列を生成する。
   ※ codegen.ts と独立させるため、小さなエスケープはここに持つ。
   ══════════════════════════════════════════════════════════ */

export type FormKind = "menu" | "input" | "confirm";
export type ActionType = "message" | "command" | "none";
export type FieldKind = "text" | "toggle" | "slider" | "dropdown";

export interface FormAction { type: ActionType; value: string; }
export interface MenuButton { id: string; label: string; action: FormAction; }
export interface FormField {
  id: string;
  kind: FieldKind;
  label: string;
  def: string;       // text=初期値 / toggle="ON"|"OFF" / slider=初期値 / dropdown=初期index
  min: string;       // slider
  max: string;       // slider
  step: string;      // slider
  options: string;   // dropdown（カンマ区切り）
}

export interface FormSpec {
  kind: FormKind;
  title: string;
  body: string;
  buttons: MenuButton[];  // menu 用
  fields: FormField[];    // input 用
  yes: string;            // confirm 用（左ボタン）
  no: string;             // confirm 用（右ボタン）
  onYes: FormAction;      // confirm で「はい」を押したとき
}

/* ───────── エスケープ（codegen.ts と同等の最小版） ───────── */
export function fEscStr(s: string): string {
  return String(s ?? "")
    .replace(/\\/g, "\\\\").replace(/"/g, '\\"')
    .replace(/`/g, "\\`").replace(/\$/g, "\\$").replace(/\n/g, "\\n");
}
function fEscId(s: string): string {
  return String(s ?? "").replace(/[^a-z0-9_.:/-]/gi, "");
}

/* ───────── 便利ファクトリ（UI側の初期値用） ───────── */
let _seq = 0;
export const newId = () => `f${Date.now().toString(36)}${(_seq++).toString(36)}`;
export const emptyAction = (): FormAction => ({ type: "message", value: "" });
export const newButton = (label = "ボタン"): MenuButton => ({ id: newId(), label, action: emptyAction() });
export const newField = (kind: FieldKind = "text"): FormField => ({
  id: newId(), kind, label: "こうもく", def: kind === "toggle" ? "OFF" : "", min: "0", max: "100", step: "1", options: "A,B,C",
});

export function defaultSpec(kind: FormKind = "menu"): FormSpec {
  return {
    kind,
    title: kind === "confirm" ? "かくにん" : "メニュー",
    body: kind === "input" ? "" : "えらんでね",
    buttons: [newButton("はい！"), newButton("やめる")],
    fields: [newField("text")],
    yes: "はい", no: "いいえ",
    onYes: { type: "message", value: "はいを選んだ！" },
  };
}

/* ───────── アクション1つ → 1行コード ───────── */
function genAction(a: FormAction, indent: string): string {
  if (!a || a.type === "none" || !a.value.trim()) return `${indent}// なにもしない`;
  if (a.type === "command") return `${indent}player.runCommandAsync("${fEscStr(a.value)}");`;
  return `${indent}player.sendMessage("${fEscStr(a.value)}");`;
}

/* ══════════════════════════════════════════════════════════
   FormSpec → Bedrock コード（player がスコープにある前提）
   ══════════════════════════════════════════════════════════ */
export function genFormCode(spec: FormSpec, indent = ""): string {
  const I = indent;
  const t = fEscStr(spec.title);
  const b = fEscStr(spec.body);

  if (spec.kind === "menu") {
    const btns = spec.buttons.length ? spec.buttons : [newButton("OK")];
    const lines: string[] = [];
    lines.push(`${I}const _form = new ActionFormData().title("${t}").body("${b}");`);
    btns.forEach(btn => lines.push(`${I}_form.button("${fEscStr(btn.label)}");`));
    lines.push(`${I}_form.show(player).then((res) => {`);
    lines.push(`${I}  if (res.canceled) return;`);
    btns.forEach((btn, i) => {
      const head = i === 0 ? `${I}  if (res.selection === ${i}) {` : `${I}  else if (res.selection === ${i}) {`;
      lines.push(head);
      lines.push(genAction(btn.action, `${I}    `));
      lines.push(`${I}  }`);
    });
    lines.push(`${I}});`);
    return lines.join("\n");
  }

  if (spec.kind === "confirm") {
    return [
      `${I}const _form = new MessageFormData().title("${t}").body("${b}").button1("${fEscStr(spec.yes)}").button2("${fEscStr(spec.no)}");`,
      `${I}_form.show(player).then((res) => {`,
      `${I}  if (res.canceled) return;`,
      `${I}  if (res.selection === 1) {`,   // button1 = selection 1（既存 ui_message と同じ規約）
      genAction(spec.onYes, `${I}    `),
      `${I}  }`,
      `${I}});`,
    ].join("\n");
  }

  // input（ModalFormData）
  const fields = spec.fields.length ? spec.fields : [newField("text")];
  const lines: string[] = [];
  lines.push(`${I}const _form = new ModalFormData().title("${t}");`);
  fields.forEach(fd => {
    const lbl = fEscStr(fd.label);
    if (fd.kind === "toggle") {
      lines.push(`${I}_form.toggle("${lbl}", ${fd.def === "ON"});`);
    } else if (fd.kind === "slider") {
      const mn = Number(fd.min) || 0, mx = Number(fd.max) || 100, st = Number(fd.step) || 1, dv = Number(fd.def) || mn;
      lines.push(`${I}_form.slider("${lbl}", ${mn}, ${mx}, ${st}, ${dv});`);
    } else if (fd.kind === "dropdown") {
      const opts = fd.options.split(",").map(s => s.trim()).filter(Boolean);
      const arr = opts.map(s => `"${fEscStr(s)}"`).join(",");
      lines.push(`${I}_form.dropdown("${lbl}", [${arr}], ${Number(fd.def) || 0});`);
    } else {
      lines.push(`${I}_form.textField("${lbl}", "", "${fEscStr(fd.def)}");`);
    }
  });
  lines.push(`${I}_form.show(player).then((res) => {`);
  lines.push(`${I}  if (res.canceled || !res.formValues) return;`);
  const summary = fields.map((fd, i) => `${fEscStr(fd.label)}: \${res.formValues[${i}]}`).join(" / ");
  lines.push(`${I}  player.sendMessage(\`${summary}\`);`);
  lines.push(`${I}});`);
  return lines.join("\n");
}
