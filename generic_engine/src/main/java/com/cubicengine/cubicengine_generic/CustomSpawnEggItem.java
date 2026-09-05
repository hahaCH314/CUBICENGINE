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
import net.minecraftforge.registries.ForgeRegistries;
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

        EntityType<?> entityType = ForgeRegistries.ENTITY_TYPES.getValue(new ResourceLocation(baseEntity));
        if (entityType != null) {
            Entity entity = entityType.spawn((ServerLevel) level, itemstack, context.getPlayer(), spawnPos, MobSpawnType.SPAWN_EGG, true, !blockpos.equals(spawnPos) && direction == net.minecraft.core.Direction.UP);
            if (entity != null) {
                CompoundTag tag = entity.getPersistentData();
                tag.putString("CubicMobId", cubicMobId);
                
                // Add a flag so ModEventHandler knows it needs to apply attributes
                tag.putBoolean("CubicMobNeedsInit", true);
                
                if (context.getPlayer() != null && !context.getPlayer().getAbilities().instabuild) {
                    itemstack.shrink(1);
                }
                return InteractionResult.CONSUME;
            }
        }
        
        return InteractionResult.PASS;
    }
}
