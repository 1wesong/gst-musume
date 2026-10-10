// 밸런스 시뮬레이션 (터미널): npm run balance [횟수]
// 로직은 src/debug/raceSim.ts에 있고, 브라우저에서는 개발 서버 /?debug=sim 으로도 같은 시뮬레이션을 돌릴 수 있다.
import { SIM_RACES } from '../src/config';
import { printReport, runSimulations } from '../src/debug/raceSim';

const n = Number(process.argv[2]) || SIM_RACES;
printReport(runSimulations(n));
