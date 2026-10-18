package com.cubicengine.cubicengine_generic;

import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.context.UseOnContext;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.level.Level;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntitySpawnReason;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.core.BlockPos;
import net.minecraft.resources.Identifier;
import net.minecraft.core.registries.BuiltInRegistries;

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
        if (!(level instanceof ServerLevel serverLevel)) {
            return InteractionResult.SUCCESS;
        }

        ItemStack itemstack = context.getItemInHand();
        BlockPos blockpos = context.getClickedPos();
        net.minecraft.core.Direction direction = context.getClickedFace();
        BlockPos spawnPos = blockpos.relative(direction);

        // ⚠️ ENTITY_TYPE は「既定値つき」の台帳で、知らない id を引くと
        //    null ではなく**ブタ**が返る。null チェックだけだと素通りして、
        //    打ち間違えた設計図が黙ってブタを湧かせる。先に有無を確かめる。
        Identifier baseId = Identifier.tryParse(baseEntity);
        if (baseId == null || !BuiltInRegistries.ENTITY_TYPE.containsKey(baseId)) {
            return InteractionResult.PASS;
        }
        EntityType<?> entityType = BuiltInRegistries.ENTITY_TYPE.getValue(baseId);
        Entity entity = spawnTagged(entityType, serverLevel, spawnPos,
            !blockpos.equals(spawnPos) && direction == net.minecraft.core.Direction.UP);
        if (entity != null) {
            if (context.getPlayer() != null && !context.getPlayer().getAbilities().instabuild) {
                itemstack.shrink(1);
            }
            return InteractionResult.CONSUME;
        }

        return InteractionResult.PASS;
    }

    /**
     * ⚠️ バニラのモブを土台にしているので、この生き物は自分が
     *    どのCUBICモブかを知らない。ここで覚えさせないと、
     *    設定した体力も名前もドロップも当たらない。
     *    （geoモブは専用の EntityType なので、この印は要らない）
     *
     *    26.1 の spawn は「ワールドに入れる前に呼ぶ Consumer」を受け取る。
     *    ここで印を付けておけば、EntityJoinLevelEvent が鳴る時点で既に名乗れる。
     *    1.21.1 では spawn の**後**に付けていたので、湧いた瞬間の Join では
     *    まだ名無しだった（体力が当たるのは次に読み込まれてから）。
     */
    private <T extends Entity> Entity spawnTagged(EntityType<T> type, ServerLevel level, BlockPos pos, boolean offsetY) {
        return type.spawn(level,
            e -> e.getPersistentData().putString("CubicMobId", cubicMobId),
            pos, EntitySpawnReason.SPAWN_ITEM_USE, true, offsetY);
    }
}
