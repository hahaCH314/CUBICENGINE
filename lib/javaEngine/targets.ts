/**
 * Java版の「出し先」の一覧。
 *
 * ■ なぜ表にするのか
 *   ローダー（Forge / NeoForge）とマイクラのバージョンが増えるたびに、
 *   エンジンの .jar・設定ファイルの名前・pack_format・依存の書き方が
 *   バラバラに散らばっていく。**片方だけ直す機会が増えるのが一番危ない。**
 *   ここを唯一の出どころにして、新しい版に対応するときは
 *   **行を1つ足すだけ**にする。exporter はこの表しか見ない。
 *
 * ■ 変えてはいけない前提
 *   設計図（cubic_data.json）の形・パス・SPEC_VERSION は**全ての出し先で共通**。
 *   違いはエンジンの中に閉じ込める、というのが 2026-08-30 の設計判断。
 *   どれかの版だけ設計図を変える必要が出たら、それは表では吸収できない。
 *   そのときは立ち止まること。
 */

export type JavaTargetId = "forge_1201" | "neoforge_1211";

export interface JavaTarget {
  id: JavaTargetId;
  /** ボタンに出す名前 */
  label: string;
  /** 「いまのバージョン」「新しいバージョン」など、選ぶ手がかり */
  hint: string;
  /** 遊ぶ人が用意するもの */
  requires: string;
  /** ブラウザが取りに行くエンジン。public/ 直下 */
  engineUrl: string;
  /** 書き出すファイル名に入れる印。⚠️ 英数字とハイフンのみ。
   *  日本語を入れると Forge がモジュール名を作れず**マイクラが起動しない** */
  fileSuffix: string;
  /** .jar の中の設定ファイル。⚠️ ローダーごとに名前が違う */
  metaPath: string;
  /** 設定ファイルに書くローダー本体の modId */
  loaderModId: string;
  loaderRange: string;
  /** mods.toml の loaderVersion。
   *  ⚠️ これは**ローダー本体の版ではなく javafml（言語プロバイダ）の版**。
   *     Forge 1.20.1 はたまたま両方 47.x で一致するが、NeoForge は別物
   *     （ローダー 21.1.x に対し javafml は 4.x）。loaderRange を流用すると
   *     「Missing language javafml version」で**起動時に弾かれる**。 */
  fmlRange: string;
  mcRange: string;
  /** pack.mcmeta に書く番号 */
  packFormat: number;
  /** GeckoLib（前提modモードのときだけ書く）のバージョン範囲 */
  geckolibRange: string;
  /**
   * 依存を「必須」と書くときの1行。
   * ⚠️ Forge は `mandatory=true`、NeoForge は `type="required"` と**キーから違う**。
   *    NeoForge は知らないキーを黙って捨て、type の既定が required なので
   *    `mandatory=true` を書いても**いまは**動く。たまたま動いているだけなので、
   *    正しい方を書く（NeoForge が既定を変えた日に静かに壊れる種類）。
   */
  requiredLine: string;
  /**
   * どちらのローダーか。
   * ⚠️ ソース一式（MDK）を書き出すとき、import・イベントの型名・注釈が
   *    **丸ごと**入れ替わる。値で分けられる違いではないので、生成側で分岐する
   *    ための印。lib/codegenJava.ts と exporter の buildJavaZip が見る。
   */
  loader: "forge" | "neoforge";
  /**
   * ソース一式（MDK）を書き出すときだけ使う値。
   * ⚠️ 完成済み .jar を作る「注入方式」には一切関係ない。
   *    こちらは**遊ぶ人の PC で gradle がコンパイルする**経路なので、要る値が別。
   */
  mdk: {
    /** 生成プロジェクトが要求する JDK。⚠️ 1.21 から Mojang が配るのは 21 */
    javaVersion: number;
    /** gradle wrapper が落とす Gradle 本体の版。
     *  ⚠️ 同梱している gradlew / gradle-wrapper.jar は「本体を落として起動する」
     *     だけなので版に依らない。落とす本体の版だけをここで変える。 */
    gradleVersion: string;
    /** build.gradle に書くローダー本体の版（範囲ではなく1点） */
    loaderVersion: string;
    /** マッピングやローダーの版に添える、マイクラ本体の版（範囲ではなく1点） */
    mcVersion: string;
  };
  /**
   * エンジンの .jar が実在して遊べる状態か。
   * ⚠️ false のあいだは**選ばせない**。選べるのに壊れた .jar が出るのは、
   *    このプロジェクトで一番高くつく形（押せるのに何も起きない）。
   */
  ready: boolean;
  /** ready が false のとき画面に出す理由 */
  notReadyReason?: string;
}

