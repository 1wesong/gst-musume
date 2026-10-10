import type { HorseData } from '../data/horses';
import { createBanner, createButton } from './components';
import { hex } from './theme';
import './result.css';

export interface ResultEntry {
  rank: number;
  lane: number;
  horse: HorseData;
  useImage: boolean; // 달리기 이미지가 실제로 로드되었는지
}

export interface ResultHandlers {
  onReplay: () => void;
  onMain: () => void;
}

// 골드 스파크 (꽃가루 대신): 골드 위주 + 화이트, 아주 가끔 레드
const SPARK_COLORS = ['var(--c-gold-light)', 'var(--c-gold)', 'var(--c-gold-light)', 'var(--c-white)', 'var(--c-gold)', 'var(--c-red-light)'];
const SPARK_COUNT = 56;

const CROWN_SVG = `
  <svg class="crown" viewBox="0 0 72 52" aria-hidden="true">
    <path d="M6 44 L10 12 L26 28 L36 5 L46 28 L62 12 L66 44 Z" fill="var(--c-gold-light)" stroke="var(--c-ink)" stroke-width="4" stroke-linejoin="round"/>
    <rect x="6" y="40" width="60" height="9" rx="3" fill="var(--c-gold-deep)" stroke="var(--c-ink)" stroke-width="4"/>
    <circle cx="10" cy="11" r="4.5" fill="var(--c-red)" stroke="var(--c-ink)" stroke-width="2.5"/>
    <circle cx="36" cy="5" r="4.5" fill="var(--c-red)" stroke="var(--c-ink)" stroke-width="2.5"/>
    <circle cx="62" cy="11" r="4.5" fill="var(--c-red)" stroke="var(--c-ink)" stroke-width="2.5"/>
  </svg>`;

/**
 * 경주 결과 팝업 (HTML 오버레이): WINNER 리본 + 3단 시상대 + 1등 뒤 회전 스포트라이트 + 꽃가루.
 * 팝업은 아래에서 튀어 오르듯 등장한다. 스타일은 공통 디자인 시스템(design.css)과 result.css.
 */
export class ResultOverlay {
  private root: HTMLDivElement;
  private onResize = () => this.fit();

  constructor(entries: ResultEntry[], handlers: ResultHandlers) {
    this.root = document.createElement('div');
    this.root.className = 'result-overlay';

    // 꽃가루 (위에서 떨어짐)
    const confetti = document.createElement('div'); // 골드 스파크 레이어
    confetti.className = 'confetti';
    for (let i = 0; i < SPARK_COUNT; i++) {
      const piece = document.createElement('i');
      piece.style.cssText = [
        `--x:${(Math.random() * 100).toFixed(1)}%`,
        `--d:${(1.6 + Math.random() * 2.2).toFixed(2)}s`,
        `--delay:${(-Math.random() * 6).toFixed(2)}s`,
        `--c:${SPARK_COLORS[i % SPARK_COLORS.length]}`,
        `--len:${Math.round(40 + Math.random() * 70)}px`,
        `--sway:${Math.round(-260 - Math.random() * 120)}px`,
      ].join(';');
      confetti.append(piece);
    }

    // 시상대 칸: 2등(왼쪽) - 1등(가운데) - 3등(오른쪽)
    const byRank = (r: number) => entries.find((e) => e.rank === r);
    const podium = document.createElement('div');
    podium.className = 'podium';
    podium.innerHTML = `
      <div class="spotlight"></div>
      ${[2, 1, 3].map((r) => this.slot(byRank(r))).join('')}`;

    const banner = createBanner('WINNER', { size: 'lg' });
    banner.classList.add('result-banner');

    const buttons = document.createElement('div');
    buttons.className = 'result-buttons';
    buttons.append(
      createButton('다시하기', { variant: 'red', size: 'lg', display: true, onClick: handlers.onReplay }),
      createButton('메인으로', { variant: 'light', size: 'md', onClick: handlers.onMain }),
    );

    const popup = document.createElement('div');
    popup.className = 'result-popup';
    popup.append(banner, podium, buttons);
    const fitBox = document.createElement('div');
    fitBox.className = 'result-fit';
    fitBox.append(popup);

    this.root.append(fitBox, confetti);
    document.body.append(this.root);
    this.fit();
    window.addEventListener('resize', this.onResize);
  }

  /** 작은 화면에서는 팝업 전체를 축소해 시상대/버튼이 잘리지 않게 한다. */
  private fit() {
    const scale = Math.min(1, window.innerHeight / 700, window.innerWidth / 900);
    this.root.style.setProperty('--fit', scale.toFixed(3));
  }

  private slot(e: ResultEntry | undefined): string {
    if (!e) return '<div class="podium-slot"></div>';
    const { horse } = e;
    // 이미지 경로가 비어 있거나 로드되지 않았으면 말 색상 사각형 + 이름으로 대체
    const visual =
      horse.images.run && e.useImage
        ? `<img src="${horse.images.run}" alt="" />`
        : `<div class="placeholder" style="background:${hex(horse.color)}"></div>`;
    return `
      <div class="podium-slot rank-${e.rank}">
        <div class="podium-horse${horse.images.run && e.useImage ? '' : ' is-ph'}" style="--bd:${(e.rank * -0.17).toFixed(2)}s">
          ${e.rank === 1 ? CROWN_SVG : ''}
          ${visual}
        </div>
        <div class="podium-block">
          <div class="podium-top"></div>
          <div class="podium-front">
            <div class="podium-rank">${e.rank}</div>
            <div class="podium-name">${horse.name}</div>
            <div class="podium-lane">${e.lane}번 레인</div>
          </div>
        </div>
      </div>`;
  }

  destroy() {
    window.removeEventListener('resize', this.onResize);
    this.root.remove();
  }
}
