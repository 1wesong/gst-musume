import Phaser from 'phaser';
import { BG_HEIGHT, CLOUD_COUNT, CLOUD_DRIFT, CLOUD_PARALLAX, GAME_WIDTH } from '../config';
import { BG_LAYERS, CLOUD_KEY, bgTextureKey } from '../data/background';
import { makeCloud } from './proceduralTextures';

interface Cloud {
  img: Phaser.GameObjects.Image;
  x0: number; // 흘러가며 변하는 기준 x
  speed: number;
}

/**
 * 하늘 / 구름 / 먼 산 / 관중석 / 울타리 패럴랙스 배경.
 * 모두 화면 가로 고정(scrollFactor x=0)으로 두고 tilePositionX를 카메라에 맞춰 직접 갱신한다.
 * 세로는 월드와 함께 움직여서 트랙과 어긋나지 않는다.
 */
export class ParallaxBackground {
  private tiles: { sprite: Phaser.GameObjects.TileSprite; factor: number; scale: number }[] = [];
  private clouds: Cloud[] = [];

  constructor(scene: Phaser.Scene) {
    // 하늘: 위에서 아래로 살짝 밝아지는 맑은 낮 하늘 띠
    const sky = scene.add.graphics().setScrollFactor(0, 1).setDepth(-12);
    const bands = 10;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      const r = Math.round(0xa9 + (0xe3 - 0xa9) * t);
      const g = Math.round(0xcd + (0xf0 - 0xcd) * t);
      const b = Math.round(0xea + (0xfa - 0xea) * t);
      sky.fillStyle(Phaser.Display.Color.GetColor(r, g, b));
      sky.fillRect(0, (BG_HEIGHT / bands) * i, GAME_WIDTH, BG_HEIGHT / bands + 1);
    }

    // 구름
    const cloudKey = scene.textures.exists(CLOUD_KEY) ? CLOUD_KEY : makeCloud(scene);
    const frameW = scene.textures.getFrame(cloudKey).width;
    for (let i = 0; i < CLOUD_COUNT; i++) {
      const scale = Phaser.Math.FloatBetween(0.35, 0.8);
      const img = scene.add
        .image(0, Phaser.Math.Between(4, Math.round(BG_HEIGHT * 0.5)), cloudKey)
        .setOrigin(0, 0)
        .setScale(scale)
        .setAlpha(Phaser.Math.FloatBetween(0.7, 0.95))
        .setScrollFactor(0, 1)
        .setDepth(-11);
      const speed = Phaser.Math.FloatBetween(CLOUD_DRIFT[0], CLOUD_DRIFT[1]) * scale;
      this.clouds.push({ img, x0: Math.random() * (GAME_WIDTH + frameW * scale), speed });
    }

    // 산 / 관중석 / 울타리 타일 레이어
    for (const def of BG_LAYERS) {
      const key = def.image && scene.textures.exists(bgTextureKey(def.id)) ? bgTextureKey(def.id) : def.fallback(scene);
      const frameH = scene.textures.getFrame(key).height;
      const scale = def.height / frameH;
      const sprite = scene.add
        .tileSprite(0, def.y, GAME_WIDTH, def.height, key)
        .setOrigin(0, 0)
        .setScrollFactor(0, 1)
        .setDepth(def.depth);
      sprite.setTileScale(scale, scale);
      this.tiles.push({ sprite, factor: def.factor, scale });
    }
  }

  /** scrollX: 카메라 가로 스크롤, dt: 게임 시간(초). 슬로모션/정지 때 구름도 같이 느려진다. */
  update(scrollX: number, dt: number) {
    for (const t of this.tiles) t.sprite.tilePositionX = (scrollX * t.factor) / t.scale;
    for (const c of this.clouds) {
      c.x0 += c.speed * dt;
      const w = c.img.displayWidth;
      const span = GAME_WIDTH + w;
      const x = (((c.x0 - scrollX * CLOUD_PARALLAX) % span) + span) % span;
      c.img.x = x - w;
    }
  }
}
