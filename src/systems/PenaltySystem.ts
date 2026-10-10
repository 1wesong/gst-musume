import Phaser from 'phaser';
import {
  GAME_HEIGHT, GAME_WIDTH, PENALTY_AT, PENALTY_PICK_RESULT_TIME, PENALTY_PICK_SPIN_TIME, PENALTY_RESULT_TIME, PENALTY_SPIN_TIME, START_X,
  TRACK_LENGTH,
} from '../config';
import { PENALTIES, type PenaltyDef } from '../data/penalties';
import { textureKey } from '../objects/HorseView';
import { makeSparkle } from '../objects/proceduralTextures';
import type { Racer } from '../objects/Racer';
import { addSkewPanel, numberStyle, titleStyle } from '../ui/phaserUi';
import { SlotReel } from '../ui/SlotReel';
import { hex, theme } from '../ui/theme';
import { excludeCandidates, pickSwapPair, rollPenaltyEnabled, rollPenaltyIndex } from './penaltyPlan';
import type { TrackMap } from './trackMap';

/** PenaltySystem이 경주 씬에 요청하는 동작. */
export interface PenaltyHost {
  scene: Phaser.Scene;
  racers: Racer[]; // 살아 있는 말들 (제외되면 이 배열에서 빠진다)
  trackMap: TrackMap;
  applyWorldFlip(): void; // 결승선을 반대쪽으로 + 모든 말의 논리 좌표를 거울상으로 + 결승선/표지판 표시 갱신
  removeRacer(r: Racer): void; // 경주에서 제외
}

type State = 'waiting' | 'spin' | 'result' | 'exec' | 'pickSpin' | 'pickResult' | 'done' | 'skipped';

const CX = GAME_WIDTH / 2;
const SLOT_Y = 392;
const SPIN_TURNS = 4; // 멈추기 전에 항목 목록이 몇 바퀴 도는지

const easeOutQuart = (x: number) => 1 - Math.pow(1 - x, 4);
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * 벌칙 슬롯: 선두가 PENALTY_AT에 닿으면 발동 → 모든 것이 정지 → 화면 중앙 슬롯 창에서 벌칙 3개가 세로로 빠르게 돌다가
 * 점점 느려지며 하나에 멈춤 → 멈춘 이름을 강조한 뒤 실행 → 슬롯이 사라지고 레이스 재개.
 * 감컴나가는 대상 슬롯(상위 50% 말의 얼굴과 이름)을 한 번 더 돌려 1마리를 고르고, 멈추는 즉시 트랙에서 탈락시킨다.
 * 한 경주에 한 번만, 경주 시작 시 발동 여부를 정한다. 화면 전환 애니메이션 없이 경주 화면 위에 바로 표시되며,
 * 정지 중에는 트윈 대신 update(dt)로 시간을 직접 계산한다.
 */
export class PenaltySystem {
  private state: State;
  private t = 0;
  private def: PenaltyDef | null = null;
  private idx = 0; // 선택된 벌칙(PENALTIES 인덱스)

  // 슬롯 연출
  private objs: Phaser.GameObjects.GameObject[] = [];
  private reel: SlotReel | null = null;
  private titleText: Phaser.GameObjects.Text | null = null; // 슬롯 제목은 한 화면에 하나만 (슬롯이 바뀔 때 이전 제목을 지운다)
  private reelStart = 0;
  private reelEnd = 0;
  private selected = 0;

  // 실행 연출 상태
  private target: Racer | null = null;
  private pair: { first: Racer; last: Racer } | null = null;
  private flipped = false;
  private swapped = false;
  private pendingResume = false;

  constructor(private host: PenaltyHost) {
    this.state = rollPenaltyEnabled() ? 'waiting' : 'skipped';
  }

  /** 슬롯이 진행 중이라 경주 전체를 정지해야 하는지. */
  get frozen() {
    return this.state !== 'waiting' && this.state !== 'done' && this.state !== 'skipped';
  }

  /** 슬롯이 끝났거나 아예 발동하지 않는 경주인지. 필살기 판정은 이때부터 한다. */
  get settled() {
    return this.state === 'done' || this.state === 'skipped';
  }

