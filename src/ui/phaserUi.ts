import Phaser from 'phaser';
import { hex, luminance, strokeFor, theme, type ButtonVariant } from './theme';

/** Phaser용 공통 UI 컴포넌트. 색/폰트/크기는 theme.ts에서만 가져온다. 각진 사선 + 얇은 금속 테두리 + 밝은 면(화이트/라이트 그레이). 글자는 기본 차콜. */

const SKEW_TAN = Math.tan((-theme.skewDeg * Math.PI) / 180); // 오른쪽 위로 기우는 사선: 위쪽이 오른쪽으로 밀린다

type TitleSize = 'sm' | 'md' | 'lg';
const STROKE: Record<TitleSize, number> = { sm: theme.titleStroke.sm, md: theme.titleStroke.md, lg: theme.titleStroke.lg };

/**
 * 외곽선 두께: Black Han Sans는 획이 촘촘해서(잖, 뛰 같은 글자) 작은 글자에 굵은 외곽선을 주면 획 사이가 메워져 깨져 보인다.
 * 그래서 글자 크기에 비례해 줄인다 (약 26px당 1px, 최대 size별 상한).
 */
export function scaledStroke(fontSize: number, size: TitleSize = 'md'): number {
  return Math.max(1, Math.min(STROKE[size], Math.round(fontSize / 26)));
}

/** 제목 텍스트 스타일: Black Han Sans + 얇은 외곽선(밝은 글자는 어두운 외곽선, 어두운 글자는 흰 외곽선). */
export function titleStyle(fontSize: number, size: TitleSize = 'md', color: number = theme.colors.charcoal): Phaser.Types.GameObjects.Text.TextStyle {
  const stroke = scaledStroke(fontSize, size);
  const small = fontSize < theme.titleMinPx; // 작은 글자는 본문 폰트 굵게 (가독성)
  return {
    fontFamily: small ? theme.fonts.body : theme.fonts.title,
    ...(small ? { fontStyle: '900' } : {}),
    fontSize: `${fontSize}px`,
    color: hex(color),
    stroke: hex(strokeFor(color)),
    strokeThickness: stroke,
    // 외곽선이 잘리지 않도록 여백
    padding: { x: stroke + 4, y: stroke + 10 },
  };
}

/** 숫자 텍스트 스타일(순위, 남은 거리, 레인 번호 등): 굵고 각진 Oswald. */
export function numberStyle(fontSize: number, color: number = theme.colors.charcoal, strokeWidth: number = theme.titleStroke.sm): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: theme.fonts.number,
    fontSize: `${fontSize}px`,
    fontStyle: '700',
    color: hex(color),
    stroke: hex(strokeFor(color)),
    strokeThickness: strokeWidth,
    padding: { x: strokeWidth + 4, y: strokeWidth + 8 },
  };
}

/** 본문 텍스트 스타일: Noto Sans KR 굵게. */
export function bodyStyle(fontSize: number, color: number = theme.colors.charcoal, bold = true): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: theme.fonts.body, fontSize: `${fontSize}px`, color: hex(color), fontStyle: bold ? '900' : '400', padding: { x: 4, y: 6 } };
}

/** 제목 텍스트 생성: 얇은 외곽선 + 번지지 않는 날카로운 하드 섀도. */
export function addTitle(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  opts: { fontSize?: number; size?: TitleSize; color?: number } = {},
): Phaser.GameObjects.Text {
  const size = opts.size ?? 'md';
  return scene.add
    .text(x, y, text, titleStyle(opts.fontSize ?? theme.fontSize.xl, size, opts.color))
    .setOrigin(0.5)
    .setShadow(theme.titleShadowY, theme.titleShadowY + 1, hex(shadowFor(opts.color ?? theme.colors.charcoal)), 0, true, true);
}

/** 제목 하드 섀도 색: 밝은 글자는 블랙, 어두운 글자는 라이트 그레이(밝은 면에서 글자가 떠 보이게). */
export const shadowFor = (textColor: number): number => (luminance(textColor) > 0.6 ? theme.colors.ink : theme.colors.steelLight);

