/**
 * 화면 없는 경주 시뮬레이션 (밸런스 확인용). Phaser 없이 게임 로직(속도 모델, 라스트 스퍼트, 일반 스킬, 필살기,
 * 슬로모션, 컷인 시간)을 재현해서 평균 경주 시간 / 경주당 1위 교체 횟수 / 필살기 말 승률을 구한다.
 * - 브라우저: 개발 서버에서 /?debug=sim 으로 접속하면 게임 대신 이 시뮬레이션을 돌리고 콘솔에 출력한다.
 * - 터미널: npm run balance [횟수]
 */
import * as C from '../config';
import { pickRaceHorses } from '../data/horses';
import { pickSkill, type SkillDef } from '../data/skills';
import { PENALTIES, type PenaltyId } from '../data/penalties';
import { LeadTracker } from '../systems/leadTracker';
import { pickExcludeTarget, pickSwapPair, rollPenaltyEnabled, rollPenaltyIndex } from '../systems/penaltyPlan';
import { mirrorLogical } from '../systems/trackMap';
import { pickUltimateTargets, rollUltimateCount, rollUltimateTrigger } from '../systems/ultimatePlan';
import {
  applyFieldEffects, fatigueMultiplier, hiddenSpurtMultiplier, isSpurt, rollSpurtPlan, speedTargetInterval, speedVariation, spurtSpeedMul, stepFatigue, styleMultiplier,
  ultimateMultiplier, type RunningStyle,
} from '../systems/speedModel';

const DT = 1 / 60;
const GAP_SAMPLE_AT = 0.6; // 간격을 재는 진행률(선두 기준)
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

class SimRacer {
  x = C.START_X;
  speed = 0;
  rank: number | null = null;
  finishTime: number | null = null;
  // 일반 스킬이 쓰는 필드 (Racer와 같은 이름)
  activeSkill: { def: SkillDef; t: number } | null = null;
  skillSpeedMul = 1;
  poseAngle = 0;
  flipX = false;
  afterimageCount = 0;
  ultimateMul = 1;
  ultimateTime = 0;
  private ultimatePeak = 1;
  private ultimateElapsed = 0;
  rubberMul = 1;
  gapMul = 1;
  slipMul = 1;
  leading = false;
  private fatigue = 0;
  private spurtPlan = rollSpurtPlan();
  heavyCooldown = 0;
  private spurt = false;
  private speedVar = 0;
  private speedVarTarget = 0;
  private speedVarTimer = 0;

  constructor(readonly baseSpeed: number, readonly style: RunningStyle) {}

  get ultimateActive() {
    return this.ultimateTime > 0;
  }
  spawnAfterimage() {}
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
  startUltimate(peak: number, duration: number) {
    this.ultimatePeak = peak;
    this.ultimateElapsed = 0;
    this.ultimateMul = ultimateMultiplier(peak, 0);
    this.ultimateTime = duration;
  }
  setSpurt(on: boolean) {
    if (this.spurt === on) return;
    this.spurt = on;
    this.speedVarTimer = 0;
  }
  update(dt: number) {
    const prev = this.x;
    this.speedVarTimer -= dt;
    if (this.speedVarTimer <= 0) {
      const [lo, hi] = speedTargetInterval(this.spurt);
      this.speedVarTarget = (Math.random() * 2 - 1) * speedVariation(this.spurt);
      this.speedVarTimer = rand(lo, hi);
    }
    this.speedVar += (this.speedVarTarget - this.speedVar) * Math.min(1, C.SPEED_TARGET_SMOOTH * dt);
    if (this.ultimateActive) this.ultimateMul = ultimateMultiplier(this.ultimatePeak, this.ultimateElapsed);
    const progress = (this.x - C.START_X) / C.TRACK_LENGTH;
    this.fatigue = stepFatigue(this.fatigue, this.leading, dt);
    this.speed =
      C.BASE_SPEED * this.baseSpeed * (1 + this.speedVar) * styleMultiplier(this.style, progress) * this.rubberMul * this.gapMul * this.slipMul * fatigueMultiplier(this.fatigue) *
      hiddenSpurtMultiplier(this.spurtPlan, progress) * spurtSpeedMul(this.spurt) * this.skillSpeedMul * this.ultimateMul;
    this.x = Math.max(C.START_X, this.x + this.speed * dt);
    if (this.ultimateActive) {
      this.ultimateTime -= dt;
      this.ultimateElapsed += dt;
      if (this.ultimateTime <= 0) {
        this.ultimateMul = 1;
        this.ultimateTime = 0;
      }
    }
    return prev;
  }
}

