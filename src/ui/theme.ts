/**
 * 디자인 시스템 단일 출처. 색상 / 폰트 / 크기 / 모션은 모두 여기서만 정의하고,
 * HTML 오버레이는 CSS 변수(applyThemeCss)로, Phaser는 이 객체를 직접 읽어서 쓴다.
 * 콘셉트: e스포츠 / 스포츠 중계 방송 그래픽 — 강하고 세련된 라이트 톤(밝은 낮 경기장).
 *   베이스 = 화이트/라이트 그레이(넓은 면: 배경, 패널, 카드), 포인트 = 강렬한 레드 1가지, 보조 = 골드(순위/우승/강조).
 *   어두운 색(차콜/네이비)은 텍스트, 테두리, 작은 강조 요소에만 쓴다. 핑크, 파스텔 계열은 쓰지 않는다.
 */
export const theme = {
  colors: {
    // 밝은 면 (넓은 면적: 배경, 패널, 카드)
    white: 0xffffff,
    snow: 0xf7f8fa, // 거의 흰색 (패널 윗면)
    fog: 0xeceff3, // 라이트 그레이 (패널/카드 면)
    mist: 0xd9dee6, // 한 단계 진한 라이트 그레이 (구분 면)
    haze: 0xbcc4d0, // 밝은 금속 테두리
    // 어두운 색: 텍스트, 테두리, 작은 강조 요소에만
    ink: 0x0d1118, // 가장 어두운 색 (외곽선, 그림자)
    charcoal: 0x1d222b, // 텍스트
    slate: 0x2e3541, // 보조 텍스트/강조 면
    navy: 0x14233f, // 딥 네이비 (작은 강조)
    navyLight: 0x25406b,
    steel: 0x7a8597, // 금속 느낌의 테두리
    steelLight: 0xaab3c2,
    // 낮 경기장 하늘 / 트랙 (넓은 배경 면)
    sky: 0xe3f0fa,
    skyDeep: 0xa9cdea,
    trackA: 0xd2cabe,
    trackB: 0xc7bfb2,
    // 포인트 / 보조
    red: 0xd7261e, // 포인트: 강렬한 레드 (이 색 하나만 포인트로 쓴다)
    redLight: 0xff4a3d,
    redDeep: 0x8e1410,
    gold: 0xd4a52a, // 보조: 순위/우승/강조
    goldLight: 0xf3d27a,
    goldDeep: 0x8a6a14,
    silver: 0xc5ccd6,
    bronze: 0xb9783f,
  },
  fonts: {
    title: '"Black Han Sans", "Noto Sans KR", sans-serif',
    body: '"Noto Sans KR", sans-serif',
    /** 숫자(순위, 남은 거리, 레인 번호 등): 굵고 각진 느낌 */
    number: '"Oswald", "Black Han Sans", sans-serif',
  },
  // Google Fonts 로드에 쓰는 정의 (index.html의 link와 맞춘다)
  fontFaces: ['32px "Black Han Sans"', '400 16px "Noto Sans KR"', '700 20px "Noto Sans KR"', '900 20px "Noto Sans KR"', '700 32px "Oswald"'],
  /** 이보다 작은 제목 글자는 Black Han Sans 대신 본문 폰트(굵게)를 쓴다 — 획이 촘촘한 글자(건, 잖, 뛰 등)가 작은 크기에서 뭉개지기 때문 */
  titleMinPx: 36,
  fontSize: { xs: 14, sm: 16, md: 20, lg: 28, xl: 44, xxl: 72, hero: 104 },
  /** 순위 칸 색 (1위 금, 2위 은, 3위 동: 금속 톤) */
  rankColors: [0xd4a52a, 0xb7bec9, 0xa8683a],
  rankColorsDeep: [0x8a6a14, 0x6b7380, 0x6e4220],
  /** 레인(1~8)별 고유 색상: 채도를 낮추고 톤을 맞춘 8색. base=패널 면, light=윗면 하이라이트, text=그 위 글자색 */
  laneColors: [
    { base: 0xa83232, light: 0xd05a58, text: 0xffffff },
    { base: 0xb0642a, light: 0xd98c52, text: 0xffffff },
    { base: 0x9c8a2a, light: 0xc9b552, text: 0xffffff },
    { base: 0x3f7d55, light: 0x6fae85, text: 0xffffff },
    { base: 0x2f7a86, light: 0x5eacb8, text: 0xffffff },
    { base: 0x4a5fa0, light: 0x7e92d0, text: 0xffffff },
    { base: 0x74559a, light: 0xa688cc, text: 0xffffff },
    { base: 0x59636f, light: 0x8a95a3, text: 0xffffff },
  ],
  /** 사선(skew) 각도(deg). 패널/배너/버튼에 공통 사용 — 더 날카롭게 */
  skewDeg: -15,
  /** 제목 텍스트 외곽선 두께(px, 얇게)와 아래 그림자 오프셋(px, 날카로운 하드 섀도) */
  titleStroke: { sm: 1, md: 2, lg: 3 },
  titleShadowY: 3,
  borderWidth: 2, // 얇은 금속 테두리
  radius: { panel: 2 },
  /** 버튼 변종: 위/아래 그라데이션, 하단 엣지, 글자색. red=주 행동, gold=강조, dark=보조, steel=중립 */
  buttons: {
    red: { top: 0xff4a3d, bottom: 0xc41d17, edge: 0x5a0b08, text: 0xffffff },
    gold: { top: 0xf3d27a, bottom: 0xd4a52a, edge: 0x6b4f0a, text: 0x14171d },
    dark: { top: 0x3a4250, bottom: 0x1d222b, edge: 0x07090d, text: 0xffffff },
    light: { top: 0xffffff, bottom: 0xe1e6ed, edge: 0x9aa4b4, text: 0x1d222b },
    steel: { top: 0x5b6578, bottom: 0x394152, edge: 0x12151b, text: 0xffffff },
  },
  /** 모션(ms) */
  motion: { fast: 150, normal: 300, slow: 500, wipe: 520, shineEvery: 3200 },
} as const;