/** 평행사변형 점 목록 (x,y는 중심). 위쪽이 오른쪽으로 밀리는 사선. */
export function skewPoints(w: number, h: number): Phaser.Geom.Point[] {
  const off = h * SKEW_TAN;
  const l = -w / 2;
  const r = w / 2;
  const t = -h / 2;
  const b = h / 2;
  return [new Phaser.Geom.Point(l + off, t), new Phaser.Geom.Point(r + off, t), new Phaser.Geom.Point(r, b), new Phaser.Geom.Point(l, b)];
}

export interface SkewPanelOptions {
  fill?: number; // 단색 채움 (기본: 라이트 그레이)
  fillTop?: number; // 윗부분을 밝게 해서 은은한 그라데이션 느낌 (기본: 거의 흰색)
  alpha?: number;
  stroke?: number; // 테두리 색 (기본: 금속)
  strokeWidth?: number;
  shadow?: boolean; // 오른쪽 아래 하드 섀도
  accent?: number; // 지정하면 왼쪽 가장자리에 굵은 포인트 띠(레드 등)
}

/** 사선 패널 (Graphics). 중심 (x,y), 크기 w×h. 밝은 면 + 얇은 금속 테두리 + 하드 섀도. */
export function addSkewPanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, o: SkewPanelOptions = {}): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  const pts = skewPoints(w, h);
  const fill = o.fill ?? theme.colors.fog;
  const sw = o.strokeWidth ?? theme.borderWidth;
  const off = h * SKEW_TAN;
  if (o.shadow !== false) {
    g.fillStyle(theme.colors.ink, 0.25).fillPoints(pts.map((p) => new Phaser.Geom.Point(p.x + 7, p.y + 7)), true);
  }
  g.fillStyle(fill, o.alpha ?? 1).fillPoints(pts, true);
  const top = o.fillTop ?? theme.colors.snow;
  const half = [
    new Phaser.Geom.Point(-w / 2 + off, -h / 2),
    new Phaser.Geom.Point(w / 2 + off, -h / 2),
    new Phaser.Geom.Point(w / 2 + off / 2, 0),
    new Phaser.Geom.Point(-w / 2 + off / 2, 0),
  ];
  g.fillStyle(top, (o.alpha ?? 1) * 0.9).fillPoints(half, true);
  if (o.accent !== undefined) {
    // 왼쪽 가장자리의 굵은 사선 포인트 띠
    const bar = Math.max(8, h * 0.12);
    g.fillStyle(o.accent, 1).fillPoints(
      [
        new Phaser.Geom.Point(-w / 2 + off, -h / 2),
        new Phaser.Geom.Point(-w / 2 + off + bar, -h / 2),
        new Phaser.Geom.Point(-w / 2 + bar, h / 2),
        new Phaser.Geom.Point(-w / 2, h / 2),
      ],
      true,
    );
  }
  g.lineStyle(sw, o.stroke ?? theme.colors.steel, 1).strokePoints(pts, true, true);
  // 윗변 안쪽의 얇은 하이라이트 (금속 느낌)
  g.lineStyle(1, theme.colors.white, 0.8).lineBetween(-w / 2 + off + 3, -h / 2 + 3, w / 2 + off - 3, -h / 2 + 3);
  return g;
}

