import Phaser from 'phaser';
import {
  BASE_SPEED, BGM_SPURT_RATE, BOOST_FADE, BOOST_SHAKE, BOOST_ZOOM, CAMERA_EDGE_MARGIN, CAMERA_FINISH_REMAINING, CAMERA_FINISH_VIEW, CAMERA_LEAD_X, CAMERA_PACK_COUNT, CAMERA_SMOOTH_TIME, FINISH_X, FIREWORK_BURST_INTERVAL, FIREWORK_DURATION, GAME_HEIGHT, GAME_WIDTH, LANE_COUNT,
  LANE_FOOT_PAD, LANE_HEIGHTS, LANE_SCALES, LANE_TOPS, SCENE_KEYS, SLOWMO_ETA_DIFF, SLOWMO_FINISH_OFFSET, SLOWMO_REMAINING, SLOWMO_SCALE,
  SLOWMO_ZOOM, SLOWMO_ZOOM_TIME, SIGN_EVERY_METERS, START_X, TRACK_BOTTOM, TRACK_LENGTH, TRACK_MARK_INTERVAL, TRACK_METERS, TRACK_TOP, WORLD_WIDTH,
} from '../config';
import type { HorseData } from '../data/horses';
import { textureKey } from '../objects/HorseView';
import { DustFx } from '../objects/DustFx';
import { ParallaxBackground } from '../objects/ParallaxBackground';
import { Racer } from '../objects/Racer';
import { SpeedLines } from '../objects/SpeedLines';
import { resetBgmRate, setBgmRate } from '../systems/bgm';
import { PenaltySystem } from '../systems/PenaltySystem';
import { applyFieldEffects, isSpurt } from '../systems/speedModel';
import { mirrorLogical, TrackMap } from '../systems/trackMap';
import { SkillSystem } from '../systems/SkillSystem';
import { UltimateSystem } from '../systems/UltimateSystem';
import { addSkewPanel, bodyStyle, numberStyle } from '../ui/phaserUi';
import { ResultOverlay } from '../ui/ResultOverlay';
import { hex, theme } from '../ui/theme';
import { wipeThen, wipeTo } from '../ui/transition';

/** 줌 보정 대상이 되는 화면 고정 UI 객체 */
type HudObject = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform;

const FINISH_RANKS = 3; // 3등까지 골인하면 종료

export interface RaceSceneData {
  horses: HorseData[]; // 배열 인덱스 + 1 = 레인 번호
}

export class RaceScene extends Phaser.Scene {
  private racers: Racer[] = []; // 살아 있는 말들 (벌칙 "감컴나가"로 제외되면 여기서 빠진다)
  private allHorses: HorseData[] = []; // 다시하기용: 제외된 말 포함 원래 8마리
  private trackMap = new TrackMap(); // 논리 좌표 ↔ 월드 좌표 (벌칙으로 결승선 방향이 바뀌면 반전)
  private penalty!: PenaltySystem;
  private startLine!: Phaser.GameObjects.Graphics;
  private finishLine!: Phaser.GameObjects.Graphics;
  private signs: { label: Phaser.GameObjects.Text; x: number }[] = [];
  private elapsed = 0;
  private finished: Racer[] = [];
  private over = false;
  private spurtOn = false; // 라스트 스퍼트 구간 진입 여부
  private overlay: ResultOverlay | null = null;
  private skills!: SkillSystem;
  private ultimates!: UltimateSystem;
  private background!: ParallaxBackground;
  private dust!: DustFx;
  private speedLines!: SpeedLines;
  private boostLevel = 0; // 0~1: 부스트/필살기 연출 강도 (속도선 강화 + 줌인 + 흔들림)
  private shake = { x: 0, y: 0 };
  private meterText!: Phaser.GameObjects.Text;
  private lastMeters = -1;
  private slowmo: 'idle' | 'active' | 'done' = 'idle'; // 한 경주에 한 번만
  private hud: { obj: HudObject; sx: number; sy: number }[] = []; // 줌에 영향받지 않게 보정할 화면 고정 UI

