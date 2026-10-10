import { HORSE_RACE_COUNT } from '../config';
import { HORSES, pickRaceHorses, type HorseData } from '../data/horses';
import { createButton, createPanel, createSegmented, createTitle, setButtonLabel, slideIn } from './components';
import { hex } from './theme';
import './select.css';

type Mode = 'random' | 'manual';

export interface SelectHandlers {
  onStart: (horses: HorseData[]) => void; // 배열 인덱스 + 1 = 레인 번호
  onBack: () => void;
  hasImage: (horse: HorseData) => boolean; // 차렷 이미지가 실제 로드되었는지
}

/** 말 선택 화면 (HTML 오버레이). 랜덤 / 직접 선택. 선택 로직은 배열 하나로만 관리한다. */
export class SelectOverlay {
  private root = document.createElement('div');
  private mode: Mode = 'random';
  // 선택 상태는 배열로만 관리한다. 레인 번호 = 인덱스 + 1 (저장하지 않고 항상 계산)
  private manual: HorseData[] = [];
  private randomLineup: HorseData[] = [];

  private cards = new Map<number, HTMLDivElement>();
  private slotBar: HTMLDivElement;
  private chips = new Map<number, HTMLDivElement>();
  private startBtn: HTMLButtonElement;
  private secondaryBtn: HTMLButtonElement; // 랜덤: 다시 섞기 / 직접: 선택 초기화
  private hint: HTMLDivElement;
  private grid: HTMLDivElement;
  private seg: ReturnType<typeof createSegmented>;

  constructor(private handlers: SelectHandlers) {
    this.root.className = 'select-overlay';

    // ---- 상단: 뒤로가기 / 제목 / 모드 토글 ----
    const back = createButton('← 메인', { variant: 'light', size: 'sm', onClick: handlers.onBack });
    this.seg = createSegmented(['랜덤', '직접 선택'], (i) => this.setMode(i === 0 ? 'random' : 'manual'));
    const head = document.createElement('div');
    head.className = 'select-head';
    const left = document.createElement('div');
    left.className = 'select-head__side';
    left.append(back);
    const right = document.createElement('div');
    right.className = 'select-head__side select-head__side--right';
    right.append(this.seg.root);
    head.append(left, createTitle('말 선택', { size: 'md', tag: 'h2' }), right);
    slideIn(head, 'up');

    // ---- 카드 그리드 (15장은 한 번만 만들고 상태만 갱신) ----
    this.grid = document.createElement('div');
    this.grid.className = 'card-grid';
    HORSES.forEach((horse, i) => {
      const card = document.createElement('div');
      card.className = 'horse-card';
      card.style.setProperty('--n', String(i));
      card.innerHTML = `
        <div class="lane-badge"></div>
        <div class="pic">${this.cardVisual(horse)}</div>
        <div class="nm">${horse.name}</div>`;
      card.addEventListener('click', () => this.toggle(horse));
      this.cards.set(horse.id, card);
      this.grid.append(card);
    });
    const main = document.createElement('div');
    main.className = 'select-main';
    main.append(this.grid);

    // ---- 하단 독: 레인 1~8 슬롯 바 + 버튼 ----
    this.slotBar = document.createElement('div');
    this.slotBar.className = 'slot-bar';
    for (let i = 0; i < HORSE_RACE_COUNT; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.style.setProperty('--i', String(i));
      slot.innerHTML = `<span class="slot__no">${i + 1}</span>`;
      this.slotBar.append(slot);
    }
    this.hint = document.createElement('div');
    this.hint.className = 'dock-hint';
    this.secondaryBtn = createButton('', { variant: 'light', size: 'sm' });
    this.startBtn = createButton('', { variant: 'red', size: 'lg', display: true });
    this.startBtn.classList.add('select-start');
    this.secondaryBtn.addEventListener('click', () => (this.mode === 'random' ? this.reshuffle() : this.clear()));
    this.startBtn.addEventListener('click', () => {
      if (this.lineup.length === HORSE_RACE_COUNT) handlers.onStart([...this.lineup]);
    });
    const actions = document.createElement('div');
    actions.className = 'dock-actions';
    actions.append(this.hint, this.secondaryBtn, this.startBtn);

    const dock = createPanel({ variant: 'glass', title: '출전 순서 · 레인' });
    dock.body.append(this.slotBar, actions);
    const dockWrap = document.createElement('div');
    dockWrap.className = 'select-dock';
    dockWrap.append(dock.root);
    slideIn(dockWrap, 'up', 1);

    this.root.append(head, main, dockWrap);
    this.reshuffle(false);
    this.render();
    document.body.append(this.root);
  }

