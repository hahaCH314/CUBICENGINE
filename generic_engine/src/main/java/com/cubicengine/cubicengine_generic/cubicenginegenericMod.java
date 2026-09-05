package com.cubicengine.cubicengine_generic;

import net.minecraftforge.common.MinecraftForge;
import net.minecraftforge.fml.common.Mod;
import net.minecraftforge.fml.event.lifecycle.FMLCommonSetupEvent;
import net.minecraftforge.fml.javafmlmod.FMLJavaModLoadingContext;
import net.minecraftforge.event.BuildCreativeModeTabContentsEvent;
import net.minecraftforge.api.distmarker.Dist;
import net.minecraftforge.eventbus.api.SubscribeEvent;
import net.minecraftforge.client.event.EntityRenderersEvent;
import net.minecraftforge.event.entity.EntityAttributeCreationEvent;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.LivingEntity;
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
        bus.addListener(this::registerAttributes);
        DynamicRegistry.init(bus);
        MinecraftForge.EVENT_BUS.register(this);
        LOGGER.info("[cubicengine_generic] Mod initialized!");
    }

    private void setup(final FMLCommonSetupEvent event) {
        LOGGER.info("[cubicengine_generic] Setup complete!");
    }

    // ⚠️ 生き物は**属性(体力・攻撃力・速さ)を登録しないと、湧いた瞬間に落ちる**。
    //    登録が無いと DefaultAttributes.getSupplier() が null を返し、
    //    LivingEntity のコンストラクタ内 setHealth(getMaxHealth()) で NPE になる。
    //    マイクラは「スポーンエッグを使ったら落ちた」としか見えない。
    private void registerAttributes(EntityAttributeCreationEvent event) {
        for (RegistryObject<EntityType<?>> type : DynamicRegistry.ENTITIES.getEntries()) {
            @SuppressWarnings("unchecked")
            EntityType<? extends LivingEntity> living = (EntityType<? extends LivingEntity>) type.get();
            event.put(living, CubicGeoEntity.createAttributes().build());
        }
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