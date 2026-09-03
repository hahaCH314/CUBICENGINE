package com.cubicengine.cubicengine_generic;

import net.neoforged.neoforge.event.entity.EntityAttributeCreationEvent;
import net.minecraft.world.entity.LivingEntity;
import net.neoforged.fml.common.Mod;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.fml.event.lifecycle.FMLCommonSetupEvent;
import net.neoforged.neoforge.event.BuildCreativeModeTabContentsEvent;
import net.neoforged.api.distmarker.Dist;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.neoforge.client.event.EntityRenderersEvent;
import net.neoforged.neoforge.registries.DeferredHolder;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.item.CreativeModeTabs;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

@Mod("cubic_xxxxxxxxxxxxxxxxxxxxxxxx")
public class cubicenginegenericMod {
    public static final String MOD_ID = "cubic_xxxxxxxxxxxxxxxxxxxxxxxx";
    private static final Logger LOGGER = LogManager.getLogger();

    public cubicenginegenericMod(IEventBus bus) {
        bus.addListener(this::setup);
        bus.addListener(this::addCreative);
        bus.addListener(this::registerAttributes);
        DynamicRegistry.init(bus);
        // ⚠️ Forge にあった NeoForge.EVENT_BUS.register(this) は**書いてはいけない**。
        //    このクラスに @SubscribeEvent メソッドは1つも無く、NeoForge のバスは
        //    その場合 IllegalArgumentException を投げる（Forge のバスは黙って無視していた）。
        //    例外はコンストラクタから出てMOD読み込みごと失敗する＝ゲームが起動しない。
        //    ゲーム側イベントは ModEventHandler が @EventBusSubscriber で拾っている。
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
        for (DeferredHolder<EntityType<?>, ? extends EntityType<?>> type : DynamicRegistry.ENTITIES.getEntries()) {
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

    @EventBusSubscriber(modid = MOD_ID, value = Dist.CLIENT)
    public static class ClientModEvents {
        @SubscribeEvent
        public static void registerRenderers(EntityRenderersEvent.RegisterRenderers event) {
            for (DeferredHolder<EntityType<?>, ? extends EntityType<?>> type : DynamicRegistry.ENTITIES.getEntries()) {
                event.registerEntityRenderer((EntityType<CubicGeoEntity>) type.get(), CubicGeoRenderer::new);
            }
        }
    }
}