  /** 벌칙 실행 중 카메라가 따라갈 말 (열심히 하시잖아의 1등). 그 외에는 null. */
  get focusRacer(): Racer | null {
    return this.state === 'exec' ? (this.pair?.first ?? null) : null;
  }

  update(dt: number) {
    switch (this.state) {
      case 'waiting': {
        const running = this.host.racers.filter((r) => r.rank === null);
        const lead = running.reduce<Racer | null>((best, r) => (!best || r.x > best.x ? r : best), null);
        if (lead && (lead.x - START_X) / TRACK_LENGTH >= PENALTY_AT) this.begin();
        break;
      }
      case 'spin': {
        this.t += dt;
        const p = clamp01(this.t / PENALTY_SPIN_TIME);
        this.reel?.setProgress(this.reelStart + (this.reelEnd - this.reelStart) * easeOutQuart(p));
        if (p >= 1) {
          this.state = 'result';
          this.t = 0;
        }
        break;
      }
      case 'result': {
        this.t += dt;
        this.reel?.celebrate(this.t, this.selected); // 멈춘 벌칙 이름 강조
        if (this.t >= PENALTY_RESULT_TIME) this.afterResult();
        break;
      }
      case 'pickSpin': {
        this.t += dt;
        const p = clamp01(this.t / PENALTY_PICK_SPIN_TIME);
        this.reel?.setProgress(this.reelStart + (this.reelEnd - this.reelStart) * easeOutQuart(p));
        if (p >= 1) {
          // 멈추는 즉시 별도 애니메이션 없이 트랙에서 사라지며 탈락 (이후 순위/결과에서 모두 빠진다)
          if (this.target) {
            this.host.removeRacer(this.target);
            this.target = null;
          }
          this.state = 'pickResult';
          this.t = 0;
        }
        break;
      }
      case 'pickResult': {
        this.t += dt;
        this.reel?.celebrate(this.t, this.selected);
        if (this.t >= PENALTY_PICK_RESULT_TIME) this.finish();
        break;
      }
      case 'exec': {
        this.t += dt;
        this.runExec();
        if (this.t >= this.def!.execTime) this.finish();
        break;
      }
    }
  }

  // ---------------- 슬롯 ----------------
  /** 항목 하나(텍스트)를 만든다. 창 폭에 맞게 줄인다. */
  private textItem(text: string): Phaser.GameObjects.Container {
    const s = this.host.scene;
    const t = s.add.text(0, 0, text, titleStyle(70, 'md', theme.colors.charcoal)).setOrigin(0.5);
    t.setShadow(4, 5, hex(theme.colors.steelLight), 0, true, true);
    if (t.width > 800) t.setScale(800 / t.width);
    return s.add.container(0, 0, [t]);
  }

  /** 대상 슬롯 항목: [얼굴 | 이름 | 순위]. 이미지가 없으면 말 색상 원. */
  private racerItem(racer: Racer, rank: number): Phaser.GameObjects.Container {
    const s = this.host.scene;
    const R = 66;
    const face = s.add.container(0, 0);
    face.add(s.add.circle(0, 0, R + 6, theme.colors.charcoal));
    face.add(s.add.circle(0, 0, R + 1, theme.colors.gold));
    face.add(s.add.circle(0, 0, R - 3, theme.colors.mist));
    const key = textureKey(racer.horse, 'stand');
    if (racer.horse.images.stand && s.textures.exists(key)) {
      const img = s.add.image(0, 0, key);
      const crop = Math.min(img.width, img.height) * 0.62; // 얼굴이 있는 윗부분
      img.setCrop((img.width - crop) / 2, img.height * 0.04, crop, crop);
      const k = (R * 2) / crop;
      img.setScale(k);
      img.y = -(img.height * 0.04 + crop / 2 - img.height / 2) * k;
      face.add(img);
    } else {
      face.add(s.add.circle(0, 0, R - 8, racer.horse.color));
    }
    const name = s.add.text(0, 0, racer.horse.name, titleStyle(66, 'md', theme.colors.charcoal)).setOrigin(0, 0.5);
    name.setShadow(4, 5, hex(theme.colors.steelLight), 0, true, true);
    const rankText = s.add.text(0, 0, `${rank}위`, numberStyle(40, theme.colors.red)).setOrigin(0, 0.5);
    const gap = 30;
    const total = R * 2 + gap + name.width + gap + rankText.width;
    let x = -total / 2;
    face.x = x + R;
    x += R * 2 + gap;
    name.x = x;
    x += name.width + gap;
    rankText.x = x;
    const c = s.add.container(0, 0, [face, name, rankText]);
    if (total > 800) c.setScale(800 / total);
    return c;
  }

