import Phaser from 'phaser';
import { HORSE_DISPLAY_SIZE, HORSE_SCALE, PLACEHOLDER_SIZE, RUN_FRAME_SWAPS_PER_JUMP } from '../config';
import type { HorseData } from '../data/horses';

export type ImageKind = keyof HorseData['images'];

export const textureKey = (horse: HorseData, kind: ImageKind) => `horse${horse.id}_${kind}`;

/**
 * 말 하나를 그리는 컨테이너. 원점은 발 밑 중앙(바닥)이다.
 * 이미지가 로드되어 있으면 이미지, 아니면 말 색상 사각형(+ 이름 텍스트)으로 대체한다.
 */
export class HorseView extends Phaser.GameObjects.Container {
  /** 달리기 프레임(run, run2). 2장이 모두 있을 때만 채워진다 */
  private frames: Phaser.GameObjects.Image[] = [];

  /**
   * @param opts.showName 이미지가 없을 때 임시 사각형 안에 이름을 그릴지 (기본 true).
   *        이름 라벨이 따로 있는 화면에서는 false로 해서 이름이 두 번 나오지 않게 한다.
   */
  constructor(scene: Phaser.Scene, x: number, y: number, horse: HorseData, kind: ImageKind, opts: { showName?: boolean } = {}) {
    super(scene, x, y);
    const key = textureKey(horse, kind);
    if (horse.images[kind] && scene.textures.exists(key)) {
      const img = scene.add.image(0, -HORSE_DISPLAY_SIZE / 2, key).setDisplaySize(HORSE_DISPLAY_SIZE, HORSE_DISPLAY_SIZE);
      this.add(img);
      const key2 = textureKey(horse, 'run2');
      if (kind === 'run' && horse.images.run2 && scene.textures.exists(key2)) {
        const img2 = scene.add.image(0, -HORSE_DISPLAY_SIZE / 2, key2).setDisplaySize(HORSE_DISPLAY_SIZE, HORSE_DISPLAY_SIZE).setVisible(false);
        this.add(img2);
        this.frames = [img, img2];
      }
    } else {
      const w = PLACEHOLDER_SIZE.w * HORSE_SCALE;
      const h = PLACEHOLDER_SIZE.h * HORSE_SCALE;
      this.add(scene.add.rectangle(0, -h / 2, w, h, horse.color).setStrokeStyle(2, 0x000000, 0.6));
      if (opts.showName !== false) {
        this.add(
          scene.add
            .text(0, -h / 2, horse.name, { fontSize: `${Math.round(16 * HORSE_SCALE)}px`, color: '#ffffff', stroke: '#000000', strokeThickness: 3 })
            .setOrigin(0.5),
        );
      }
    }
    scene.add.existing(this);
  }

  /** 튀는 위상에 맞춰 달리기 프레임을 번갈아 보여 준다 (프레임이 1장이면 아무것도 하지 않음). */
  setRunPhase(phase: number) {
    if (this.frames.length < 2) return;
    const i = Math.floor((phase * RUN_FRAME_SWAPS_PER_JUMP) / Math.PI) & 1;
    this.frames[0].setVisible(i === 0);
    this.frames[1].setVisible(i === 1);
  }
}
