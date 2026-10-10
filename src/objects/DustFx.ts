import Phaser from 'phaser';
import { DUST_COLOR, DUST_COUNT, DUST_LIFE, DUST_SCALE, DUST_SPEED_X, DUST_SPEED_Y } from '../config';
import { makeDust } from './proceduralTextures';

/** 말 발밑 흙먼지. 달리는 방향 반대쪽으로 길게 날리며, 오른쪽 달리기/왼쪽 달리기용 이미터를 하나씩 공유한다. */
export class DustFx {
  private right: Phaser.GameObjects.Particles.ParticleEmitter; // 오른쪽으로 달릴 때(먼지는 왼쪽으로)
  private left: Phaser.GameObjects.Particles.ParticleEmitter; // 왼쪽으로 달릴 때(먼지는 오른쪽으로)

  constructor(scene: Phaser.Scene) {
    const key = makeDust(scene);
    const make = (sign: 1 | -1) =>
      scene.add
        .particles(0, 0, key, {
          lifespan: { min: DUST_LIFE[0], max: DUST_LIFE[1] },
          speedX: { min: Math.min(DUST_SPEED_X[0] * sign, DUST_SPEED_X[1] * sign), max: Math.max(DUST_SPEED_X[0] * sign, DUST_SPEED_X[1] * sign) },
          speedY: { min: DUST_SPEED_Y[0], max: DUST_SPEED_Y[1] },
          scale: { start: DUST_SCALE.start, end: DUST_SCALE.end },
          alpha: { start: 0.65, end: 0 },
          tint: DUST_COLOR,
          emitting: false,
        })
        .setDepth(-0.2);
    this.right = make(1);
    this.left = make(-1);
  }

  /** dir: 말이 달리는 월드 방향(+1 오른쪽 / -1 왼쪽). */
  puff(x: number, y: number, dir: 1 | -1 = 1) {
    (dir > 0 ? this.right : this.left).explode(DUST_COUNT, x, y);
  }

  /** 필살기 정지/슬로모션에 맞춰 입자 속도를 조절한다. */
  setTimeScale(scale: number) {
    this.right.timeScale = scale;
    this.left.timeScale = scale;
  }
}
