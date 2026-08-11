/**
 * デベロッパータブの重い処理を回す Web Worker。
 *
 * なぜ Worker なのか:
 *   「ブラウザをフリーズさせない」はスレッドの問題であって、言語の問題ではない。
 *   同じ処理でもメインスレッドで回せば固まるし、Worker に載せれば素の JS でも固まらない。
 *   まずここに載せる。計測して本当に足りなければ、**この中だけ**を差し替えればいい。
 *   呼び出し側（client.ts）の形は変わらないので、後から中身を替えても UI は無傷。
 *
 * このファイルは DOM も React も触らない。self.onmessage だけが入口。
 */

import { parseBbmodel } from "./bbmodel";
import type { IRResult, MobIR } from "./ir";

/** client.ts から来る依頼 */
export type DevWorkerRequest = { id: number; kind: "parseBbmodel"; text: string; fallbackName?: string };

/** client.ts へ返す結果。id で依頼と対応づける */
export type DevWorkerResponse =
  | { id: number; ok: true; kind: "parseBbmodel"; result: IRResult<MobIR> }
  | { id: number; ok: false; error: string };

/**
 * 依頼を処理する本体。**client.ts からも直接呼べるように export している。**
 * Worker が使えない環境（テスト、SSR、古いブラウザ）では同じ関数を同期的に呼んで
 * 同じ結果を得る。処理の実体が2つに分かれるのを避けるため。
 */
export function handleRequest(req: DevWorkerRequest): DevWorkerResponse {
  try {
    switch (req.kind) {
      case "parseBbmodel":
        return { id: req.id, ok: true, kind: "parseBbmodel", result: parseBbmodel(req.text, req.fallbackName) };
      default:
        return { id: req.id, ok: false, error: `未知の依頼です` };
    }
  } catch (e) {
    // parseBbmodel は throw しない作りだが、想定外の例外で Worker ごと黙って死ぬのを防ぐ
    return { id: req.id, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Worker として読み込まれたときだけ待ち受ける。
// client.ts が同じモジュールを import しても、ここは実行されない。
if (typeof self !== "undefined" && typeof (self as unknown as { postMessage?: unknown }).postMessage === "function" && typeof window === "undefined") {
  self.onmessage = (e: MessageEvent<DevWorkerRequest>) => {
    self.postMessage(handleRequest(e.data));
  };
}
