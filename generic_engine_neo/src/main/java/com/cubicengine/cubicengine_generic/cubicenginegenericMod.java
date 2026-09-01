package com.cubicengine.cubicengine_generic;

import net.minecraftforge.common.MinecraftForge;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.event.lifecycle.FMLCommonSetupEvent;
import net.minecraftforge.fml.javafmlmod.FMLJavaModLoadingContext;
import net.minecraftforge.event.BuildCreativeModeTabContentsEvent;
import net.minecraftforge.api.distmarker.Dist;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.client.event.EntityRenderersEvent;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.item.CreativeModeTabs;
import net.minecraftforge.registries.RegistryObject;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

@Mod("cubic_xxxxxxxxxxxxxxxxxxxxxxxx")
public class cubicenginegenericMod {
    public static final String MOD_ID = "cubic_xxxxxxxxxxxxxxxxxxxxxxxx";
    private static final Logger LOGGER = LogManager.getLogger();

    public cubicenginegenericMod() {
        var bus = FMLJavaModLoadingContext.get().getModEventBus();
        bus.addListener(this::setup);
        bus.addListener(this::addCreative);
        DynamicRegistry.init(bus);
        MinecraftForge.EVENT_BUS.register(this);
        LOGGER.info("[cubicengine_generic] Mod initialized!");
    }

    private void setup(final FMLCommonSetupEvent event) {
        LOGGER.info("[cubicengine_generic] Setup complete!");
    }

    private void addCreative(BuildCreativeModeTabContentsEvent event) {
        if (event.getTabKey() == CreativeModeTabs.BUILDING_BLOCKS) {
            DynamicRegistry.ITEMS.getEntries().forEach(item -> event.accept(item.get()));
        }
    }

    @Mod.EventBusSubscriber(modid = MOD_ID, bus = Mod.EventBusSubscriber.Bus.MOD, value = Dist.CLIENT)
    public static class ClientModEvents {
        @SubscribeEvent
        public static void registerRenderers(EntityRenderersEvent.RegisterRenderers event) {
            for (RegistryObject<EntityType<?>> type : DynamicRegistry.ENTITIES.getEntries()) {
                event.registerEntityRenderer((EntityType<CubicGeoEntity>) type.get(), CubicGeoRenderer::new);
            }
        }
    }
}