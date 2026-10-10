import {
  GAP_ASSIST, LAST_SPURT_AT, RUBBER_BAND, SPEED_TARGET_INTERVAL, SPEED_TARGET_VARIATION, SPURT_SPEED_MUL, SPURT_TARGET_INTERVAL, SPURT_VARIATION, STYLE_CURVES,
  STYLE_STRENGTH, ULTIMATE_RAMP_TIME,
} from '../config';

export type RunningStyle = keyof typeof STYLE_CURVES;

/** 각질에 따른 속도 배율. progress: 경주 진행률(0~1). 곡선 5개 지점 사이를 선형 보간한다. */
export function styleMultiplier(style: RunningStyle, progress: number): number {
  const curve = STYLE_CURVES[style];
  const p = Math.min(1, Math.max(0, progress)) * (curve.length - 1);
  const i = Math.min(curve.length - 2, Math.floor(p));
  const v = curve[i] + (curve[i + 1] - curve[i]) * (p - i);
  return 1 + (v - 1) * STYLE_STRENGTH;
}

/** 라스트 스퍼트 구간인지. leaderProgress: 선두의 진행률(0~1). */
export const isSpurt = (leaderProgress: number): boolean => leaderProgress >= LAST_SPURT_AT;

/**
 * 추격 보정 배율. rankIndex: 0=선두, count-1=최하위. 선두는 감속, 최하위는 가속.
 * 초중반(pack)에는 강하게, 라스트 스퍼트(spurt)에서는 RUBBER_BAND.spurt(기본 0=끔).
 */
export function rubberMultiplier(rankIndex: number, count: number, spurt = false): number {
  if (count <= 1) return 1;
  const t = rankIndex / (count - 1); // 0(선두) ~ 1(최하위)
  const band = spurt ? RUBBER_BAND.spurt : RUBBER_BAND.pack;
  return 1 + band * (2 * t - 1);
}

/** 목표 속도 변동 폭(±). 스퍼트에서 커진다. */
export const speedVariation = (spurt: boolean): number => (spurt ? SPURT_VARIATION : SPEED_TARGET_VARIATION);

/** 목표 속도를 새로 뽑는 주기(초). */
export const speedTargetInterval = (spurt: boolean): readonly [number, number] => (spurt ? SPURT_TARGET_INTERVAL : SPEED_TARGET_INTERVAL);

/** 스퍼트 구간 전체 속도 배율. */
export const spurtSpeedMul = (spurt: boolean): number => (spurt ? SPURT_SPEED_MUL : 1);

/**
 * 필살기 속도 배율. 발동 직후에는 1에 가깝게 시작해 ULTIMATE_RAMP_TIME에 걸쳐 peak까지 부드럽게 올라간다.
 * (갑자기 선두를 크게 따돌리지 않고 점점 따라붙는 흐름)
 */
export function ultimateMultiplier(peak: number, elapsed: number): number {
  const t = Math.min(1, Math.max(0, elapsed / ULTIMATE_RAMP_TIME));
  return 1 + (peak - 1) * t * t * (3 - 2 * t);
}

/**
 * 극단적 격차 보정 배율. gapFrac: 선두-꼴찌 간격(트랙 길이 대비). GAP_ASSIST.limit 이하면 항상 1(보정 없음).
 * 넘으면 초과분에 비례해 선두는 감속, 꼴찌는 가속(rankIndex 0=선두, count-1=최하위, 가운데는 거의 영향 없음). 위치는 건드리지 않는다.
 */
export function gapAssistMultiplier(rankIndex: number, count: number, gapFrac: number): number {
  if (count <= 1) return 1;
  const strength = Math.min(1, Math.max(0, (gapFrac - GAP_ASSIST.limit) / GAP_ASSIST.range));
  if (strength === 0) return 1;
  const t = rankIndex / (count - 1);
  return 1 + GAP_ASSIST.max * strength * (2 * t - 1);
}