export interface RaceResult {
  winnerUlt: boolean; // 필살기를 쓴 말(들) 중 한 마리라도 우승
  ultCount: number; // 이번 경주에서 발동한 필살기 마리 수(0~2)
  triggerRanks: number[]; // 발동 시점 순위(1=선두)
  takeoverProgress: number | null; // 필살기 말이 처음 선두로 올라선 시점의 진행률(0~1), 못 올라서면 null
  realTime: number; // 3등 골인(경주 종료)까지 실제 시간(컷인/슬로모션 포함)
  gameTime: number;
  firstTime: number; // 1등 골인 시각(실제 시간)
  slowmo: boolean;
  penalty: PenaltyId | null; // 이번 경주에서 발동한 벌칙 (없으면 null)
  gapMaxRace: number; // 1등 골인 전까지 경주 중 선두-꼴찌 최대 간격(트랙 길이 대비)
  gap60: number | null; // 선두 진행률이 60%가 되는 시점의 선두-꼴찌 간격(트랙 길이 대비 비율)
  worldLastWins: boolean | null; // "내 세상" 벌칙이 나온 경주에서, 벌칙 직전 꼴찌였던 말이 우승했는지 (그 벌칙이 아니면 null)
  leadChanges: number; // 경주당 1위 교체 횟수 (게임 중계 자막과 같은 기준)
  rankSwaps: number; // 경주당 전체 순위 변동(추월) 횟수: 1등 골인 전까지 두 말의 앞뒤가 뒤바뀐 횟수
  winnerLeadAt: number | null; // 최종 우승마가 마지막으로 1위에 올라선 진행률(0~1). "내 세상" 경주는 좌표가 뒤집혀 null
}

