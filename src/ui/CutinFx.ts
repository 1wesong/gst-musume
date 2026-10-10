import Phaser from 'phaser';
import { CUTIN_DIM_ALPHA, CUTIN_SIZE, GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { HorseData } from '../data/horses';
import { textureKey } from '../objects/HorseView';
import { skewPoints, titleStyle } from './phaserUi';
import { hex, theme } from './theme';

const CX = GAME_WIDTH / 2;
const CY = GAME_HEIGHT / 2;
const PIC_X = GAME_WIDTH * 0.66;

/**
 * 필살기 컷인 연출. 경주 화면 위에 인물 컷인(굵은 흰 외곽선 + 레인 색 glow)과 필살기 이름이 바로 나타났다 사라진다.
 * 화면 번쩍임, 사선 와이프, 슬라이드/등장 애니메이션은 쓰지 않는다. 배경은 약하게만 어둡게 해서
 * 뒤의 경주 화면과 말들의 위치가 그대로 보인다. 컷인은 살짝 떨리는 정도의 움직임만 가진다.
 * 경주가 정지된 동안 쓰이므로 트윈 대신 update(t)로 시간(초)을 직접 받는다.
 */
export class CutinFx {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private lines: Phaser.GameObjects.Graphics;
  private pic: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, horse: HorseData, _lane: number) {
    const fixed = <T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.ScrollFactor>(o: T, depth: number): T => {
      o.setScrollFactor(0);
      (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(depth);
      this.objects.push(o);
      return o;
    };

    // 약한 배경 어둡게
    fixed(scene.add.rectangle(CX, CY, GAME_WIDTH, GAME_HEIGHT, theme.colors.charcoal, 1).setAlpha(CUTIN_DIM_ALPHA), 80);

    // 집중선: 가늘고 반투명해서 뒤의 경주 화면을 가리지 않는다
    this.lines = fixed(scene.add.graphics({ x: CX, y: CY }), 81);
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2;
      const w = Phaser.Math.FloatBetween(0.004, 0.016);
      const r0 = Phaser.Math.Between(260, 420);
      const r1 = Phaser.Math.Between(900, 1300);
      this.lines.fillStyle(i % 3 === 0 ? theme.colors.redLight : 0xffffff, Phaser.Math.FloatBetween(0.15, 0.4));
      this.lines.fillTriangle(Math.cos(a - w) * r0, Math.sin(a - w) * r0, Math.cos(a + w) * r0, Math.sin(a + w) * r0, Math.cos(a) * r1, Math.sin(a) * r1);
    }

    // 빨강/흰 사선 띠 (필살기 이름 뒤, 밝은 배경에서도 글자가 또렷하게)
    const band = fixed(scene.add.graphics({ x: CX - 130, y: CY + 36 }), 85);
    band.setRotation(-0.13);
    band.fillStyle(theme.colors.white, 0.9).fillPoints(skewPoints(1020, 214), true);
    band.fillStyle(theme.colors.red, 0.95).fillPoints(skewPoints(980, 170), true);
    band.fillStyle(theme.colors.goldLight, 1).fillPoints(skewPoints(980, 8).map((p) => new Phaser.Geom.Point(p.x, p.y + 92)), true);

    // 인물 컷인: 굵은 흰 외곽선 + 레인 색 glow
    this.pic = fixed(scene.add.container(PIC_X, CY), 84) as Phaser.GameObjects.Container;
    const key = textureKey(horse, 'cutin');
    if (horse.images.cutin && scene.textures.exists(key)) {
      const img = scene.add.image(0, 0, key).setDisplaySize(CUTIN_SIZE, CUTIN_SIZE);
      // 이미지의 알파 윤곽을 따라 흰 외곽선 → 레인 색 glow (WebGL 전용)
      img.preFX?.addGlow(theme.colors.white, 7, 0, false, 0.12, 14);
      img.preFX?.addGlow(theme.colors.red, 10, 0, false, 0.08, 22);
      this.pic.add(img);
    } else {
      // 이미지가 없으면 도형: 레인 색 glow 겹 + 흰 외곽선 사각형 (이름은 따로 필살기 이름만 표시)
      const s = CUTIN_SIZE * 0.78;
      this.pic.add(scene.add.rectangle(0, 0, s + 70, s + 70, theme.colors.red, 0.25));
      this.pic.add(scene.add.rectangle(0, 0, s + 36, s + 36, theme.colors.red, 0.5));
      this.pic.add(scene.add.rectangle(0, 0, s, s, horse.color).setStrokeStyle(14, theme.colors.white));
    }

    // 필살기 이름: 기울어진 큰 글자 + 굵은 외곽선 (한꺼번에 바로 표시)
    const label = fixed(scene.add.container(CX - 130, CY + 36), 86) as Phaser.GameObjects.Container;
    const chars = [...horse.ultimate.name];
    const style = { ...titleStyle(124, 'lg', theme.colors.white), fontStyle: 'italic' };
    const texts = chars.map((ch) => scene.add.text(0, 0, ch, style).setOrigin(0.5).setShadow(6, 7, hex(theme.colors.ink), 0, true, true));
    const gap = -14;
    const total = texts.reduce((sum, t) => sum + t.width, 0) + gap * (texts.length - 1);
    let x = -total / 2;
    texts.forEach((t) => {
      t.x = x + t.width / 2;
      x += t.width + gap;
      label.add(t);
    });
    label.setRotation(-0.13).setScale(Math.min(1, 860 / total));

    this.update(0);
  }

  /** t: 컷인 시작 후 경과 시간(초). 집중선이 천천히 돌고 인물이 미세하게 떨린다. */
  update(t: number) {
    this.lines.setRotation(t * 0.5);
    this.pic.setPosition(PIC_X + Math.sin(t * 43) * 2.2, CY + Math.cos(t * 37) * 2.2);
  }

  destroy() {
    for (const o of this.objects) o.destroy();
    this.objects = [];
  }
}
