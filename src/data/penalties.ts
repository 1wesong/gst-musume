import { PENALTY_EXEC_TIME, PENALTY_PICK_RESULT_TIME, PENALTY_PICK_SPIN_TIME } from '../config';

export type PenaltyId = 'exclude' | 'world' | 'swap';

export interface PenaltyDef {
  id: PenaltyId;
  name: string; // 슬롯에 적히고 멈췄을 때 강조되는 이름
  execTime: number; // 벌칙 실행 연출 시간(초). 감컴나가는 대상 슬롯(회전 + 결과 강조) 시간
}

/** 벌칙 3종. 배열 순서 = config PENALTY_WEIGHTS 순서 = 슬롯에 도는 순서. */
export const PENALTIES: PenaltyDef[] = [
  { id: 'exclude', name: '감컴나가', execTime: PENALTY_PICK_SPIN_TIME + PENALTY_PICK_RESULT_TIME },
  { id: 'world', name: '내가 만든 내 세상이야', execTime: PENALTY_EXEC_TIME.world },
  { id: 'swap', name: '열심히 하시잖아', execTime: PENALTY_EXEC_TIME.swap },
];