export function simulateRace(): RaceResult {
  const racers = pickRaceHorses().map((h) => new SimRacer(h.baseSpeed, h.style));
  // 필살기: 경주 시작 시 발동 마리 수와 판정 지점을 정하고, 선두가 그 지점에 닿는 순간 하위권에서 대상을 고른다
  const ultCount = rollUltimateCount();
  const ultTrigger = rollUltimateTrigger();
  let ultResolved = ultCount === 0;
  const ultSet = new Set<SimRacer>();
  const triggerRanks: number[] = [];
  let takeoverProgress: number | null = null;
  const finished: SimRacer[] = [];
  let tracker = new LeadTracker<SimRacer>(C.LEAD_HOLD);
  // 벌칙 슬롯: 경주 시작 시 발동 여부를 정하고, 선두가 PENALTY_AT에 닿는 순간 한 번 판정한다 (필살기 판정은 그 뒤)
  let penaltyState: 'waiting' | 'done' | 'skipped' = rollPenaltyEnabled() ? 'waiting' : 'skipped';
  let penaltyId: PenaltyId | null = null;
  let gap60: number | null = null;
  let gapMaxRace = 0;
  let worldLast: SimRacer | null = null; // 방향 전환 직전 꼴찌
  let skillTimer = C.SKILL_START_DELAY;
  let slowmo: 'idle' | 'active' | 'done' = 'idle';
  let spurt = false;
  let gameTime = 0;
  let realTime = 0;
  let firstTime = 0;
  let usedSlowmo = false;
  let leadChanges = 0;
  let rankSwaps = 0;
  const pairSign = new Map<string, number>(); // 두 말의 앞뒤 관계(+1: i가 앞)
  const leadSince = new Map<SimRacer, number>(); // 말이 마지막으로 1위에 올라선 진행률
  let seenLeader: SimRacer | null = null;

  while (finished.length < 3 && gameTime < 200) {
    // 경주 중 최대 간격 (1등 골인 전까지)
    if (finished.length === 0) {
      const xs = racers.filter((r) => r.rank === null).map((r) => r.x);
      if (xs.length > 1) gapMaxRace = Math.max(gapMaxRace, (Math.max(...xs) - Math.min(...xs)) / C.TRACK_LENGTH);
    }

    // 선두 진행률 60% 시점의 선두-꼴찌 간격 (벌칙 적용 전)
    if (gap60 === null) {
      const run = racers.filter((r) => r.rank === null);
      const xs = run.map((r) => r.x);
      if (xs.length && (Math.max(...xs) - C.START_X) / C.TRACK_LENGTH >= GAP_SAMPLE_AT) gap60 = (Math.max(...xs) - Math.min(...xs)) / C.TRACK_LENGTH;
    }

    // 벌칙 슬롯: 실제 시간만 흐르고 경주는 멈춘다. 벌칙 효과는 게임과 같은 규칙으로 적용
    if (penaltyState === 'waiting') {
      const running0 = racers.filter((r) => r.rank === null);
      const lead0 = running0.reduce((best, r) => (r.x > best.x ? r : best), running0[0]);
      if (lead0 && (lead0.x - C.START_X) / C.TRACK_LENGTH >= C.PENALTY_AT) {
        const def = PENALTIES[rollPenaltyIndex()];
        penaltyId = def.id;
        penaltyState = 'done';
        realTime += C.PENALTY_SPIN_TIME + C.PENALTY_RESULT_TIME + def.execTime;
        if (def.id === 'exclude') {
          const pick = pickExcludeTarget(running0);
          if (pick) racers.splice(racers.indexOf(pick.racer), 1);
        } else if (def.id === 'world') {
          worldLast = running0.reduce((worst, r) => (r.x < worst.x ? r : worst), running0[0]);
          for (const r of racers) r.x = mirrorLogical(r.x); // 결승선이 반대쪽: 논리 좌표를 거울상으로
        } else {
          const pair = pickSwapPair(running0);
          if (pair) [pair.first.x, pair.last.x] = [pair.last.x, pair.first.x];
        }
        tracker = new LeadTracker<SimRacer>(C.LEAD_HOLD); // 벌칙으로 바뀐 선두는 "선두 교체"로 세지 않는다
      }
    }

    // 필살기 판정 (경주당 한 번, 벌칙 슬롯이 끝난 뒤): 컷인 동안 경주는 멈추고 실제 시간만 흐른다
    if (!ultResolved && penaltyState !== 'waiting') {
      const running0 = racers.filter((r) => r.rank === null);
      const lead0 = running0.reduce((best, r) => (r.x > best.x ? r : best), running0[0]);
      if (lead0 && (lead0.x - C.START_X) / C.TRACK_LENGTH >= ultTrigger) {
        ultResolved = true;
        for (const t of pickUltimateTargets(running0, ultCount)) {
          ultSet.add(t.racer);
          triggerRanks.push(t.rank);
          // 선두가 결승 직전이면 컷인 없이 효과만 적용 (게임과 동일)
          if ((lead0.x - C.START_X) / C.TRACK_LENGTH < 1 - C.CAMERA_FINISH_REMAINING) realTime += C.CUTIN_DURATION;
          t.racer.startUltimate(C.ULTIMATE_SPEED_MUL, C.ULTIMATE_DURATION);
        }
      }
    }
    const dt = DT * (slowmo === 'active' ? C.SLOWMO_SCALE : 1);
    gameTime += dt;
    realTime += DT;

    // 일반 스킬
    for (const r of racers) r.heavyCooldown = Math.max(0, r.heavyCooldown - dt);
    for (const r of racers) {
      const a = r.activeSkill;
      if (!a) continue;
      if (r.rank !== null) {
        r.resetSkillEffects();
        continue;
      }
      a.t += dt;
      const pr = Math.min(1, a.t / a.def.duration);
      a.def.apply(r as never, pr, dt, a.t);
      if (pr >= 1) r.resetSkillEffects();
    }
    if (slowmo !== 'active') {
      skillTimer -= dt;
      if (skillTimer <= 0) {
        skillTimer = rand(C.SKILL_INTERVAL[0], C.SKILL_INTERVAL[1]);
        const cands = racers.filter((r) => r.rank === null && !r.activeSkill);
        if (cands.length) {
          const target = cands[Math.floor(Math.random() * cands.length)];
          const def = pickSkill(target.heavyCooldown <= 0);
          target.startSkill(def);
          if (def.heavy) target.heavyCooldown = def.duration + C.SKILL_HEAVY_MIN_GAP;
        }
      }
    }

    // 라스트 스퍼트 / 추격 보정
    const running = racers.filter((r) => r.rank === null).sort((a, b) => b.x - a.x);
    if (!spurt && running.length && isSpurt((running[0].x - C.START_X) / C.TRACK_LENGTH)) {
      spurt = true;
      racers.forEach((r) => r.setSpurt(true));
    }
    applyFieldEffects(running, spurt);

    for (const r of racers) {
      const prev = r.update(dt);
      if (r.finishTime === null && r.x >= C.FINISH_X) {
        r.finishTime = gameTime - dt + dt * ((C.FINISH_X - prev) / (r.x - prev));
      }
    }
    const newly = racers.filter((r) => r.finishTime !== null && r.rank === null).sort((a, b) => a.finishTime! - b.finishTime!);
    for (const r of newly) {
      r.rank = finished.length + 1;
      finished.push(r);
      if (finished.length === 1) firstTime = realTime;
    }

    // 1위 교체 집계 (게임의 선두 탈환 자막과 같은 규칙: 초반 CAPTION_START_DELAY 제외, 1등 골인 전까지)
    if (finished.length === 0) {
      const lead = racers.reduce((best, r) => (r.x > best.x ? r : best));
      const change = tracker.update(lead, dt);
      if (change && gameTime > C.CAPTION_START_DELAY) leadChanges++;
      // 우승마가 마지막으로 1위에 올라선 지점: 확정 대기 없이, 앞선 말보다 RANK_SWAP_MIN_GAP 이상 앞서면 1위 교체로 본다
      if (seenLeader === null || lead.x - seenLeader.x > C.RANK_SWAP_MIN_GAP * C.TRACK_LENGTH) {
        seenLeader = lead;
        leadSince.set(lead, (lead.x - C.START_X) / C.TRACK_LENGTH);
      }
      // 전체 순위 변동: 두 말의 앞뒤가 RANK_SWAP_MIN_GAP 이상 벌어진 채 뒤바뀌면 1회
      for (let i = 0; i < racers.length; i++) {
        for (let j = i + 1; j < racers.length; j++) {
          const d = (racers[i].x - racers[j].x) / C.TRACK_LENGTH;
          if (Math.abs(d) < C.RANK_SWAP_MIN_GAP) continue;
          const key = i * 16 + j;
          const sign = Math.sign(d);
          const prevSign = pairSign.get(String(key));
          if (prevSign !== undefined && prevSign !== sign) rankSwaps++;
          pairSign.set(String(key), sign);
        }
      }
    }

    // 필살기 말이 처음 선두로 올라선 시점의 진행률
    if (ultSet.size > 0 && takeoverProgress === null && finished.length === 0) {
      const lead = racers.reduce((best, r) => (r.x > best.x ? r : best));
      if (ultSet.has(lead)) takeoverProgress = (lead.x - C.START_X) / C.TRACK_LENGTH;
    }

    // 슬로모션 판정
    if (slowmo === 'active' && finished.length >= 1) slowmo = 'done';
    else if (slowmo === 'idle' && finished.length === 0) {
      const [lead, second] = racers.filter((r) => r.rank === null).sort((a, b) => b.x - a.x);
      if (lead && second && lead.speed > 0 && second.speed > 0) {
        const rem = C.FINISH_X - lead.x;
        if (rem <= C.TRACK_LENGTH * C.SLOWMO_REMAINING) {
          const diff = Math.abs((C.FINISH_X - second.x) / second.speed - rem / lead.speed);
          if (diff <= C.SLOWMO_ETA_DIFF) {
            slowmo = 'active';
            usedSlowmo = true;
          }
        }
      }
    }
  }
  return { winnerUlt: ultSet.has(finished[0]), ultCount, triggerRanks, takeoverProgress, realTime, gameTime, firstTime, slowmo: usedSlowmo, penalty: penaltyId, gapMaxRace, gap60, worldLastWins: worldLast ? finished[0] === worldLast : null, leadChanges, rankSwaps,
    winnerLeadAt: penaltyId === 'world' ? null : leadSince.get(finished[0]) ?? 1 };
}

