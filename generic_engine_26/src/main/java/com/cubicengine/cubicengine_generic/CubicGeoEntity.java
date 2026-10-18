package com.cubicengine.cubicengine_generic;

import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.PathfinderMob;
import net.minecraft.world.entity.ai.goal.WaterAvoidingRandomStrollGoal;
import net.minecraft.world.entity.ai.goal.LookAtPlayerGoal;
import net.minecraft.world.entity.ai.goal.RandomLookAroundGoal;
import net.minecraft.world.entity.ai.attributes.AttributeSupplier;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.Level;
// GeckoLib 5（26.1 向け）はパッケージが software.bernie.geckolib → com.geckolib に変わった
import com.geckolib.animatable.GeoEntity;
import com.geckolib.animatable.instance.AnimatableInstanceCache;
import com.geckolib.animatable.manager.AnimatableManager;
import com.geckolib.animation.AnimationController;
import com.geckolib.animation.RawAnimation;
import com.geckolib.util.GeckoLibUtil;

public class CubicGeoEntity extends PathfinderMob implements GeoEntity {
    private final AnimatableInstanceCache cache = GeckoLibUtil.createInstanceCache(this);
    private final String mobId;
    private final RawAnimation walkAnim;
    private final RawAnimation idleAnim;

    public CubicGeoEntity(EntityType<? extends PathfinderMob> entityType, Level level, String mobId) {
        super(entityType, level);
        this.mobId = mobId;
        this.walkAnim = RawAnimation.begin().thenLoop("animation." + mobId + ".walk");
        this.idleAnim = RawAnimation.begin().thenLoop("animation." + mobId + ".idle");
    }

    public String getMobId() {
        return this.mobId;
    }

    public static AttributeSupplier.Builder createAttributes() {
        return PathfinderMob.createMobAttributes()
                .add(Attributes.MAX_HEALTH, 20.0D)
                .add(Attributes.MOVEMENT_SPEED, 0.25D)
                .add(Attributes.ATTACK_DAMAGE, 3.0D);
    }

    @Override
    protected void registerGoals() {
        this.goalSelector.addGoal(1, new WaterAvoidingRandomStrollGoal(this, 1.0D));
        this.goalSelector.addGoal(2, new LookAtPlayerGoal(this, Player.class, 6.0F));
        this.goalSelector.addGoal(3, new RandomLookAroundGoal(this));
    }

    @Override
    public void registerControllers(AnimatableManager.ControllerRegistrar controllers) {
        // GeckoLib 5 の AnimationController は (名前, 切り替えtick, ハンドラ)。
        // ハンドラは AnimationTest を受け取り、setAndContinue が「その動きを流して続行」
        controllers.add(new AnimationController<>("controller", 0,
            test -> test.setAndContinue(test.isMoving() ? walkAnim : idleAnim)));
    }

    @Override
    public AnimatableInstanceCache getAnimatableInstanceCache() {
        return this.cache;
    }
}
