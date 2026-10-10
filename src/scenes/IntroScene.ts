import Phaser from 'phaser';
import {
  GAME_HEIGHT, GAME_WIDTH, GO_BURST_TIME, HORSE_RACE_COUNT, INTRO_HORSE_TIME, INTRO_PORTRAIT_SCALE, INTRO_SLIDE_TIME, SCENE_KEYS,
} from '../config';
import type { HorseData } from '../data/horses';
import { HorseView } from '../objects/HorseView';
import { makeSparkle } from '../objects/proceduralTextures';
import { addCaptionBar, addSkewPanel, addTitle, bodyStyle, numberStyle, skewPoints, UiButton } from '../ui/phaserUi';
import { hex, theme } from '../ui/theme';

export interface IntroSceneData {
  horses: HorseData[]; // 배열 인덱스 + 1 = 레인 번호
}

const PANEL = { x: 400, y: 372, w: 780, h: 340 };
const CHAR = { x: 995, footY: 610 };

/**
 * 경주 시작 전 선수 소개 (TV 경마 중계 스타일).
 * 사선 패널이 왼쪽에서 슬라이드인 + 오른쪽에 캐릭터가 통통 튀며 등장.
 * 클릭하면 다음 말로, 건너뛰기 버튼은 전체 소개를 건너뛰고 "출발!"로 간다.
 */
export class IntroScene extends Phaser.Scene {
  private horses: HorseData[] = [];
  private current: Phaser.GameObjects.GameObject[] = [];
  private index = -1;
  private timer: Phaser.Time.TimerEvent | null = null;
  private going = false;
  private chrome: Phaser.GameObjects.GameObject[] = []; // 건너뛰기 버튼/안내 문구 (출발! 때 숨김)

  constructor() {
    super(SCENE_KEYS.Intro);
  }

  create(data: IntroSceneData) {
    this.horses = data.horses;
    this.current = [];
    this.index = -1;
    this.timer = null;
    this.going = false;
    this.chrome = [];

    this.drawBackground();

    // 전체 건너뛰기
    const skip = new UiButton(this, GAME_WIDTH - 130, 54, '건너뛰기 ▶▶', { variant: 'light', width: 210, height: 56, fontSize: theme.fontSize.md });
    skip.setDepth(60);
    const hint = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 18, '화면을 클릭하면 다음 선수로', bodyStyle(theme.fontSize.sm, theme.colors.charcoal))
      .setOrigin(0.5)
      .setAlpha(0.95)
      .setStroke(hex(theme.colors.white), 4)
      .setDepth(60);
    this.chrome.push(skip, hint);
    skip.on('pointerup', () => this.go());

