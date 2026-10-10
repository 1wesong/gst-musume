import { HORSE_RACE_COUNT, STYLE_MAX_PER_RACE, ULTIMATE_SPEED_MUL } from '../config';
import type { RunningStyle } from '../systems/speedModel';

export interface HorseData {
  id: number;
  name: string;
  /** 넘어짐/역주행 때 말 위에 뜨는 이름. 기본은 이름 첫 글자 + "창", 예외는 STUMBLE_OVERRIDES */
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
    run: string; // 달리는 포즈 (경주, 결과 팝업)
    cutin: string; // 필살기 컷인
  };
}

// 이미지 경로가 빈 문자열이면 임시 도형으로 대체된다.
// 실제 이미지 적용 시 'assets/horses/01_stand.png' 형태(public/ 기준 상대경로)로 채운다.
export const STYLE_LABEL: Record<RunningStyle, string> = {
  escape: '도주',
  front: '선행',
  stalker: '선입',
  closer: '추입',
};

const STYLES: RunningStyle[] = ['escape', 'front', 'stalker', 'closer'];

const NO_IMAGES = { stand: '', run: '', cutin: '' };

const palette = [
  0xe74c3c, 0xe67e22, 0xf1c40f, 0x2ecc71, 0x1abc9c,
  0x3498db, 0x9b59b6, 0xe84393, 0x95a5a6, 0x8d6e63,
  0x00b894, 0x0984e3, 0xfd79a8, 0x6c5ce7, 0xfab1a0,
];

const NAMES = ['감스트', '로기다', '홍타쿠', '박재박', '황원태', '카라미', '용형', '조경훈', '꾸티뉴', '뿌꾸', '추멘', '아뚱', '세글자', '지피티', '울큰고'];

// 넘어짐/역주행 표시 이름 예외 (말 id → 이름). 나머지는 첫 글자 + "창"
const STUMBLE_OVERRIDES: Record<number, string> = { 4: '털창', 5: '습창', 8: '썩창', 12: '뚱창' };

// 필살기 이름은 임시 값. 추후 교체.
export const HORSES: HorseData[] = palette.map((color, i) => ({
  id: i + 1,
  name: NAMES[i],
  stumbleName: STUMBLE_OVERRIDES[i + 1] ?? `${NAMES[i][0]}창`,
  color,
  baseSpeed: 1.0,
  style: STYLES[i % STYLES.length], // 임시: 순환 배정. 실제 말 데이터 확정 후 개별 지정
  ultimate: { name: `필살기${i + 1}`, speedMul: ULTIMATE_SPEED_MUL },
  images: { ...NO_IMAGES },
}));

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
