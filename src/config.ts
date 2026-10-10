// 밸런스/레이아웃 상수는 모두 이곳에 모은다.

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const HORSE_TOTAL = 15; // 전체 말 수
export const HORSE_RACE_COUNT = 8; // 경주 출전 수

export const SCENE_KEYS = {
  Preload: 'PreloadScene',
  Main: 'MainScene',
  Select: 'SelectScene',
  Intro: 'IntroScene',
  Race: 'RaceScene',
} as const;

// 이미지가 없을 때 임시 도형 크기
export const PLACEHOLDER_SIZE = { w: 88, h: 52 };

// ---- 경주 레이아웃 ----
export const BG_HEIGHT = 160; // 상단 배경(하늘/산/관중석/울타리) 영역 높이. 나머지 세로 전체를 8개 레인이 채운다
export const TRACK_TOP = BG_HEIGHT;
export const FG_HEIGHT = 24; // 화면 맨 아래 전경(잔디 줄무늬) 띠 높이. 0이면 전경 없음. 트랙 레인은 이 위까지만 차지한다
export const TRACK_BOTTOM = GAME_HEIGHT - FG_HEIGHT;
export const LANE_COUNT = HORSE_RACE_COUNT;
export const LANE_HEIGHT = (TRACK_BOTTOM - TRACK_TOP) / LANE_COUNT; // 레인 평균 높이

// 원근감: 위쪽(먼) 레인은 좁고 아래쪽(가까운) 레인은 넓다. 값 = 맨 아래 레인 높이 / 맨 위 레인 높이 (1이면 균등)
export const LANE_PERSPECTIVE = 1.6;
const laneWeights = Array.from({ length: LANE_COUNT }, (_, i) => 1 + ((LANE_PERSPECTIVE - 1) * i) / (LANE_COUNT - 1));
const laneWeightSum = laneWeights.reduce((a, b) => a + b, 0);
export const LANE_HEIGHTS = laneWeights.map((w) => ((TRACK_BOTTOM - TRACK_TOP) * w) / laneWeightSum); // 레인별 높이
export const LANE_TOPS = LANE_HEIGHTS.map((_, i) => TRACK_TOP + LANE_HEIGHTS.slice(0, i).reduce((a, b) => a + b, 0)); // 레인별 윗변 y
export const LANE_SCALES = LANE_HEIGHTS.map((h) => h / LANE_HEIGHT); // 레인별 말 크기 배율(평균 레인 = 1)
export const START_X = 110; // 출발선 x
// 확대 정도: 화면 가로에 트랙 전체 길이의 이 비율만 보인다 (작을수록 더 확대된 느낌, 트랙이 길어짐)
export const RACE_VIEW_FRACTION = 0.25;
export const TRACK_LENGTH = Math.round(GAME_WIDTH / RACE_VIEW_FRACTION); // 출발선~결승선 거리(px). 화면보다 길고 가로 스크롤
export const FINISH_X = START_X + TRACK_LENGTH; // 결승선 x
export const WORLD_WIDTH = FINISH_X + 500; // 결승선 뒤 여유 포함 월드 너비
// 말 크기: 레인 높이에 대한 비율. 1보다 크면 위 레인을 살짝 덮는다
export const HORSE_LANE_FILL = 1.25;
export const HORSE_DISPLAY_SIZE = Math.round(LANE_HEIGHT * HORSE_LANE_FILL); // 말 이미지 표시 크기(정사각)
export const HORSE_SCALE = HORSE_DISPLAY_SIZE / 72; // 기존(72px) 대비 배율. 임시 도형, 튀는 높이 등에 적용
export const LANE_FOOT_PAD = 6; // 레인 바닥에서 말 발끝까지의 여백

// ---- 이동 ----
export const TARGET_RACE_SECONDS = 24.6; // 기준 속도로 트랙을 달리는 시간(초). 슬로모션/컷인이 더해져 실제 경주는 약 30초
export const BASE_SPEED = (FINISH_X - START_X) / TARGET_RACE_SECONDS; // px/s
// 목표 속도: 말마다 일정 주기로 새로 뽑고, 현재 속도가 부드럽게 따라간다(가속/감속)
export const SPEED_TARGET_VARIATION = 0.17; // 목표 속도 배율의 변동 폭(±)
export const SPEED_TARGET_INTERVAL = [1, 2] as const; // 목표 속도를 새로 뽑는 주기(초)
export const SPEED_TARGET_SMOOTH = 1.8; // 목표 속도 추종 속도(클수록 빨리 가속/감속)

