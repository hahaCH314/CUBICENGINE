package com.cubicengine.cubicengine_generic;

import net.minecraft.server.level.ServerPlayer;
import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.event.level.BlockEvent;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.lang.reflect.Method;

/**
 * 「ブロックをこわしたとき」のイベントを、NeoForge 26.1 のどの版でも拾えるように登録する。
 *
 * ■ なぜ普通に @SubscribeEvent で書かないのか（2026-10-19 の実機事故）
 *   26.1 の NeoForge は、同じ「26.1」のまま途中でこのイベントのクラスを入れ替えた。
 *     ・古い版（26.1.0.x 〜 26.1.2.20）: net.neoforged.neoforge.event.level.BlockEvent$BreakEvent
 *     ・新しい版（26.1.2.21 以降）   : net.neoforged.neoforge.event.level.block.BreakBlockEvent
 *   （NeoForge の 26.1.x ブランチ、commit 8fe4ba2「Fire the BreakBlockEvent on the client and server (#3064)」。
 *     26.1.2 タグから 21 個目の commit なので、ビルド番号 21 から）
 *   古い方は新しい版から**消えている**ので、どちらか片方をメソッドの引数に書くと、
 *   もう片方の NeoForge では ModEventHandler クラスを読んだ瞬間に NoClassDefFoundError になり、
 *   MOD 全体が「failed to load correctly」で止まる。実機でまさにそれが起きた
 *   （CI は 26.1.2.122 でコンパイルしていたので気づけなかった）。
 *
 * ■ どうしているか
 *   クラス名を文字列で探し（Class.forName）、見つかった方を EVENT_BUS.addListener(クラス, 処理) で登録する。
 *   両方とも BlockEvent の子で getState() は親にあるので型付きで呼べる。getPlayer() だけは
 *   それぞれのクラスにしか無いので、リフレクションで1回引いて使い回す。
 *   ここに書いた名前以外のクラスは一切参照しないので、どの版でも読み込み自体は通る。
 *   どちらも無い（将来また変わった）ときは、ログに書いて「こわしたとき」だけ無効にする。
 *   起動が止まるより、1種類のきっかけが効かない方がまし。
 */
final class BlockBreakHook {
    private static final Logger LOGGER = LogManager.getLogger();

    private static final String[] CANDIDATES = {
        "net.neoforged.neoforge.event.level.block.BreakBlockEvent", // 26.1.2.21 以降
        "net.neoforged.neoforge.event.level.BlockEvent$BreakEvent",  // それより前
    };

    private BlockBreakHook() {}

    static void register() {
        Class<?> found = null;
        for (String name : CANDIDATES) {
            try {
                found = Class.forName(name, false, BlockBreakHook.class.getClassLoader());
                break;
            } catch (ClassNotFoundException | LinkageError ignored) {
                // 次の候補へ
            }
        }
        if (found == null || !BlockEvent.class.isAssignableFrom(found)) {
            LOGGER.error("[cubicengine_generic] ブロック破壊イベントのクラスが見つからない。「こわしたとき」のきっかけは効かない（他は動く）");
            return;
        }
        final Method getPlayer;
        try {
            getPlayer = found.getMethod("getPlayer");
        } catch (NoSuchMethodException e) {
            LOGGER.error("[cubicengine_generic] {} に getPlayer() が無い。「こわしたとき」のきっかけは効かない", found.getName());
            return;
        }
        @SuppressWarnings("unchecked")
        Class<BlockEvent> eventClass = (Class<BlockEvent>) found;
        NeoForge.EVENT_BUS.addListener(eventClass, event -> {
            try {
                if (getPlayer.invoke(event) instanceof ServerPlayer player) {
                    ModEventHandler.handleBlockBreak(player, event.getState());
                }
            } catch (ReflectiveOperationException e) {
                LOGGER.error("[cubicengine_generic] ブロック破壊イベントの読み取りに失敗", e);
            }
        });
        LOGGER.info("[cubicengine_generic] ブロック破壊イベント: {}", found.getName());
    }
}
