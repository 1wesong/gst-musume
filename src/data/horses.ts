import { HORSE_RACE_COUNT, STYLE_MAX_PER_RACE } from '../config';
import type { RunningStyle } from '../systems/speedModel';
import { parseHorses } from './horseParser';

export interface HorseData {
  id: number; // horses.json 안의 순서(1부터). 텍스처 키에 쓰인다
  name: string;
  /** 넘어짐/역주행 때 말 위에 뜨는 이름. horses.json에서 생략하면 이름 첫 글자 + "창" */
  stumbleName: string;
  color: number; // 임시 사각형 색상
  baseSpeed: number; // 개성용, 차이는 아주 작게
  style: RunningStyle; // 각질: escape 도주 / front 선행 / stalker 선입 / closer 추입
  ultimate: {
    name: string;
    speedMul: number;
  };
  images: {
    stand: string; // 차렷 자세 (레인 소개, 선택 카드)
    run: string; // 달리는 포즈 1 (경주, 결과 팝업)
    run2: string; // 달리는 포즈 2 (다리 반대 자세). 비어 있으면 run 한 장만 쓴다
    cutin: string; // 필살기 컷인
  };
}

export const STYLE_LABEL: Record<RunningStyle, string> = {
  escape: '도주',
  front: '선행',
  stalker: '선입',
  closer: '추입',
};

/**
 * 전체 말 목록. 데이터는 public/data/horses.json 에 있고, 게임 시작 때 loadHorses()가 채운다.
 * 이미지 경로가 빈 문자열이면 임시 도형으로 대체된다. 파일을 읽은 뒤에는 같은 배열을 그대로 쓰므로 import만 해도 된다.
 */
export const HORSES: HorseData[] = [];

export function setHorses(horses: HorseData[]) {
  HORSES.length = 0;
  HORSES.push(...horses);
}

/** public/data/horses.json 을 읽어 HORSES를 채운다 (브라우저). 잘못된 항목은 콘솔 경고, 파일이 쓸 수 없으면 예외. */
export async function loadHorses(url = `${import.meta.env.BASE_URL}data/horses.json`) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url} 를 읽지 못했습니다 (HTTP ${res.status})`);
  const { horses, warnings } = parseHorses(await res.json());
  for (const w of warnings) console.warn('[horses.json]', w);
  setHorses(horses);
}

/**
 * 랜덤 모드용: 15마리를 셔플해 8마리를 뽑되, 같은 각질이 STYLE_MAX_PER_RACE마리를 넘지 않게 한다.
 * 반환 순서가 곧 레인 순서(셔플 순서).
 */
export function pickRaceHorses(): HorseData[] {
  const pool = [...HORSES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const count = new Map<RunningStyle, number>();
  const picked: HorseData[] = [];
  const rest: HorseData[] = [];
  for (const h of pool) {
    const n = count.get(h.style) ?? 0;
    if (picked.length < HORSE_RACE_COUNT && n < STYLE_MAX_PER_RACE) {
      picked.push(h);
      count.set(h.style, n + 1);
    } else {
      rest.push(h);
    }
  }
  // 상한 때문에 모자라면(말 데이터가 한쪽으로 몰린 경우) 남은 말로 채운다
  while (picked.length < HORSE_RACE_COUNT && rest.length) picked.push(rest.shift()!);
  return picked;
}
