import { GAME_HEIGHT, GAME_WIDTH } from '../config';

/**
 * HTML 오버레이를 캔버스와 같은 방식(Phaser Scale.FIT)으로 맞춘다.
 * 오버레이는 항상 GAME_WIDTH x GAME_HEIGHT 크기로 레이아웃하고, 창 크기에 맞게 통째로 확대/축소해 가운데에 둔다.
 * 그래서 창이 작아져도 캔버스 화면(레인 소개, 경주 등)과 배치가 같고, 글자가 세로로 꺾이거나 영역이 겹치지 않는다.
 * 반환값은 리스너를 해제하는 함수.
 */
export function fitStage(el: HTMLElement): () => void {
  el.style.position = 'fixed';
  el.style.left = '50%';
  el.style.top = '50%';
  el.style.width = `${GAME_WIDTH}px`;
  el.style.height = `${GAME_HEIGHT}px`;
  el.style.transformOrigin = 'center center';
  const apply = () => {
    const fit = Math.min(window.innerWidth / GAME_WIDTH, window.innerHeight / GAME_HEIGHT);
    el.style.transform = `translate(-50%, -50%) scale(${fit})`;
  };
  apply();
  window.addEventListener('resize', apply);
  return () => window.removeEventListener('resize', apply);
}
