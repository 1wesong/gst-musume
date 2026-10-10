import { defineConfig } from 'vite';

// 상대 경로 base: GitHub Pages 하위 경로(/repo-name/)에서도 에셋 경로가 깨지지 않는다.
export default defineConfig({
  base: './',
});
