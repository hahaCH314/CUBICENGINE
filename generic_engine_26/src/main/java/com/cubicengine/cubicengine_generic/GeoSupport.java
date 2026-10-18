package com.cubicengine.cubicengine_generic;

import net.minecraft.world.entity.LivingEntity;

/**
 * GeckoLib に触るコードを、このクラス**だけ**に閉じ込める。
 *
 * ■ なぜ1クラスに隔離するのか
 *   ふつうモードで書き出した .jar は GeckoLib を要求しない
 *   （前提MODを入れさせないための設計。exporter の mods.toml 生成を参照）。
 *   つまり遊ぶ人の環境に GeckoLib は**無い**。
 *
 *   ところが CubicGeoEntity は GeckoLib の GeoEntity を実装しているので、
 *   `living instanceof CubicGeoEntity` と**書くだけ**で JVM は
 *   CubicGeoEntity を読み込もうとし、その親が見つからず
 *   NoClassDefFoundError: software/bernie/geckolib/animatable/GeoEntity で落ちる。
 *
 *   ⚠️ 2026-09-05、これが実機で起きた。ModEventHandler.resolveMobId が
 *      「生き物が湧いたとき」に呼ばれるため、**ワールド生成の途中で必ず死ぬ**。
 *      GeckoLib を使うモブを1体も作っていなくても落ちる。
 *      当時 exporter には「geo モブが無ければ GeckoLib のクラスは読み込まれない
 *      （javap で実測）」と書いてあったが、実測されていたのは registerRenderers
 *      だけで、この経路が抜けていた。
 *
 *   Java はクラスを**最初に使うときに**読み込む。だから GeckoLib への参照を
 *   このクラスに閉じ込め、呼ぶ側で DynamicRegistry.hasGeoMobs を見てから
 *   入れば、geo モブが無い作品ではこのクラス自体が一度も読み込まれない。
 *
 * ■ 触るときの約束
 *   ⚠️ 呼ぶ側は**必ず** DynamicRegistry.hasGeoMobs で守ること。
 *   ⚠️ CubicGeoEntity / CubicGeoModel / CubicGeoRenderer を書いてよいのは、
 *      **geo モブがあるときしか通らないと確かめた場所だけ**。
 *      いま許してある場所は次の3つ。増やすなら、同じ確認をしてから増やす:
 *        1. このクラス（呼ぶ側が hasGeoMobs を見ている）
 *        2. DynamicRegistry の render:"geo" の枝（旗を立てている枝そのもの）
 *        3. cubicenginegenericMod の registerAttributes / registerRenderers
 *           （どちらも先頭で hasGeoMobs を見て抜ける）
 *      3 は 2026-09-07 まで「ENTITIES が空だから通らない」という
 *      **書かれていない前提**に頼っていた。geo でない EntityType を1つ
 *      登録した瞬間に、この .java を書いた理由の事故がそのまま戻る形だった。
 */
final class GeoSupport {
    private GeoSupport() {}

    /** geo モブなら自分の id、それ以外なら null。 */
    static String mobIdOf(LivingEntity living) {
        if (living instanceof CubicGeoEntity geo) {
            return geo.getMobId();
        }
        return null;
    }
}
