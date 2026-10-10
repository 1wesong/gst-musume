import type Phaser from 'phaser';
import { FG_HEIGHT, PARALLAX, TRACK_BOTTOM } from '../config';
import { makeFence, makeForeground, makeMountains, makeStands } from '../objects/proceduralTextures';

/**
 * 경주 배경 패럴랙스 레이어 정의 (멀리 있는 것부터).
 * image가 빈 문자열이거나 로드되지 않으면 fallback이 만든 단색 도형 텍스처를 쓴다.
 * 이미지는 가로로 이어 붙일 수 있는 타일형이어야 하고, height에 맞춰 세로 크기가 조정된다.
 */
export interface BgLayerDef {
  id: string;
  image: string; // public/ 기준 상대경로. 예: 'assets/bg/mountains.png'
  factor: number; // 패럴랙스 계수 (0=고정, 1=트랙과 동일)
  y: number; // 배경 영역 안에서 레이어 윗변 y
  height: number;
  depth: number;
  fallback: (scene: Phaser.Scene) => string; // 임시 텍스처 생성 → 텍스처 키 반환
}

export const bgTextureKey = (id: string) => `bg_${id}`;

export const BG_LAYERS: BgLayerDef[] = [
  { id: 'mountains', image: '', factor: PARALLAX.mountains, y: 6, height: 128, depth: -10, fallback: makeMountains },
  { id: 'stands', image: '', factor: PARALLAX.stands, y: 84, height: 64, depth: -9, fallback: makeStands },
  { id: 'fence', image: '', factor: PARALLAX.fence, y: 128, height: 32, depth: -8, fallback: makeFence },
  // 전경: 트랙보다 빠르게 스쳐 지나가는 맨 앞 띠 (FG_HEIGHT가 0이면 만들지 않는다)
  ...(FG_HEIGHT > 0
    ? [{ id: 'foreground', image: '', factor: PARALLAX.foreground, y: TRACK_BOTTOM, height: FG_HEIGHT, depth: 44, fallback: makeForeground }]
    : []),
];

// 구름 이미지(투명 PNG). 비어 있으면 임시 구름 사용
export const CLOUD_IMAGE = '';
export const CLOUD_KEY = 'bg_cloud';

// 메인 화면 이미지. 비어 있으면 도형/텍스트로 대체 (배경은 1920px 가로, 로고는 투명 PNG)
export const MAIN_ASSETS = {
  bg: { key: 'main_bg', image: '' },
  logo: { key: 'main_logo', image: '' },
} as const;