// 각질(주행 성향): 경주 진행률(0~1)에 따른 속도 배율 곡선. 값 5개는 진행률 0, 25, 50, 75, 100%의 배율
export const STYLE_STRENGTH = 1.2; // 각질 효과 전체 강도(0이면 끔, 1이 기준)
export const STYLE_CURVES = {
  escape: [1.08, 1.06, 1.0, 0.94, 0.91], // 도주: 초반 강세, 후반 하락
  front: [1.05, 1.05, 1.02, 0.97, 0.95], // 선행: 초중반 강세
  stalker: [0.94, 0.97, 1.04, 1.05, 1.03], // 선입: 중반부터 상승
  closer: [0.91, 0.94, 0.98, 1.06, 1.1], // 추입: 후반 폭발
} as const;
export const STYLE_MAX_PER_RACE = 3; // 랜덤 선택 시 같은 각질 최대 마릿수

// 추격 보정: 순위가 낮을수록 가속, 선두는 감속 (약하게)
// 극단적 격차 보정: 선두-꼴찌 간격이 limit(트랙 길이 대비)을 넘을 때만, 초과분이 range에 가까워질수록 선두는 감속/꼴찌는 가속(최대 max).
// 위치를 옮기지 않고 속도만 살짝 조정하며, 기준 이하면 보정이 없다
export const GAP_ASSIST = { limit: 0.25, range: 0.1, max: 0.06 } as const;

// 추격 보정(선두는 감속, 하위권은 가속). 초중반엔 강하게 해서 한 무리로 뭉치게 하고, 라스트 스퍼트에서는 끈다
export const RUBBER_BAND = { pack: 0.07, spurt: 0 } as const; // 선두 -값 ~ 꼴찌 +값

// 라스트 스퍼트: 선두가 이 진행률에 닿으면 전체가 스퍼트 구간에 들어간다 (추격 보정 off, 속도와 변동 폭 증가)
export const LAST_SPURT_AT = 0.7;
export const SPURT_SPEED_MUL = 1.08; // 스퍼트 구간 전체 속도 배율
export const SPURT_VARIATION = 0.27; // 스퍼트 구간 목표 속도 변동 폭(±). 클수록 역전이 잦다
export const SPURT_TARGET_INTERVAL = [0.7, 1.4] as const; // 스퍼트 구간 목표 속도 갱신 주기(초)
export const BGM_SPURT_RATE = 1.08; // 스퍼트 구간 BGM 재생 속도 (1이 원래 속도)

// 선두 교체 집계 기준 (경주 중 상단 자막은 표시하지 않고, 디버그 시뮬레이션의 "1위 교체 횟수" 지표에만 쓴다)
export const LEAD_HOLD = 0.35; // 새 선두가 이 시간(초) 이상 유지돼야 "선두 교체"로 인정 (박빙 떨림 방지)
export const CAPTION_START_DELAY = 3; // 경주 시작 후 이 시간(초) 동안은 선두 교체를 집계하지 않는다
export const CAMERA_PACK_COUNT = 3; // 카메라가 따라가는 선두권 마릿수 (1~N위의 중간 지점)
// 1등 골인 장면 카메라: 선두가 결승까지 이 비율 이내로 남으면(그리고 골인한 뒤에도) 최우선으로 결승선과 선두를 함께 비춘다
export const CAMERA_FINISH_REMAINING = 0.05;
export const CAMERA_FINISH_VIEW = 0.72; // 이때 결승선을 화면의 이 위치(진행 방향 기준, 0~1)에 둔다. 선두는 그보다 앞쪽에 보인다
export const CAMERA_EDGE_MARGIN = 170; // 선두권 1위/마지막 말이 화면 가장자리에서 최소 이 거리(px) 안쪽에 있게 한다

// 디버그 시뮬레이션 (개발 서버에서 ?debug=sim 으로 접속하면 화면 없이 실행하고 콘솔에 출력)
export const SIM_RACES = 100;

// ---- 달리기 모션 ----
export const BOB_HEIGHT = 12 * HORSE_SCALE; // 통통 튀는 높이(px)
export const BOB_FREQ = 3.3; // 기준 속도에서 초당 튀는 횟수
export const TILT_DEG = 5; // 앞뒤 기울기
export const SQUASH_AMOUNT = 0.18; // 착지 찌그러짐 정도

// ---- 카메라 ----
export const CAMERA_LEAD_X = 420; // 추적 대상이 화면 왼쪽에서 떨어진 거리(px)
export const CAMERA_SMOOTH_TIME = 0.4; // 대상 전환 시 부드럽게 따라붙는 시간(초)
export const TRACK_MARK_INTERVAL = 200; // 트랙 바닥 줄무늬 한 칸 너비(스크롤 체감용). 밝고 어두운 띠가 번갈아 지나간다

// ---- 결과 연출 ----
export const FIREWORK_DURATION = 1800; // 폭죽 지속 시간(ms) 후 결과 팝업 표시
export const FIREWORK_BURST_INTERVAL = 220; // 폭죽 터지는 간격(ms)

