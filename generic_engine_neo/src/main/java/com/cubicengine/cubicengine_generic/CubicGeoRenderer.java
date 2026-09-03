package com.cubicengine.cubicengine_generic;

import net.minecraft.client.renderer.entity.EntityRendererProvider;
import software.bernie.geckolib.renderer.GeoEntityRenderer;

public class CubicGeoRenderer extends GeoEntityRenderer<CubicGeoEntity> {
    public CubicGeoRenderer(EntityRendererProvider.Context renderManager) {
        super(renderManager, new CubicGeoModel());
    }
}