export type ButtonVariant = keyof typeof theme.buttons;

/** 0xRRGGBB → '#rrggbb' */
export const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());

/** 상대 밝기(0~1). 글자색이 밝은지 판단해 외곽선 색을 자동으로 고른다. */
export function luminance(n: number): number {
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** 글자색에 맞는 외곽선 색: 밝은 글자는 어두운 외곽선, 어두운 글자는 흰 외곽선. */
export const strokeFor = (textColor: number): number => (luminance(textColor) > 0.6 ? theme.colors.ink : theme.colors.white);

/** 텍스트 외곽선(얇게) + 날카로운 하드 섀도: 원 둘레에 text-shadow를 배치하고 번지지 않는 그림자를 더한다. HTML 제목용 */
export function outlineTextShadow(stroke: number, color: number = theme.colors.white, shadowY: number = theme.titleShadowY, shadowColor: number = theme.colors.steelLight): string {
  const c = hex(color);
  const parts: string[] = [];
  const steps = 16;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    parts.push(`${(Math.cos(a) * stroke).toFixed(1)}px ${(Math.sin(a) * stroke).toFixed(1)}px 0 ${c}`);
  }
  parts.push(`${shadowY}px ${stroke + shadowY}px 0 ${hex(shadowColor)}`);
  return parts.join(', ');
}

/** theme를 CSS 변수로 :root에 주입한다. 앱 시작 시 한 번 호출. */
export function applyThemeCss(root: HTMLElement = document.documentElement) {
  const set = (k: string, v: string | number) => root.style.setProperty(`--${k}`, String(v));
  for (const [k, v] of Object.entries(theme.colors)) set(`c-${kebab(k)}`, hex(v));
  set('font-title', theme.fonts.title);
  set('font-body', theme.fonts.body);
  set('font-number', theme.fonts.number);
  theme.rankColors.forEach((c, i) => {
    set(`rank-${i + 1}`, hex(c));
    set(`rank-${i + 1}-deep`, hex(theme.rankColorsDeep[i]));
  });
  theme.laneColors.forEach((c, i) => {
    set(`lane-${i + 1}`, hex(c.base));
    set(`lane-${i + 1}-light`, hex(c.light));
  });
  for (const [k, v] of Object.entries(theme.fontSize)) set(`fs-${k}`, `${v}px`);
  set('skew', `${theme.skewDeg}deg`);
  set('unskew', `${-theme.skewDeg}deg`);
  set('border-w', `${theme.borderWidth}px`);
  set('radius-panel', `${theme.radius.panel}px`);
  for (const [name, b] of Object.entries(theme.buttons)) {
    set(`btn-${name}-top`, hex(b.top));
    set(`btn-${name}-bottom`, hex(b.bottom));
    set(`btn-${name}-edge`, hex(b.edge));
    set(`btn-${name}-text`, hex(b.text));
  }
  for (const [k, v] of Object.entries(theme.motion)) set(`ms-${kebab(k)}`, `${v}ms`);
  // 밝은 면 위의 어두운 글자: 흰 외곽선 + 라이트 그레이 하드 섀도 / 어두운·레드 면 위의 흰 글자(-inv): 블랙 외곽선 + 블랙 하드 섀도
  for (const k of ['sm', 'md', 'lg'] as const) {
    set(`title-shadow-${k}`, outlineTextShadow(theme.titleStroke[k]));
    set(`title-shadow-${k}-inv`, outlineTextShadow(theme.titleStroke[k], theme.colors.ink, theme.titleShadowY, theme.colors.ink));
  }
}

/**
 * 웹폰트가 준비될 때까지 기다린다. Phaser 텍스트는 폰트가 로드된 뒤에 만들어야 올바르게 그려진다.
 * 구글 폰트는 한글을 글자 범위별 조각으로 나눠 내려주므로, 화면에 쓰일 글자(extraText)를 넘겨야 그 글자가 든 조각까지 미리 받는다.
 * 안 그러면 처음 그리는 순간 일부 글자가 대체 폰트(굵기가 다름)로 나오고, 한 번 그린 Phaser 텍스트는 다시 그려지지 않는다.
 */
export async function loadThemeFonts(extraText = ''): Promise<void> {
  const text = `감컴무스메 ABC 123${extraText}`;
  try {
    await Promise.all(theme.fontFaces.map((f) => document.fonts.load(f, text)));
  } catch {
    // 오프라인 등: 대체 폰트로 진행
  }
}
