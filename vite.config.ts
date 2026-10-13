import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

// src/ 아래 소스에 쓰인 비ASCII 글자(한글 등)를 모아 가상 모듈로 내보낸다.
// 구글 폰트는 한글을 조각으로 나눠 내려주므로, 게임 시작 전에 이 글자들의 조각을 미리 받아 두는 데 쓴다 (main.ts, loadThemeFonts).
function uiChars(): Plugin {
  const id = 'virtual:ui-chars';
  return {
    name: 'ui-chars',
    resolveId: (source) => (source === id ? `\0${id}` : undefined),
    load(source) {
      if (source !== `\0${id}`) return undefined;
      const chars = new Set<string>();
      const walk = (dir: URL) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
          if (entry.isDirectory()) walk(url);
          else if (/\.(ts|css)$/.test(entry.name)) for (const c of readFileSync(fileURLToPath(url), 'utf8')) if (c > '\x7f') chars.add(c);
        }
      };
      walk(new URL('./src/', import.meta.url));
      return `export default ${JSON.stringify([...chars].join(''))};`;
    },
  };
}

// 상대 경로 base: GitHub Pages 하위 경로(/repo-name/)에서도 에셋 경로가 깨지지 않는다.
export default defineConfig({
  base: './',
  plugins: [uiChars()],
});
