import Phaser from 'phaser';
import { SCENE_KEYS } from '../config';
import { textureKey } from '../objects/HorseView';
import { SelectOverlay } from '../ui/SelectOverlay';
import { wipeTo } from '../ui/transition';

// 선택 UI는 HTML 오버레이(SelectOverlay)가 담당하고, 씬은 연결만 한다.
export class SelectScene extends Phaser.Scene {
  private overlay: SelectOverlay | null = null;

  constructor() {
    super(SCENE_KEYS.Select);
  }

  create() {
    this.overlay = new SelectOverlay({
      hasImage: (horse) => this.textures.exists(textureKey(horse, 'stand')),
      onStart: (horses) => void wipeTo(this, SCENE_KEYS.Intro, { horses }),
      onBack: () => void wipeTo(this, SCENE_KEYS.Main),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.overlay?.destroy();
      this.overlay = null;
    });
  }
}
