import { FINISH_X, START_X } from '../config';

/**
 * 논리 좌표(x: 결승선 쪽으로 갈수록 커진다)와 화면 월드 좌표의 변환.
 * 벌칙 "내가 만든 내 세상이야"로 결승선이 반대쪽(출발선 위치)으로 바뀌면 flipped가 되고,
 * 월드 좌표는 거울상(START_X + FINISH_X - x)이 된다. 진행률/순위/남은 거리/슬로모션 같은 로직은 논리 좌표만 쓰므로
 * 방향이 바뀌어도 그대로 새 결승선 기준으로 동작한다.
 */
export class TrackMap {
  flipped = false;

  toWorld(u: number): number {
    return this.flipped ? START_X + FINISH_X - u : u;
  }

  /** 말이 달리는 월드 방향 (+1 오른쪽 / -1 왼쪽). */
  get dir(): 1 | -1 {
    return this.flipped ? -1 : 1;
  }

  /** 결승선의 월드 x. */
  get finishWorld(): number {
    return this.toWorld(FINISH_X);
  }

  flip() {
    this.flipped = true;
  }
}

/** 논리 좌표를 거울상으로 (결승선 반대 전환 시 모든 말에 적용). */
export const mirrorLogical = (x: number): number => START_X + FINISH_X - x;
