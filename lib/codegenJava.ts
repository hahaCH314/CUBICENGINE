/* ══════════════════════════════════════════════════════════════════
   codegenJava.ts — CBlock グラフ → Forge 1.20.1 (Java 17) コード
   ──────────────────────────────────────────────────────────────────
   lib/codegen.ts(Bedrock JS版)の鏡像。同じ CBlock[] を入力に取り、
   ModEventHandler.java の中身（@SubscribeEvent ハンドラ群）を生成する。

   方針:
   - give/effect/title/sound/scoreboard 等は _cmd() ヘルパ経由でコマンド実行
     （権限レベル4・@s）。Bedrock の runCommandAsync と同じ発想で堅牢＆移植が楽。
   - msg/tag/kick/teleport などは素のForge APIで直接。
   - UIフォーム(ui_*)は Java に等価が無い → 正直に「未対応」コメントを出す
     （動かないのに動くフリはしない）。
   - i18n: 値で分岐するフィールド(ac_score op / ac_tag op)は codegen.ts と
     同じ内部判定にしてある（英語化で壊さない）。
   ══════════════════════════════════════════════════════════════════ */

import { CBlock } from "../app/editor/_types";
import { escId, sanitizeVarName } from "./codegen";

/** Java文字列リテラル用エスケープ */
function escJava(s: string): string {
  return (s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "")
    .replace(/\n/g, "\\n");
}
/** Minecraft ID 正規化：名前空間が無ければ minecraft: を付与 */
function nsIdJava(s: string, fb = "minecraft:air"): string {
  const v = escId(s) || fb;
  return v.includes(":") ? v : "minecraft:" + v;
}
/** 整数リテラル（不正なら fb） */
function jint(s: string, fb: string): string {
  const n = parseInt((s ?? "").trim(), 10);
  return Number.isFinite(n) ? String(n) : fb;
}
/** 数値リテラル（小数可・不正なら fb） */
function jnum(s: string, fb: string): string {
  const t = (s ?? "").trim();
  return /^-?\d+(\.\d+)?$/.test(t) ? t : fb;
}
function gf(b: CBlock, id: string, fb = ""): string {
  return b.fields.find((f) => f.id === id)?.value ?? fb;
}

