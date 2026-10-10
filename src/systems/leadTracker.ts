/**
 * 선두 교체 감지. 새 선두가 holdSec 이상 계속 1위를 유지해야 "교체"로 인정한다 (박빙 구간의 순간적인 떨림 방지).
 * 게임 화면(중계 자막)과 디버그 시뮬레이션이 같은 기준을 쓰도록 순수 클래스로 분리했다.
 */
export class LeadTracker<T> {
  private current: T | null = null;
  private candidate: T | null = null;
  private heldFor = 0;

  constructor(private holdSec: number) {}

  /** 매 프레임 호출. 교체가 확정된 프레임에만 { from, to }를 반환한다. */
  update(leader: T, dt: number): { from: T; to: T } | null {
    if (this.current === null) {
      this.current = leader; // 최초 선두는 교체로 보지 않는다
      return null;
    }
    if (leader === this.current) {
      this.candidate = null;
      this.heldFor = 0;
      return null;
    }
    if (this.candidate !== leader) {
      this.candidate = leader;
      this.heldFor = 0;
    }
    this.heldFor += dt;
    if (this.heldFor >= this.holdSec) {
      const change = { from: this.current, to: leader };
      this.current = leader;
      this.candidate = null;
      this.heldFor = 0;
      return change;
    }
    return null;
  }
}