/** 사선 배너 리본 + 제목: 컨테이너 반환 (중심 기준). red=레드, gold=레드+골드 테두리(우승), dark=라이트 그레이. */
export function addBanner(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  opts: { variant?: 'gold' | 'red' | 'dark'; fontSize?: number; padX?: number } = {},
): Phaser.GameObjects.Container {
  const fontSize = opts.fontSize ?? theme.fontSize.lg;
  const variant = opts.variant ?? 'red';
  const label = scene.add
    .text(0, 0, text, titleStyle(fontSize, 'sm', variant === 'dark' ? theme.colors.charcoal : variant === 'gold' ? theme.colors.goldLight : theme.colors.white))
    .setOrigin(0.5)
    .setShadow(2, theme.titleShadowY, hex(variant === 'dark' ? theme.colors.steelLight : theme.colors.ink), 0, true, true);
  const w = label.width + (opts.padX ?? 80);
  const h = fontSize * 1.9;
  const panel = {
    red: { fill: theme.colors.red, fillTop: theme.colors.redLight, stroke: theme.colors.goldLight },
    gold: { fill: theme.colors.red, fillTop: theme.colors.redLight, stroke: theme.colors.gold }, // 레드 + 골드 (WINNER)
    dark: { fill: theme.colors.fog, fillTop: theme.colors.snow, stroke: theme.colors.steel },
  }[variant];
  const bg = addSkewPanel(scene, 0, 0, w, h, panel);
  return scene.add.container(x, y, [bg, label]);
}

/** TV 자막 바: [태그 | 본문]. 중심 기준 컨테이너. 태그는 레드, 본문은 라이트 패널(차콜 글자). */
export function addCaptionBar(scene: Phaser.Scene, x: number, y: number, tag: string, text: string, opts: { fontSize?: number } = {}): Phaser.GameObjects.Container {
  const fs = opts.fontSize ?? theme.fontSize.md;
  const tagText = scene.add.text(0, 0, tag, titleStyle(fs, 'sm', theme.colors.white)).setOrigin(0.5);
  const body = scene.add.text(0, 0, text, bodyStyle(fs, theme.colors.charcoal)).setOrigin(0, 0.5);
  const h = fs * 2;
  const tagW = tagText.width + 40;
  const bodyW = body.width + 50;
  const total = tagW + bodyW;
  // 왼쪽 끝을 기준으로 배치
  const left = -total / 2;
  const bar = addSkewPanel(scene, 0, 0, total, h, { fill: theme.colors.fog, fillTop: theme.colors.white, alpha: 0.96 });
  const tagBg = addSkewPanel(scene, left + tagW / 2, 0, tagW, h, { fill: theme.colors.red, fillTop: theme.colors.redLight, stroke: theme.colors.goldLight, shadow: false });
  tagText.setPosition(left + tagW / 2 + (h * SKEW_TAN) / 2, 0);
  body.setPosition(left + tagW + 20 + (h * SKEW_TAN) / 2, 0);
  return scene.add.container(x, y, [bar, tagBg, tagText, body]);
}

export interface UiButtonOptions {
  variant?: ButtonVariant;
  width?: number;
  height?: number;
  fontSize?: number;
  onClick?: () => void;
}

/**
 * 각진 사선 버튼: 호버 시 살짝 커지고, 누르면 눌리고, 표면을 날카로운 빛줄기가 가로지른다.
 * 원점은 버튼 중심.
 */