/* ─────────────── 式（値）→ Java 式 ─────────────── */
function genExprJava(id: string | null | undefined, blocks: CBlock[]): string {
  if (!id) return "";
  const b = blocks.find((x) => x.id === id);
  if (!b) return "";
  const f = (fid: string, fb = "") => gf(b, fid, fb);
  // ネストした式スロット or 数値リテラル
  const x = (slotIdx: number, litField: string, litFb: string) =>
    genExprJava(b.fields[slotIdx]?.id, blocks) || jnum(f(litField, litFb), litFb);
  const xs = (slotIdx: number, litField: string, litFb: string) =>
    genExprJava(b.fields[slotIdx]?.id, blocks) || `"${escJava(f(litField, litFb))}"`;

  switch (b.type) {
    // ── 値 ──
    case "va_name":  return "player.getName().getString()";
    case "va_rand":  return `(${jint(f("min","0"),"0")} + player.getRandom().nextInt(Math.max(1, ${jint(f("max","100"),"100")} - ${jint(f("min","0"),"0")} + 1)))`;
    case "va_str":   return `"${escJava(f("v",""))}"`;
    case "va_num":   return jnum(f("v","0"),"0");
    case "va_hp":    return "player.getHealth()";
    case "va_pos":   return `player.getBlock${f("axis","Y").toUpperCase()}()`;
    case "va_score": return `_score(player, "${escId(f("obj","points"))}")`;
    // ── 算術 ──
    case "ca_add":   return `((${x(0,"a","0")}) + (${x(1,"b","0")}))`;
    case "ca_sub":   return `((${x(0,"a","0")}) - (${x(1,"b","0")}))`;
    case "ca_mul":   return `((${x(0,"a","1")}) * (${x(1,"b","1")}))`;
    case "ca_div":   return `((double)(${x(0,"a","0")}) / (${x(1,"b","1")}))`;
    case "ca_mod":   return `((${x(0,"a","10")}) % (${x(1,"b","3")}))`;
    case "ca_pow":   return `Math.pow(${x(0,"a","2")}, ${x(1,"b","8")})`;
    case "ca_abs":   return `Math.abs(${x(0,"a","-5")})`;
    case "ca_floor": return `Math.floor(${x(0,"a","3.7")})`;
    case "ca_ceil":  return `Math.ceil(${x(0,"a","3.2")})`;
    case "ca_round": return `Math.round(${x(0,"a","3.5")})`;
    case "ca_sqrt":  return `Math.sqrt(${x(0,"a","9")})`;
    case "ca_min":   return `Math.min(${x(0,"a","3")}, ${x(1,"b","7")})`;
    case "ca_max":   return `Math.max(${x(0,"a","3")}, ${x(1,"b","7")})`;
    case "ca_clamp": return `Math.min(Math.max(${x(0,"val","50")}, ${x(1,"min","0")}), ${x(2,"max","100")})`;
    case "ca_sin":   return `Math.sin(${x(0,"a","0")})`;
    case "ca_cos":   return `Math.cos(${x(0,"a","0")})`;
    case "ca_pi":    return "Math.PI";
    // ── 比較 ──
    case "ca_gt":    return `((${x(0,"a","5")}) > (${x(1,"b","3")}))`;
    case "ca_lt":    return `((${x(0,"a","3")}) < (${x(1,"b","5")}))`;
    case "ca_gte":   return `((${x(0,"a","5")}) >= (${x(1,"b","5")}))`;
    case "ca_lte":   return `((${x(0,"a","3")}) <= (${x(1,"b","5")}))`;
    case "ca_eq":    return `((${x(0,"a","1")}) == (${x(1,"b","1")}))`;
    case "ca_neq":   return `((${x(0,"a","1")}) != (${x(1,"b","2")}))`;
    // ── 文字列 ──
    case "ca_concat":  return `(String.valueOf(${xs(0,"a","")}) + String.valueOf(${xs(1,"b","")}))`;
    case "ca_strlen":  return `String.valueOf(${xs(0,"str","")}).length()`;
    case "ca_numstr":  return `String.valueOf(${x(0,"num","42")})`;
    case "ca_strnum":  return `_num(String.valueOf(${xs(0,"str","0")}))`;
    case "ca_substr":  return `_substr(String.valueOf(${xs(0,"str","")}), ${jint(f("start","0"),"0")}, ${jint(f("len","3"),"3")})`;
    case "ca_replace": return `String.valueOf(${xs(0,"str","")}).replace("${escJava(f("from",""))}", "${escJava(f("to",""))}")`;
    case "ca_upper":   return `String.valueOf(${xs(0,"str","")}).toUpperCase()`;
    case "ca_lower":   return `String.valueOf(${xs(0,"str","")}).toLowerCase()`;
    case "ca_contains":return `String.valueOf(${xs(0,"str","")}).contains("${escJava(f("search",""))}")`;
    // ── ID（文字列として）──
    case "ca_id_gem":    return `"${nsIdJava(f("id","diamond"))}"`;
    case "ca_id_block":  return `"${nsIdJava(f("id","stone"))}"`;
    case "ca_id_tool":   return `"${nsIdJava(f("id","diamond_sword"))}"`;
    case "ca_id_armor":  return `"${nsIdJava(f("id","diamond_chestplate"))}"`;
    case "ca_id_food":   return `"${nsIdJava(f("id","bread"))}"`;
    case "ca_id_misc":   return `"${nsIdJava(f("id","ender_pearl"))}"`;
    case "ca_id_mob":    return `"${nsIdJava(f("id","zombie"))}"`;
    case "ca_id_effect": return `"${nsIdJava(f("id","speed"))}"`;
    // ── 乱数 ──
    case "ca_rand_int":   return `(${jint(f("min","1"),"1")} + player.getRandom().nextInt(Math.max(1, ${jint(f("max","6"),"6")} - ${jint(f("min","1"),"1")} + 1)))`;
    case "ca_rand_float": return "player.getRandom().nextFloat()";
    case "ca_rand_bool":  return "player.getRandom().nextBoolean()";
    case "ca_rand_range": return `(${jnum(f("min","0.0"),"0.0")} + player.getRandom().nextDouble() * (${jnum(f("max","1.0"),"1.0")} - ${jnum(f("min","0.0"),"0.0")}))`;
    case "ca_rand_pct":   return `(player.getRandom().nextInt(100) < ${jint(f("pct","30"),"30")})`;
    case "ca_rand_sign":  return "(player.getRandom().nextBoolean() ? 1 : -1)";
    case "ca_rand_gauss": return `((int)Math.round(player.getRandom().nextGaussian() * ${jnum(f("sd","15"),"15")} + ${jnum(f("mean","50"),"50")}))`;
    case "ca_rand_pick": {
      const items = f("items","A,B,C").split(",").map((s) => s.trim()).filter(Boolean);
      const arr = items.map((i) => `"${escJava(i)}"`).join(", ");
      return `new String[]{${arr}}[player.getRandom().nextInt(${items.length || 1})]`;
    }
    case "ca_rand_shuffle": return "0 /* shuffle: Java版未対応 */";
    case "ca_rand_seed":    return `(${jint(f("min","0"),"0")} + player.getRandom().nextInt(Math.max(1, ${jint(f("max","100"),"100")} - ${jint(f("min","0"),"0")} + 1)))`;
    // ── 変数 ──
    case "vv_get": return `_v_${sanitizeVarName(f("name","score"))}`;
    case "vv_eq":  return `(_v_${sanitizeVarName(f("name","score"))} == ${jint(f("val","0"),"0")})`;
    case "vv_gt":  return `(_v_${sanitizeVarName(f("name","score"))} > ${jint(f("val","0"),"0")})`;
    case "vv_lt":  return `(_v_${sanitizeVarName(f("name","score"))} < ${jint(f("val","100"),"100")})`;
    // ── 条件 ──
    case "co_tag":   return `player.getTags().contains("${escId(f("tag",""))}")`;
    case "co_sneak": return "player.isShiftKeyDown()";
    case "co_hp":    return `(player.getHealth() <= ${jnum(f("threshold","10"),"10")})`;
    case "co_night": return "!player.level().isDay()";
    case "co_rain":  return "player.level().isRaining()";
    case "co_item":  return `_hasItem(player, "${nsIdJava(f("item","minecraft:diamond"))}")`;
    case "co_and":   return `((${genExprJava(b.innerId,blocks)||"true"}) && (${genExprJava(b.thenId,blocks)||"true"}))`;
    case "co_or":    return `((${genExprJava(b.innerId,blocks)||"false"}) || (${genExprJava(b.thenId,blocks)||"false"}))`;
    case "co_not":   return `(!(${genExprJava(b.innerId,blocks)||"false"}))`;
    default: return "0";
  }
}

