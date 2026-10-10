import Phaser from 'phaser';
import { BGM } from '../data/audio';

/** BGM이 로드되어 있으면 반복 재생한다 (이미 재생 중이면 그대로 둔다). 브라우저 자동재생 정책은 Phaser가 첫 입력 때 해제한다. */
export function playBgm(scene: Phaser.Scene) {
  if (!scene.cache.audio.exists(BGM.key)) return;
  const existing = scene.sound.get(BGM.key);
  if (existing?.isPlaying) return;
  scene.sound.play(BGM.key, { loop: true, volume: 0.6 });
}

/** BGM 재생 속도를 부드럽게 바꾼다 (라스트 스퍼트 긴박감용). BGM이 없으면 아무 일도 하지 않는다. */
export function setBgmRate(scene: Phaser.Scene, rate: number, duration = 700) {
  const sound = scene.sound.get(BGM.key) as (Phaser.Sound.BaseSound & { setRate?: (r: number) => unknown; rate?: number }) | null;
  if (!sound || !sound.setRate) return;
  const from = sound.rate ?? 1;
  const counter = { v: from };
  scene.tweens.add({ targets: counter, v: rate, duration, onUpdate: () => sound.setRate!(counter.v) });
}

/** 재생 속도를 즉시 원래대로 (경주 씬을 떠날 때). */
export function resetBgmRate(scene: Phaser.Scene) {
  const sound = scene.sound.get(BGM.key) as (Phaser.Sound.BaseSound & { setRate?: (r: number) => unknown }) | null;
  sound?.setRate?.(1);
}