export class UiButton extends Phaser.GameObjects.Container {
  private face = this.scene.add.graphics();
  private shine = this.scene.add.graphics();
  private label: Phaser.GameObjects.Text;
  private colors: (typeof theme.buttons)[ButtonVariant];
  private bw: number;
  private bh: number;
  private pressed = false;
  private enabled = true;
  private shineTween: Phaser.Tweens.Tween | null = null;
  private shineTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, opts: UiButtonOptions = {}) {
    super(scene, x, y);
    this.colors = theme.buttons[opts.variant ?? 'red'];
    this.bh = opts.height ?? 72;
    const fontSize = opts.fontSize ?? theme.fontSize.lg;
    const lightText = this.colors.text === theme.colors.white;
    this.label = scene.add
      .text(0, 0, text, { ...titleStyle(fontSize, 'sm', this.colors.text), stroke: hex(this.colors.edge), strokeThickness: lightText && fontSize >= 36 ? 2 : 0, padding: { x: 6, y: 10 } })
      .setOrigin(0.5);
    this.bw = opts.width ?? Math.max(220, this.label.width + this.bh);
    this.add([this.face, this.shine, this.label]);
    this.drawFace(0);
    this.setSize(this.bw + this.bh * 0.27, this.bh + 8);
    this.setInteractive({ useHandCursor: true });
    scene.add.existing(this);

    this.on('pointerover', () => this.enabled && this.hover(true));
    this.on('pointerout', () => {
      this.pressed = false;
      this.hover(false);
      this.drawFace(0);
    });
    this.on('pointerdown', () => {
      if (!this.enabled) return;
      this.pressed = true;
      this.drawFace(4);
      this.scene.tweens.add({ targets: this, scale: 0.97, duration: theme.motion.fast / 2 });
    });
    this.on('pointerup', () => {
      if (!this.enabled) return;
      const was = this.pressed;
      this.pressed = false;
      this.drawFace(0);
      this.scene.tweens.add({ targets: this, scale: 1.04, duration: theme.motion.fast, ease: 'Quad.easeOut' });
      if (was) opts.onClick?.();
    });

    this.startShineLoop();
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.shineTimer?.remove();
      this.shineTween?.stop();
    });
  }

  setEnabled(enabled: boolean): this {
    this.enabled = enabled;
    this.setAlpha(enabled ? 1 : 0.55);
    this.input!.cursor = enabled ? 'pointer' : 'not-allowed';
    return this;
  }

  private hover(on: boolean) {
    this.scene.tweens.add({ targets: this, scale: on ? 1.04 : 1, duration: theme.motion.fast, ease: 'Quad.easeOut' });
    if (on) this.playShine(380);
  }

  /** 사선 본체. press: 눌렀을 때 아래로 내려가는 px */
  private drawFace(press: number) {
    const { bw: w, bh: h } = this;
    const c = this.colors;
    const off = (dx: number, dy: number, pts: Phaser.Geom.Point[]) => pts.map((p) => new Phaser.Geom.Point(p.x + dx, p.y + dy));
    const base = skewPoints(w, h);
    const g = this.face.clear();
    g.fillStyle(0x000000, 0.22).fillPoints(off(5, 9 - press, base), true); // 바닥 그림자
    g.fillStyle(c.edge, 1).fillPoints(off(0, 6 - press * 0.6, base), true); // 아래 엣지(두께)
    g.fillStyle(c.bottom, 1).fillPoints(off(0, press, base), true); // 면
    // 윗면 밝은 면 (은은한 그라데이션)
    const e = h * SKEW_TAN;
    g.fillStyle(c.top, 0.95).fillPoints(
      off(0, press, [
        new Phaser.Geom.Point(-w / 2 + e, -h / 2),
        new Phaser.Geom.Point(w / 2 + e, -h / 2),
        new Phaser.Geom.Point(w / 2 + e * 0.5, 0),
        new Phaser.Geom.Point(-w / 2 + e * 0.5, 0),
      ]),
      true,
    );
    // 얇은 금속 테두리
    g.lineStyle(2, theme.colors.steelLight, 0.55).strokePoints(off(0, press, base), true, true);
    this.label.setPosition(0, press);
    this.shine.y = press;
  }

  /** 빛이 지나가는 효과: 날카로운 사선 빛줄기가 버튼 면 안쪽을 가로지른다 */
  private playShine(duration = 600) {
    const { bw: w, bh: h } = this;
    const bandW = h * 0.3;
    const startX = -w / 2 + h * 0.15;
    const endX = w / 2 - bandW - h * 0.15;
    this.shineTween?.stop();
    this.shine.clear();
    this.shine.fillStyle(0xffffff, 0.5).fillPoints(skewPoints(bandW, h - 12), true);
    this.shine.setX(startX).setAlpha(0);
    this.shineTween = this.scene.tweens.add({
      targets: this.shine,
      x: endX,
      alpha: { from: 1, to: 0 },
      duration,
      ease: 'Sine.easeInOut',
    });
  }

  private startShineLoop() {
    this.shineTimer = this.scene.time.addEvent({ delay: theme.motion.shineEvery, loop: true, startAt: theme.motion.shineEvery - 600, callback: () => this.playShine() });
  }
}
