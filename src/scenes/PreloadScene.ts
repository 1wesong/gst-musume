import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, LOADING_MIN_TIME, SCENE_KEYS } from '../config';
import { BGM } from '../data/audio';
import { BG_LAYERS, CLOUD_IMAGE, CLOUD_KEY, MAIN_ASSETS, bgTextureKey } from '../data/background';
import { HORSES } from '../data/horses';
import { textureKey, type ImageKind } from '../objects/HorseView';
import { playBgm } from '../systems/bgm';
import { addSkewPanel, bodyStyle, numberStyle, skewPoints, titleStyle } from '../ui/phaserUi';
import { hex, theme } from '../ui/theme';

const BAR = { x: GAME_WIDTH / 2, y: 520, w: 760, h: 30 };

/**
 * 로딩 화면 (라이트 e스포츠 톤): 밝은 배경 + 로고 + 사선 진행률 바 + 퍼센트 숫자.
 * 에셋이 없거나 금방 끝나도 LOADING_MIN_TIME 동안은 보여 주고, 바는 실제 로드 진행률을 부드럽게 따라간다.
 */
export class PreloadScene extends Phaser.Scene {
  private target = 0; // 실제 로드 진행률 (0~1)
  private shown = 0; // 화면에 표시 중인 진행률
  private elapsed = 0;
  private done = false;
  private leaving = false;
  private fill!: Phaser.GameObjects.Graphics;
  private percent!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE_KEYS.Preload);
  }

  preload() {
    this.target = 0;
    this.shown = 0;
    this.elapsed = 0;
    this.done = false;
    this.leaving = false;
    this.createUi();

    this.load.on('progress', (v: number) => (this.target = v));
    // 경로가 비어 있으면 로드하지 않고, 로드 실패는 무시한다(임시 도형 대체).
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      console.warn('에셋 로드 실패, 임시 도형으로 대체:', file.src);
    });
    for (const horse of HORSES) {
      for (const kind of Object.keys(horse.images) as ImageKind[]) {
        const path = horse.images[kind];
        if (path) this.load.image(textureKey(horse, kind), path);
      }
    }
    // 경주 배경 레이어 (경로가 비어 있으면 임시 도형으로 대체)
    for (const layer of BG_LAYERS) if (layer.image) this.load.image(bgTextureKey(layer.id), layer.image);
    if (CLOUD_IMAGE) this.load.image(CLOUD_KEY, CLOUD_IMAGE);
    if (BGM.path) this.load.audio(BGM.key, BGM.path);
    for (const a of Object.values(MAIN_ASSETS)) if (a.image) this.load.image(a.key, a.image);
  }

  create() {
    this.target = 1;
    this.done = true;
    playBgm(this);
  }

  /** 밝은 하늘 배경, 레드 광선, 로고, 진행률 바. */
  private createUi() {
    const g = this.add.graphics();
    const bands = 14;
    for (let i = 0; i < bands; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(theme.colors.skyDeep),
        Phaser.Display.Color.ValueToColor(theme.colors.sky),
        bands - 1,
        i,
      );
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b)).fillRect(0, (GAME_HEIGHT / bands) * i, GAME_WIDTH, GAME_HEIGHT / bands + 1);
    }
    // 대각선 레드 광선
    const beams = this.add.graphics();
    for (const [x, w, a] of [[180, 150, 0.1], [620, 110, 0.06], [980, 190, 0.08]] as const) {
      beams.fillStyle(theme.colors.red, a).fillPoints(
        [new Phaser.Geom.Point(x, 0), new Phaser.Geom.Point(x + w, 0), new Phaser.Geom.Point(x + w - 340, GAME_HEIGHT), new Phaser.Geom.Point(x - 340, GAME_HEIGHT)],
        true,
      );
    }

    // 로고 (차콜 글자 + 흰 외곽선) + 레드 밑줄
    this.add
      .text(GAME_WIDTH / 2, 250, '감컴무스메', titleStyle(theme.fontSize.hero, 'lg', theme.colors.charcoal))
      .setOrigin(0.5)
      .setShadow(5, 6, hex(theme.colors.steelLight), 0, true, true);
    const underline = this.add.graphics({ x: GAME_WIDTH / 2, y: 340 });
    underline.fillStyle(theme.colors.red, 1).fillPoints(skewPoints(420, 10), true);

    this.add
      .text(GAME_WIDTH / 2, 462, 'LOADING', numberStyle(30, theme.colors.slate, 1))
      .setOrigin(0.5)
      .setAlpha(0.9);
    this.status = this.add.text(GAME_WIDTH / 2, 612, '말들이 출발선에 서는 중...', bodyStyle(theme.fontSize.md, theme.colors.slate)).setOrigin(0.5);

    // 진행률 바: 라이트 사선 프레임 + 레드 채움
    addSkewPanel(this, BAR.x, BAR.y, BAR.w, BAR.h + 14, { fill: theme.colors.mist, fillTop: theme.colors.haze });
    this.fill = this.add.graphics();
    this.percent = this.add.text(BAR.x + BAR.w / 2 + 70, BAR.y, '0%', numberStyle(48, theme.colors.charcoal)).setOrigin(0, 0.5);
    this.drawFill(0);
  }

  /** 바 안쪽 채움(사선). 끝부분에 밝은 하이라이트가 붙는다. */
  private drawFill(p: number) {
    const innerW = BAR.w - 12;
    const w = Math.max(0, innerW * p);
    this.fill.clear();
    if (w < 2) return;
    const h = BAR.h;
    const left = BAR.x - innerW / 2;
    // 사선 모양을 유지하려고 평행사변형 점을 직접 만든다 (왼쪽 끝은 프레임과 같은 각도)
    const pts = skewPoints(innerW, h);
    const off = pts[0].x - pts[3].x; // 위쪽이 오른쪽으로 밀린 정도
    const x0 = left - innerW / 2 + innerW / 2; // = left
    const poly = [
      new Phaser.Geom.Point(x0 + off, BAR.y - h / 2),
      new Phaser.Geom.Point(x0 + off + w, BAR.y - h / 2),
      new Phaser.Geom.Point(x0 + w, BAR.y + h / 2),
      new Phaser.Geom.Point(x0, BAR.y + h / 2),
    ];
    this.fill.fillStyle(theme.colors.red, 1).fillPoints(poly, true);
    this.fill.fillStyle(theme.colors.redLight, 1).fillPoints(
      [poly[0], poly[1], new Phaser.Geom.Point(poly[1].x - off / 2, BAR.y), new Phaser.Geom.Point(poly[0].x - off / 2, BAR.y)],
      true,
    );
    // 선두의 밝은 빛줄기
    this.fill.fillStyle(0xffffff, 0.8).fillPoints(
      [new Phaser.Geom.Point(poly[1].x - 6, poly[1].y), poly[1], poly[2], new Phaser.Geom.Point(poly[2].x - 6, poly[2].y)],
      true,
    );
  }

  update(_time: number, deltaMs: number) {
    const dt = deltaMs / 1000;
    this.elapsed += dt;
    // 표시 진행률은 실제 진행률을 따라가되, 최소 로딩 시간 안에서는 그 시간에 비례하는 속도로만 찬다 (너무 순식간에 지나가지 않게)
    const cap = Math.min(1, this.elapsed / LOADING_MIN_TIME);
    const goal = Math.min(this.target, cap);
    this.shown += (goal - this.shown) * Math.min(1, dt * 10);
    if (goal - this.shown < 0.002) this.shown = goal;
    this.drawFill(this.shown);
    this.percent.setText(`${Math.round(this.shown * 100)}%`);

    if (this.done && !this.leaving && this.shown >= 0.999) {
      this.leaving = true;
      this.status.setText('준비 완료!');
      this.time.delayedCall(250, () => this.scene.start(SCENE_KEYS.Main));
    }
  }
}
