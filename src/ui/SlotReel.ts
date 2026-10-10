import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';
import { theme } from './theme';

const CX = GAME_WIDTH / 2;

/**
 * 슬롯머신 한 칸 창. 항목들이 세로로 돌아가다가 하나에 멈춘다.
 * 항목은 창 높이 간격으로 배치되고, 진행도 p(항목 단위, 소수 가능)에 따라 위치가 정해진다.
 * 경주가 정지된 동안 쓰이므로 트윈 대신 setProgress/celebrate에 시간을 직접 넣어 구동한다.
 */
export class SlotReel {
  private root: Phaser.GameObjects.Container;
  private frame: Phaser.GameObjects.Graphics;
  private strip: Phaser.GameObjects.Container;
  private maskGfx: Phaser.GameObjects.Graphics;
  private objs: Phaser.GameObjects.GameObject[] = [];

  constructor(
    scene: Phaser.Scene,
    private items: Phaser.GameObjects.Container[],
    cy: number,
    readonly w = 860,
    readonly h = 190,
    depth = 95,
  ) {
    this.root = scene.add.container(CX, cy).setScrollFactor(0).setDepth(depth);
    this.frame = scene.add.graphics();
    this.drawFrame(theme.colors.gold);
    this.strip = scene.add.container(0, 0, items);
    this.root.add([this.frame, this.strip]);

    // 창 밖으로 나가는 항목을 가린다 (화면 고정 마스크)
    this.maskGfx = scene.make.graphics({ x: 0, y: 0 }, false);
    this.maskGfx.fillStyle(0xffffff).fillRect(CX - w / 2, cy - h / 2, w, h);
    this.maskGfx.setScrollFactor(0);
    this.strip.setMask(this.maskGfx.createGeometryMask());

    // 창 양옆의 화살표
    const arrows = scene.add.graphics();
    arrows.fillStyle(theme.colors.gold, 1).lineStyle(4, theme.colors.charcoal, 1);
    for (const sign of [-1, 1]) {
      const x = sign * (w / 2 + 52);
      arrows.fillTriangle(x - sign * 22, -26, x - sign * 22, 26, x + sign * 18, 0);
      arrows.strokeTriangle(x - sign * 22, -26, x - sign * 22, 26, x + sign * 18, 0);
    }
    this.root.add(arrows);
    this.setProgress(0);
  }

  /** 창 테두리: 흰 창 + 골드 테두리. 멈췄을 때 테두리 색을 바꿔 강조한다. */
  private drawFrame(border: number) {
    const { w, h } = this;
    const g = this.frame.clear();
    g.fillStyle(0x000000, 0.25).fillRect(-w / 2 - 6, -h / 2 + 10, w + 32, h + 30); // 하드 섀도
    g.fillStyle(theme.colors.charcoal, 1).fillRect(-w / 2 - 22, -h / 2 - 22, w + 44, h + 44);
    g.fillStyle(border, 1).fillRect(-w / 2 - 14, -h / 2 - 14, w + 28, h + 28);
    g.fillStyle(theme.colors.charcoal, 1).fillRect(-w / 2 - 8, -h / 2 - 8, w + 16, h + 16);
    g.fillStyle(theme.colors.white, 1).fillRect(-w / 2, -h / 2, w, h);
    g.fillStyle(theme.colors.fog, 1).fillRect(-w / 2, h * 0.25 - h / 2 + h * 0.25, w, h * 0.25); // 아랫면 은은한 그라데이션
    g.lineStyle(1, theme.colors.haze, 0.8).lineBetween(-w / 2, -h / 2 + 1, w / 2, -h / 2 + 1);
  }

  /** p: 항목 단위 진행도. p가 정수일 때 해당 항목이 창 가운데에 온다. */
  setProgress(p: number) {
    const n = this.items.length;
    this.items.forEach((item, i) => {
      let d = (((i - p) % n) + n) % n; // 0 이상 n 미만: 가운데에서 아래쪽으로 몇 칸 떨어졌는지
      if (d >= n / 2) d -= n; // 가장 가까운 쪽(위/아래)으로
      item.setPosition(0, d * this.h);
    });
  }

  /** 멈춘 뒤 강조: 테두리가 레드로 번쩍이고 선택된 항목이 살짝 펄럭인다. */
  celebrate(t: number, selected: number) {
    this.drawFrame(Math.floor(t * 8) % 2 === 0 ? theme.colors.redLight : theme.colors.red); // 당첨: 레드로 번쩍
    const pulse = 1 + Math.sin(t * 12) * 0.035 + Math.max(0, 1 - t * 4) * 0.08;
    this.items.forEach((it, i) => it.setScale(i === selected ? pulse : 1));
  }

  destroy() {
    this.strip.clearMask(true);
    this.maskGfx.destroy();
    this.root.destroy();
    for (const o of this.objs) o.destroy();
  }
}