function genCondJava(id: string | null | undefined, blocks: CBlock[]): string {
  if (!id) return "true";
  const expr = genExprJava(id, blocks);
  return expr === "0" || expr === "" ? "true" : expr;
}

/* ─────────────── アクション（命令）→ Java 文 ─────────────── */
function genBlockJava(b: CBlock, blocks: CBlock[], indent: string): string {
  const f = (id: string, fb = "") => gf(b, id, fb);
  const I = indent;
  const v = (n = "score") => `_v_${sanitizeVarName(f("name", n))}`;
  switch (b.type) {
    // ── すること ──
    case "ac_msg":
      return f("target","@a") === "@a"
        ? `${I}for (ServerPlayer _tp : player.getServer().getPlayerList().getPlayers()) _tp.sendSystemMessage(Component.literal("${escJava(f("msg","こんにちは"))}"));`
        : `${I}player.sendSystemMessage(Component.literal("${escJava(f("msg","こんにちは"))}"));`;
    case "ac_give":   return `${I}_cmd(player, "give @s ${escId(f("item","minecraft:diamond"))} ${jint(f("count","1"),"1")}");`;
    case "ac_tp":     return `${I}player.teleportTo(${jnum(f("x","0"),"0")}, ${jnum(f("y","64"),"64")}, ${jnum(f("z","0"),"0")});`;
    case "ac_cmd":    return `${I}_cmd(player, "${escJava(f("cmd","say hi"))}");`;
    case "ac_sound":  return `${I}_cmd(player, "playsound ${escId(f("snd","random.orb"))} @s ~ ~ ~ ${jnum(f("vol","1"),"1")}");`;
    case "ac_title":  return [
      `${I}_cmd(player, "title @s title \\"${escJava(f("title",""))}\\"");`,
      `${I}_cmd(player, "title @s subtitle \\"${escJava(f("sub",""))}\\"");`,
    ].join("\n");
    case "ac_effect": return `${I}_cmd(player, "effect give @s ${escId(f("eff","speed"))} ${jint(f("dur","10"),"10")} 0");`;
    case "ac_score": {
      const ops: Record<string,string> = { "加算":"add", "減算":"remove", "セット":"set", "リセット":"set" };
      const cmd = ops[f("op","加算")] ?? "add";
      const val = f("op","加算") === "リセット" ? "0" : jint(f("val","1"),"1");
      return `${I}_cmd(player, "scoreboard players ${cmd} @s ${escId(f("obj","points"))} ${val}");`;
    }
    case "ac_tag":
      return f("op","追加") === "追加"
        ? `${I}player.addTag("${escId(f("tag","vip"))}");`
        : `${I}player.removeTag("${escId(f("tag","vip"))}");`;
    case "ac_kick":
      return `${I}player.connection.disconnect(Component.literal("${escJava(f("msg","ルール違反"))}"));`;
    // ── 演算ブロックを単体実行（ログ出力）──
    case "ca_add": case "ca_sub": case "ca_mul": case "ca_div": case "ca_mod": case "ca_pow":
    case "ca_abs": case "ca_floor": case "ca_ceil": case "ca_round": case "ca_sqrt":
    case "ca_min": case "ca_max": case "ca_clamp": case "ca_sin": case "ca_cos": case "ca_pi":
    case "ca_gt": case "ca_lt": case "ca_gte": case "ca_lte": case "ca_eq": case "ca_neq":
    case "ca_concat": case "ca_strlen": case "ca_numstr": case "ca_strnum":
    case "ca_substr": case "ca_replace": case "ca_upper": case "ca_lower": case "ca_contains":
      return `${I}LOGGER.info("[CUBICENGINE演算] " + (${genExprJava(b.id,blocks)}));`;
    // ── 制御 ──
    case "ct_rep": {
      const body = genChainJava(b.thenId, blocks, I + "    ");
      return `${I}for (int _ri = 0; _ri < ${jint(f("n","3"),"3")}; _ri++) {\n${body || I + "    // くりかえす"}\n${I}}`;
    }
    case "ct_log": {
      const e = genExprJava(b.innerId, blocks) || `"${escJava(f("v","ログ"))}"`;
      return `${I}LOGGER.info("[CUBICENGINEログ] " + (${e}));`;
    }
    // ── 変数（int フィールド）──
    case "vv_set":    return `${I}${v()} = (int)(${genExprJava(b.innerId,blocks) || jnum(f("val","0"),"0")});`;
    case "vv_add":    return `${I}${v()} += (int)(${genExprJava(b.innerId,blocks) || jnum(f("val","1"),"1")});`;
    case "vv_sub":    return `${I}${v()} -= (int)(${genExprJava(b.innerId,blocks) || jnum(f("val","1"),"1")});`;
    case "vv_mul":    return `${I}${v()} *= (int)(${genExprJava(b.innerId,blocks) || jnum(f("val","2"),"2")});`;
    case "vv_div":    return `${I}${v()} /= (int)(${genExprJava(b.innerId,blocks) || jnum(f("val","2"),"2")});`;
    case "vv_inc":    return `${I}${v()}++;`;
    case "vv_dec":    return `${I}${v()}--;`;
    case "vv_reset":  return `${I}${v()} = 0;`;
    case "vv_msg":    return `${I}player.sendSystemMessage(Component.literal("${escJava(f("prefix","スコア:"))}" + ${v()}));`;
    case "vv_concat": return `${I}// 文字つなげ（Java版は数値変数のため未対応）`;
    // ── UIフォーム：Java版は未対応（正直に明示） ──
    case "ui_action": case "ui_message": case "ui_textinput":
    case "ui_toggle": case "ui_slider": case "ui_dropdown": case "ui_mixed":
      return `${I}// 📋 フォーム(${b.type})は統合版(SPROUT)専用：Java版では未対応です`;
    // ── もし〜なら ──
    case "co_if": {
      const cond = genCondJava(b.innerId, blocks);
      const t = genChainJava(b.thenId, blocks, I + "    ");
      const e = genChainJava(b.elseId, blocks, I + "    ");
      return [
        `${I}if (${cond}) {`,
        t || `${I}    // 何もしない`,
        ...(e ? [`${I}} else {`, e] : []),
        `${I}}`,
      ].join("\n");
    }
    default: return "";
  }
}

