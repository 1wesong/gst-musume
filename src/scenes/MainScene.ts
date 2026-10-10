import Phaser from 'phaser';
import {
  BASE_SPEED, BOB_FREQ, GAME_HEIGHT, GAME_WIDTH, HORSE_DISPLAY_SIZE, LANE_PERSPECTIVE, MAIN_LANE_FILL, MAIN_RUNNER_COUNT, MAIN_RUNNER_SPEED, MAIN_SPARKLE_COUNT, SCENE_KEYS,
} from '../config';
import { MAIN_ASSETS } from '../data/background';
import { HORSES } from '../data/horses';
import { applyBob } from '../objects/bob';
import { HorseView } from '../objects/HorseView';
import { makeSparkle } from '../objects/proceduralTextures';
import { addSkewPanel, titleStyle, UiButton } from '../ui/phaserUi';
import { hex, theme } from '../ui/theme';
import { wipeTo } from '../ui/transition';

const GROUND_Y = 470; // 바닥(트랙) 시작선
const RUNNER_WRAP = 160; // 화면 밖으로 이만큼 나가면 반대편에서 다시 등장
const TITLE_Y = 170;

/** 메인 화면 (e스포츠 톤): 어두운 배경 + 레드 광선, 타이틀 + 사선 리본, 하단을 달리는 캐릭터, 각진 시작 버튼, 스파크 파티클. */
export class MainScene extends Phaser.Scene {
  private laneTops: number[] = []; // 하단 레인 윗변 y (원근: 아래 레인일수록 넓다)
  private laneHeights: number[] = [];
  private bands!: Phaser.GameObjects.Graphics; // 레인 바닥을 흘러가는 띠 (달리는 속도감)
  private runners: { view: HorseView; shadow: Phaser.GameObjects.Ellipse; baseY: number; scale: number; speed: number; phase: number }[] = [];

  constructor() {
    super(SCENE_KEYS.Main);
  }

  create() {
    this.runners = [];
    this.drawBackground();
    this.createSparkles();
    this.createTitle();
    this.createRunners();
    this.createStartButton();
  }

