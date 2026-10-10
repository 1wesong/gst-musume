import type Phaser from 'phaser';
import { theme } from './theme';

const SKEW = `${theme.skewDeg}deg`;

/**
 * 사선 와이프 화면 전환. 노랑 → 핑크 → 하늘색 띠가 차례로 화면을 쓸고 지나간다.
 * 캔버스 위 HTML 오버레이이므로 Phaser 씬과 HTML 오버레이 화면 모두를 덮는다.
 */
export interface WipeOptions {
  /** false면 와이프 띠 위의 "감컴무스메" 로고를 숨긴다 (필살기 컷인 등) */
  logo?: boolean;
}

class Wipe {
  private root: HTMLDivElement;
  private bands: HTMLDivElement[];
  private busy = false;

  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'ui-wipe';
    this.bands = [1, 2, 3].map((n) => {
      const b = document.createElement('div');
      b.className = `ui-wipe__band ui-wipe__band--${n}`;
      this.root.append(b);
      return b;
    });
    const logo = document.createElement('div');
    logo.className = 'ui-wipe__logo';
    logo.textContent = '감컴무스메';
    this.bands[2].append(logo);
    document.body.append(this.root);
  }

  /** 화면을 덮는다 (왼쪽 → 오른쪽). */
  async cover(): Promise<void> {
    this.root.classList.add('active');
    const dur = theme.motion.wipe;
    await Promise.all(
      this.bands.map((b, i) =>
        b.animate(
          [{ transform: `translateX(-190vw) skewX(${SKEW})` }, { transform: `translateX(-35vw) skewX(${SKEW})` }],
          { duration: dur, delay: i * 90, easing: 'cubic-bezier(.7,0,.3,1)', fill: 'forwards' },
        ).finished,
      ),
    );
  }

  /** 덮은 화면을 걷어낸다 (오른쪽으로 빠져나감). */
  async reveal(): Promise<void> {
    const dur = theme.motion.wipe;
    await Promise.all(
      this.bands.map((b, i) =>
        b.animate(
          [{ transform: `translateX(-35vw) skewX(${SKEW})` }, { transform: `translateX(190vw) skewX(${SKEW})` }],
          { duration: dur, delay: (this.bands.length - 1 - i) * 90, easing: 'cubic-bezier(.7,0,.3,1)', fill: 'forwards' },
        ).finished,
      ),
    );
    this.root.classList.remove('active');
    for (const b of this.bands) b.getAnimations().forEach((a) => a.cancel());
  }

  get running() {
    return this.busy;
  }

  async run(change: () => void, opts: WipeOptions = {}): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.root.classList.toggle('no-logo', opts.logo === false);
    await this.cover();
    change();
    await new Promise((r) => setTimeout(r, 120)); // 새 씬이 첫 프레임을 그릴 시간
    await this.reveal();
    this.busy = false;
  }
}

let wipe: Wipe | null = null;
const getWipe = () => (wipe ??= new Wipe());

/** 사선 와이프로 화면을 덮은 뒤 change를 실행하고 걷어낸다. HTML 오버레이 화면 전환에도 쓸 수 있다. */
export function wipeThen(change: () => void, opts?: WipeOptions): Promise<void> {
  return getWipe().run(change, opts);
}

/** Phaser 씬 전환: 사선 와이프 후 scene.start. */
export function wipeTo(scene: Phaser.Scene, key: string, data?: object): Promise<void> {
  return wipeThen(() => scene.scene.start(key, data));
}
