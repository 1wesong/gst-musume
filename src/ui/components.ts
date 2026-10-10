import type { ButtonVariant } from './theme';

/** HTML 오버레이용 공통 컴포넌트. 스타일은 design.css, 값은 theme.ts의 CSS 변수. */

type Child = string | Node;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, children: Child[] = []): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = cls;
  for (const c of children) node.append(c);
  return node;
};

const span = (text: Child) => el('span', '', [text]);

/** 제목 텍스트 (얇은 외곽선 + 날카로운 하드 섀도). */
export function createTitle(text: string, opts: { size?: 'sm' | 'md' | 'lg'; color?: 'white' | 'gold' | 'red'; tag?: 'h1' | 'h2' | 'h3' | 'div' } = {}): HTMLElement {
  const node = document.createElement(opts.tag ?? 'div');
  node.className = `ui-title ui-title--${opts.size ?? 'md'}${opts.color && opts.color !== 'white' ? ` ui-title--${opts.color}` : ''}`;
  node.textContent = text;
  return node;
}

export interface ButtonOptions {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  /** 제목 폰트(Black Han Sans) 사용 */
  display?: boolean;
  disabled?: boolean;
  onClick?: (e: MouseEvent) => void;
}

/** 각진 사선 버튼: 호버 상승, 눌림, 표면을 가로지르는 빛줄기. 라벨은 span 안에 있어 setButtonLabel로 바꾼다. */
export function createButton(label: string, opts: ButtonOptions = {}): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = ['ui-btn', `ui-btn--${opts.variant ?? 'red'}`, opts.size && opts.size !== 'md' ? `ui-btn--${opts.size}` : '', opts.display ? 'ui-btn--title' : '']
    .filter(Boolean)
    .join(' ');
  btn.append(span(label));
  btn.disabled = !!opts.disabled;
  if (opts.onClick) btn.addEventListener('click', opts.onClick);
  return btn;
}

/** 버튼 라벨을 바꾼다. */
export function setButtonLabel(btn: HTMLButtonElement, label: string) {
  const s = btn.querySelector('span');
  if (s) s.textContent = label;
  else btn.textContent = label;
}

export interface PanelOptions {
  variant?: 'dark' | 'glass' | 'red' | 'gold';
  /** 패널 위에 걸치는 제목 리본 */
  title?: string;
  className?: string;
}

/** 사선 패널. 반환값의 body에 내용을 넣는다(내용은 기울지 않는다). */
export function createPanel(opts: PanelOptions = {}): { root: HTMLDivElement; body: HTMLDivElement } {
  const variant = opts.variant && opts.variant !== 'dark' ? ` ui-panel--${opts.variant}` : '';
  const root = el('div', `ui-panel${variant}${opts.title ? ' ui-panel--titled' : ''}${opts.className ? ` ${opts.className}` : ''}`);
  const body = el('div', 'ui-panel__body');
  if (opts.title) root.append(el('div', 'ui-panel__tab', [span(opts.title)]));
  root.append(body);
  return { root, body };
}

/** 사선 배너 리본. */
export function createBanner(text: string, opts: { variant?: 'gold' | 'red' | 'dark'; size?: 'sm' | 'md' | 'lg' } = {}): HTMLElement {
  const v = opts.variant && opts.variant !== 'gold' ? ` ui-banner--${opts.variant}` : '';
  const title = createTitle(text, { size: opts.size ?? 'md' });
  return el('div', `ui-banner${v}`, [span(title)]);
}

/** TV 중계 하단 자막 바: [태그 | 본문]. */
export function createCaptionBar(tag: string, text: string): HTMLElement {
  return el('div', 'ui-caption', [el('div', 'ui-caption__tag', [span(tag)]), el('div', 'ui-caption__text', [span(text)])]);
}

/** 슬라이드 인 연출 클래스를 붙인다. delay: 0~3 */
export function slideIn(node: HTMLElement, from: 'left' | 'right' | 'up' = 'left', delay = 0): HTMLElement {
  node.classList.add(`ui-slide-${from}`);
  if (delay > 0) node.classList.add(`ui-delay-${delay}`);
  return node;
}

/** 세그먼트 토글 (알약 모양 + 움직이는 썸). */
export function createSegmented(
  labels: string[],
  onChange: (index: number) => void,
  initial = 0,
): { root: HTMLElement; setValue: (index: number) => void } {
  const root = el('div', 'ui-seg');
  root.style.setProperty('--n', String(labels.length));
  const thumb = el('div', 'ui-seg__thumb');
  root.append(thumb);
  const buttons = labels.map((label, i) => {
    const b = el('button', 'ui-seg__btn', [span(label)]);
    b.type = 'button';
    b.addEventListener('click', () => {
      setValue(i);
      onChange(i);
    });
    root.append(b);
    return b;
  });
  const setValue = (index: number) => {
    root.style.setProperty('--i', String(index));
    buttons.forEach((b, i) => b.classList.toggle('active', i === index));
  };
  setValue(initial);
  return { root, setValue };
}
