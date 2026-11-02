# culture-dig — 유물 발굴 → 박물관 방탈출

3학년 한국사 문화사(고려·조선 전기, 유연 모듈로 삼국·남북국) 수업용 개별 웹앱(정적 파일). 1차시 «발굴»(개인·짝, 마인크래프트식 블록 캐기)과 2차시 «박물관 방탈출»(모둠, 스타듀밸리 결의 박물관)이 한 앱에 있다.
배포: https://hyonnie-t.github.io/culture-dig/ (GitHub Pages). 저장소는 public이다. 교사용 안내는 `학교업무\2026 대영중학교\3학년 한국사\문화사 발굴·방탈출\01_교사용_안내.md`, 2판 디자인 브리프는 같은 폴더 `02_디자인수정_브리프_2026-11-03.md`.

## 구조
- `index.html` / `style.css` / `data.js`(팀·성향 테스트·유물·퍼즐·사진·도트 아이콘·어휘, 교과서 쪽수) / `logic.js`(판정·점수·팀 배정·블록 배치, DOM 없음) / `app.js`(화면 흐름)
- `fonts/NeoDunggeunmo.woff`: 도트 글꼴(nation-building과 같은 파일). `img/`: 유물 사진(공공누리 제1유형만, 300KB 이하) + `img/manifest.json`(출처·라이선스 근거)
- `focus_guard.js`·`draft_guard.js`·`glossary.js`: history26 `snippets/` 사본(2026-11-02 기준)
- `tests/logic.test.mjs`: `node --test tests/logic.test.mjs` / `tools/export_puzzles.mjs`: 교사용 표(유물·퍼즐·사진 출처)를 data.js에서 뽑는다 / `tools/register_lesson.mjs`: 커리큘럼 등록(이미 등록됨)
- 활동 id: `CONFIG.GAME_DIG` = `문화사_유물발굴`, `CONFIG.GAME_ESCAPE` = `문화사_박물관방탈출` (커리큘럼 한 차시, 활동 2개)
- 주소 파라미터: `?screen=dig|escape`(없으면 선택 화면), `?mode=flex`(삼국·남북국 층·전시실 추가), `?solo=1`(방탈출 개인용, 모둠 코드 = 학번), `?sid=&name=`, `?preview=1`

## 설계(2판, 2026-11-03)
- 팀 = 사신도 청룡·백호·주작·현무(`TEAMS`, ⓑ 수능 던전·ⓒ survive-eras와 같은 이름, 9차시 내내 유지). 첫 화면의 «발굴단 성향 테스트»(`QUIZ` 4문항, 보기 4개가 팀 하나씩)로 자동 배정 — `Logic.assignTeam`(최다 득표, 동점은 학번 번호). 팀은 모드와 상관없는 키 `culture-dig:team:<학번>`에 저장된다. 선생님이 다르게 정하면 «팀 바꾸기»로 고른다.
- 발굴: 층마다 블록 10개(5×2, `BLOCKS_PER_LAYER`) 중 7개에 유물·3개는 «돌멩이뿐». 자리는 학번+층 시드(`Logic.blockLayout`)라 새로고침해도 같고, 화면에는 안 보인다. 블록은 곡괭이 탭 3번(`CONFIG.TAPS_TO_BREAK`)에 깨진다. 이름 보기는 «그 층에서 먼저 캔 2개(흘러든 유물 제외)는 2지선다, 그다음 4지선다»(`Logic.nameChoices(art, foundCount, seed)`).
- 층 순서는 `data.js`의 `DIG_ORDER`("bottom-up" 아래 층부터 / "top-down" 표토부터). 효니 결정 전까지 bottom-up. 지층 단면은 순서와 상관없이 위(표토)→아래(옛날)로 그린다.
- 사진: `ARTIFACTS[].photo = { src, credit, license, note }`. 공공누리 제1유형(e뮤지엄·국가유산포털·국립중앙박물관)만. 확인 못 한 유물은 `PIXEL_ICONS`/`PIXEL_FOR`의 도트 아이콘(12×12)을 쓴다. 탭하면 라이트박스 + 출처 한 줄. 학교망 외부 로드를 피하려고 파일은 레포 `img/`에 둔다.
- 방탈출: 평면도(전시실 타일·수장고 문) → 전시실 안(진열장 벽 = 퍼즐 4개, 안내판 = 문항) → 수장고 문(번호판 → 마지막 자물쇠). 타이머·열쇠 숫자는 상단 HUD(Sticky). 짝 맞추기에서 쓴 설명은 «사용됨».
- 배색은 나무·석재·황동(style.css 머리 주석). 도트 글꼴은 제목·블록·HUD만, 본문은 Noto Sans KR 16px 이상, 수첩은 손글씨 Gaegu.
- 움직임: Scroll-triggered(수첩 쪽·전시실 타일), Sticky(상단바·HUD), Scroll Snap(수첩 ◀▶ «3/16»), 곡괭이 0.18초·등장 도트→선명 0.5초. `prefers-reduced-motion`이면 전부 끈다.

## 규칙
- 교과서(비상 역사② 이병인) 밖 사실을 넣지 않는다. 유물·퍼즐마다 `page`를 붙인다. 퍼즐·사진을 고치면 `node tools/export_puzzles.mjs`로 교사용 안내의 표도 다시 뽑는다.
- 금고(수장고) 번호는 전시실 순서대로 각 방 `key` 퍼즐의 숫자를 이어 붙인 것(공통 8593, 유연 98593). 방을 더하거나 순서를 바꾸면 테스트의 기대값도 바꾼다.
- 제출은 기본 제출 경로(`gameName`·`reflection`·`choiceSummary`·`choicesJson`·`groupId`). `groupId`에 팀 이름(발굴)·모둠 코드 `3-반-팀`(방탈출, solo면 `학번(개인)`)을 넣어 시트 조번호 열에 남긴다. `choicesJson.house`·`team` = 팀 이름, 팀 점수는 `choicesJson.score`. 탈출 순위는 앱이 모른다 — 교사가 대시보드 조번호 + G열 «탈출 n분»으로 집계.
- 백엔드는 `history26_backend`. URL·ID·토큰을 새로 적지 않는다. 백엔드 변경 없음.
- 태블릿 기본(폭 3단계). 작업 브랜치 → PR → 세 폭 내장 브라우저 확인 → 검토자 1회 → `gh pr merge`(효니 확정 2026-10-25: 병합은 Claude가 한다) → 배포 주소를 내장 브라우저로 직접 확인 → 효니에게 Ctrl+F5 안내.
- 미리보기(`?preview=1`)에서는 «건너뛰기»·«이 층 전부 캐기»·«해결 처리»·«아무 팀» 버튼으로 활동을 안 해도 넘어간다. 학생 화면에는 그 버튼이 없다.
- 학생 화면 문자열에 «기숙사»·옛 팀 이름(청자단 등)·검증 라벨을 쓰지 않는다(테스트가 잡는다).
