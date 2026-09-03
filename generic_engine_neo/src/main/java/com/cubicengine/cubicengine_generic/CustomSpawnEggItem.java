package com.cubicengine.cubicengine_generic;

import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.context.UseOnContext;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.level.Level;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.MobSpawnType;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.core.BlockPos;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.nbt.CompoundTag;

public class CustomSpawnEggItem extends Item {
    private final String baseEntity;
    private final String cubicMobId;
    
    public CustomSpawnEggItem(String baseEntity, String cubicMobId, Properties properties) {
        super(properties);
        this.baseEntity = baseEntity;
        this.cubicMobId = cubicMobId;
    }

    @Override
    public InteractionResult useOn(UseOnContext context) {
        Level level = context.getLevel();
        if (!(level instanceof ServerLevel)) {
            return InteractionResult.SUCCESS;
        }

        ItemStack itemstack = context.getItemInHand();
        BlockPos blockpos = context.getClickedPos();
        net.minecraft.core.Direction direction = context.getClickedFace();
        BlockPos spawnPos = blockpos.relative(direction);

        // ⚠️ ENTITY_TYPE は「既定値つき」の台帳で、知らない id を引くと
        //    null ではなく**ブタ**が返る。null チェックだけだと素通りして、
        //    打ち間違えた設計図が黙ってブタを湧かせる。先に有無を確かめる。
        ResourceLocation baseId = ResourceLocation.parse(baseEntity);
        if (!BuiltInRegistries.ENTITY_TYPE.containsKey(baseId)) {
            return InteractionResult.PASS;
        }
        EntityType<?> entityType = BuiltInRegistries.ENTITY_TYPE.get(baseId);
        if (entityType != null) {
            Entity entity = entityType.spawn((ServerLevel) level, itemstack, context.getPlayer(), spawnPos, MobSpawnType.SPAWN_EGG, true, !blockpos.equals(spawnPos) && direction == net.minecraft.core.Direction.UP);
            if (entity != null) {
                // ⚠️ バニラのモブを土台にしているので、この生き物は自分が
                //    どのCUBICモブかを知らない。ここで覚えさせないと、
                //    設定した体力も名前もドロップも当たらない。
                //    （geoモブは専用の EntityType なので、この印は要らない）
                CompoundTag tag = entity.getPersistentData();
                tag.putString("CubicMobId", cubicMobId);

                if (context.getPlayer() != null && !context.getPlayer().getAbilities().instabuild) {
                    itemstack.shrink(1);
                }
                return InteractionResult.CONSUME;
            }
        }
        
        return InteractionResult.PASS;
    }
}
