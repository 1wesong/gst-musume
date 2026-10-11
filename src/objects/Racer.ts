import Phaser from 'phaser';
import {
  BASE_SPEED, BOB_FREQ, BOB_HEIGHT, HORSE_DISPLAY_SIZE, LANE_SCALES, SHADOW_ALPHA, SPEED_TARGET_SMOOTH, START_X, TRACK_LENGTH, ULTIMATE_AFTERIMAGE_EVERY, ULTIMATE_AURA_COLOR,
} from '../config';
import type { HorseData } from '../data/horses';
import type { SkillDef } from '../data/skills';
import { fatigueMultiplier, hiddenSpurtMultiplier, rollSpurtPlan, speedTargetInterval, speedVariation, spurtSpeedMul, stepFatigue, styleMultiplier, ultimateMultiplier } from '../systems/speedModel';
import type { TrackMap } from '../systems/trackMap';
import { applyBob } from './bob';
import type { DustFx } from './DustFx';
import { HorseView } from './HorseView';

/** 벌칙 연출 등에서 말의 표시만 잠깐 바꾸는 값 (로직 좌표와 무관). */
export interface PoseFx {
  dx: number; // 월드 x 오프셋
  dy: number;
  rot: number; // 추가 회전(도)
  scale: number;
  alpha: number;
}

/** 경주 중인 말 하나의 상태 + 표시. x는 논리 좌표(결승선 쪽으로 갈수록 커짐), 화면 위치는 worldX. */
export class Racer {
  x = START_X;
  speed = 0;
  finishTime: number | null = null;
  rank: number | null = null;

  // 일반 스킬이 조작하는 값 (resetSkillEffects로 초기화)
  activeSkill: { def: SkillDef; t: number } | null = null;
  skillSpeedMul = 1;
  poseAngle = 0; // 달리기 기울기에 더해지는 각도(넘어짐 등)
  flipX = false; // 좌우 반전(역주행)
  afterimageCount = 0;

  // 필살기 속도 강화 상태
  rubberMul = 1; // 추격 보정(RaceScene이 순위에 따라 갱신)
  gapMul = 1; // 극단적 격차 보정(선두-꼴찌 간격이 기준을 넘을 때만 1이 아니다)
  slipMul = 1; // 슬립스트림(바로 앞 말을 바짝 따라갈 때)
  leading = false; // 지금 1위인지 (선두 피로 계산용)
  private fatigue = 0; // 선두 피로(0~1)
  private spurtPlan = rollSpurtPlan(); // 숨겨진 라스트 스퍼트 시작 지점/강도
  heavyCooldown = 0; // 이 시간(초)이 지나기 전에는 넘어짐/역주행 같은 heavy 스킬이 다시 걸리지 않는다
  private spurt = false; // 라스트 스퍼트 구간인지
  ultimateMul = 1;
  ultimateTime = 0; // 남은 시간(초). 0 이하면 비활성
  private ultimatePeak = 1; // 필살기 최대 속도 배율
  private ultimateElapsed = 0; // 발동 후 경과 시간(초). 배율이 서서히 올라가는 데 쓴다
  private aura: Phaser.GameObjects.Ellipse | null = null;
  private ultimateAfterimageTimer = 0;

  /** 벌칙 연출용 표시 오버라이드. 기본값은 영향 없음. */
  fx: PoseFx = { dx: 0, dy: 0, rot: 0, scale: 1, alpha: 1 };
  private ring: Phaser.GameObjects.Ellipse | null = null; // 강조 표시 링

  private view: HorseView;
  private shadow: Phaser.GameObjects.Ellipse;
  private baseY: number;
  private laneScale: number; // 레인 원근에 따른 크기 배율
  private speedVar = 0; // 현재 속도 변동(목표를 향해 부드럽게 변함)
  private speedVarTarget = 0;
  private speedVarTimer = 0;
  private bobPhase = Math.random() * Math.PI * 2; // 말마다 시작 타이밍 랜덤

