import { HORSE_RACE_COUNT, ULTIMATE_SPEED_MUL } from '../config';
import type { RunningStyle } from '../systems/speedModel';
import type { HorseData } from './horses';

// public/data/horses.json 을 HorseData[]로 바꾸는 순수 함수. 브라우저(fetch)와 Node(balance 스크립트)가 같이 쓴다.
// 틀린 항목은 기본값으로 대체하고 warnings에 모아 둔다. 경주를 못 할 정도로 잘못된 파일(말 8마리 미만 등)만 예외를 던진다.

const STYLES: RunningStyle[] = ['escape', 'front', 'stalker', 'closer'];
const IMAGE_KINDS = ['stand', 'run', 'run2', 'cutin'] as const;

// color를 비웠을 때 순서대로 쓰는 임시 색상
const FALLBACK_COLORS = [
  0xe74c3c, 0xe67e22, 0xf1c40f, 0x2ecc71, 0x1abc9c,
  0x3498db, 0x9b59b6, 0xe84393, 0x95a5a6, 0x8d6e63,
  0x00b894, 0x0984e3, 0xfd79a8, 0x6c5ce7, 0xfab1a0,
];

export interface ParseResult {
  horses: HorseData[];
  warnings: string[];
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseHorses(json: unknown): ParseResult {
  const warnings: string[] = [];
  const list = isObject(json) ? json.horses : undefined;
  if (!Array.isArray(list)) throw new Error('horses.json: 최상위에 "horses" 배열이 필요합니다');

  const horses: HorseData[] = [];
  const names = new Set<string>();
  list.forEach((raw, index) => {
    const at = `horses[${index}]`;
    if (!isObject(raw)) {
      warnings.push(`${at}: 객체가 아니라서 건너뜀`);
      return;
    }
    const name = typeof raw.name === 'string' ? raw.name.trim() : '';
    if (!name) {
      warnings.push(`${at}: name이 비어 있어서 건너뜀`);
      return;
    }
    if (names.has(name)) warnings.push(`${at}: 이름 "${name}"이 중복됨`);
    names.add(name);

    const id = horses.length + 1; // 파일 순서가 id. 텍스처 키에 쓰이므로 말 하나를 건너뛰면 뒤 id가 당겨진다

    let style: RunningStyle;
    if (STYLES.includes(raw.style as RunningStyle)) {
      style = raw.style as RunningStyle;
    } else {
      style = STYLES[(id - 1) % STYLES.length];
      warnings.push(`${at}(${name}): style은 ${STYLES.join('/')} 중 하나여야 함 (받은 값: ${JSON.stringify(raw.style)}), ${style}로 대체`);
    }

    const baseSpeed = typeof raw.baseSpeed === 'number' && raw.baseSpeed > 0 ? raw.baseSpeed : 1;
    if (raw.baseSpeed !== undefined && baseSpeed !== raw.baseSpeed) warnings.push(`${at}(${name}): baseSpeed는 0보다 큰 숫자여야 함, 1로 대체`);

    const ult = isObject(raw.ultimate) ? raw.ultimate : {};
    const ultName = typeof ult.name === 'string' && ult.name.trim() ? ult.name.trim() : `필살기${id}`;
    const speedMul = typeof ult.speedMul === 'number' && ult.speedMul > 0 ? ult.speedMul : ULTIMATE_SPEED_MUL;
    if (ult.speedMul !== undefined && speedMul !== ult.speedMul) warnings.push(`${at}(${name}): ultimate.speedMul은 0보다 큰 숫자여야 함, 기본값으로 대체`);

    const imgs = isObject(raw.images) ? raw.images : {};
    const images = { stand: '', run: '', run2: '', cutin: '' };
    for (const kind of IMAGE_KINDS) {
      const v = imgs[kind];
      if (typeof v === 'string') images[kind] = v.trim().replace(/^\/+/, ''); // public/ 기준 상대경로 (예: assets/horses/01_stand.png)
      else if (v !== undefined) warnings.push(`${at}(${name}): images.${kind}는 문자열이어야 함`);
    }

    horses.push({
      id,
      name,
      stumbleName: typeof raw.stumbleName === 'string' && raw.stumbleName.trim() ? raw.stumbleName.trim() : `${[...name][0]}창`,
      color: parseColor(raw.color, FALLBACK_COLORS[(id - 1) % FALLBACK_COLORS.length], `${at}(${name})`, warnings),
      baseSpeed,
      style,
      ultimate: { name: ultName, speedMul },
      images,
    });
  });

  if (horses.length < HORSE_RACE_COUNT) {
    throw new Error(`horses.json: 유효한 말이 ${horses.length}마리뿐입니다. 경주에는 최소 ${HORSE_RACE_COUNT}마리가 필요합니다`);
  }
  return { horses, warnings };
}

function parseColor(v: unknown, fallback: number, at: string, warnings: string[]): number {
  if (v === undefined) return fallback;
  if (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.trim())) return parseInt(v.trim().slice(1), 16);
  warnings.push(`${at}: color는 "#rrggbb" 형식이어야 함 (받은 값: ${JSON.stringify(v)}), 임시 색으로 대체`);
  return fallback;
}