export const JAVA_TARGETS: Record<JavaTargetId, JavaTarget> = {
  forge_1201: {
    id: "forge_1201",
    label: "Forge 1.20.1",
    hint: "いまのバージョン",
    requires: "Forge 1.20.1",
    engineUrl: "/base-mod.jar",
    fileSuffix: "forge1201",
    metaPath: "META-INF/mods.toml",
    loaderModId: "forge",
    loaderRange: "[47,)",
    fmlRange: "[47,)",
    mcRange: "[1.20.1,1.21)",
    packFormat: 15,
    geckolibRange: "[4.8.4,)",
    requiredLine: "    mandatory=true",
    loader: "forge",
    mdk: {
      javaVersion: 17,
      // 同梱ラッパーの gradle-wrapper.properties が指していた版。ここが唯一の出どころ
      gradleVersion: "8.8",
      loaderVersion: "1.20.1-47.3.0",
      mcVersion: "1.20.1",
    },
    ready: true,
  },
  neoforge_1211: {
    id: "neoforge_1211",
    label: "NeoForge 1.21.1",
    hint: "新しいバージョン",
    requires: "NeoForge 1.21.1",
    // ⚠️ まだ存在しない。ヒマワリが作ったら public/ に置いて ready を true にする。
    //    ⚠️ base-mod.jar を**上書きしない**こと。1.20.1 で遊んでいる人が遊べなくなる
    engineUrl: "/base-mod-neo.jar",
    fileSuffix: "neoforge1211",
    metaPath: "META-INF/neoforge.mods.toml",
    loaderModId: "neoforge",
    loaderRange: "[21.1,)",
    // javafml は 4.x。NeoForge 公式 MDK と同じく下限のみ緩く見る
    fmlRange: "[1,)",
    mcRange: "[1.21.1,1.21.2)",
    // ⚠️ 1.21.1 は assets が 34、data が 48 と番号が分かれている。
    //    いまは assets しか出していないので 34。Create 連携などで
    //    data/ にレシピを入れ始めたら、1つの数字で足りるか実機で確かめること
    packFormat: 34,
    geckolibRange: "[4.9,)",
    requiredLine: '    type="required"',
    loader: "neoforge",
    mdk: {
      // ⚠️ 17 ではビルドが通らない。NeoForge 1.21.1 は 21 で組まれている
      javaVersion: 21,
      // ⚠️ ModDevGradle は Gradle 8.8 では動かない。generic_engine_neo と同じ版に揃える
      gradleVersion: "9.2.1",
      loaderVersion: "21.1.248",
      mcVersion: "1.21.1",
    },
    // ✅ 2026-09-09、**実機で動いた**。
    //    PrismLauncher の 1.21.1 インスタンスに `gapple-neoforge1211-mod.jar` を入れて起動し、
    //    積み木で組んだ「あげる」が実際に走った（金のリンゴ64個がプレイヤーの持ち物に入った）。
    //    ＝ MOD の読み込み・きっかけの発火・アクションの実行まで通っている。
    //
    //    経緯: 2026-09-05 に「鍵をかけたままでは選べず、選べないと試せない」（鶏と卵）ため
    //    先に開けた。その仮置きが 2026-09-09 に裏付けられた形。
    //
    //    ⚠️ まだ見ていないもの: ブロックの登録・クリエイティブタブ・モブ（geo 含む）。
    //       ここを触ったときは、Forge 側だけでなく**こちらも実機で見ること**。
    ready: true,
  },
};

export const JAVA_TARGET_LIST: JavaTarget[] = [JAVA_TARGETS.forge_1201, JAVA_TARGETS.neoforge_1211];

/** 既定の出し先。実機で確認できているものを既定にする */
export const DEFAULT_JAVA_TARGET: JavaTargetId = "forge_1201";

/** 知らない値が来ても止まらない。既定へ落とす */
export function getJavaTarget(id: JavaTargetId | undefined): JavaTarget {
  const t = id ? JAVA_TARGETS[id] : undefined;
  if (!t || !t.ready) return JAVA_TARGETS[DEFAULT_JAVA_TARGET];
  return t;
}
