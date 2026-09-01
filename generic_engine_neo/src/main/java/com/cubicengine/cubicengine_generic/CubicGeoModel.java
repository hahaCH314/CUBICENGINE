package com.cubicengine.cubicengine_generic;

import net.minecraft.resources.ResourceLocation;
import software.bernie.geckolib.model.GeoModel;

public class CubicGeoModel extends GeoModel<CubicGeoEntity> {
    
    @Override
    public ResourceLocation getModelResource(CubicGeoEntity object) {
        return new ResourceLocation(cubicenginegenericMod.MOD_ID, "geo/" + object.getMobId() + ".geo.json");
    }

    @Override
    public ResourceLocation getTextureResource(CubicGeoEntity object) {
        return new ResourceLocation(cubicenginegenericMod.MOD_ID, "textures/entity/" + object.getMobId() + ".png");
    }

    @Override
    public ResourceLocation getAnimationResource(CubicGeoEntity object) {
        return new ResourceLocation(cubicenginegenericMod.MOD_ID, "animations/" + object.getMobId() + ".animation.json");
    }
}
