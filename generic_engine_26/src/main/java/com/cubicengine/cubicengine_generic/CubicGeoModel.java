package com.cubicengine.cubicengine_generic;

import net.minecraft.resources.Identifier;
import com.geckolib.constant.dataticket.DataTicket;
import com.geckolib.model.GeoModel;
import com.geckolib.renderer.base.GeoRenderState;

/**
 * geo モブの「どのファイルで描くか」。
 *
 * ⚠️ GeckoLib 5 で2つ変わった。
 *   1. モデル/テクスチャの問い合わせには**実体ではなく GeoRenderState**が来る。
 *      描く側のスレッドは実体に触れないので、必要な値（ここでは mobId）は
 *      addAdditionalStateData で先に RenderState に積んでおく。
 *   2. モデルと動きの置き場所が決まった。
 *        assets/<modid>/geckolib/models/<name>.geo.json
 *        assets/<modid>/geckolib/animations/<name>.animation.json
 *      しかもキーは「<modid>:<name>」（接頭・拡張子を剥いたもの）で引く。
 *      1.21.1 の geo/ と animations/ に置いたままだと見つからず、
 *      エラー四角（MISSINGNO）が湧く。exporter 側の出し先も合わせること。
 *      テクスチャは従来どおり textures/entity/<name>.png。
 */
public class CubicGeoModel extends GeoModel<CubicGeoEntity> {
    static final DataTicket<String> MOB_ID = DataTicket.create("cubic_mob_id", String.class);

    @Override
    public void addAdditionalStateData(CubicGeoEntity animatable, Object relatedObject, GeoRenderState renderState) {
        renderState.addGeckolibData(MOB_ID, animatable.getMobId());
    }

    private static String mobIdOf(GeoRenderState renderState) {
        return renderState.getOrDefaultGeckolibData(MOB_ID, "unknown");
    }

    @Override
    public Identifier getModelResource(GeoRenderState renderState) {
        return Identifier.fromNamespaceAndPath(cubicenginegenericMod.MOD_ID, mobIdOf(renderState));
    }

    @Override
    public Identifier getTextureResource(GeoRenderState renderState) {
        return Identifier.fromNamespaceAndPath(cubicenginegenericMod.MOD_ID, "textures/entity/" + mobIdOf(renderState) + ".png");
    }

    @Override
    public Identifier getAnimationResource(CubicGeoEntity object) {
        return Identifier.fromNamespaceAndPath(cubicenginegenericMod.MOD_ID, object.getMobId());
    }
}
