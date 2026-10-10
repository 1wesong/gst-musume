import { SKILL_BOOST, SKILL_FALL, SKILL_REVERSE } from '../config';
import type { Racer } from '../objects/Racer';

/**
 * 일반 스킬 정의. 새 스킬은 SKILLS 배열에 항목만 추가하면 된다.
 * apply는 발동 중 매 프레임 호출되며 p는 진행도(0~1), dt는 초 단위 프레임 시간이다.
 * 스킬이 끝나거나 취소되면 Racer.resetSkillEffects()로 효과가 초기화되므로 end는 필요한 경우만 쓴다.
 */
export interface SkillDef {
  id: string;
  name: string;
  weight: number; // 가중치(클수록 자주 발생)
  duration: number; // 지속 시간(초)
  heavy?: boolean; // 한 번에 크게 뒤처지는 스킬 (같은 말에게 연속으로 걸리지 않게 SKILL_HEAVY_MIN_GAP 적용)
  apply: (racer: Racer, p: number, dt: number, t: number) => void;
}

const smooth = (x: number) => x * x * (3 - 2 * x);

export const SKILLS: SkillDef[] = [
  {
    // 부스트: 잔상 + 빠르게 튐
    id: 'boost',
    name: '부스트!',
    weight: SKILL_BOOST.weight,
    duration: SKILL_BOOST.duration,
    apply(r, _p, _dt, t) {
      r.skillSpeedMul = SKILL_BOOST.speedMul;
      const n = Math.floor(t / SKILL_BOOST.afterimageEvery);
      if (n !== r.afterimageCount) {
        r.afterimageCount = n;
        r.spawnAfterimage();
      }
    },
  },
  {
    // 넘어짐: 앞으로 회전해 쓰러졌다가 일어남
    id: 'fall',
    name: '넘어짐',
    weight: SKILL_FALL.weight,
    duration: SKILL_FALL.duration,
    heavy: true,
    apply(r, p) {
      r.skillSpeedMul = SKILL_FALL.speedMul;
      const down = smooth(Math.min(1, p / 0.2));
      const up = smooth(Math.max(0, (p - 0.75) / 0.25));
      r.poseAngle = SKILL_FALL.fallAngle * (down - up);
    },
  },
  {
    // 역주행: 좌우 반전 후 뒤로 달림
    id: 'reverse',
    name: '역주행',
    weight: SKILL_REVERSE.weight,
    duration: SKILL_REVERSE.duration,
    heavy: true,
    apply(r) {
      r.skillSpeedMul = SKILL_REVERSE.speedMul;
      r.flipX = true;
    },
  },
];

/** 가중치로 스킬 하나를 고른다. allowHeavy가 false면 넘어짐/역주행 같은 heavy 스킬은 제외. */
export function pickSkill(allowHeavy = true): SkillDef {
  const pool = allowHeavy ? SKILLS : SKILLS.filter((d) => !d.heavy);
  const total = pool.reduce((sum, d) => sum + d.weight, 0);
  let roll = Math.random() * total;
  for (const d of pool) {
    roll -= d.weight;
    if (roll <= 0) return d;
  }
  return pool[pool.length - 1];
}
