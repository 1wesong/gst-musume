import { ULTIMATE_BOTTOM_FRACTION, ULTIMATE_COUNT_WEIGHTS, ULTIMATE_TRIGGER } from '../config';

/** 이번 경주에서 필살기를 쓸 말 수(0~2)를 확률(ULTIMATE_COUNT_WEIGHTS)대로 정한다. */
export function rollUltimateCount(rand: () => number = Math.random): number {
  const total = ULTIMATE_COUNT_WEIGHTS.reduce((a, b) => a + b, 0);
  let roll = rand() * total;
  for (let i = 0; i < ULTIMATE_COUNT_WEIGHTS.length; i++) {
    roll -= ULTIMATE_COUNT_WEIGHTS[i];
    if (roll < 0) return i;
  }
  return ULTIMATE_COUNT_WEIGHTS.length - 1;
}

/** 선두가 필살기 판정 지점에 닿는 진행률(0~1)을 랜덤으로 정한다. */
export function rollUltimateTrigger(rand: () => number = Math.random): number {
  return ULTIMATE_TRIGGER[0] + rand() * (ULTIMATE_TRIGGER[1] - ULTIMATE_TRIGGER[0]);
}

/**
 * 판정 시점에 남은 말 중 하위권(하위 ULTIMATE_BOTTOM_FRACTION, 예: 8마리면 5~8위, 7마리면 5~7위) 중에서 count마리를 랜덤으로 고른다.
 * running: 아직 골인하지 않고 제외되지 않은 말들 (x가 클수록 앞). 반환값에 rank(1=선두)를 함께 돌려준다.
 */
export function pickUltimateTargets<T extends { x: number }>(running: T[], count: number, rand: () => number = Math.random): { racer: T; rank: number }[] {
  const sorted = [...running].sort((a, b) => b.x - a.x);
  const pool = sorted
    .map((racer, i) => ({ racer, rank: i + 1 }))
    .filter((e) => e.rank > Math.ceil(sorted.length * (1 - ULTIMATE_BOTTOM_FRACTION)));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
