// 개발용 스타일 가이드 페이지 (npm run dev → /styleguide.html). 공통 디자인 시스템 컴포넌트를 한눈에 확인한다.
import Phaser from 'phaser';
import { createBanner, createButton, createCaptionBar, createPanel, createTitle, slideIn } from './ui/components';
import { addBanner, addCaptionBar, addSkewPanel, addTitle, UiButton } from './ui/phaserUi';
import uiChars from 'virtual:ui-chars';
import { applyThemeCss, loadThemeFonts, theme } from './ui/theme';
import { wipeThen } from './ui/transition';
import './ui/design.css';

applyThemeCss();

const root = document.getElementById('root')!;
const section = (title: string) => {
  const h = createTitle(title, { size: 'sm', tag: 'h2' });
  h.classList.add('sec');
  root.append(h);
  const row = document.createElement('div');
  row.className = 'row';
  root.append(row);
  return row;
};

function buildHtml() {
  root.append(createTitle('감컴무스메 디자인 시스템', { size: 'lg', tag: 'h1' }));

  section('제목 텍스트').append(createTitle('SMALL 작은 제목', { size: 'sm' }), createTitle('MEDIUM 보통 제목', { size: 'md', color: 'gold' }), createTitle('LARGE 큰 제목', { size: 'lg', color: 'red' }));

  const btns = section('버튼 (호버: 확대 / 클릭: 눌림 / 표면에 빛)');
  btns.append(
    createButton('레드 버튼 (주 행동)', { variant: 'red' }),
    createButton('스틸 버튼', { variant: 'steel' }),
    createButton('골드 버튼', { variant: 'gold' }),
    createButton('라이트 버튼 (보조)', { variant: 'light' }),
    createButton('큰 버튼', { variant: 'red', size: 'lg', display: true }),
    createButton('작은 버튼', { variant: 'light', size: 'sm' }),
    createButton('비활성', { variant: 'red', disabled: true }),
  );

  const panels = section('패널 / 배너 / 자막 바');
  const light = createPanel({ title: 'DARK PANEL' });
  light.body.append('다크 사선 패널입니다. 내용은 기울지 않습니다.');
  const glass = createPanel({ variant: 'glass', title: 'RACE INFO' });
  glass.body.append('남색 글래스 패널');
  const yellow = createPanel({ variant: 'red' });
  yellow.body.append('레드 패널');
  panels.append(light.root, glass.root, yellow.root);

  const banners = section('');
  banners.className = 'col';
  banners.append(
    slideIn(createBanner('WINNER', { size: 'md' }), 'left'),
    slideIn(createBanner('1번 레인', { variant: 'red', size: 'sm' }), 'left', 1),
    slideIn(createCaptionBar('LIVE', '선두는 3번 레인 말3! 그 뒤를 5번 레인이 바짝 쫓습니다'), 'left', 2),
  );

  const wipe = section('화면 전환 (사선 와이프)');
  wipe.append(createButton('와이프 재생', { variant: 'gold', onClick: () => void wipeThen(() => undefined) }));
}

class GuideScene extends Phaser.Scene {
  constructor() {
    super('guide');
  }

  create() {
    this.add.rectangle(450, 170, 900, 340, theme.colors.navy);
    addTitle(this, 450, 52, 'PHASER 컴포넌트', { fontSize: 44, size: 'md' });
    addSkewPanel(this, 130, 190, 200, 120, { accent: theme.colors.red });
    new UiButton(this, 360, 120, '레드 버튼', { variant: 'red', onClick: () => console.log('red') });
    new UiButton(this, 600, 120, '골드 버튼', { variant: 'gold' });
    new UiButton(this, 790, 120, '라이트', { variant: 'light', width: 160 });
    addBanner(this, 330, 215, '경주 시작!', { variant: 'red' });
    addCaptionBar(this, 500, 295, 'LIVE', '선두는 3번 레인 말3!');
  }
}

void loadThemeFonts(uiChars).then(() => {
  buildHtml();
  new Phaser.Game({ type: Phaser.AUTO, parent: 'phaser', width: 900, height: 340, backgroundColor: '#eceff3', scene: [GuideScene] });
});
