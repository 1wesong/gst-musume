/// <reference types="vite/client" />

// vite.config.ts의 ui-chars 플러그인이 만드는 가상 모듈: 소스(src/)에 쓰인 모든 한글 등 비ASCII 글자
declare module 'virtual:ui-chars' {
  const chars: string;
  export default chars;
}