  constructor(
    private scene: Phaser.Scene,
    readonly horse: HorseData,
    readonly lane: number,
    laneY: number,
    private dust: DustFx,
    private trackMap: TrackMap,
  ) {
    this.baseY = laneY;
    this.laneScale = LANE_SCALES[lane - 1];
    // 발밑 그림자 (말보다 아래, 트랙보다 위)
    this.shadow = scene.add
      .ellipse(this.x, laneY - 2 * this.laneScale, this.size * 0.75, this.size * 0.16, 0x000000, SHADOW_ALPHA)
      .setDepth(-0.8);
    this.view = new HorseView(scene, this.x, laneY, horse, 'run');
    this.applyPose();
  }

  get y() {
    return this.baseY;
  }

  /** 화면(월드) x. 결승선 방향이 바뀌어도 올바른 위치를 준다. */
  get worldX() {
    return this.trackMap.toWorld(this.x);
  }

  /** 이 레인에서의 말 표시 크기(px). */
  get size() {
    return HORSE_DISPLAY_SIZE * this.laneScale;
  }

  /** 말 몸통 중심 y (바닥 기준). */
  get bodyY() {
    return this.baseY - this.size / 2;
  }

  get ultimateActive() {
    return this.ultimateTime > 0;
  }

  /** dt: 초 단위. 이동한 뒤 이동 전 x를 반환한다. */
  update(dt: number): number {
    const prevX = this.x;

    // 1~2초마다 목표 속도를 새로 뽑고, 현재 속도는 부드럽게 따라간다
    this.speedVarTimer -= dt;
    if (this.speedVarTimer <= 0) {
      const [lo, hi] = speedTargetInterval(this.spurt);
      this.speedVarTarget = (Math.random() * 2 - 1) * speedVariation(this.spurt);
      this.speedVarTimer = Phaser.Math.FloatBetween(lo, hi);
    }
    this.speedVar += (this.speedVarTarget - this.speedVar) * Math.min(1, SPEED_TARGET_SMOOTH * dt);

    if (this.ultimateActive) this.ultimateMul = ultimateMultiplier(this.ultimatePeak, this.ultimateElapsed);
    const progress = (this.x - START_X) / TRACK_LENGTH;
    this.fatigue = stepFatigue(this.fatigue, this.leading, dt);
    this.speed =
      BASE_SPEED * this.horse.baseSpeed * (1 + this.speedVar) * styleMultiplier(this.horse.style, progress) *
      this.rubberMul * this.gapMul * this.slipMul * fatigueMultiplier(this.fatigue) * hiddenSpurtMultiplier(this.spurtPlan, progress) * spurtSpeedMul(this.spurt) * this.skillSpeedMul * this.ultimateMul;
    this.x = Math.max(START_X, this.x + this.speed * dt);

    // 튀는 속도는 현재 속도에 비례. |sin| 한 주기가 한 번의 점프
    const prevPhase = this.bobPhase;
    this.bobPhase += dt * Math.PI * BOB_FREQ * (Math.abs(this.speed) / BASE_SPEED);
    // 착지(위상이 π의 배수를 지나는 순간)마다 흙먼지(달리는 반대쪽으로 날림). 쓰러진 동안은 제외
    if (Math.floor(this.bobPhase / Math.PI) !== Math.floor(prevPhase / Math.PI) && Math.abs(this.poseAngle) < 30) {
      const dir = this.trackMap.dir;
      this.dust.puff(this.worldX - dir * this.size * 0.2, this.baseY - 3 * this.laneScale, dir);
    }
    this.applyPose();
    this.updateUltimate(dt);
    return prevX;
  }

  private applyPose() {
    const wx = this.worldX;
    const fx = this.fx;
    const s = applyBob(this.view, this.bobPhase, wx + fx.dx, this.baseY + fx.dy, this.laneScale);
    this.view.angle += this.poseAngle + fx.rot;
    this.view.scaleX *= fx.scale;
    this.view.scaleY *= fx.scale;
    // 방향이 반대로 바뀌었거나(결승선 반대) 역주행 중이면 좌우 반전. 둘 다면 다시 정방향
    if (this.flipX !== this.trackMap.flipped) this.view.scaleX *= -1;
    this.view.setAlpha(fx.alpha);
    // 그림자는 바닥에 남고, 높이 뜰수록 작아진다
    this.shadow.setPosition(wx + fx.dx, this.baseY - 2 * this.laneScale + fx.dy).setScale(1 - s * 0.3).setAlpha(fx.alpha);
    if (this.ring) {
      const pulse = 1 + Math.sin(this.scene.time.now / 90) * 0.08;
      this.ring.setPosition(wx + fx.dx, this.bodyY + fx.dy).setScale(pulse * fx.scale);
    }
  }

