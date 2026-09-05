package com.cubicengine.cubicengine_generic;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import net.minecraft.world.item.BlockItem;
import net.minecraft.world.item.Item;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.state.BlockBehaviour;
import net.minecraft.world.level.material.MapColor;
import net.minecraftforge.eventbus.api.IEventBus;
import net.minecraftforge.registries.DeferredRegister;
import net.minecraftforge.registries.ForgeRegistries;
import net.minecraftforge.registries.RegistryObject;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.MobCategory;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;

public class DynamicRegistry {
    public static final DeferredRegister<Block> BLOCKS = DeferredRegister.create(ForgeRegistries.BLOCKS, cubicenginegenericMod.MOD_ID);
    public static final DeferredRegister<Item> ITEMS = DeferredRegister.create(ForgeRegistries.ITEMS, cubicenginegenericMod.MOD_ID);
    public static final DeferredRegister<EntityType<?>> ENTITIES = DeferredRegister.create(ForgeRegistries.ENTITY_TYPES, cubicenginegenericMod.MOD_ID);

    public static JsonObject modData = null;
    public static final java.util.Map<String, JsonObject> MOBS_MAP = new java.util.HashMap<>();

    public static void init(IEventBus bus) {
        // Load data from JAR
        try {
            InputStream is = DynamicRegistry.class.getResourceAsStream("/assets/" + cubicenginegenericMod.MOD_ID + "/cubic_data.json");
            if (is != null) {
                try (Reader reader = new InputStreamReader(is, "UTF-8")) {
                    modData = new Gson().fromJson(reader, JsonObject.class);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        // ルールをトリガー種別ごとに仕分けておく。詳細は LogicInterpreter の索引まわり。
        LogicInterpreter.buildIndex();

        if (modData != null) {
            if (modData.has("spec")) {
                int spec = modData.get("spec").getAsInt();
                if (spec != 3) {
                    System.err.println("[CUBICENGINE] WARNING: SPEC_VERSION mismatch! Expected 3, got " + spec);
                }
            }

            if (modData.has("blocks")) {
                JsonArray blocks = modData.getAsJsonArray("blocks");
                for (JsonElement elem : blocks) {
                    JsonObject b = elem.getAsJsonObject();
                    String id = b.get("id").getAsString();
                    float hardness = b.has("hardness") ? b.get("hardness").getAsFloat() : 1.5f;
                    int light = b.has("lightLevel") ? b.get("lightLevel").getAsInt() : 0;
                    
                    // Register Block
                    RegistryObject<Block> blockReg = BLOCKS.register(id, 
                        () -> new Block(BlockBehaviour.Properties.of().mapColor(MapColor.STONE).strength(hardness).lightLevel(state -> light)));
                    // Register Item
                    ITEMS.register(id, () -> new BlockItem(blockReg.get(), new Item.Properties()));
                }
            }

            if (modData.has("items")) {
                JsonArray items = modData.getAsJsonArray("items");
                for (JsonElement elem : items) {
                    JsonObject i = elem.getAsJsonObject();
                    String id = i.get("id").getAsString();
                    int maxStack = i.has("maxStack") ? i.get("maxStack").getAsInt() : 64;
                    
                    // Register Item
                    ITEMS.register(id, () -> new Item(new Item.Properties().stacksTo(maxStack)));
                }
            }

            if (modData.has("mobs")) {
                JsonArray mobs = modData.getAsJsonArray("mobs");
                for (JsonElement elem : mobs) {
                    JsonObject m = elem.getAsJsonObject();
                    String id = m.get("id").getAsString();
                    String base = m.get("base").getAsString();
                    MOBS_MAP.put(id, m);
                    
                    if (m.has("render") && m.get("render").getAsString().equals("geo")) {
                        RegistryObject<EntityType<CubicGeoEntity>> entityReg = ENTITIES.register(id, 
                            () -> EntityType.Builder.of((EntityType.EntityFactory<CubicGeoEntity>) (type, level) -> new CubicGeoEntity(type, level, id), MobCategory.CREATURE)
                                .sized(1.0F, 1.0F)
                                .build(new net.minecraft.resources.ResourceLocation(cubicenginegenericMod.MOD_ID, id).toString()));
                        
                        ITEMS.register(id + "_spawn_egg", () -> new net.minecraftforge.common.ForgeSpawnEggItem(entityReg, 0x333333, 0xaaaaaa, new Item.Properties()));
                    } else {
                        // Register Spawn Egg Item
                        ITEMS.register(id + "_spawn_egg", () -> new CustomSpawnEggItem(base, id, new Item.Properties()));
                    }
                }
            }
        }

        BLOCKS.register(bus);
        ITEMS.register(bus);
        ENTITIES.register(bus);
    }
}