  /** 배경: 이미지가 있으면 이미지, 없으면 블랙→딥 네이비 그라데이션 + 레드/골드 광선 + 다크 트랙. */
  private drawBackground() {
    const key = MAIN_ASSETS.bg.key;
    if (MAIN_ASSETS.bg.image && this.textures.exists(key)) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, key).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
      return;
    }
    const g = this.add.graphics();
    const bands = 14;
    for (let i = 0; i < bands; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(theme.colors.skyDeep),
        Phaser.Display.Color.ValueToColor(theme.colors.sky),
        bands - 1,
        i,
      );
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b)).fillRect(0, (GROUND_Y / bands) * i, GAME_WIDTH, GROUND_Y / bands + 1);
    }

    // 대각선으로 내리꽂는 레드 광선 (중계 스튜디오 조명)
    const beams = this.add.graphics();
    const beamDefs: [number, number, number, number][] = [
      [140, 160, 0.1, theme.colors.red],
      [520, 110, 0.06, theme.colors.red],
      [860, 200, 0.08, theme.colors.red],
      [1130, 90, 0.1, theme.colors.gold],
    ];
    for (const [x, w, a, color] of beamDefs) {
      beams.fillStyle(color, a).fillPoints(
        [new Phaser.Geom.Point(x, 0), new Phaser.Geom.Point(x + w, 0), new Phaser.Geom.Point(x + w - 260, GROUND_Y), new Phaser.Geom.Point(x - 260, GROUND_Y)],
        true,
      );
    }

    // 타이틀 뒤에서 천천히 도는 가는 빛줄기 (골드/화이트)
    const rays = this.add.graphics({ x: GAME_WIDTH / 2, y: TITLE_Y });
    const n = 28;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = a0 + 0.018;
      rays.fillStyle(i % 3 === 0 ? theme.colors.goldLight : 0xffffff, i % 3 === 0 ? 0.3 : 0.35);
      rays.fillTriangle(0, 0, Math.cos(a0) * 1500, Math.sin(a0) * 1500, Math.cos(a1) * 1500, Math.sin(a1) * 1500);
    }
    this.tweens.add({ targets: rays, rotation: Math.PI * 2, duration: 200000, repeat: -1 });

    // 바닥: 경마장처럼 레인이 나뉜 다크 트랙. 위쪽 레인은 좁고 아래쪽 레인은 넓다 (경주 화면과 같은 원근)
    const laneN = MAIN_RUNNER_COUNT;
    const weights = Array.from({ length: laneN }, (_, i) => 1 + ((LANE_PERSPECTIVE - 1) * i) / (laneN - 1));
    const wsum = weights.reduce((x, y) => x + y, 0);
    const gh = GAME_HEIGHT - GROUND_Y;
    this.laneHeights = weights.map((w) => (gh * w) / wsum);
    this.laneTops = this.laneHeights.map((_, i) => GROUND_Y + this.laneHeights.slice(0, i).reduce((x, y) => x + y, 0));
    const ground = this.add.graphics();
    for (let i = 0; i < laneN; i++) {
      ground.fillStyle(i % 2 === 0 ? theme.colors.trackA : theme.colors.trackB).fillRect(0, this.laneTops[i], GAME_WIDTH, this.laneHeights[i] + 1);
      ground.fillStyle(0xffffff, 0.7).fillRect(0, this.laneTops[i], GAME_WIDTH, 2); // 레인 구분선
    }
    ground.fillStyle(0xffffff, 0.7).fillRect(0, GAME_HEIGHT - 2, GAME_WIDTH, 2);
    // 트랙 위를 흘러가는 어두운 띠 (러너가 달릴수록 바닥이 뒤로 흐르는 느낌)
    this.bands = this.add.graphics();
    this.bands.fillStyle(0x000000, 0.06);
    for (let x = 0; x < GAME_WIDTH + 400; x += 400) this.bands.fillRect(x, GROUND_Y, 200, gh);
    // 출발 게이트 선과 윗 울타리(금속 + 레드 라인)
    ground.fillStyle(0xffffff, 0.85).fillRect(90, GROUND_Y, 5, gh);
    ground.lineStyle(3, theme.colors.steel, 1).lineBetween(0, GROUND_Y, GAME_WIDTH, GROUND_Y);
    ground.lineStyle(4, theme.colors.red, 1).lineBetween(0, GROUND_Y - 5, GAME_WIDTH, GROUND_Y - 5);
  }

  /** 은은하게 떠오르는 스파크 파티클 (날카로운 불꽃 느낌: 레드/골드/화이트). */
  private createSparkles() {
    const key = makeSparkle(this);
    const lifespan = { min: 3500, max: 6000 };
    this.add
      .particles(0, 0, key, {
        emitZone: { type: 'random' as const, source: new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT) as unknown as Phaser.Types.GameObjects.Particles.RandomZoneSource },
        lifespan,
        frequency: (lifespan.min + lifespan.max) / 2 / MAIN_SPARKLE_COUNT,
        speedX: { min: -8, max: 8 },
        speedY: { min: -30, max: -8 },
        scale: { min: 0.25, max: 0.7 },
        rotate: { min: -25, max: 25 },
        tint: [theme.colors.goldLight, theme.colors.redLight, theme.colors.white, theme.colors.goldLight],
        // 수명 중간에 가장 밝게: 번쩍였다 사라진다
        alpha: { onEmit: () => 0, onUpdate: (_p: unknown, _k: string, t: number) => Math.sin(t * Math.PI) * 0.8 },
      })
      .setDepth(5);
  }

  /** 타이틀: 레드/블랙 사선 리본 + 글자별 튀는 등장 → 숨쉬듯 움직임. 로고 이미지가 있으면 이미지로 대체. */
  private createTitle() {
    const ribbonBack = this.add.container(GAME_WIDTH / 2, TITLE_Y + 8, [
      addSkewPanel(this, 0, 0, 1060, 150, { fill: theme.colors.red, fillTop: theme.colors.redLight, stroke: theme.colors.goldLight }),
    ]);
    ribbonBack.setAngle(-3).setDepth(10);
    const ribbonFront = this.add.container(GAME_WIDTH / 2, TITLE_Y, [
      addSkewPanel(this, 0, 0, 940, 176, { fill: theme.colors.fog, fillTop: theme.colors.white, stroke: theme.colors.steel, accent: theme.colors.red }),
    ]);
    ribbonFront.setAngle(1.5).setDepth(11);
    // 리본은 좌우에서 슬라이드 인
    ribbonBack.x = -700;
    ribbonFront.x = GAME_WIDTH + 700;
    this.tweens.add({ targets: ribbonBack, x: GAME_WIDTH / 2, duration: 600, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: ribbonFront, x: GAME_WIDTH / 2, duration: 600, delay: 120, ease: 'Cubic.easeOut' });

    const group = this.add.container(GAME_WIDTH / 2, TITLE_Y).setDepth(12);
    const logoKey = MAIN_ASSETS.logo.key;
    if (MAIN_ASSETS.logo.image && this.textures.exists(logoKey)) {
      const logo = this.add.image(0, 0, logoKey);
      logo.setScale(Math.min(1, 760 / logo.width, 220 / logo.height));
      group.add(logo);
      group.setScale(0);
      this.tweens.add({ targets: group, scale: 1, duration: 700, delay: 500, ease: 'Back.easeOut', onComplete: () => this.breathe(group) });
      return;
    }

    // 글자별로 위에서 떨어져 튕긴다 (차콜 글자 + 흰 외곽선)
    const chars = [...'감컴무스메'];
    const style = titleStyle(theme.fontSize.hero, 'lg', theme.colors.charcoal);
    const texts = chars.map((ch) => this.add.text(0, 0, ch, style).setOrigin(0.5).setShadow(5, 6, hex(theme.colors.steelLight), 0, true, true));
    const gap = -12; // 글자 박스에 외곽선 여백이 포함돼 있어 음수 간격으로 붙인다
    const total = texts.reduce((sum, t) => sum + t.width, 0) + gap * (texts.length - 1);
    let cx = -total / 2;
    texts.forEach((t, i) => {
      t.x = cx + t.width / 2;
      cx += t.width + gap;
      t.y = -520;
      group.add(t);
      this.tweens.add({
        targets: t,
        y: 0,
        duration: 650,
        delay: 450 + i * 110,
        ease: 'Bounce.easeOut',
        onComplete: () => {
          // 착지 찌그러짐
          this.tweens.add({ targets: t, scaleX: 1.1, scaleY: 0.9, duration: 90, yoyo: true, ease: 'Sine.easeOut' });
          if (i === texts.length - 1) this.breathe(group);
        },
      });
    });
  }

  /** 숨쉬듯 살짝 커졌다 작아짐. */
  private breathe(target: Phaser.GameObjects.Container) {
    this.tweens.add({ targets: target, scale: 1.03, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /**
   * 화면 하단 레인에서 달리는 캐릭터들. 레인마다 1마리가 자기 레인을 달리고, 경주 화면과 같은 통통 튀는 모션(applyBob)을 쓴다.
   * 레인이 아래일수록 크고 빠르게 달려 원근감을 준다. 이미지가 없으면 도형으로 대체(HorseView).
   */
  private createRunners() {
    const picks = Phaser.Utils.Array.Shuffle([...HORSES]).slice(0, MAIN_RUNNER_COUNT);
    const n = picks.length;
    picks.forEach((horse, i) => {
      const h = this.laneHeights[i];
      const baseY = this.laneTops[i] + h - 4; // 레인 바닥 근처에 발이 닿는다
      const near = i / Math.max(1, n - 1); // 0(먼 레인) ~ 1(가까운 레인)
      const scale = (h * MAIN_LANE_FILL) / HORSE_DISPLAY_SIZE;
      const x = Phaser.Math.Between(100, GAME_WIDTH - 100) + (i % 2) * 40;
      const shadow = this.add.ellipse(x, baseY - 2, 90 * scale, 16 * scale, 0x000000, 0.25).setDepth(i + 0.1);
      const view = new HorseView(this, x, baseY, horse, 'run').setDepth(i + 0.2); // 아래 레인이 위에 그려진다
      const speed = Phaser.Math.Between(MAIN_RUNNER_SPEED[0], MAIN_RUNNER_SPEED[1]) * (0.8 + near * 0.5);
      this.runners.push({ view, shadow, baseY, scale, speed, phase: Math.random() * Math.PI * 2 });
    });
  }

  private createStartButton() {
    const btn = new UiButton(this, GAME_WIDTH / 2, GAME_HEIGHT + 120, '시작하기', {
      variant: 'red', width: 400, height: 100, fontSize: 46, onClick: () => void wipeTo(this, SCENE_KEYS.Select),
    });
    btn.setDepth(30);
    this.tweens.add({ targets: btn, y: GAME_HEIGHT - 82, duration: 650, delay: 1500, ease: 'Back.easeOut' });
  }

  update(_time: number, deltaMs: number) {
    const dt = deltaMs / 1000;
    // 바닥 띠가 왼쪽으로 흘러간다
    this.bands.x = -((this.time.now / 1000) * 150) % 400;
    for (const r of this.runners) {
      let x = r.view.x + r.speed * dt;
      if (x > GAME_WIDTH + RUNNER_WRAP) x = -RUNNER_WRAP;
      // 튀는 속도는 달리는 속도에 비례
      r.phase += dt * Math.PI * BOB_FREQ * (r.speed / BASE_SPEED);
      const s = applyBob(r.view, r.phase, x, r.baseY, r.scale);
      r.shadow.setPosition(x, r.baseY - 2).setScale(1 - s * 0.3);
    }
  }
}