/* ─────────────── チェーン（縦のつながり）─────────────── */
function genChainJava(id: string | null | undefined, blocks: CBlock[], indent: string): string {
  if (!id) return "";
  const b = blocks.find((x) => x.id === id);
  if (!b) return "";
  // ct_wait は Java に即時等価が無い → コメントしてそのまま続行
  if (b.type === "ct_wait") {
    const rest = genChainJava(b.nextId, blocks, indent);
    return `${indent}// ⏳ まつ(${jnum(gf(b,"s","1"),"1")}秒)：Java版は遅延未対応のためそのまま続行\n${rest}`;
  }
  const here = genBlockJava(b, blocks, indent);
  const next = genChainJava(b.nextId, blocks, indent);
  return here + (here && next ? "\n" : "") + next;
}

/* ─────────────── きっかけ → @SubscribeEvent メソッド ─────────────── */
function genTriggerJava(b: CBlock, blocks: CBlock[], idx: number): string {
  const f = (id: string, fb = "") => gf(b, id, fb);
  const m = `handler${idx}`;
  // ev_tick 以外は player(ServerPlayer) を確定させてから body(8スペース)
  const body8 = genChainJava(b.nextId, blocks, "        ") || "        // なにもしない";
  const head = (emoji: string, note: string) => `    // ${emoji} ${note}`;

  switch (b.type) {
    case "ev_join":
      return [
        head("👋", "プレイヤーが参加したとき"),
        `    @SubscribeEvent`,
        `    public static void ${m}(PlayerEvent.PlayerLoggedInEvent event) {`,
        `        if (!(event.getEntity() instanceof ServerPlayer player)) return;`,
        body8,
        `    }`,
      ].join("\n");
    case "ev_break":
      return [
        head("⛏️", `ブロックをこわしたとき (${nsIdJava(f("block","minecraft:stone"))})`),
        `    @SubscribeEvent`,
        `    public static void ${m}(BlockEvent.BreakEvent event) {`,
        `        if (!(event.getPlayer() instanceof ServerPlayer player)) return;`,
        `        ResourceLocation _bid = ForgeRegistries.BLOCKS.getKey(event.getState().getBlock());`,
        `        if (_bid == null || !_bid.toString().equals("${nsIdJava(f("block","minecraft:stone"))}")) return;`,
        body8,
        `    }`,
      ].join("\n");
    case "ev_item":
      return [
        head("🔮", `アイテムをつかったとき (${nsIdJava(f("item","minecraft:diamond"))})`),
        `    @SubscribeEvent`,
        `    public static void ${m}(PlayerInteractEvent.RightClickItem event) {`,
        `        if (!(event.getEntity() instanceof ServerPlayer player)) return;`,
        `        ResourceLocation _iid = ForgeRegistries.ITEMS.getKey(event.getItemStack().getItem());`,
        `        if (_iid == null || !_iid.toString().equals("${nsIdJava(f("item","minecraft:diamond"))}")) return;`,
        body8,
        `    }`,
      ].join("\n");
    case "ev_tick": {
      const body12 = genChainJava(b.nextId, blocks, "            ") || "            // なにもしない";
      return [
        head("⏰", "毎ティック"),
        `    @SubscribeEvent`,
        `    public static void ${m}(TickEvent.ServerTickEvent event) {`,
        `        if (event.phase != TickEvent.Phase.END) return;`,
        `        var _server = ServerLifecycleHooks.getCurrentServer();`,
        `        if (_server == null) return;`,
        `        for (ServerPlayer player : _server.getPlayerList().getPlayers()) {`,
        body12,
        `        }`,
        `    }`,
      ].join("\n");
    }
    case "ev_chat":
      return [
        head("💬", `チャットしたとき ("${escJava(f("pat","!hi"))}")`),
        `    @SubscribeEvent`,
        `    public static void ${m}(ServerChatEvent event) {`,
        `        ServerPlayer player = event.getPlayer();`,
        `        if (player == null) return;`,
        `        if (!event.getRawText().equals("${escJava(f("pat","!hi"))}")) return;`,
        `        event.setCanceled(true);`,
        body8,
        `    }`,
      ].join("\n");
    case "ev_hurt":
      return [
        head("💥", "ダメージをうけたとき"),
        `    @SubscribeEvent`,
        `    public static void ${m}(LivingHurtEvent event) {`,
        `        if (!(event.getEntity() instanceof ServerPlayer player)) return;`,
        body8,
        `    }`,
      ].join("\n");
    case "ev_place":
      return [
        head("🧱", "ブロックをおいたとき"),
        `    @SubscribeEvent`,
        `    public static void ${m}(BlockEvent.EntityPlaceEvent event) {`,
        `        if (!(event.getEntity() instanceof ServerPlayer player)) return;`,
        body8,
        `    }`,
      ].join("\n");
    default:
      return `    // ⚠️ 不明なきっかけ: ${b.type}`;
  }
}

