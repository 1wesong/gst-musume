import Phaser from 'phaser';

/** 이미지가 없을 때 쓰는 배경/효과용 임시 텍스처를 코드로 만든다. 이미 있으면 재사용. */
function canvasTexture(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): string {
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, w, h)!;
  draw(tex.getContext());
  tex.refresh();
  return key;
}

const TAU = Math.PI * 2;

/** 먼 산: 1024×128, 좌우로 이음새 없이 반복된다(주기가 폭의 약수인 사인파 합). */
export function makeMountains(scene: Phaser.Scene): string {
  return canvasTexture(scene, 'bgfb_mountains', 1024, 128, (ctx) => {
    const range = (color: string, base: number, amp: number, phase: number) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, 128);
      for (let x = 0; x <= 1024; x += 8) {
        const h =
          base +
          amp * (0.55 * Math.sin((TAU * 2 * x) / 1024 + phase) + 0.3 * Math.sin((TAU * 5 * x) / 1024 + phase * 2) + 0.15 * Math.sin((TAU * 11 * x) / 1024 + phase * 3));
        ctx.lineTo(x, 128 - h);
      }
      ctx.lineTo(1024, 128);
      ctx.closePath();
      ctx.fill();
    };
    range('#b4c8dc', 70, 45, 0.5); // 더 먼 실루엣 (옅은 푸른 회색)
    range('#98aec6', 45, 35, 2.2); // 가까운 실루엣
  });
}

/** 관중석: 256×64. 계단형 좌석 + 관중 점. */
export function makeStands(scene: Phaser.Scene): string {
  return canvasTexture(scene, 'bgfb_stands', 256, 64, (ctx) => {
    ctx.fillStyle = '#d5dbe4';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#9aa4b4';
    ctx.fillRect(0, 0, 256, 6); // 지붕 그늘
    const colors = ['#c9443f', '#d4a52a', '#4a76b8', '#f2f4f7', '#5a9a7c', '#b98a5a', '#7a8597', '#e0645f']; // 밝은 관중
    for (let row = 0; row < 5; row++) {
      const y = 14 + row * 10;
      ctx.fillStyle = row % 2 ? '#bcc4d0' : '#e6eaf0';
      ctx.fillRect(0, y + 4, 256, 6);
      for (let x = 4 + (row % 2) * 4; x < 256; x += 8) {
        ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
        ctx.fillRect(x, y - 1, 5, 6);
        ctx.fillStyle = '#f0d4b8';
        ctx.fillRect(x + 1, y - 5, 3, 3);
      }
    }
  });
}

/** 울타리: 64×32. 기둥 + 가로대 두 줄. */
export function makeFence(scene: Phaser.Scene): string {
  return canvasTexture(scene, 'bgfb_fence', 64, 32, (ctx) => {
    ctx.fillStyle = '#8fc79a';
    ctx.fillRect(0, 26, 64, 6); // 아래 풀
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 8, 64, 4);
    ctx.fillRect(0, 17, 64, 4);
    ctx.fillStyle = '#aab3c2';
    ctx.fillRect(28, 3, 8, 26); // 기둥
  });
}

/** 구름: 256×128, 겹친 원. */
export function makeCloud(scene: Phaser.Scene): string {
  return canvasTexture(scene, 'bgfb_cloud', 256, 128, (ctx) => {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const blobs: [number, number, number][] = [[70, 80, 38], [110, 62, 46], [155, 72, 42], [195, 85, 32], [120, 88, 40]];
    for (const [x, y, r] of blobs) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
  });
}

/** 흙먼지 입자: 16×16 부드러운 원. */
export function makeDust(scene: Phaser.Scene): string {
  return canvasTexture(scene, 'fx_dust', 16, 16, (ctx) => {
    const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 16);
  });
}

/** 스파크 입자: 32×32, 가늘고 날카로운 십자 빛줄기(글로우 없음). 틴트로 레드/골드/화이트를 입힌다. */
export function makeSparkle(scene: Phaser.Scene): string {
  return canvasTexture(scene, 'fx_sparkle', 32, 32, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); // 세로로 긴 날카로운 다이아몬드
    ctx.moveTo(16, 0);
    ctx.lineTo(18.5, 16);
    ctx.lineTo(16, 32);
    ctx.lineTo(13.5, 16);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath(); // 가로로는 더 짧게
    ctx.moveTo(2, 16);
    ctx.lineTo(16, 13.8);
    ctx.lineTo(30, 16);
    ctx.lineTo(16, 18.2);
    ctx.closePath();
    ctx.fill();
  });
}

/** 속도선: 256×8, 양 끝이 투명하게 사라지는 가로 줄. */
export function makeSpeedLine(scene: Phaser.Scene): string {
  return canvasTexture(scene, 'fx_speedline', 256, 8, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.lineTo(256, 0);
    ctx.lineTo(256, 8);
    ctx.closePath();
    ctx.fill();
  });
}

/** 전경: 256×32, 화면 맨 아래를 아주 빠르게 스쳐 지나가는 잔디 줄무늬 + 울타리 기둥. */
export function makeForeground(scene: Phaser.Scene): string {
  return canvasTexture(scene, 'bgfb_foreground', 256, 32, (ctx) => {
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#8fc79a' : '#7dba89';
      ctx.fillRect(i * 64, 0, 64, 32);
    }
    ctx.fillStyle = 'rgba(29,34,43,0.25)';
    ctx.fillRect(0, 0, 256, 4); // 트랙과 맞닿는 그림자
    ctx.fillStyle = '#ffffff';
    for (const x of [28, 156]) {
      ctx.fillRect(x, 6, 8, 24); // 기둥
      ctx.fillStyle = '#aab3c2';
      ctx.fillRect(x + 6, 6, 2, 24);
      ctx.fillStyle = '#ffffff';
    }
  });
}