  /** 벌칙 연출처럼 로직이 멈춘 동안 표시를 다시 그린다. */
  refreshPose() {
    this.applyPose();
    this.aura?.setPosition(this.worldX + this.fx.dx, this.bodyY + this.fx.dy);
  }

  /** 강조 링(벌칙 대상 표시). null이면 해제. */
  setHighlight(color: number | null) {
    if (color === null) {
      this.ring?.destroy();
      this.ring = null;
      return;
    }
    if (!this.ring) {
      this.ring = this.scene.add.ellipse(this.worldX, this.bodyY, this.size * 1.9, this.size * 1.5).setDepth(5);
    }
    this.ring.setStrokeStyle(6, color, 1).setFillStyle(color, 0.22);
    this.applyPose();
  }

  /** 경주에서 제외될 때 표시 객체를 정리한다. */
  destroy() {
    this.view.destroy();
    this.shadow.destroy();
    this.aura?.destroy();
    this.ring?.destroy();
    this.aura = null;
    this.ring = null;
  }

  /** 라스트 스퍼트 구간 진입/해제. 진입하면 바로 새 목표 속도를 뽑는다. */
  setSpurt(on: boolean) {
    if (this.spurt === on) return;
    this.spurt = on;
    this.speedVarTimer = 0;
  }

  startSkill(def: SkillDef) {
    this.activeSkill = { def, t: 0 };
  }

  resetSkillEffects() {
    this.activeSkill = null;
    this.skillSpeedMul = 1;
    this.poseAngle = 0;
    this.flipX = false;
    this.afterimageCount = 0;
  }

  startUltimate(mul: number, duration: number) {
    this.ultimatePeak = mul;
    this.ultimateElapsed = 0;
    this.ultimateMul = ultimateMultiplier(mul, 0);
    this.ultimateTime = duration;
    this.ultimateAfterimageTimer = 0;
    this.aura?.destroy();
    this.aura = this.scene.add
      .ellipse(this.worldX, this.bodyY, this.size * 2.1, this.size * 1.65, ULTIMATE_AURA_COLOR, 0.4)
      .setDepth(-0.5);
  }

  endUltimate() {
    this.ultimateMul = 1;
    this.ultimateTime = 0;
    this.aura?.destroy();
    this.aura = null;
  }

  private updateUltimate(dt: number) {
    if (!this.ultimateActive) return;
    this.ultimateTime -= dt;
    this.ultimateElapsed += dt;
    if (this.ultimateTime <= 0) {
      this.endUltimate();
      return;
    }
    // 오라: 말을 따라다니며 맥동
    const pulse = 1 + Math.sin(this.scene.time.now / 70) * 0.12;
    this.aura?.setPosition(this.worldX, this.bodyY - Math.abs(Math.sin(this.bobPhase)) * BOB_HEIGHT * this.laneScale).setScale(pulse);
    this.ultimateAfterimageTimer -= dt;
    if (this.ultimateAfterimageTimer <= 0) {
      this.ultimateAfterimageTimer = ULTIMATE_AFTERIMAGE_EVERY;
      this.spawnAfterimage();
    }
  }

  /** 현재 모습을 복제해 서서히 사라지는 잔상을 남긴다. */
  spawnAfterimage() {
    const ghost = new HorseView(this.scene, this.view.x, this.view.y, this.horse, 'run');
    ghost.setRunPhase(this.bobPhase);
    ghost.setAngle(this.view.angle).setScale(this.view.scaleX, this.view.scaleY).setAlpha(0.5).setDepth(-1);
    this.scene.tweens.add({ targets: ghost, alpha: 0, duration: 300, onComplete: () => ghost.destroy() });
  }
}
