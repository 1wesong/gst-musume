import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SPEEDLINE_ALPHA, SPEEDLINE_BOOST_ALPHA, SPEEDLINE_COUNT, SPEEDLINE_EDGE, SPEEDLINE_SPEED } from '../config';
import { makeSpeedLine } from './proceduralTextures';

interface Line {
  img: Phaser.GameObjects.Image;
  side: 0 | 1; // 0=왼쪽 가장자리, 1=오른쪽 가장자리
  x: number;
  len: number;
  speed: number; // 개별 속도 배율
  alpha: number; // 개별 진하기 배율
}

const EDGE_W = GAME_WIDTH * SPEEDLINE_EDGE;

/**
 * 화면 좌우 가장자리에 흐르는 은은한 속도선. 화면 가운데는 비워 두어 경주를 가리지 않는다.
 * 말이 오른쪽으로 달리므로 선은 왼쪽으로 흐르고, 부스트/필살기 중에는 더 길고 진하고 빠르게 흐른다.
 */
export class SpeedLines {
  private lines: Line[] = [];

  constructor(scene: Phaser.Scene) {
    const key = makeSpeedLine(scene);
    for (let i = 0; i < SPEEDLINE_COUNT; i++) {
      const img = scene.add.image(0, 0, key).setOrigin(0, 0.5).setScrollFactor(0).setDepth(30).setAlpha(0);
      const line: Line = { img, side: (i % 2) as 0 | 1, x: 0, len: 0, speed: 1, alpha: 1 };
      this.respawn(line, true);
      this.lines.push(line);
    }
  }

  private respawn(l: Line, initial = false) {
    l.len = Phaser.Math.Between(90, 240);
    l.speed = Phaser.Math.FloatBetween(0.7, 1.4);
    l.alpha = Phaser.Math.FloatBetween(0.5, 1);
    const zoneStart = l.side === 0 ? 0 : GAME_WIDTH - EDGE_W;
    // 처음에는 구역 안에 흩뿌리고, 이후에는 구역 안쪽 끝에서 다시 나타난다
    l.x = initial ? zoneStart + Math.random() * EDGE_W : l.side === 0 ? EDGE_W : GAME_WIDTH;
    l.img.y = Phaser.Math.Between(8, GAME_HEIGHT - 8);
    l.img.setScale(1, Phaser.Math.FloatBetween(0.35, 0.9));
  }

  /**
   * @param dt 게임 시간(초)
   * @param speedRatio 현재 달리는 속도 / 기준 속도 (보통 1 안팎)
   * @param boost 0~1: 부스트/필살기 강화 정도
   * @param enabled false면 숨김 (슬로모션 등)
   */
  update(dt: number, speedRatio: number, boost: number, enabled = true, dir: 1 | -1 = 1) {
    const base = SPEEDLINE_ALPHA + (SPEEDLINE_BOOST_ALPHA - SPEEDLINE_ALPHA) * boost;
    for (const l of this.lines) {
      l.x -= SPEEDLINE_SPEED * l.speed * Math.max(0.4, speedRatio) * (1 + boost * 0.9) * dt;
      const len = l.len * (1 + boost * 0.8);
      const gone = l.side === 0 ? l.x + len < 0 : l.x + len < GAME_WIDTH - EDGE_W;
      if (gone) this.respawn(l);
      // 화면 가장자리에 가까울수록 진하고, 안쪽으로 갈수록 사라진다
      const near = l.side === 0 ? 1 - Phaser.Math.Clamp(l.x / EDGE_W, 0, 1) : Phaser.Math.Clamp((l.x - (GAME_WIDTH - EDGE_W)) / EDGE_W, 0, 1);
      // dir이 -1이면 화면을 좌우로 뒤집어 그린다 (흐르는 방향이 반대)
      const drawX = dir > 0 ? l.x : GAME_WIDTH - l.x - len;
      l.img.setFlipX(dir < 0).setPosition(drawX, l.img.y).setDisplaySize(len, 8 * l.img.scaleY).setAlpha(enabled ? near * base * l.alpha : 0);
    }
  }
}