  /** 슬롯 창과 제목을 만든다. 항목 목록과 멈출 항목을 받아 회전을 시작한다. */
  private makeReel(items: Phaser.GameObjects.Container[], stopAt: number, title: string) {
    const s = this.host.scene;
    const fix = <T extends Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.ScrollFactor>(o: T, depth: number): T => {
      o.setScrollFactor(0);
      (o as unknown as Phaser.GameObjects.Components.Depth).setDepth(depth);
      this.objs.push(o);
      return o;
    };
    if (!this.objs.length) fix(s.add.rectangle(CX, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, theme.colors.charcoal, 1).setAlpha(0.12), 90); // 약한 배경 어둡게
    // 이전 슬롯의 제목이 남아 새 제목과 겹쳐 보이지 않도록 먼저 제거한다
    if (this.titleText) {
      this.objs = this.objs.filter((o) => o !== this.titleText);
      this.titleText.destroy();
    }
    this.titleText = fix(s.add.text(CX, SLOT_Y - 172, title, titleStyle(60, 'md', theme.colors.red)).setOrigin(0.5), 94);

    this.reel?.destroy();
    this.reel = new SlotReel(s, items, SLOT_Y);
    const n = items.length;
    this.selected = stopAt;
    // 시작 위치는 랜덤, 끝 위치는 선택된 항목이 가운데에 오도록 (n으로 나눈 나머지가 stopAt)
    this.reelStart = Phaser.Math.Between(0, n - 1);
    this.reelEnd = this.reelStart + SPIN_TURNS * n + ((((stopAt - this.reelStart) % n) + n) % n);
    this.reel.setProgress(this.reelStart);
  }

  private clearVisuals() {
    this.reel?.destroy();
    this.reel = null;
    this.titleText = null; // objs와 함께 파괴된다
    for (const o of this.objs) o.destroy();
    this.objs = [];
  }

  private begin() {
    this.idx = rollPenaltyIndex();
    this.def = PENALTIES[this.idx];
    this.host.scene.tweens.pauseAll(); // 진행 중인 잔상/문구 트윈도 정지
    this.pendingResume = true;
    this.state = 'spin';
    this.t = 0;
    this.makeReel(PENALTIES.map((p) => this.textItem(p.name)), this.idx, '벌칙 슬롯!');
  }

  /** 멈춘 벌칙 이름을 강조한 뒤: 감컴나가면 대상 슬롯, 나머지는 바로 실행. */
  private afterResult() {
    const running = this.host.racers.filter((r) => r.rank === null);
    switch (this.def!.id) {
      case 'exclude': {
        const pool = excludeCandidates(running);
        if (pool.length === 0) return this.finish();
        const pick = Phaser.Math.Between(0, pool.length - 1);
        this.target = pool[pick];
        this.state = 'pickSpin';
        this.t = 0;
        this.makeReel(pool.map((r, i) => this.racerItem(r, i + 1)), pick, '탈락 대상 추첨!');
        break;
      }
      case 'world':
      case 'swap': {
        this.state = 'exec';
        this.t = 0;
        this.clearVisuals();
        this.showTopBanner(this.def!.name);
        if (this.def!.id === 'world') running.forEach((r) => r.setHighlight(theme.colors.steelLight));
        else {
          this.pair = pickSwapPair(running);
          this.pair?.first.setHighlight(theme.colors.goldLight);
          this.pair?.last.setHighlight(theme.colors.redLight);
        }
        this.runExec();
        break;
      }
    }
  }