export interface SimReport {
  races: number;
  avgRealTime: number;
  avgGameTime: number;
  avgFirstTime: number;
  avgLeadChanges: number;
  leadChangesDist: Record<string, number>; // 1위 교체 횟수별 경주 비율(%)
  slowmoRate: number;
  avgRankSwaps: number; // 경주당 전체 순위 변동 횟수(평균)
  winnerLeadAtAvg: number; // 최종 우승마가 마지막으로 1위에 올라선 진행률 평균(%)
  lateTakeoverRate: number; // 우승마가 진행률 90% 이후에 1위로 올라선 경주 비율(%)
  penaltyStats: { id: PenaltyId | 'none'; name: string; count: number; rate: number; avgRealTime: number }[]; // 벌칙별 발생 횟수와 평균 경주 시간
  gapAvg: number; // 진행률 60% 시점 선두-꼴찌 평균 간격(트랙 길이 대비 %)
  gapP95: number;
  gapMax: number;
  gapOverLimitRate: number; // 경주 중 한 번이라도 간격이 GAP_ASSIST.limit을 넘은(=보정이 작동한) 경주 비율(%)
  gapRaceMaxAvg: number; // 경주 중 최대 간격의 평균(%)
  worldLastWinRate: number; // "내 세상" 벌칙 경주에서 벌칙 직전 꼴찌의 우승 확률(%)
  worldRaces: number;
  avgRealTimeNoWorld: number; // "내가 만든 내 세상이야"가 나오지 않은 경주의 평균 경주 시간 (경주 시간 목표 판정 기준)
  countDist: Record<number, number>; // 필살기 발동 마리 수(0/1/2) 비율(%)
  ultRaces: number; // 필살기가 발동한 경주 수
  ultWinRate: number; // 필살기 발동 경주에서 필살기 말(2마리면 둘 중 한 마리라도)이 우승한 비율(%)
  ultWinRateBy: Record<number, number>; // 발동 마리 수별 위 비율
  triggerRankDist: Record<number, number>; // 발동 시점 순위 분포(%)
  takeoverRate: number; // 필살기 발동 경주 중 필살기 말이 선두로 올라선 적이 있는 비율(%)
  takeoverProgress: number; // 필살기 말이 선두로 올라서는 평균 진행률(%)
}