  private get lineup(): HorseData[] {
    return this.mode === 'random' ? this.randomLineup : this.manual;
  }

  /** 카드용 차렷 이미지, 없으면 말 색상 사각형. */
  private cardVisual(horse: HorseData): string {
    if (this.handlers.hasImage(horse) && horse.images.stand) return `<img src="${horse.images.stand}" alt="" />`;
    return `<div class="ph" style="background:${hex(horse.color)}"></div>`;
  }

  /** 슬롯용 얼굴: 차렷 이미지의 윗부분을 원형으로 크롭, 없으면 말 색상 원. */
  private faceVisual(horse: HorseData): string {
    if (this.handlers.hasImage(horse) && horse.images.stand) {
      return `<div class="chip__face" style="background-image:url('${horse.images.stand}')"></div>`;
    }
    return `<div class="chip__face"><div class="ph" style="background:${hex(horse.color)}"></div></div>`;
  }

  private reshuffle(render = true) {
    this.randomLineup = pickRaceHorses(); // 셔플 순서가 곧 레인 순서. 각질이 한쪽으로 몰리지 않게 뽑는다
    if (render) this.render();
  }

  private clear() {
    this.manual = [];
    this.render();
  }

  private setMode(mode: Mode) {
    this.mode = mode;
    this.seg.setValue(mode === 'random' ? 0 : 1);
    this.render();
  }

  private toggle(horse: HorseData) {
    if (this.mode !== 'manual') return;
    const idx = this.manual.indexOf(horse);
    if (idx >= 0) this.manual.splice(idx, 1); // 해제하면 뒤 말들이 앞으로 당겨진다
    else if (this.manual.length < HORSE_RACE_COUNT) this.manual.push(horse);
    this.render();
  }

  private render() {
    const manual = this.mode === 'manual';
    const lineup = this.lineup;
    const full = lineup.length === HORSE_RACE_COUNT;

    // 카드: 선택 여부, 레인 번호 뱃지(인덱스에서 계산), 직접 선택에서 가득 찼을 때 비활성, 랜덤 모드는 고정 표시
    for (const horse of HORSES) {
      const card = this.cards.get(horse.id)!;
      const idx = lineup.indexOf(horse);
      card.classList.toggle('selected', idx >= 0);
      card.classList.toggle('disabled', manual && full && idx < 0);
      card.classList.toggle('static', !manual);
      card.querySelector('.lane-badge')!.textContent = idx >= 0 ? String(idx + 1) : '';
    }

    // 슬롯 바: 칩의 --i를 인덱스로 바꾸면 CSS transition으로 부드럽게 당겨진다
    const alive = new Set(lineup.map((h) => h.id));
    for (const [id, chip] of this.chips) {
      if (!alive.has(id)) {
        chip.classList.add('leaving');
        this.chips.delete(id);
        setTimeout(() => chip.remove(), 220);
      }
    }
    lineup.forEach((horse, i) => {
      let chip = this.chips.get(horse.id);
      if (!chip) {
        chip = document.createElement('div');
        chip.className = 'chip';
        chip.innerHTML = `<div class="chip__inner">${this.faceVisual(horse)}<div class="chip__no"></div><div class="chip__name">${horse.name}</div></div>`;
        chip.style.setProperty('--i', String(i));
        this.slotBar.append(chip);
        this.chips.set(horse.id, chip);
      }
      chip.style.setProperty('--i', String(i));
      chip.querySelector('.chip__no')!.textContent = String(i + 1);
    });

    // 버튼/안내
    setButtonLabel(this.secondaryBtn, manual ? '선택 초기화' : '다시 섞기');
    this.secondaryBtn.disabled = manual && lineup.length === 0;
    setButtonLabel(this.startBtn, full ? '경주 시작!' : `경주 시작 (${lineup.length}/${HORSE_RACE_COUNT})`);
    this.startBtn.disabled = !full;
    this.startBtn.classList.toggle('ready', full);
    this.hint.innerHTML = manual
      ? `<b>${lineup.length}/${HORSE_RACE_COUNT}</b>${full ? '준비 완료! 선택한 순서가 레인 번호예요' : '카드를 눌러 1번 레인부터 채워 보세요'}`
      : `<b>${lineup.length}/${HORSE_RACE_COUNT}</b>랜덤으로 뽑았어요. 마음에 안 들면 다시 섞어 보세요`;
  }

  destroy() {
    this.root.remove();
  }
}