  /** 실행 중 상단에 작게 남는 벌칙 이름. */
  private showTopBanner(name: string) {
    const s = this.host.scene;
    const panel = addSkewPanel(s, 0, 0, 1040, 190, { fill: theme.colors.fog, fillTop: theme.colors.white, stroke: theme.colors.gold, strokeWidth: 4, accent: theme.colors.red });
    const text = s.add.text(0, -6, name, titleStyle(86, 'lg', theme.colors.charcoal)).setOrigin(0.5);
    text.setShadow(5, 6, hex(theme.colors.steelLight), 0, true, true);
    if (text.width > 940) text.setScale(940 / text.width);
    const banner = s.add.container(CX, 118, [panel, text]).setScrollFactor(0).setDepth(100).setScale(0.5);
    this.objs.push(banner);
  }

  // ---------------- 벌칙 실행 (내 세상 / 열심히 하시잖아) ----------------
  private runExec() {
    const T = this.def!.execTime;
    const t = this.t;
    switch (this.def!.id) {
      case 'world': {
        // 앞부분은 모든 말을 강조, 중간에 결승선이 반대쪽으로 바뀐다 (말들은 제자리에서 방향만 돈다)
        if (!this.flipped && t >= T * 0.35) {
          this.flipped = true;
          this.host.applyWorldFlip();
        }
        const pop = this.flipped ? Math.sin(clamp01((t - T * 0.35) / (T * 0.3)) * Math.PI) * 0.18 : 0;
        for (const r of this.host.racers) {
          r.fx.scale = 1 + pop;
          r.refreshPose();
        }
        if (t >= T * 0.75) this.host.racers.forEach((r) => r.setHighlight(null));
        break;
      }
      case 'swap': {
        const pr = this.pair;
        if (!pr) return;
        // 강조 → 작아지며 사라짐 → 자리 교환 → 다시 커지며 나타남
        const shrinkStart = T * 0.4;
        const swapAt = T * 0.55;
        const growEnd = T * 0.8;
        let scale = 1;
        let alpha = 1;
        if (t >= shrinkStart && t < swapAt) {
          const p = (t - shrinkStart) / (swapAt - shrinkStart);
          scale = 1 - p;
          alpha = 1 - p;
        } else if (t >= swapAt) {
          if (!this.swapped) {
            this.swapped = true;
            const a = pr.first.worldX;
            const b = pr.last.worldX;
            const x1 = pr.first.x;
            pr.first.x = pr.last.x;
            pr.last.x = x1; // 레인은 그대로, x만 교환
            this.burst(a, pr.first.y - pr.first.size / 2);
            this.burst(b, pr.last.y - pr.last.size / 2);
          }
          const p = clamp01((t - swapAt) / (growEnd - swapAt));
          scale = p < 1 ? easeOut(p) * 1.15 : 1;
          alpha = p;
        }
        for (const r of [pr.first, pr.last]) {
          r.fx.scale = Math.max(0.01, scale);
          r.fx.alpha = alpha;
          r.refreshPose();
        }
        break;
      }
    }
  }

  /** 순간이동 반짝임. */
  private burst(x: number, y: number) {
    const s = this.host.scene;
    const em = s.add
      .particles(x, y, makeSparkle(s), {
        speed: { min: 120, max: 380 },
        angle: { min: 0, max: 360 },
        lifespan: 600,
        scale: { start: 1.1, end: 0 },
        tint: [theme.colors.goldLight, theme.colors.white, theme.colors.redLight, theme.colors.gold],
        emitting: false,
      })
      .setDepth(105);
    em.explode(22);
    s.time.delayedCall(900, () => em.destroy());
  }

  private finish() {
    // 연출용 표시를 원래대로
    for (const r of this.host.racers) {
      r.setHighlight(null);
      r.fx = { dx: 0, dy: 0, rot: 0, scale: 1, alpha: 1 };
    }
    if (this.pair) {
      for (const r of [this.pair.first, this.pair.last]) {
        r.fx = { dx: 0, dy: 0, rot: 0, scale: 1, alpha: 1 };
        r.refreshPose();
      }
    }
    this.clearVisuals();
    this.target = null;
    this.pair = null;
    this.state = 'done';
    if (this.pendingResume) {
      this.host.scene.tweens.resumeAll();
      this.pendingResume = false;
    }
  }

  /** 씬 종료 시 정리. */
  destroy() {
    if (this.pendingResume) this.host.scene.tweens.resumeAll();
    this.clearVisuals();
  }
}
