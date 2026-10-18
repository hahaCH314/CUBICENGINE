package com.cubicengine.cubicengine_generic;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.SpawnEggItem;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.state.BlockBehaviour;
import net.minecraft.world.level.material.MapColor;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.neoforge.registries.DeferredBlock;
import net.neoforged.neoforge.registries.DeferredRegister;
import net.neoforged.neoforge.registries.DeferredHolder;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.MobCategory;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;

public class DynamicRegistry {
    // ⚠️ 26.1 では Block / Item / EntityType に「自分の登録名(id)」を持たせないと
    //    組み立ての時点で落ちる（Properties#setId が要る）。素の DeferredRegister.create で
    //    `() -> new Block(Properties.of())` と書くと id が無く、起動時に
    //    "Block id not set" で死ぬ。専用の createBlocks / createItems / createEntities と
    //    registerBlock / registerItem / registerEntityType を使うと、名前から id を付けてくれる。
    public static final DeferredRegister.Blocks BLOCKS = DeferredRegister.createBlocks(cubicenginegenericMod.MOD_ID);
    public static final DeferredRegister.Items ITEMS = DeferredRegister.createItems(cubicenginegenericMod.MOD_ID);
    public static final DeferredRegister.Entities ENTITIES = DeferredRegister.createEntities(cubicenginegenericMod.MOD_ID);

    public static JsonObject modData = null;
    public static final java.util.Map<String, JsonObject> MOBS_MAP = new java.util.HashMap<>();

    /**
     * GeckoLib で描くモブ（render:"geo"）が1体でもあるか。
     *
     * ⚠️ これが false のときは **GeckoLib のクラスに一切触ってはいけない**。
     *    ふつうモードの .jar は GeckoLib を要求しないので、遊ぶ人の環境に無い。
     *    詳しい理由と、実際に起きた事故は GeoSupport のコメントに書いてある。
     */
    public static boolean hasGeoMobs = false;

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

        // ルールをトリガー種別ごとに仕分けておく。ここで1回やっておけば、
        // 毎ティック呼ばれる LogicInterpreter.onTrigger が Map を引くだけで済む。
        // 詳細は LogicInterpreter の索引まわりのコメント。
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
                    DeferredBlock<Block> blockReg = BLOCKS.registerBlock(id, Block::new,
                        () -> BlockBehaviour.Properties.of().mapColor(MapColor.STONE).strength(hardness).lightLevel(state -> light));
                    // Register Item
                    ITEMS.registerSimpleBlockItem(blockReg);
                }
            }

            if (modData.has("items")) {
                JsonArray items = modData.getAsJsonArray("items");
                for (JsonElement elem : items) {
                    JsonObject i = elem.getAsJsonObject();
                    String id = i.get("id").getAsString();
                    int maxStack = i.has("maxStack") ? i.get("maxStack").getAsInt() : 64;

                    // Register Item
                    ITEMS.registerSimpleItem(id, () -> new Item.Properties().stacksTo(maxStack));
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
                        // ここを通った作品だけが GeckoLib を必要とする。
                        // 旗を立てるのを忘れると、geo モブの体力や名前が全部素通りする。
                        hasGeoMobs = true;
                        DeferredHolder<EntityType<?>, EntityType<CubicGeoEntity>> entityReg = ENTITIES.registerEntityType(id,
                            (type, level) -> new CubicGeoEntity(type, level, id),
                            MobCategory.CREATURE,
                            builder -> builder.sized(1.0F, 1.0F));

                        // 1.21.1 の DeferredSpawnEggItem は無くなった。EntityType は Item より先に
                        // 登録されるので、Item.Properties#spawnEgg に直接渡せる（ラムダの中なので
                        // 実際に get() が呼ばれるのは Item の登録時＝EntityType 登録後）。
                        ITEMS.registerItem(id + "_spawn_egg", props -> new SpawnEggItem(props.spawnEgg(entityReg.get())));
                    } else {
                        // Register Spawn Egg Item
                        ITEMS.registerItem(id + "_spawn_egg", props -> new CustomSpawnEggItem(base, id, props));
                    }
                }
            }
        }

        BLOCKS.register(bus);
        ITEMS.register(bus);
        ENTITIES.register(bus);
    }
}