// ---- 메인 화면 ----
export const MAIN_RUNNER_COUNT = 6; // 화면 하단 레인 수 = 레인에서 달리는 캐릭터 수 (레인마다 1마리)
export const MAIN_RUNNER_SPEED = [150, 240] as const; // 기본 속도(px/s). 아래 줄(가까운 줄)일수록 더 빠르다
export const MAIN_LANE_FILL = 1.7; // 메인 화면 하단 레인에서 말 크기 = 레인 높이 × 이 값 (위 레인은 작고 아래 레인은 크게)
export const MAIN_SPARKLE_COUNT = 40; // 배경 반짝이 동시 개수(대략)

// ---- 일반 스킬 ----
export const SKILL_START_DELAY = 2; // 경주 시작 후 첫 스킬 판정까지(초)
export const SKILL_INTERVAL = [0.7, 1.7] as const; // 스킬 판정 주기(초). 판정마다 말 1마리에게 발동
export const SKILL_BOOST = { weight: 5, duration: 1.4, speedMul: 1.8, afterimageEvery: 0.06 } as const;
export const SKILL_FALL = { weight: 3, duration: 1.3, speedMul: 0.25, fallAngle: 90 } as const;
export const SKILL_REVERSE = { weight: 2, duration: 0.7, speedMul: -0.5 } as const;
// 넘어짐/역주행처럼 한 번에 크게 뒤처지는 스킬(heavy)은 같은 말에게 연달아 걸리지 않는다. 스킬이 끝난 뒤 이 시간(초) 동안은 heavy 스킬 제외
export const SKILL_HEAVY_MIN_GAP = 7;

// ---- 필살기 ----
// 한 경주에 필살기가 발동하는 말 수의 확률 (인덱스 = 마리 수 0/1/2, 합이 1이 아니어도 비율로 계산)
export const ULTIMATE_COUNT_WEIGHTS = [0.3, 0.5, 0.2] as const;
// 선두 말이 이 진행률 구간의 랜덤 지점에 닿는 순간 필살기를 한 번만 판정한다. 벌칙 슬롯(PENALTY_AT)의 슬롯이 끝난 뒤에 판정하므로 그보다 뒤로 잡는다
export const ULTIMATE_TRIGGER = [0.63, 0.74] as const;
// 판정 시점에 남은 말 중 하위 이 비율(0.5면 8마리 중 5~8위, 7마리면 5~7위) 안에서 정해진 수만큼 랜덤으로 필살기가 발동한다 (하위권 역전)
export const ULTIMATE_BOTTOM_FRACTION = 0.5;
export const ULTIMATE_SPEED_MUL = 2.5; // 필살기 최대 속도 배율. 말별로 horses.ts에서 덮어쓸 수 있다 (기본은 모두 같은 조건)
export const ULTIMATE_DURATION = 12; // 속도 강화 지속 시간(초)
export const ULTIMATE_RAMP_TIME = 8; // 속도 배율이 1 → 최대치까지 서서히 올라가는 시간(초). 길수록 초반엔 천천히 따라붙고 뒤로 갈수록 빨라진다
export const ULTIMATE_TARGET_WIN_RATE = 70; // 목표: 필살기가 발동한 경주에서 필살기 말이 우승할 확률(%). 디버그 시뮬레이션 판정용
export const ULTIMATE_AFTERIMAGE_EVERY = 0.07; // 필살기 중 잔상 간격(초)
export const ULTIMATE_AURA_COLOR = 0xf3d27a; // 골드
export const CUTIN_DURATION = 1.6; // 컷인이 떠 있는 시간(초, 1.5~2). 화면 전환 없이 바로 나타났다 사라진다
export const CUTIN_DIM_ALPHA = 0.1; // 컷인 중 화면 어두워지는 정도 (약하게: 뒤의 경주 화면과 말 위치가 보이게)
export const CUTIN_SIZE = 640; // 인물 컷인 표시 크기(px)

// ---- 슬로모션 (1등 접전) ----
export const SLOWMO_SCALE = 0.3; // 게임 속도 배율
export const SLOWMO_REMAINING = 0.05; // 선두가 결승까지 남은 거리가 트랙의 이 비율 이내일 때
export const SLOWMO_ETA_DIFF = 0.3; // 2등과의 예상 도착 시간 차이(초) 이내일 때
export const SLOWMO_ZOOM = 1.3; // 슬로모션 카메라 줌
export const SLOWMO_FINISH_OFFSET = 150; // 슬로모션 카메라 중심이 결승선보다 앞(왼쪽)으로 떨어진 거리(px)
export const SLOWMO_ZOOM_TIME = 0.35; // 줌 인/아웃 보간 시간(초)