  constructor() {
    super(SCENE_KEYS.Race);
  }

  create(data: RaceSceneData) {
    this.racers = [];
    this.allHorses = data.horses;
    this.trackMap = new TrackMap();
    this.signs = [];
    this.finished = [];
    this.elapsed = 0;
    this.over = false;
    this.slowmo = 'idle';
    this.hud = [];
    this.spurtOn = false;
    this.boostLevel = 0;
    this.shake = { x: 0, y: 0 };
    this.lastMeters = -1;
    this.time.timeScale = 1;
    this.tweens.timeScale = 1;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      resetBgmRate(this);
      this.penalty?.destroy();
      this.ultimates?.destroy();
      this.overlay?.destroy();
      this.overlay = null;
    });

    this.background = new ParallaxBackground(this);
    this.drawTrack();
    this.createDistanceSigns();
    this.dust = new DustFx(this);
    data.horses.forEach((horse, i) => {
      const laneY = LANE_TOPS[i] + LANE_HEIGHTS[i] - LANE_FOOT_PAD * LANE_SCALES[i]; // 원근에 따라 레인마다 높이가 다르다
      this.racers.push(new Racer(this, horse, i + 1, laneY, this.dust, this.trackMap));
    });

    this.skills = new SkillSystem(this, this.racers);
    this.penalty = new PenaltySystem({
      scene: this,
      racers: this.racers,
      trackMap: this.trackMap,
      applyWorldFlip: () => this.applyWorldFlip(),
      removeRacer: (r) => this.removeRacer(r),
    });
    // 필살기 판정은 벌칙 슬롯이 끝나고 레이스가 재개된 뒤에 한다
    this.ultimates = new UltimateSystem(this, this.racers, () => this.penalty.settled, () => this.isFinishScene());

    this.speedLines = new SpeedLines(this);
    this.createDistanceCounter();

    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, GAME_HEIGHT);
    this.cameras.main.scrollX = 0;
    this.cameras.main.scrollY = 0;
    this.cameras.main.setZoom(1);
  }

  update(_time: number, deltaMs: number) {
    const realDt = deltaMs / 1000;
    if (this.over) {
      this.updateCamera(realDt); // 줌이 남아 있으면 원래대로 복귀
      this.updateScenery(0, false);
      return;
    }
    const dt = realDt * (this.slowmo === 'active' ? SLOWMO_SCALE : 1);

    this.penalty.update(dt);
    if (this.penalty.frozen) {
      // 벌칙 슬롯 중: 이동/애니메이션/스킬 타이머는 모두 정지, 카메라만 벌칙 대상으로 이동
      this.updateCamera(realDt);
      this.updateScenery(0, true);
      return;
    }

    this.ultimates.update(dt);
    if (this.ultimates.frozen) {
      // 필살기 컷인 중: 이동/애니메이션/스킬 타이머는 모두 정지, 카메라만 대상으로 이동
      this.updateCamera(realDt);
      this.updateScenery(0, true);
      return;
    }
    this.elapsed += dt;

    this.updateSpurtPhase();
    this.updateRubberBand();
    this.skills.update(dt, this.slowmo !== 'active'); // 슬로모션 중에는 새 스킬이 발생하지 않는다
    for (const r of this.racers) {
      const prevX = r.update(dt);
      if (r.finishTime === null && r.x >= FINISH_X) {
        // 이전/현재 위치 보간으로 결승선을 넘은 정확한 시점 계산
        const t = (FINISH_X - prevX) / (r.x - prevX);
        r.finishTime = this.elapsed - dt + dt * t;
      }
    }

    // 이번 프레임에 골인한 말들을 정확한 시각 순으로 순위 부여
    const newly = this.racers
      .filter((r) => r.finishTime !== null && r.rank === null)
      .sort((a, b) => a.finishTime! - b.finishTime!);
    for (const r of newly) {
      r.rank = this.finished.length + 1;
      this.finished.push(r);
    }

    this.updateSlowmo();
    this.updateCamera(realDt);
    this.updateScenery(dt, false);
    if (this.finished.length >= FINISH_RANKS) this.endRace();
  }

  /** 선두가 결승 직전(남은 거리 CAMERA_FINISH_REMAINING 이내)이거나 이미 1등이 골인했는지. 결승선 방향이 바뀌어도 논리 좌표라 새 결승선 기준으로 동작한다. */
  private isFinishScene(): boolean {
    if (this.finished.length > 0) return true;
    const lead = this.racers.reduce((best, r) => (r.x > best.x ? r : best), this.racers[0]);
    return !!lead && (lead.x - START_X) / TRACK_LENGTH >= 1 - CAMERA_FINISH_REMAINING;
  }

  /**
   * 카메라 스크롤 목표. 우선순위: 1) 1등 골인 장면 2) 슬로모션(updateCamera에서 처리) 3) 필살기 사용 중인 말 4) 선두권 추적. 결승선 방향(오른쪽/왼쪽)에 따라 선두가 화면의 어느 쪽에 오도록 할지가 달라진다.
   * 벌칙 대상 > 필살기 대상 > 선두권(1~3위)의 중간 지점 순으로 따라간다.
   * 1위와 선두권 마지막 말이 화면 가장자리 안쪽(CAMERA_EDGE_MARGIN)에 들어오도록 제한해서 접전이 한 화면에 보이게 한다.
   */
  private getCameraScrollTarget(): number {
    const dir = this.trackMap.dir;
    // 1순위: 1등 골인 장면 — 결승선과 선두가 함께 화면에 들어오게 (필살기 대상보다 우선)
    if (this.isFinishScene()) {
      const fw = this.trackMap.finishWorld;
      return dir > 0 ? fw - GAME_WIDTH * CAMERA_FINISH_VIEW : fw - GAME_WIDTH * (1 - CAMERA_FINISH_VIEW);
    }
    const leadOff = dir > 0 ? CAMERA_LEAD_X : GAME_WIDTH - CAMERA_LEAD_X; // 선두가 화면 왼쪽(오른쪽 달리기)/오른쪽(왼쪽 달리기)에서 이만큼 떨어진 곳
    const focus = this.penalty.focusRacer ?? this.ultimates.cameraRacer;
    if (focus) return focus.worldX - leadOff;
    const ws = this.getStandings().slice(0, CAMERA_PACK_COUNT).map((r) => r.worldX);
    const mean = ws.reduce((a, b) => a + b, 0) / ws.length;
    const lead = ws[0];
    const trail = ws[ws.length - 1];
    if (dir > 0) {
      const lo = lead - (GAME_WIDTH - CAMERA_EDGE_MARGIN); // 1위가 오른쪽 가장자리를 넘지 않게
      const hi = trail - CAMERA_EDGE_MARGIN; // 선두권 마지막 말이 왼쪽 가장자리를 넘지 않게
      return lo <= hi ? Phaser.Math.Clamp(mean - leadOff, lo, hi) : lo; // 간격이 화면보다 크면 1위 우선
    }
    const lo = trail - (GAME_WIDTH - CAMERA_EDGE_MARGIN);
    const hi = lead - CAMERA_EDGE_MARGIN;
    return lo <= hi ? Phaser.Math.Clamp(mean - leadOff, lo, hi) : hi;
  }

  /** 순위: 골인한 말(골인 순) → 나머지는 x 큰 순. */
  private getStandings(): Racer[] {
    const rest = this.racers.filter((r) => r.rank === null).sort((a, b) => b.x - a.x);
    return [...this.finished, ...rest];
  }

  /** 부스트(속도 강화 스킬) 또는 필살기 중인지. */
  private isBoosting(r: Racer | undefined | null): boolean {
    return !!r && r.rank === null && (r.ultimateActive || r.activeSkill?.def.id === 'boost');
  }

  /** 카메라가 보고 있는 말(필살기 대상 또는 선두). */
  private getFocusRacer(): Racer {
    return this.ultimates.cameraRacer ?? this.racers.reduce((best, r) => (r.x > best.x ? r : best));
  }

  /** 부스트 연출 강도를 부드럽게 올리고 내린다. */
  private updateBoost(dt: number) {
    let target = 0;
    const idle = this.over || this.ultimates.frozen || this.penalty.frozen || this.slowmo === 'active';
    if (!idle) {
      if (this.isBoosting(this.getFocusRacer())) target = 1;
      else if (this.racers.some((r) => this.isBoosting(r))) target = 0.35; // 다른 말이 부스트 중이면 약하게
    }
    this.boostLevel += (target - this.boostLevel) * (1 - Math.exp(-BOOST_FADE * dt));
    if (this.boostLevel < 0.001) this.boostLevel = 0;
  }

  private updateCamera(dt: number) {
    const cam = this.cameras.main;
    this.updateBoost(dt);
    const slow = this.slowmo === 'active';
    // 슬로모션 카메라가 최우선: 결승선 쪽 줌인. 그 외에는 필살기 대상 또는 선두 추적
    const targetX = slow
      ? this.trackMap.finishWorld - this.trackMap.dir * SLOWMO_FINISH_OFFSET - GAME_WIDTH / 2
      : this.getCameraScrollTarget();
    const targetY = slow ? this.getContendersMidY() - GAME_HEIGHT / 2 : 0;
    const targetZoom = slow ? SLOWMO_ZOOM : 1 + BOOST_ZOOM * this.boostLevel;
    // 지수 보간: 대상이 바뀌어도 약 CAMERA_SMOOTH_TIME 안에 따라붙는다. 흔들림은 위치와 분리해서 누적되지 않게 한다
    const k = 1 - Math.exp(-dt / (CAMERA_SMOOTH_TIME / 3));
    const baseX = cam.scrollX - this.shake.x;
    const baseY = cam.scrollY - this.shake.y;
    this.shake.x = (Math.random() * 2 - 1) * BOOST_SHAKE * this.boostLevel;
    this.shake.y = (Math.random() * 2 - 1) * BOOST_SHAKE * 0.7 * this.boostLevel;
    cam.scrollX = baseX + (targetX - baseX) * k + this.shake.x;
    cam.scrollY = baseY + (targetY - baseY) * k + this.shake.y;
    cam.setZoom(cam.zoom + (targetZoom - cam.zoom) * (1 - Math.exp(-dt / (SLOWMO_ZOOM_TIME / 3))));
    this.applyHudZoom(cam.zoom);
  }

  /** 패럴랙스 배경(카메라 기준)과 먼지 속도를 갱신. dt는 게임 시간이라 슬로모션/정지 때 같이 느려진다. */
  private updateScenery(dt: number, frozen: boolean) {
    this.background.update(this.cameras.main.scrollX, dt);
    const slow = this.slowmo === 'active';
    this.speedLines.update(dt, this.getFocusRacer().speed / BASE_SPEED, this.boostLevel, !this.over && !slow, this.trackMap.dir);
    this.updateDistanceCounter();
    this.dust.setTimeScale(frozen ? 0 : this.slowmo === 'active' ? SLOWMO_SCALE : 1);
  }

  /** 라스트 스퍼트: 선두가 LAST_SPURT_AT에 닿으면 전체가 스퍼트 구간에 들어간다 (추격 보정 off, 속도/변동 증가). */
  private updateSpurtPhase() {
    if (this.spurtOn) return;
    const lead = this.racers.reduce((best, r) => (r.x > best.x ? r : best));
    if (!isSpurt((lead.x - START_X) / TRACK_LENGTH)) return;
    this.spurtOn = true;
    this.racers.forEach((r) => r.setSpurt(true));
    setBgmRate(this, BGM_SPURT_RATE); // BGM 재생 속도를 살짝 올려 긴박감을 준다
  }

  /** 추격 보정: 초중반엔 강하게(한 무리로 뭉침), 스퍼트에서는 꺼서 역전이 잦아지게 한다. */
  private updateRubberBand() {
    const running = this.racers.filter((r) => r.rank === null).sort((a, b) => b.x - a.x);
    // 추격 보정 + (간격이 기준을 넘을 때만) 격차 보정 + 슬립스트림 + 선두 표시
    applyFieldEffects(running, this.spurtOn);
    for (const r of this.racers) {
      if (r.rank !== null) {
        r.rubberMul = 1;
        r.gapMul = 1;
        r.slipMul = 1;
        r.leading = false;
      }
    }
  }

  /** 1등 다툼 중인 상위 2마리의 세로 중심. */
  private getContendersMidY(): number {
    const top = this.racers.filter((r) => r.rank === null).sort((a, b) => b.x - a.x).slice(0, 2);
    return top.reduce((sum, r) => sum + r.bodyY, 0) / Math.max(1, top.length);
  }

  /** 슬로모션 시작/종료 판정. 1등 다툼에만, 한 경주에 한 번. */
  private updateSlowmo() {
    if (this.slowmo === 'done') return;
    if (this.slowmo === 'active') {
      if (this.finished.length >= 1) this.endSlowmo(); // 1등 골인 순간 원래 속도로 복귀
      return;
    }
    if (this.finished.length > 0) return;
    const [lead, second] = this.racers.filter((r) => r.rank === null).sort((a, b) => b.x - a.x);
    if (!lead || !second || lead.speed <= 0 || second.speed <= 0) return;
    const remLead = FINISH_X - lead.x;
    if (remLead > TRACK_LENGTH * SLOWMO_REMAINING) return;
    const etaDiff = Math.abs((FINISH_X - second.x) / second.speed - remLead / lead.speed);
    if (etaDiff > SLOWMO_ETA_DIFF) return;
    this.slowmo = 'active';
    this.time.timeScale = SLOWMO_SCALE;
    this.tweens.timeScale = SLOWMO_SCALE;
  }

  private endSlowmo() {
    this.slowmo = 'done';
    this.time.timeScale = 1;
    this.tweens.timeScale = 1;
  }

  /** 화면 고정 UI를 줌 보정 대상으로 등록. (sx, sy)는 줌 1 기준 화면 좌표. */
  private registerHud(obj: HudObject) {
    this.hud.push({ obj, sx: obj.x, sy: obj.y });
  }

  /** 카메라 줌은 scrollFactor 0 객체에도 적용되므로, 화면 중심 기준으로 역보정해 UI 크기/위치를 유지한다. */
  private applyHudZoom(zoom: number) {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    for (const h of this.hud) h.obj.setScale(1 / zoom).setPosition(cx + (h.sx - cx) / zoom, cy + (h.sy - cy) / zoom);
  }

  private endRace() {
    this.over = true; // 나머지 말은 그 자리에서 정지
    this.playFireworks();
    this.time.delayedCall(FIREWORK_DURATION, () => this.showResult());
  }

  /** 레인 화면 위 폭죽 (화면 고정 좌표, 코드로 만든 파티클). */
  private playFireworks() {
    if (!this.textures.exists('spark')) {
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      g.fillStyle(0xffffff).fillCircle(4, 4, 4);
      g.generateTexture('spark', 8, 8);
      g.destroy();
    }
    const colors = [0xf3d27a, 0xd4a52a, 0xffffff, 0xf3d27a, 0xff4a3d]; // 골드 위주 + 화이트, 가끔 레드
    const burst = () => {
      const x = Phaser.Math.Between(150, GAME_WIDTH - 150);
      const y = Phaser.Math.Between(120, GAME_HEIGHT / 2);
      const emitter = this.add.particles(x, y, 'spark', {
        speed: { min: 120, max: 320 },
        angle: { min: 0, max: 360 },
        lifespan: 900,
        gravityY: 220,
        scale: { start: 1.2, end: 0 },
        tint: Phaser.Utils.Array.GetRandom(colors),
        emitting: false,
      });
      emitter.setScrollFactor(0).setDepth(90);
      emitter.explode(40);
      this.time.delayedCall(1200, () => emitter.destroy());
    };
    burst();
    this.time.addEvent({ delay: FIREWORK_BURST_INTERVAL, repeat: Math.floor(FIREWORK_DURATION / FIREWORK_BURST_INTERVAL) - 1, callback: burst });
  }

  private showResult() {
    const horses = this.allHorses; // 제외된 말까지 포함한 원래 8마리/레인
    this.overlay = new ResultOverlay(
      this.finished.slice(0, FINISH_RANKS).map((r) => ({
        rank: r.rank!,
        lane: r.lane,
        horse: r.horse,
        useImage: this.textures.exists(textureKey(r.horse, 'run')),
        useImage2: !!r.horse.images.run2 && this.textures.exists(textureKey(r.horse, 'run2')),
      })),
      {
        onReplay: () => void wipeThen(() => this.scene.restart({ horses })), // 같은 8마리, 같은 레인
        onMain: () => void wipeTo(this, SCENE_KEYS.Main),
      },
    );
  }

  /** 트랙 옆 거리 표지판: 100m마다 남은 거리를 보여 주며 빠르게 지나간다. */
  private createDistanceSigns() {
    for (let d = SIGN_EVERY_METERS; d < TRACK_METERS; d += SIGN_EVERY_METERS) {
      const x = START_X + (d / TRACK_METERS) * TRACK_LENGTH;
      const remain = TRACK_METERS - d;
      const post = this.add.rectangle(0, -20, 7, 40, theme.colors.steel);
      const board = this.add.rectangle(0, -56, 84, 36, theme.colors.white).setStrokeStyle(2, theme.colors.charcoal);
      const stripe = this.add.rectangle(0, -70, 84, 6, remain <= 200 ? theme.colors.red : theme.colors.gold);
      const label = this.add.text(0, -54, `${remain}m`, numberStyle(26, theme.colors.charcoal, 0)).setOrigin(0.5);
      this.add.container(x, TRACK_TOP + 8, [post, board, stripe, label]).setDepth(-4);
      this.signs.push({ label, x });
    }
  }

  /** 표지판의 남은 거리를 현재 결승선 방향 기준으로 다시 쓴다. */
  private refreshSigns() {
    for (const sg of this.signs) {
      const toFinish = this.trackMap.flipped ? sg.x - START_X : FINISH_X - sg.x;
      sg.label.setText(`${Math.round((toFinish / TRACK_LENGTH) * TRACK_METERS)}m`);
    }
  }

  /** 벌칙 "내가 만든 내 세상이야": 결승선이 출발선 위치로 옮겨지고 모든 말이 반대로 달린다. 논리 좌표를 거울상으로 바꿔 순위/남은 거리/슬로모션이 새 결승선 기준으로 동작한다. */
  private applyWorldFlip() {
    this.trackMap.flip();
    for (const r of this.racers) r.x = mirrorLogical(r.x);
    this.finishLine.x = START_X - 24; // 결승선 이미지는 출발선 쪽으로
    this.startLine.x = FINISH_X - 3; // 출발선 표시는 반대쪽 끝으로
    this.refreshSigns();
    this.lastMeters = -1;
  }

  /** 벌칙 "감컴나가": 말을 경주에서 완전히 제외한다 (이후 순위/결과/필살기 대상에서 빠진다). */
  private removeRacer(r: Racer) {
    const i = this.racers.indexOf(r);
    if (i >= 0) this.racers.splice(i, 1); // 스킬/필살기/벌칙 시스템이 같은 배열을 참조하므로 모두 반영된다
    r.destroy();
  }

  /** 화면 상단 중앙의 남은 거리 카운터 (TV 자막 스타일). */
  private createDistanceCounter() {
    const panel = addSkewPanel(this, 0, 0, 340, 54, { fill: theme.colors.fog, fillTop: theme.colors.white, alpha: 0.94, shadow: false, accent: theme.colors.red, stroke: theme.colors.charcoal });
    const label = this.add.text(-92, 0, '남은 거리', bodyStyle(20, theme.colors.charcoal)).setOrigin(0.5);
    this.meterText = this.add.text(66, 1, '', numberStyle(40, theme.colors.charcoal)).setOrigin(0.5);
    const box = this.add.container(GAME_WIDTH / 2, 34, [panel, label, this.meterText]).setScrollFactor(0).setDepth(60);
    this.registerHud(box);
    this.updateDistanceCounter();
  }

  private updateDistanceCounter() {
    const lead = this.racers.reduce((best, r) => (r.x > best.x ? r : best), this.racers[0]);
    const meters = Math.max(0, Math.ceil(((FINISH_X - lead.x) / TRACK_LENGTH) * TRACK_METERS));
    if (meters === this.lastMeters) return;
    this.lastMeters = meters;
    this.meterText.setText(`${meters}m`);
    this.meterText.setColor(hex(meters <= 100 ? theme.colors.red : theme.colors.charcoal)); // 마지막 100m는 레드
  }

  /** 흙 트랙: 레인마다 원근에 따른 높이로 그린다. 위쪽(먼) 레인은 좁고 아래쪽은 넓다. */
  private drawTrack() {
    const g = this.add.graphics().setDepth(-5);
    for (let i = 0; i < LANE_COUNT; i++) {
      const y = LANE_TOPS[i];
      const h = LANE_HEIGHTS[i];
      g.fillStyle(i % 2 === 0 ? theme.colors.trackA : theme.colors.trackB).fillRect(0, y, WORLD_WIDTH, h); // 낮 경기장 트랙(밝은 흙색)
      g.fillStyle(0xffffff, 0.7).fillRect(0, y, WORLD_WIDTH, 2); // 레인 구분선
    }
    g.fillStyle(0xffffff, 0.7).fillRect(0, TRACK_BOTTOM - 2, WORLD_WIDTH, 2);
    // 스크롤 체감용 바닥 표시 (트랙 타일 이미지가 들어가면 대체)
    g.fillStyle(0x000000, 0.06);
    for (let x = START_X, k = 0; x < FINISH_X; x += TRACK_MARK_INTERVAL, k++) {
      if (k % 2 === 1) g.fillRect(x, TRACK_TOP, TRACK_MARK_INTERVAL, TRACK_BOTTOM - TRACK_TOP); // 어두운 띠가 번갈아 지나가며 속도감을 준다
    }

    // 출발선과 체크무늬 결승선은 따로 만들어 둔다 (벌칙으로 결승선이 반대쪽으로 바뀌면 위치를 서로 바꾼다)
    this.startLine = this.add.graphics({ x: START_X - 3, y: 0 }).setDepth(-4.9);
    this.startLine.fillStyle(0xffffff).fillRect(0, TRACK_TOP, 6, TRACK_BOTTOM - TRACK_TOP);
    this.finishLine = this.add.graphics({ x: FINISH_X, y: 0 }).setDepth(-4.9);
    for (let i = 0; i < LANE_COUNT; i++) {
      const cellH = LANE_HEIGHTS[i] / 4; // 체크무늬 결승선: 레인별로 세로 4칸
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 2; col++) {
          this.finishLine.fillStyle((row + col) % 2 === 0 ? 0xffffff : 0x000000).fillRect(col * 12, LANE_TOPS[i] + row * cellH, 12, cellH);
        }
      }
    }
  }
}