/* ═══════════════════════════════════════════
   公開: ModEventHandler.java の中身を丸ごと生成
   ═══════════════════════════════════════════ */
const JAVA_IMPORTS = [
  "import net.minecraftforge.eventbus.api.SubscribeEvent;",
  "import net.minecraftforge.fml.common.Mod;",
  "import net.minecraftforge.event.entity.player.PlayerEvent;",
  "import net.minecraftforge.event.entity.player.PlayerInteractEvent;",
  "import net.minecraftforge.event.entity.living.LivingHurtEvent;",
  "import net.minecraftforge.event.level.BlockEvent;",
  "import net.minecraftforge.event.ServerChatEvent;",
  "import net.minecraftforge.event.TickEvent;",
  "import net.minecraftforge.server.ServerLifecycleHooks;",
  "import net.minecraftforge.registries.ForgeRegistries;",
  "import net.minecraft.server.level.ServerPlayer;",
  "import net.minecraft.network.chat.Component;",
  "import net.minecraft.resources.ResourceLocation;",
  "import net.minecraft.world.item.Item;",
  "import net.minecraft.world.item.Items;",
  "import net.minecraft.world.item.ItemStack;",
  "import net.minecraft.world.scores.Objective;",
  "import net.minecraft.world.scores.Scoreboard;",
  "import org.apache.logging.log4j.LogManager;",
  "import org.apache.logging.log4j.Logger;",
];