    // 버튼 밖을 클릭하면 다음 말로 빠르게 넘어간다
    this.input.on('pointerdown', (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length === 0) this.next();
    });

    this.next();
  }

  /** 배경: 블랙→딥 네이비 그라데이션 + 옆으로 흘러가는 가는 속도선 (스피드감). */
  private drawBackground() {
    const g = this.add.graphics();
    const bands = 12;
    for (let i = 0; i < bands; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(theme.colors.white),
        Phaser.Display.Color.ValueToColor(theme.colors.mist),
        bands - 1,
        i,
      );
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b)).fillRect(0, (GAME_HEIGHT / bands) * i, GAME_WIDTH, GAME_HEIGHT / bands + 1);
    }
    for (let i = 0; i < 14; i++) {
      const w = Phaser.Math.Between(160, 420);
      const h = Phaser.Math.Between(6, 16);
      const line = this.add.graphics({ x: Phaser.Math.Between(-200, GAME_WIDTH), y: Phaser.Math.Between(20, GAME_HEIGHT - 20) });
      line.fillStyle(i % 4 === 0 ? theme.colors.red : theme.colors.steel, Phaser.Math.FloatBetween(0.06, 0.14)).fillPoints(skewPoints(w, h / 2), true);
      this.tweens.add({
        targets: line,
        x: GAME_WIDTH + 500,
        duration: Phaser.Math.Between(500, 1100),
        repeat: -1,
        onRepeat: () => {
          line.x = -500;
          line.y = Phaser.Math.Between(20, GAME_HEIGHT - 20);
        },
      });
    }
  }

  /** 다음 말로. 마지막이면 출발! */
  private next() {
    if (this.going) return;
    this.timer?.remove();
    this.index++;
    if (this.index >= Math.min(HORSE_RACE_COUNT, this.horses.length)) {
      this.go();
      return;
    }
    this.showHorse(this.index);
    this.timer = this.time.delayedCall(INTRO_HORSE_TIME, () => this.next());
  }

  private showHorse(i: number) {
    // 이전 말은 빠르게 사라진다
    const old = this.current;
    this.current = [];
    old.forEach((o) => o.destroy()); // 새 말의 패널/글자와 겹쳐 보이지 않도록 이전 말은 바로 지운다

    const horse = this.horses[i];
    const lc = theme.laneColors[i];
    const slide = INTRO_SLIDE_TIME;

    // ---- 왼쪽: 사선 패널 (고유 레인 색) ----
    const panel = this.add.container(0, 0).setDepth(20);
    // 어두운 사선 패널 + 왼쪽 굵은 레인 색 띠 (채도를 낮춘 레인 색)
    panel.add(addSkewPanel(this, PANEL.x, PANEL.y, PANEL.w, PANEL.h, { fill: theme.colors.fog, fillTop: theme.colors.white, stroke: theme.colors.steel, accent: lc.base }));
    // 패널 아래쪽 레드 포인트 줄 장식
    panel.add(this.add.graphics({ x: PANEL.x, y: PANEL.y + 118 }).fillStyle(theme.colors.red, 1).fillPoints(skewPoints(PANEL.w - 80, 8), true));

    const label = addTitle(this, 190, PANEL.y - 112, 'LANE', { fontSize: 38, size: 'sm', color: theme.colors.red });
    const number = this.add.text(196, PANEL.y + 6, String(i + 1), numberStyle(250, theme.colors.charcoal, 4)).setOrigin(0.5).setShadow(6, 7, hex(lc.base), 0, true, true);
    const name = addTitle(this, 505, PANEL.y + 2, horse.name, { fontSize: 96, size: 'md' });
    if (name.width > 400) name.setScale(400 / name.width);
    panel.add([label, number, name]);

    // 얇은 보조 패널(뒤쪽 그림자 패널)이 살짝 늦게 따라 들어온다
    const accent = this.add.container(0, 0).setDepth(19);
    accent.add(addSkewPanel(this, PANEL.x - 16, PANEL.y + 22, PANEL.w, PANEL.h, { fill: theme.colors.red, alpha: 0.9, shadow: false, stroke: theme.colors.redDeep }));

    // TV 자막 바: 선수 소개 N/8
    const caption = addCaptionBar(this, 330, 66, '선수 소개', `${i + 1} / ${HORSE_RACE_COUNT}  ·  ${i + 1}번 레인`).setDepth(40);

    for (const [obj, delay] of [[accent, 70], [panel, 0], [caption, 40]] as const) {
      const tx = obj.x;
      obj.x = tx - 1100;
      this.tweens.add({ targets: obj, x: tx, duration: slide, delay, ease: 'Back.easeOut', easeParams: [1.1] });
    }

    // ---- 오른쪽: 캐릭터가 통통 튀며 등장 ----
    const spot = this.add.container(CHAR.x, CHAR.footY - 210).setDepth(10);
    const ring = this.add.ellipse(0, 0, 520, 520, lc.base, 0.3).setStrokeStyle(4, theme.colors.steelLight, 0.8);
    const core = this.add.ellipse(0, 0, 400, 400, lc.light, 0.25);
    spot.add([ring, core]);
    spot.setScale(0);
    this.tweens.add({ targets: spot, scale: 1, duration: 360, delay: 120, ease: 'Back.easeOut' });

    const shadow = this.add.ellipse(CHAR.x, CHAR.footY + 4, 300, 44, 0x000000, 0.28).setDepth(11).setScale(0);
    const view = new HorseView(this, CHAR.x, CHAR.footY + 700, horse, 'stand', { showName: false }).setDepth(30).setScale(INTRO_PORTRAIT_SCALE);
    this.tweens.add({ targets: shadow, scale: 1, duration: 300, delay: 300 });
    this.tweens.add({
      targets: view,
      y: CHAR.footY,
      duration: 620,
      delay: 120,
      ease: 'Bounce.easeOut',
      onComplete: () => {
        if (!view.scene) return;
        // 착지 찌그러짐 후 제자리에서 통통
        this.tweens.add({
          targets: view,
          scaleX: INTRO_PORTRAIT_SCALE * 1.1,
          scaleY: INTRO_PORTRAIT_SCALE * 0.9,
          duration: 80,
          yoyo: true,
          onComplete: () => {
            if (!view.scene) return;
            this.tweens.add({ targets: view, y: CHAR.footY - 18, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.easeOut' });
          },
        });
      },
    });

    this.current = [accent, panel, caption, spot, shadow, view];
  }

  /** 소개를 끝내고 "출발!" 연출 후 경주 시작. */
  private go() {
    if (this.going) return;
    this.going = true;
    this.timer?.remove();
    this.input.removeAllListeners();
    this.chrome.forEach((o) => o.disableInteractive());
    this.tweens.add({ targets: this.chrome, alpha: 0, duration: 120 });
    const old = this.current;
    this.current = [];
    this.tweens.add({ targets: old, alpha: 0, duration: 120, onComplete: () => old.forEach((o) => o.destroy()) });

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const flash = this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0.85).setDepth(90);
    this.tweens.add({ targets: flash, alpha: 0, duration: 350 });
    this.cameras.main.shake(240, 0.008);

    const banner = addSkewPanel(this, 0, 0, 1180, 270, { fill: theme.colors.red, fillTop: theme.colors.redLight, stroke: theme.colors.goldLight, strokeWidth: 4 });
    const stripe = this.add.graphics().fillStyle(theme.colors.charcoal, 1).fillPoints(skewPoints(1180, 36), true);
    stripe.y = 108;
    const text = addTitle(this, 0, -6, '출발!', { fontSize: 210, size: 'lg', color: theme.colors.white });
    const group = this.add.container(cx, cy, [banner, stripe, text]).setDepth(80).setScale(0, 1);
    this.tweens.add({ targets: group, scaleX: 1, duration: 160, ease: 'Cubic.easeOut' });
    text.setScale(3.2);
    this.tweens.add({ targets: text, scale: 1, duration: 360, delay: 60, ease: 'Back.easeOut' });
    this.tweens.add({ targets: group, scale: 1.05, duration: 120, delay: 420, yoyo: true, repeat: 1 });

    // 반짝이 폭죽
    const key = makeSparkle(this);
    const burst = this.add
      .particles(cx, cy, key, {
        speed: { min: 260, max: 760 },
        angle: { min: 0, max: 360 },
        lifespan: 800,
        scale: { start: 1.4, end: 0 },
        tint: [theme.colors.goldLight, theme.colors.white, theme.colors.redLight, theme.colors.gold],
        emitting: false,
      })
      .setDepth(85);
    burst.explode(60);

    this.time.delayedCall(GO_BURST_TIME, () => this.scene.start(SCENE_KEYS.Race, { horses: this.horses }));
  }
}
