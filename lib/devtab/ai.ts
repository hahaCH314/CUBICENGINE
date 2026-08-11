/**
 * 自作AI（外部API）との境界。
 *
 * AI の正体がまだ決まっていないので、**呼び出し側がその形に依存しないように**
 * ここで1枚かぶせる。UI は AiAdapter しか知らない。実装を差し替えても UI は無傷。
 *
 * いまは MockAdapter が入っている。API が決まったら HttpAdapter の
 * endpoint / リクエスト形を埋めて、setAiAdapter で差し替えるだけでよい。
 *
 * 鍵はブラウザに置かない:
 *   外部APIのキーをフロントに置くと、配布した時点で誰でも読める。
 *   HttpAdapter は自分のサーバ（Next の route handler）を叩き、
 *   そこからAPIへ中継する前提で書いてある。
 */

/** AI に投げる依頼 */
export interface AiRequest {
  /** 何を作ってほしいか。利用者が書いた自然文 or DSL */
  prompt: string;
  /** テクスチャを作るのか、挙動を作るのか */
  kind: "texture" | "behavior" | "dsl";
  /** 参考にさせたい既存データ（任意） */
  context?: string;
}

/** AI から返るもの */
export interface AiResponse {
  ok: boolean;
  /** kind に応じた中身。texture なら data URL、それ以外は文字列 */
  content?: string;
  error?: string;
}

export interface AiAdapter {
  readonly name: string;
  /** 実際に呼べる状態か。false ならUIは入力欄を無効にして理由を出す */
  readonly ready: boolean;
  /** 使えない理由。ready が false のとき UI に出す */
  readonly reason?: string;
  generate(req: AiRequest): Promise<AiResponse>;
}

/**
 * API が決まるまでの仮実装。
 * **わざと「未接続」を返す。**それっぽい偽の結果を返すと、繋いだつもりで
 * 先に進んでしまい、後で全部やり直しになる。
 */
export const MockAdapter: AiAdapter = {
  name: "mock",
  ready: false,
  reason: "自作AIの接続先がまだ設定されていません",
  async generate() {
    return { ok: false, error: "自作AIが未接続です。接続先が決まってから使えるようになります" };
  },
};

/**
 * 外部APIを叩く実装。**自分のサーバ経由**にすること。
 * endpoint は Next の route handler（例: /api/ai/generate）を想定している。
 */
export function createHttpAdapter(endpoint: string): AiAdapter {
  return {
    name: "http",
    ready: endpoint.length > 0,
    reason: endpoint.length > 0 ? undefined : "接続先URLが空です",
    async generate(req: AiRequest): Promise<AiResponse> {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(req),
        });
        if (!res.ok) {
          // ステータスだけだと原因が分からないので本文も拾う。
          // 過去に Failed to fetch で詰まった経緯があるので、ここは厚めに扱う
          const body = await res.text().catch(() => "");
          return { ok: false, error: `AIサーバが ${res.status} を返しました${body ? `: ${body.slice(0, 200)}` : ""}` };
        }
        const json: unknown = await res.json();
        if (typeof json === "object" && json !== null && "content" in json) {
          return { ok: true, content: String((json as { content: unknown }).content) };
        }
        return { ok: false, error: "AIサーバの応答形式が想定と違います" };
      } catch (e) {
        // fetch の失敗はネットワーク・CORS・オフラインが混ざる。区別できないので素直に出す
        return { ok: false, error: `AIサーバに繋がりませんでした（${e instanceof Error ? e.message : String(e)}）` };
      }
    },
  };
}

let current: AiAdapter = MockAdapter;

export function getAiAdapter(): AiAdapter {
  return current;
}

export function setAiAdapter(adapter: AiAdapter): void {
  current = adapter;
}
