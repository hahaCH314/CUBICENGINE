package com.cubicengine.cubicengine_generic;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.effect.MobEffect;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.scores.Objective;
import net.minecraft.world.scores.Scoreboard;
import net.minecraft.core.registries.BuiltInRegistries;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class LogicInterpreter {

    /* ═══════════════════════════════════════════
       トリガー種別ごとの索引
       ═══════════════════════════════════════════
       ⚠️ ここは **毎ティック・全プレイヤー分**呼ばれる。1秒に20回×人数。
          以前は呼ばれるたびに全ルールを線形に走査し、そのつど JSON を
          getAsJsonObject / getAsString で触っていた。
          「毎ティック」のカードを1枚も置いていない作品でも、全ルールを舐めていた。

          この MOD は 300〜400 個の MOD と同居する環境に入る。そこで TPS を落とすと
          「犯人探し」で真っ先に抜かれる。作品が悪いのではなく土台が悪い、という形で
          評価されてしまうので、ここは軽くしておく。

          modData は起動時に一度だけ読まれる（DynamicRegistry.init）ので、
          そのタイミングで種別ごとに仕分けておけば、以降は Map を1回引くだけで済む。
          該当ルールが無ければ **その場で戻る**（これが一番効く）。 */
    private static Map<String, List<JsonObject>> rulesByTrigger = null;

    /** modData を読み込んだ後に呼ぶ。索引を作り直す。 */
    public static void buildIndex() {
        Map<String, List<JsonObject>> index = new HashMap<>();
        if (DynamicRegistry.modData != null && DynamicRegistry.modData.has("rules")) {
            JsonArray rules = DynamicRegistry.modData.getAsJsonArray("rules");
            for (JsonElement ruleElem : rules) {
                if (!ruleElem.isJsonObject()) continue;
                JsonObject rule = ruleElem.getAsJsonObject();
                if (!rule.has("trigger")) continue;
                JsonObject trigger = rule.getAsJsonObject("trigger");
                if (!trigger.has("type")) continue;
                index.computeIfAbsent(trigger.get("type").getAsString(), k -> new ArrayList<>()).add(rule);
            }
        }
        rulesByTrigger = index;
    }

    public static void onTrigger(String triggerType, ServerPlayer player, JsonObject context) {
        // 索引がまだ無ければ作る（buildIndex の呼び忘れでも壊れないように）
        if (rulesByTrigger == null) buildIndex();

        // ★ この種別のルールが1つも無ければ、ここで終わり。
        //   「毎ティック」を使っていない作品では、毎回ここで抜ける。
        List<JsonObject> rules = rulesByTrigger.getOrDefault(triggerType, Collections.emptyList());
        if (rules.isEmpty()) return;

        for (JsonObject rule : rules) {
            JsonObject trigger = rule.getAsJsonObject("trigger");
            String tType = triggerType;

            // Check trigger conditions (e.g. break block id)
            if (tType.equals("break") || tType.equals("place")) {
                if (trigger.has("block") && context != null && context.has("block")) {
                    String wantBlock = trigger.get("block").getAsString();
                    String actBlock = context.get("block").getAsString();
                    if (!wantBlock.equals(actBlock)) continue;
                }
            }
            if (tType.equals("useItem") && trigger.has("item") && context != null && context.has("item")) {
                String wantItem = trigger.get("item").getAsString();
                String actItem = context.get("item").getAsString();
                if (!wantItem.equals(actItem)) continue;
            }
            if (tType.equals("chat") && trigger.has("pattern") && context != null && context.has("message")) {
                String wantPat = trigger.get("pattern").getAsString();
                String actMsg = context.get("message").getAsString();
                if (!actMsg.contains(wantPat)) continue;
            }

            // Check conditions
            boolean pass = true;
            if (rule.has("conditions")) {
                JsonArray conditions = rule.getAsJsonArray("conditions");
                for (JsonElement cElem : conditions) {
                    if (!evalCondition(cElem.getAsJsonObject(), player)) {
                        pass = false;
                        break;
                    }
                }
            }
            
            if (pass && rule.has("actions")) {
                JsonArray actions = rule.getAsJsonArray("actions");
                for (JsonElement aElem : actions) {
                    executeAction(aElem.getAsJsonObject(), player);
                }
            }
        }
    }

    private static boolean evalCondition(JsonObject cond, ServerPlayer player) {
        if (!cond.has("type")) return false;
        String type = cond.get("type").getAsString();
        
        try {
            switch (type) {
                case "hasTag":
                    return player.getTags().contains(cond.get("tag").getAsString());
                case "hasItem":
                    Item want = BuiltInRegistries.ITEM.get(ResourceLocation.parse(cond.get("item").getAsString()));
                    if (want != null) {
                        for (ItemStack s : player.getInventory().items) {
                            if (!s.isEmpty() && s.is(want)) return true;
                        }
                    }
                    return false;
                case "hpBelow":
                    return player.getHealth() < cond.get("value").getAsFloat();
                case "isSneaking":
                    return player.isShiftKeyDown();
                case "isNight":
                    long time = player.level().getDayTime() % 24000;
                    return time >= 13000 && time <= 23000;
                case "isRaining":
                    return player.level().isRaining();
                case "and":
                    for (JsonElement e : cond.getAsJsonArray("all")) {
                        if (!evalCondition(e.getAsJsonObject(), player)) return false;
                    }
                    return true;
                case "or":
                    for (JsonElement e : cond.getAsJsonArray("any")) {
                        if (evalCondition(e.getAsJsonObject(), player)) return true;
                    }
                    return false;
                case "not":
                    return !evalCondition(cond.getAsJsonObject("of"), player);
                default:
                    String warnC = "§c[CUBICENGINE] 警告: 未知の条件タイプ(Unknown condition type): " + type;
                    System.err.println(warnC);
                    player.sendSystemMessage(Component.literal(warnC));
                    return false;
            }
        } catch (Exception e) {
            e.printStackTrace();
            return false;
        }
    }

    private static void executeAction(JsonObject action, ServerPlayer player) {
        if (!action.has("type")) return;
        String type = action.get("type").getAsString();
        
        try {
            switch (type) {
                case "message":
                    String msg = evalValue(action.getAsJsonObject("text"), player);
                    String target = action.get("target").getAsString();
                    if (target.equals("all")) {
                        player.getServer().getPlayerList().broadcastSystemMessage(Component.literal(msg), false);
                    } else {
                        player.sendSystemMessage(Component.literal(msg));
                    }
                    break;
                case "give":
                    String item = action.get("item").getAsString();
                    int count = action.get("count").getAsInt();
                    _cmd(player, "give @s " + item + " " + count);
                    break;
                case "effect":
                    String effect = action.get("effect").getAsString();
                    int sec = action.get("seconds").getAsInt();
                    int amp = action.get("amplifier").getAsInt();
                    MobEffect eff = BuiltInRegistries.MOB_EFFECT.get(ResourceLocation.parse(effect));
                    if (eff != null) player.addEffect(new MobEffectInstance(BuiltInRegistries.MOB_EFFECT.wrapAsHolder(eff), sec * 20, amp));
                    break;
                case "sound":
                    String sound = action.get("sound").getAsString();
                    float vol = action.get("volume").getAsFloat();
                    _cmd(player, "playsound " + sound + " master @s ~ ~ ~ " + vol);
                    break;
                case "title":
                    String title = action.get("title").getAsString();
                    String sub = action.get("sub").getAsString();
                    if (!title.isEmpty()) _cmd(player, "title @s title {\"text\":\"" + title + "\"}");
                    if (!sub.isEmpty()) _cmd(player, "title @s subtitle {\"text\":\"" + sub + "\"}");
                    break;
                case "teleport":
                    _cmd(player, "tp @s " + action.get("x").getAsInt() + " " + action.get("y").getAsInt() + " " + action.get("z").getAsInt());
                    break;
                case "command":
                    _cmd(player, action.get("command").getAsString());
                    break;
                case "tag":
                    String tag = action.get("tag").getAsString();
                    if (action.get("add").getAsBoolean()) player.addTag(tag);
                    else player.removeTag(tag);
                    break;
                case "score":
                    String obj = action.get("objective").getAsString();
                    String op = action.get("op").getAsString();
                    int val = action.get("value").getAsInt();
                    if (op.equals("set")) _cmd(player, "scoreboard players set @s " + obj + " " + val);
                    else if (op.equals("remove")) _cmd(player, "scoreboard players remove @s " + obj + " " + val);
                    else _cmd(player, "scoreboard players add @s " + obj + " " + val);
                    break;
                case "kick":
                    player.connection.disconnect(Component.literal(action.get("reason").getAsString()));
                    break;
                default:
                    String warnA = "§c[CUBICENGINE] 警告: 未知のアクションタイプ(Unknown action type): " + type;
                    System.err.println(warnA);
                    player.sendSystemMessage(Component.literal(warnA));
                    break;
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private static String evalValue(JsonObject val, ServerPlayer player) {
        String kind = val.get("kind").getAsString();
        switch (kind) {
            case "text":
                return val.get("value").getAsString();
            case "num":
                return String.valueOf(val.get("value").getAsNumber());
            case "rand":
                return String.valueOf((int)(Math.random() * val.get("max").getAsInt()));
            case "var":
                String name = val.get("name").getAsString();
                if (name.equals("playerName")) return player.getScoreboardName();
                if (name.equals("playerHp")) return String.valueOf(player.getHealth());
                if (name.equals("playerPos")) return (int)player.getX() + " " + (int)player.getY() + " " + (int)player.getZ();
                if (name.equals("score")) {
                    try {
                        Scoreboard sb = player.getScoreboard();
                        Objective o = sb.getObjective(val.get("arg").getAsString());
                        if (o != null) return String.valueOf(sb.getOrCreatePlayerScore(player, o).get());
                    } catch (Exception e) {}
                    return "0";
                }
                return "";
            default:
                return "";
        }
    }

    private static void _cmd(ServerPlayer p, String command) {
        try {
            if (p.getServer() == null) return;
            p.getServer().getCommands().performPrefixedCommand(
                p.createCommandSourceStack().withPermission(4), command);
        } catch (Exception e) {}
    }
}
