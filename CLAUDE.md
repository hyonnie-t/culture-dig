# culture-dig — 유물 발굴 → 박물관 방탈출

3학년 한국사 문화사(고려·조선 전기, 유연 모듈로 삼국·남북국) 수업용 개별 웹앱(정적 파일). 1차시 «발굴»(개인·짝)과 2차시 «박물관 방탈출»(모둠)이 한 앱에 있다.
배포: https://hyonnie-t.github.io/culture-dig/ (GitHub Pages). 저장소는 public이다. 교사용 안내는 `학교업무\2026 대영중학교\3학년 한국사\문화사 발굴·방탈출\01_교사용_안내.md`.

## 구조
- `index.html` / `style.css` / `data.js`(유물·퍼즐·기숙사·어휘, 교과서 쪽수) / `logic.js`(판정·점수, DOM 없음) / `app.js`(화면 흐름)
- `focus_guard.js`·`draft_guard.js`·`glossary.js`: history26 `snippets/` 사본(2026-11-02 기준)
- `tests/logic.test.mjs`: `node --test tests/logic.test.mjs` / `tools/export_puzzles.mjs`: 교사용 퍼즐 표(라포라포용)를 data.js에서 뽑는다
- 활동 id: `CONFIG.GAME_DIG` = `문화사_유물발굴`, `CONFIG.GAME_ESCAPE` = `문화사_박물관방탈출` (커리큘럼 한 차시, 활동 2개)
- 주소 파라미터: `?screen=dig|escape`(없으면 선택 화면), `?mode=flex`(삼국·남북국 층·전시실 추가), `?sid=&name=`, `?preview=1`

## 규칙
- 교과서(비상 역사② 이병인) 밖 사실을 넣지 않는다. 유물·퍼즐마다 `page`를 붙인다. 퍼즐을 고치면 `tools/export_puzzles.mjs`로 교사용 안내의 표도 다시 뽑는다.
- 금고 번호는 전시실 순서대로 각 방 `key` 퍼즐의 숫자를 이어 붙인 것(공통 8734, 유연 98734). 방을 더하거나 순서를 바꾸면 테스트의 기대값도 바꾼다.
- 제출은 기본 제출 경로(`gameName`·`reflection`·`choiceSummary`·`choicesJson`·`groupId`). `groupId`에 기숙사(발굴)·모둠 코드(방탈출)를 넣어 시트 조번호 열에 남긴다. 기숙사 점수는 `choicesJson.score`.
- 백엔드는 `history26_backend`. URL·ID·토큰을 새로 적지 않는다. 백엔드 변경 없음.
- 태블릿 기본(폭 3단계). 푸시는 작업 브랜치에만, `main` 병합은 효니가 한다. 수정·배포 뒤 배포 주소를 내장 브라우저로 직접 열어 확인한다.
- 미리보기(`?preview=1`)에서는 «건너뛰기»·«해결 처리» 버튼으로 활동을 안 해도 넘어간다. 학생 화면에는 그 버튼이 없다.
