import { PENALTY_CHANCE, PENALTY_EXCLUDE_TOP_FRACTION, PENALTY_WEIGHTS } from '../config';
import { PENALTIES } from '../data/penalties';

/** 이번 경주에 벌칙 슬롯이 발동하는지 (PENALTY_CHANCE). */
export const rollPenaltyEnabled = (rand: () => number = Math.random): boolean => rand() < PENALTY_CHANCE;

/** 벌칙 3개 중 하나를 PENALTY_WEIGHTS 비율대로 고른다. 반환값은 PENALTIES의 인덱스. */
export function rollPenaltyIndex(rand: () => number = Math.random): number {
  const total = PENALTY_WEIGHTS.reduce((a, b) => a + b, 0);
  let roll = rand() * total;
  for (let i = 0; i < PENALTIES.length; i++) {
    roll -= PENALTY_WEIGHTS[i] ?? 0;
    if (roll < 0) return i;
  }
  return PENALTIES.length - 1;
}

/** 감컴나가 대상 후보: 현재 순위 상위 PENALTY_EXCLUDE_TOP_FRACTION(8마리면 1~4위). 순위순으로 돌려준다. */
export function excludeCandidates<T extends { x: number }>(running: T[]): T[] {
  const sorted = [...running].sort((a, b) => b.x - a.x);
  return sorted.slice(0, Math.max(1, Math.ceil(sorted.length * PENALTY_EXCLUDE_TOP_FRACTION)));
}

/** 후보 중 랜덤 1마리 (게임에서는 대상 슬롯의 결과, 시뮬레이션에서는 바로 뽑는다). */
export function pickExcludeTarget<T extends { x: number }>(running: T[], rand: () => number = Math.random): { racer: T; rank: number } | null {
  const pool = excludeCandidates(running);
  if (pool.length === 0) return null;
  const i = Math.floor(rand() * pool.length);
  return { racer: pool[i], rank: i + 1 };
}

/** 열심히 하시잖아: 현재 1등과 꼴등. 말이 2마리 미만이면 null. */
export function pickSwapPair<T extends { x: number }>(running: T[]): { first: T; last: T } | null {
  if (running.length < 2) return null;
  const sorted = [...running].sort((a, b) => b.x - a.x);
  return { first: sorted[0], last: sorted[sorted.length - 1] };
}