export function runSimulations(n: number): SimReport {
  const rs = Array.from({ length: n }, simulateRace);
  const pct = (xs: boolean[]) => (xs.filter(Boolean).length / (xs.length || 1)) * 100;
  const dist: Record<string, number> = {};
  for (const r of rs) {
    const k = r.leadChanges >= 8 ? '8+' : String(r.leadChanges);
    dist[k] = (dist[k] ?? 0) + 100 / n;
  }
  const ultRs = rs.filter((r) => r.ultCount > 0);
  const countDist: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
  for (const r of rs) countDist[r.ultCount] += 100 / n;
  const by: Record<number, number> = {};
  for (const c of [1, 2]) by[c] = pct(ultRs.filter((r) => r.ultCount === c).map((r) => r.winnerUlt));
  const rankDist: Record<number, number> = {};
  const allRanks = ultRs.flatMap((r) => r.triggerRanks);
  for (const k of allRanks) rankDist[k] = (rankDist[k] ?? 0) + 100 / (allRanks.length || 1);
  const takeovers = ultRs.map((r) => r.takeoverProgress).filter((x): x is number => x !== null);
  return {
    races: n,
    avgRealTime: avg(rs.map((r) => r.realTime)),
    avgGameTime: avg(rs.map((r) => r.gameTime)),
    avgFirstTime: avg(rs.map((r) => r.firstTime)),
    avgLeadChanges: avg(rs.map((r) => r.leadChanges)),
    leadChangesDist: dist,
    slowmoRate: pct(rs.map((r) => r.slowmo)),
    avgRankSwaps: avg(rs.map((r) => r.rankSwaps)),
    ...(() => {
      const w = rs.map((r) => r.winnerLeadAt).filter((x): x is number => x !== null);
      return { winnerLeadAtAvg: avg(w) * 100, lateTakeoverRate: pct(w.map((x) => x >= 0.9)) };
    })(),
    penaltyStats: [
      ...PENALTIES.map((d) => {
        const sub = rs.filter((r) => r.penalty === d.id);
        return { id: d.id, name: d.name, count: sub.length, rate: (sub.length / n) * 100, avgRealTime: avg(sub.map((r) => r.realTime)) };
      }),
      (() => {
        const sub = rs.filter((r) => r.penalty === null);
        return { id: 'none' as const, name: '벌칙 없음', count: sub.length, rate: (sub.length / n) * 100, avgRealTime: avg(sub.map((r) => r.realTime)) };
      })(),
    ],
    ...(() => {
      const gaps = rs.map((r) => r.gap60).filter((g): g is number => g !== null).sort((a, b) => a - b);
      const worlds = rs.filter((r) => r.worldLastWins !== null);
      return {
        gapAvg: avg(gaps) * 100,
        gapP95: (gaps[Math.floor(gaps.length * 0.95)] ?? 0) * 100,
        gapMax: (gaps[gaps.length - 1] ?? 0) * 100,
        gapOverLimitRate: pct(rs.map((r) => r.gapMaxRace > C.GAP_ASSIST.limit)),
        gapRaceMaxAvg: avg(rs.map((r) => r.gapMaxRace)) * 100,
        worldLastWinRate: pct(worlds.map((r) => r.worldLastWins === true)),
        worldRaces: worlds.length,
      };
    })(),
    avgRealTimeNoWorld: avg(rs.filter((r) => r.penalty !== 'world').map((r) => r.realTime)),
    countDist,
    ultRaces: ultRs.length,
    ultWinRate: pct(ultRs.map((r) => r.winnerUlt)),
    ultWinRateBy: by,
    triggerRankDist: rankDist,
    takeoverRate: (takeovers.length / (ultRs.length || 1)) * 100,
    takeoverProgress: avg(takeovers) * 100,
  };
}