const JAVA_HELPERS = `    // ─────────── ヘルパー ───────────
    /** プレイヤー視点・権限レベル4でコマンド実行（@s が本人に解決される） */
    private static void _cmd(ServerPlayer p, String command) {
        try {
            if (p.getServer() == null) return;
            p.getServer().getCommands().performPrefixedCommand(
                p.createCommandSourceStack().withPermission(4), command);
        } catch (Exception e) {
            LOGGER.warn("[CUBICENGINE] command failed: " + command);
        }
    }
    private static Item _item(String id) {
        try {
            ResourceLocation rl = ResourceLocation.tryParse(id);
            if (rl == null) return Items.AIR;
            Item it = ForgeRegistries.ITEMS.getValue(rl);
            return it != null ? it : Items.AIR;
        } catch (Exception e) { return Items.AIR; }
    }
    private static boolean _hasItem(ServerPlayer p, String id) {
        Item want = _item(id);
        for (ItemStack s : p.getInventory().items) if (!s.isEmpty() && s.is(want)) return true;
        return false;
    }
    private static int _score(ServerPlayer p, String obj) {
        try {
            Scoreboard sb = p.getScoreboard();
            Objective o = sb.getObjective(obj);
            if (o == null) return 0;
            return sb.getOrCreatePlayerScore(p.getScoreboardName(), o).getScore();
        } catch (Exception e) { return 0; }
    }
    private static double _num(String s) {
        try { return Double.parseDouble(s.trim()); } catch (Exception e) { return 0; }
    }
    private static String _substr(String s, int start, int len) {
        if (s == null) return "";
        int a = Math.max(0, Math.min(start, s.length()));
        int b = Math.max(a, Math.min(a + len, s.length()));
        return s.substring(a, b);
    }`;

