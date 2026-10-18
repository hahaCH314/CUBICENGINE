package com.cubicengine.cubicengine_generic;

import net.minecraft.client.renderer.entity.EntityRendererProvider;
import net.minecraft.client.renderer.entity.state.LivingEntityRenderState;
import com.geckolib.renderer.GeoEntityRenderer;

// GeckoLib 5 の GeoEntityRenderer は <実体, RenderState> の2つを取る。
// 生き物なので LivingEntityRenderState（GeoEntityRenderer の既定どおり）
public class CubicGeoRenderer extends GeoEntityRenderer<CubicGeoEntity, LivingEntityRenderState> {
    public CubicGeoRenderer(EntityRendererProvider.Context renderManager) {
        super(renderManager, new CubicGeoModel());
    }
}
