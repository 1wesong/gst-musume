// 밸런스 시뮬레이션 (터미널): npm run balance [횟수]
// 로직은 src/debug/raceSim.ts에 있고, 브라우저에서는 개발 서버 /?debug=sim 으로도 같은 시뮬레이션을 돌릴 수 있다.
import { readFileSync } from 'node:fs';
import { SIM_RACES } from '../src/config';
import { parseHorses } from '../src/data/horseParser';
import { setHorses } from '../src/data/horses';
import { printReport, runSimulations } from '../src/debug/raceSim';

// 말 데이터는 게임과 같은 public/data/horses.json 을 쓴다
const { horses, warnings } = parseHorses(JSON.parse(readFileSync('public/data/horses.json', 'utf8')));
for (const w of warnings) console.warn('[horses.json]', w);
setHorses(horses);

const n = Number(process.argv[2]) || SIM_RACES;
printReport(runSimulations(n));
