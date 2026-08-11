/**
 * Worker の呼び出し口。UI 側はこのファイルだけを見ればいい。
 *
 * Worker が作れない環境では、同じ関数をその場で呼んで同じ結果を返す。
 * 「Worker が無いと動かない」状態を作らないため。処理の実体は worker.ts に1つだけ。
 */

import { handleRequest, type DevWorkerRequest, type DevWorkerResponse } from "./worker";
import type { IRResult, MobIR } from "./ir";

let worker: Worker | null = null;
let workerBroken = false;
let seq = 0;

const pending = new Map<number, (res: DevWorkerResponse) => void>();

function getWorker(): Worker | null {
  if (workerBroken) return null;
  if (worker) return worker;
  if (typeof window === "undefined" || typeof Worker === "undefined") return null;
  try {
    worker = new Worker(new URL("./worker.ts", import.meta.url));
    worker.onmessage = (e: MessageEvent<DevWorkerResponse>) => {
      const done = pending.get(e.data.id);
      if (done) {
        pending.delete(e.data.id);
        done(e.data);
      }
    };
    worker.onerror = () => {
      // Worker が起動できない環境ではその場実行に切り替える。
      // 待っている依頼を放置すると UI が「読み込み中」のまま固まるので、全部返す
      workerBroken = true;
      for (const [id, done] of pending) {
        done({ id, ok: false, error: "Worker が使えないため、その場で処理します" });
      }
      pending.clear();
      worker = null;
    };
    return worker;
  } catch {
    workerBroken = true;
    return null;
  }
}

function send(req: Omit<DevWorkerRequest, "id">): Promise<DevWorkerResponse> {
  const id = ++seq;
  const full = { ...req, id } as DevWorkerRequest;
  const w = getWorker();
  if (!w) return Promise.resolve(handleRequest(full));

  return new Promise<DevWorkerResponse>(resolve => {
    pending.set(id, resolve);
    w.postMessage(full);
  }).then(res => {
    // Worker が途中で壊れた場合はその場実行でやり直す（利用者には成功して見える）
    if (!res.ok && workerBroken) return handleRequest(full);
    return res;
  });
}

/** .bbmodel の中身を IR に変換する。UI は await するだけでよい */
export async function parseBbmodelAsync(text: string, fallbackName?: string): Promise<IRResult<MobIR>> {
  const res = await send({ kind: "parseBbmodel", text, fallbackName });
  if (res.ok && res.kind === "parseBbmodel") return res.result;
  return { ok: false, errors: [res.ok ? "想定外の応答です" : res.error], warnings: [] };
}

/** 画面を離れるときに片付ける。開きっぱなしの Worker を残さない */
export function disposeDevWorker(): void {
  worker?.terminate();
  worker = null;
  pending.clear();
}