/** 목표 대비 결과를 콘솔에 표로 출력한다. */
export function printReport(r: SimReport, log: (...a: unknown[]) => void = console.log, table: (d: unknown) => void = console.table) {
  const mark = (ok: boolean) => (ok ? '✅' : '⚠️');
  const [w0, w1, w2] = C.ULTIMATE_COUNT_WEIGHTS;
  const wsum = w0 + w1 + w2;
  const T = C.ULTIMATE_TARGET_WIN_RATE;
  log(`경주 시뮬레이션 ${r.races}회 (화면 없음)`);
  table([
    { 항목: '평균 경주 시간 - "내 세상" 벌칙 제외 (슬롯·컷인·슬로모션 포함)', 결과: `${r.avgRealTimeNoWorld.toFixed(1)}초`, 목표: '약 30초', 판정: mark(Math.abs(r.avgRealTimeNoWorld - 30) <= 2) },
    { 항목: '평균 경주 시간 - 전체 (참고)', 결과: `${r.avgRealTime.toFixed(1)}초`, 목표: '-', 판정: '' },
    { 항목: '평균 게임 시간(컷인·슬로모션 제외)', 결과: `${r.avgGameTime.toFixed(1)}초`, 목표: '-', 판정: '' },
    { 항목: '1등 골인 시각', 결과: `${r.avgFirstTime.toFixed(1)}초`, 목표: '-', 판정: '' },
    { 항목: '경주당 1위 교체 횟수(평균)', 결과: r.avgLeadChanges.toFixed(2), 목표: '5회 이상', 판정: mark(r.avgLeadChanges >= 5) },
    { 항목: '경주당 전체 순위 변동 횟수(평균)', 결과: r.avgRankSwaps.toFixed(1), 목표: '-', 판정: '' },
    { 항목: '우승마가 마지막으로 1위에 올라선 진행률(평균)', 결과: `${r.winnerLeadAtAvg.toFixed(1)}%`, 목표: '85% 이상', 판정: mark(r.winnerLeadAtAvg >= 85) },
    { 항목: '우승마가 90% 이후 1위로 올라선 경주 비율', 결과: `${r.lateTakeoverRate.toFixed(1)}%`, 목표: '-', 판정: '' },
    { 항목: '슬로모션 발생률', 결과: `${r.slowmoRate.toFixed(1)}%`, 목표: '-', 판정: '' },
  ]);
  table([
    { 항목: '진행률 60% 시점 선두-꼴찌 간격 (평균)', 결과: `${r.gapAvg.toFixed(1)}% (${((r.gapAvg / 100) * C.TRACK_METERS).toFixed(0)}m)`, 목표: '-' },
    { 항목: '  95% 경주가 이 값 이하', 결과: `${r.gapP95.toFixed(1)}% (${((r.gapP95 / 100) * C.TRACK_METERS).toFixed(0)}m)`, 목표: '-' },
    { 항목: '  최대 간격', 결과: `${r.gapMax.toFixed(1)}% (${((r.gapMax / 100) * C.TRACK_METERS).toFixed(0)}m)`, 목표: '-' },
    { 항목: '경주 중 최대 간격의 평균', 결과: `${r.gapRaceMaxAvg.toFixed(1)}%`, 목표: '-' },
    { 항목: `간격이 보정 기준(${(C.GAP_ASSIST.limit * 100).toFixed(0)}%)을 넘은 경주 비율`, 결과: `${r.gapOverLimitRate.toFixed(1)}%`, 목표: '-' },
    { 항목: `"내 세상" 벌칙 직전 꼴찌의 우승 확률 (${r.worldRaces}경주)`, 결과: `${r.worldLastWinRate.toFixed(1)}%`, 목표: '(참고: 8마리 무작위면 12.5%)' },
  ]);
  table(
    r.penaltyStats.map((x) => ({
      벌칙: x.name,
      '발생 횟수': `${x.count}회 (${x.rate.toFixed(1)}%)`,
      '평균 경주 시간': x.count ? `${x.avgRealTime.toFixed(1)}초` : '-',
      비고: x.id === 'world' ? '길어지는 게 의도됨, 시간 목표에서 제외' : '',
    })),
  );
  table([
    { 항목: '필살기 0마리 경주 비율', 결과: `${r.countDist[0].toFixed(1)}%`, 목표: `${((w0 / wsum) * 100).toFixed(0)}%` },
    { 항목: '필살기 1마리 경주 비율', 결과: `${r.countDist[1].toFixed(1)}%`, 목표: `${((w1 / wsum) * 100).toFixed(0)}%` },
    { 항목: '필살기 2마리 경주 비율', 결과: `${r.countDist[2].toFixed(1)}%`, 목표: `${((w2 / wsum) * 100).toFixed(0)}%` },
  ]);
  table([
    { 항목: `필살기 발동 경주에서 필살기 말 우승 확률 (${r.ultRaces}경주)`, 결과: `${r.ultWinRate.toFixed(1)}%`, 목표: `약 ${T}%`, 판정: mark(Math.abs(r.ultWinRate - T) <= 5) },
    { 항목: '  1마리 발동 경주', 결과: `${(r.ultWinRateBy[1] ?? 0).toFixed(1)}%`, 목표: '-', 판정: '' },
    { 항목: '  2마리 발동 경주 (둘 중 한 마리라도)', 결과: `${(r.ultWinRateBy[2] ?? 0).toFixed(1)}%`, 목표: '-', 판정: '' },
    { 항목: '필살기 말이 선두로 올라서는 평균 진행률', 결과: `${r.takeoverProgress.toFixed(1)}%`, 목표: '결승 직전(약 90%+)', 판정: mark(r.takeoverProgress >= 88) },
    { 항목: '  선두에 올라선 적이 있는 경주 비율(발동 경주 중)', 결과: `${r.takeoverRate.toFixed(1)}%`, 목표: '-', 판정: '' },
  ]);
  log(
    '발동 시점 순위 분포(%):',
    Object.fromEntries(Object.entries(r.triggerRankDist).map(([k, v]) => [`${k}위`, +v.toFixed(1)])),
  );
  log('1위 교체 횟수 분포(%):', Object.fromEntries(Object.entries(r.leadChangesDist).map(([k, v]) => [k, +v.toFixed(1)])));
}

export function runDebugSim(n = C.SIM_RACES) {
  const t0 = performance.now();
  const report = runSimulations(n);
  printReport(report);
  console.log(`(소요 ${(performance.now() - t0).toFixed(0)}ms)`);
  return report;
}