// ---- 레인 소개 연출 ----
export const GO_BURST_TIME = 1000; // "출발!" 연출 길이(ms) 후 경주 시작
export const INTRO_HORSE_TIME = 1000; // 말 한 마리당 소개 시간(ms)
export const INTRO_SLIDE_TIME = 300; // 등장 슬라이드 시간(ms)
export const INTRO_PORTRAIT_SCALE = 4.2; // 차렷 이미지 확대 배율

// ---- 배경 / 연출 (2.5D) ----
// 패럴랙스 계수: 0이면 화면 고정, 1이면 트랙과 같은 속도. 멀수록 작다
// 멀수록 아주 느리고 가까울수록 훨씬 빠르다. foreground는 트랙보다 빠르게 스쳐 지나가는 맨 앞 전경
export const PARALLAX = { mountains: 0.03, stands: 0.16, fence: 0.6, foreground: 1.8 } as const;
export const CLOUD_COUNT = 7;
export const CLOUD_DRIFT = [6, 18] as const; // 구름이 흘러가는 속도(px/s)
export const CLOUD_PARALLAX = 0.04;
export const SHADOW_ALPHA = 0.32; // 말 그림자 진하기
export const DUST_COUNT = 7; // 착지 한 번에 나오는 흙먼지 입자 수
export const DUST_SPEED_X = [-340, -110] as const; // 흙먼지가 뒤로 날리는 속도(px/s). 클수록 길게 날린다
export const DUST_SPEED_Y = [-70, -8] as const;
export const DUST_LIFE = [550, 1000] as const; // 흙먼지 수명(ms)
export const DUST_SCALE = { start: 0.8, end: 2.4 } as const;
export const DUST_COLOR = 0xa89f92; // 밝은 트랙 위에서 보이는 먼지색

// ---- 속도감 연출 ----
export const TRACK_METERS = 800; // 트랙 전체 길이를 몇 미터로 표시할지 (남은 거리 카운터 / 거리 표지판)
export const SIGN_EVERY_METERS = 100; // 거리 표지판 간격(m)
export const SPEEDLINE_COUNT = 28; // 화면 좌우 가장자리 속도선 개수
export const SPEEDLINE_EDGE = 0.2; // 속도선이 나타나는 좌우 가장자리 폭 (화면 너비 대비)
export const SPEEDLINE_SPEED = 1500; // 속도선이 흐르는 속도(px/s)
export const SPEEDLINE_ALPHA = 0.32; // 평상시 속도선 진하기
export const SPEEDLINE_BOOST_ALPHA = 0.75; // 부스트/필살기 중 속도선 진하기
export const BOOST_ZOOM = 0.05; // 부스트/필살기 중 추가 줌인 (1 + 값)
export const BOOST_SHAKE = 2.6; // 부스트/필살기 중 화면 흔들림 세기(px)
export const BOOST_FADE = 5; // 부스트 연출이 켜지고 꺼지는 속도(클수록 빠름)

// ---- 벌칙 슬롯 ----
export const PENALTY_CHANCE = 1; // 경주마다 벌칙 슬롯이 발동할 확률 (0~1, 100%면 매 경주)
export const PENALTY_AT = 0.6; // 선두 말이 이 진행률에 닿으면 슬롯 발동 (한 경주에 한 번)
// 벌칙 선택 확률(비율). 순서: 감컴나가 / 내가 만든 내 세상이야 / 열심히 하시잖아
export const PENALTY_WEIGHTS = [1, 1, 1] as const;
export const PENALTY_EXCLUDE_TOP_FRACTION = 0.5; // 감컴나가: 그 시점 순위 상위 이 비율(8마리면 1~4위)을 대상으로 두 번째 슬롯을 돌려 1마리 제외
export const PENALTY_SPIN_TIME = 2.4; // 벌칙 슬롯이 돌아가는 시간(초)
export const PENALTY_RESULT_TIME = 1.0; // 멈춘 벌칙 이름을 강조하는 시간(초)
export const PENALTY_PICK_SPIN_TIME = 2.2; // 감컴나가 대상 슬롯이 돌아가는 시간(초)
export const PENALTY_PICK_RESULT_TIME = 0.9; // 멈춘 말을 강조하는 시간(초). 이후 바로 탈락
export const PENALTY_EXEC_TIME = { world: 1.6, swap: 1.8 } as const; // 나머지 벌칙 실행 연출 시간(초). 감컴나가의 실행은 대상 슬롯(PICK)이다

// ---- 로딩 화면 ----
export const LOADING_MIN_TIME = 1.2; // 에셋이 금방 로드돼도 로딩 화면을 최소 이 시간(초) 동안 보여 준다
