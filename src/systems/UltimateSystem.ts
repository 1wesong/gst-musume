import Phaser from 'phaser';
import { CUTIN_DURATION, FINISH_X, START_X, ULTIMATE_DURATION } from '../config';
import type { Racer } from '../objects/Racer';
import { pickUltimateTargets, rollUltimateCount, rollUltimateTrigger } from './ultimatePlan';
import { CutinFx } from '../ui/CutinFx';

interface Cutin {
  racer: Racer;
  t: number;
  fx: CutinFx;
}

/**
 * 필살기: 경주 시작 시 이번 경주의 발동 마리 수(0~2)와 판정 지점(선두 진행률 60~72%)을 정해 두고,
 * 선두가 그 지점에 닿는 순간 하위권(5~8위) 말들 중에서 정해진 수만큼 골라 발동한다 (판정은 경주당 한 번).
 * 발동하면 전체 정지 + 컷인 → 재개 후 속도 강화. 2마리면 큐에 넣어 한 마리씩 연출한다.
 * 정지 중에는 RaceScene이 이동/스킬 갱신을 건너뛴다. 씬이 새로 만들어지므로 다시하기마다 매번 새로 판정한다.
 */
export class UltimateSystem {
  private count: number; // 이번 경주에서 필살기를 쓸 말 수
  private trigger: number; // 선두가 이 진행률에 닿으면 판정
  private resolved = false; // 판정 완료 여부 (경주당 한 번)
  private queue: Racer[] = [];
  private cutin: Cutin | null = null;
  private pendingResume = false; // 컷인으로 멈춰 둔 트윈을 아직 재개하지 않았는지
  private activated: Racer[] = []; // 발동 순서. 마지막이 가장 나중에 발동한 말

  /** canJudge: 벌칙 슬롯이 끝났거나 발동하지 않는 경주에서만 true. 필살기 판정은 슬롯이 끝나고 레이스가 재개된 뒤에 한다. */
  constructor(
    private scene: Phaser.Scene,
    private racers: Racer[],
    private canJudge: () => boolean = () => true,
    private isFinishNear: () => boolean = () => false,
  ) {
    this.count = rollUltimateCount();
    this.trigger = rollUltimateTrigger();
    this.resolved = this.count === 0; // 0마리로 정해진 경주는 필살기 없이 진행
  }

  /** 전체 정지 중인지 (컷인 연출 중). */
  get frozen() {
    return this.cutin !== null;
  }

  /** 카메라가 따라갈 말. 컷인 중이면 그 말, 아니면 가장 나중에 발동해 아직 강화 중인 말, 없으면 null(선두 추적). */
  get cameraRacer(): Racer | null {
    if (this.cutin) return this.cutin.racer;
    for (let i = this.activated.length - 1; i >= 0; i--) {
      if (this.activated[i].ultimateActive) return this.activated[i];
    }
    return null;
  }

  update(dt: number) {
    if (this.cutin) {
      this.updateCutin(dt);
      return;
    }
    // 골인한 말의 필살기 효과는 정리
    for (const r of this.activated) if (r.rank !== null && r.ultimateActive) r.endUltimate();

    // 선두가 판정 지점에 닿는 순간, 그 시점 하위권 말들 중에서 정해진 수만큼 발동 (한 번만)
    if (!this.resolved && this.canJudge()) {
      const running = this.racers.filter((r) => r.rank === null);
      const lead = running.reduce((best, r) => (r.x > best.x ? r : best), running[0]);
      if (lead && (lead.x - START_X) / (FINISH_X - START_X) >= this.trigger) {
        this.resolved = true;
        this.queue.push(...pickUltimateTargets(running, this.count).map((t) => t.racer));
      }
    }
    this.startNext();
  }

  /** 큐의 다음 말을 시작한다. 선두가 결승 직전이면 1등 골인 장면과 겹치지 않도록 컷인 없이 효과만 적용한다. */
  private startNext() {
    while (this.queue.length > 0) {
      const racer = this.queue.shift()!;
      if (this.isFinishNear()) {
        racer.startUltimate(racer.horse.ultimate.speedMul, ULTIMATE_DURATION);
        this.activated.push(racer);
        continue;
      }
      this.beginCutin(racer);
      return;
    }
    if (!this.cutin && this.pendingResume) {
      this.scene.tweens.resumeAll();
      this.pendingResume = false;
    }
  }

  private beginCutin(racer: Racer) {
    this.pendingResume = true;
    this.scene.tweens.pauseAll(); // 진행 중인 잔상/문구 트윈도 정지
    this.cutin = { racer, t: 0, fx: new CutinFx(this.scene, racer.horse, racer.lane) };
  }

  private updateCutin(dt: number) {
    const c = this.cutin!;
    c.t += dt;
    c.fx.update(c.t);
    // 화면 전환(번쩍임/와이프) 없이 시간이 다 되면 바로 사라지고 경주가 재개된다
    if (c.t >= CUTIN_DURATION) this.endCutin();
  }

  private endCutin() {
    const c = this.cutin!;
    c.fx.destroy();
    this.cutin = null;

    c.racer.startUltimate(c.racer.horse.ultimate.speedMul, ULTIMATE_DURATION);
    this.activated.push(c.racer);

    this.startNext(); // 큐에 남은 말은 이어서 연출 (결승 직전이면 컷인 없이 효과만). 더 없으면 경주 재개
  }

  /** 씬 종료 시 정리. */
  destroy() {
    this.scene.tweens.resumeAll();
  }
}