export interface JavaGenContext {
  pkg: string;
  className: string;
  projectName: string;
}

/** ルート（親を持たない）から trigger だけ拾う */
function collectTriggers(blocks: CBlock[]): CBlock[] {
  const roots = blocks.filter((b) => {
    for (const p of blocks)
      if (p.nextId === b.id || p.innerId === b.id || p.thenId === b.id || p.elseId === b.id) return false;
    return true;
  });
  return roots.filter((b) => b.category === "trigger");
}

/** 変数ブロックから static int フィールド宣言を作る */
function collectVarFields(blocks: CBlock[]): string[] {
  const names = new Set<string>();
  blocks
    .filter((b) => b.category === "variable")
    .forEach((b) => names.add(sanitizeVarName(b.fields.find((f) => f.id === "name")?.value || "myVar")));
  return [...names].map((n) => `    private static int _v_${n} = 0; // 変数: ${n}`);
}

/**
 * ModEventHandler.java のファイル内容を生成する。
 * blocks が空/トリガー無しでも、起動確認ハンドラだけは出力する（=最低限動く）。
 */
export function buildJavaModEventHandler(blocks: CBlock[], ctx: JavaGenContext): string {
  const triggers = collectTriggers(blocks);
  const varFields = collectVarFields(blocks);
  const handlers = triggers.map((t, i) => genTriggerJava(t, blocks, i)).join("\n\n");

  const startup = [
    `    // ✅ 起動確認（参加時に1回お知らせ）`,
    `    @SubscribeEvent`,
    `    public static void onCubicReady(PlayerEvent.PlayerLoggedInEvent event) {`,
    `        if (event.getEntity() instanceof ServerPlayer player) {`,
    `            player.sendSystemMessage(Component.literal(`,
    `                "§a§l[CUBICENGINE] §r§a${escJava(ctx.projectName)} 起動！ イベント${triggers.length}個"));`,
    `        }`,
    `    }`,
  ].join("\n");

  return [
    `package ${ctx.pkg};`,
    ``,
    `// ============================================================`,
    `//  CUBICENGINE Studio — 自動生成コード (GROVE / Java)`,
    `//  Forge 1.20.1 (47.x) / Java 17`,
    `//  このファイルは積み木グラフから生成されています。`,
    `// ============================================================`,
    ``,
    ...JAVA_IMPORTS,
    ``,
    `@Mod.EventBusSubscriber(modid = ${ctx.className}Mod.MOD_ID)`,
    `public class ModEventHandler {`,
    `    private static final Logger LOGGER = LogManager.getLogger();`,
    ``,
    ...(varFields.length ? [`    // ─────────── 変数 ───────────`, ...varFields, ``] : []),
    startup,
    ...(handlers ? [``, handlers] : []),
    ``,
    JAVA_HELPERS,
    `}`,
    ``,
  ].join("\n");
}

export { genTriggerJava, genChainJava, genBlockJava, genExprJava, genCondJava, escJava, nsIdJava };
