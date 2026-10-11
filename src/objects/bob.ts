import { BOB_HEIGHT, SQUASH_AMOUNT, TILT_DEG } from '../config';

interface RunFramed {
  setRunPhase(phase: number): void;
}

/**
 * 통통 튀는 달리기 포즈 적용. phase: |sin| 한 주기가 한 번의 점프.
 * baseScale: 레인 원근에 따른 크기 배율. 반환값: 점프 높이 비율(0=착지, 1=최고점)
 */
export function applyBob(view: Phaser.GameObjects.Container, phase: number, x: number, baseY: number, baseScale = 1): number {
  const s = Math.abs(Math.sin(phase));
  const landing = Math.pow(1 - s, 6); // 착지 순간 근처에서만 커진다
  (view as Partial<RunFramed>).setRunPhase?.(phase);
  view.x = x;
  view.y = baseY - s * BOB_HEIGHT * baseScale;
  view.angle = Math.cos(phase) * TILT_DEG;
  view.scaleX = baseScale * (1 + landing * SQUASH_AMOUNT);
  view.scaleY = baseScale * (1 - landing * SQUASH_AMOUNT);
  return s;
}
