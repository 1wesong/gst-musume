import Phaser from 'phaser';
import { SKILL_HEAVY_MIN_GAP, SKILL_INTERVAL, SKILL_START_DELAY } from '../config';
import { pickSkill } from '../data/skills';
import type { Racer } from '../objects/Racer';
import { titleStyle } from '../ui/phaserUi';
import { theme } from '../ui/theme';

/** 경주 중 일반 스킬을 랜덤 발동하고 진행시킨다. 경주를 멈추지 않는다. */
export class SkillSystem {
  private timer = SKILL_START_DELAY;

  constructor(private scene: Phaser.Scene, private racers: Racer[]) {}

  /** allowNew=false면 진행 중인 스킬만 갱신하고 새 스킬은 발생시키지 않는다(슬로모션 중). */
  update(dt: number, allowNew = true) {
    for (const r of this.racers) r.heavyCooldown = Math.max(0, r.heavyCooldown - dt);
    for (const r of this.racers) {
      const a = r.activeSkill;
      if (!a) continue;
      // 골인한 말의 스킬은 즉시 중단
      if (r.rank !== null) {
        r.resetSkillEffects();
        continue;
      }
      a.t += dt;
      const p = Math.min(1, a.t / a.def.duration);
      a.def.apply(r, p, dt, a.t);
      if (p >= 1) r.resetSkillEffects();
    }

    if (!allowNew) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = Phaser.Math.FloatBetween(SKILL_INTERVAL[0], SKILL_INTERVAL[1]);

    // 골인하지 않았고 다른 스킬을 쓰는 중이 아닌 말만 대상
    const candidates = this.racers.filter((r) => r.rank === null && !r.activeSkill);
    if (candidates.length === 0) return;
    const target = Phaser.Utils.Array.GetRandom(candidates);
    // 직전에 넘어짐/역주행을 겪은 말에게는 heavy 스킬을 다시 걸지 않는다
    const def = pickSkill(target.heavyCooldown <= 0);
    target.startSkill(def);
    if (def.heavy) target.heavyCooldown = def.duration + SKILL_HEAVY_MIN_GAP;
    // 넘어짐/역주행은 "○창" 이름으로 표시한다 (부스트는 스킬 이름 그대로)
    this.showLabel(target, def.id === 'fall' || def.id === 'reverse' ? target.horse.stumbleName : def.name);
  }

  private showLabel(racer: Racer, name: string) {
    const text = this.scene.add
      .text(racer.worldX, racer.y - racer.size - 16, name, titleStyle(26, 'sm', theme.colors.red))
      .setOrigin(0.5)
      .setDepth(60);
    this.scene.tweens.add({
      targets: text, y: text.y - 30, alpha: 0, duration: 900, onComplete: () => text.destroy(),
    });
  }
}
