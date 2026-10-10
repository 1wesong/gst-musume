import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, SIM_RACES } from './config';
import { PreloadScene } from './scenes/PreloadScene';
import { MainScene } from './scenes/MainScene';
import { SelectScene } from './scenes/SelectScene';
import { IntroScene } from './scenes/IntroScene';
import { RaceScene } from './scenes/RaceScene';
import { applyThemeCss, loadThemeFonts } from './ui/theme';
import './ui/design.css';

const params = new URLSearchParams(location.search);

if (import.meta.env.DEV && params.get('debug') === 'sim') {
  // 개발용 디버그 모드: 게임 화면 없이 경주를 시뮬레이션해서 결과를 콘솔에 출력한다. 예) /?debug=sim&n=500
  const n = Number(params.get('n')) || SIM_RACES;
  document.body.innerHTML = `<pre style="color:#fff;font:16px/1.6 monospace;padding:24px">경주 시뮬레이션 ${n}회 실행 중... 결과는 브라우저 콘솔(F12)에 출력됩니다.</pre>`;
  void import('./debug/raceSim').then((m) => m.runDebugSim(n));
} else {
  applyThemeCss();

  // 웹폰트가 준비된 뒤에 게임을 시작해야 Phaser 텍스트가 올바른 폰트로 그려진다
  void loadThemeFonts().then(() => {
    new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'game',
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      backgroundColor: '#222222',
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: [PreloadScene, MainScene, SelectScene, IntroScene, RaceScene],
    });
  });
}
