# culture-dig — 유물 발굴 → 박물관 방탈출

3학년 한국사 문화사(고려·조선 전기, 유연 모듈로 삼국·남북국) 수업용 개별 웹앱(정적 파일). 1차시 «발굴»(개인, 마인크래프트식 블록 캐기)과 2차시 «박물관 방탈출»(팀 협력, 스타듀밸리 결의 박물관)이 한 앱에 있다. **학생마다 개인 태블릿**(1인 1태블릿, 2026-11-03 3판) — 모둠 태블릿 돌려 쓰기 구조는 없다.
배포: https://hyonnie-t.github.io/culture-dig/ (GitHub Pages). 저장소는 public이다. 교사용 안내는 `학교업무\2026 대영중학교\3학년 한국사\문화사 발굴·방탈출\01_교사용_안내.md`, 3판 재설계안은 같은 폴더 `03_재설계안_1인1태블릿_2026-11-03.md`(2판 디자인 브리프는 `02_…`).

## 구조
- `index.html` / `style.css` / `data.js`(팀·성향 테스트·점수 기준·유물·퍼즐·사진·어휘, 교과서 쪽수) / `pixels.js`(유물마다 32×32 도트 그림) / `logic.js`(판정·점수·팀 뽑기·결산·블록 배치, DOM 없음) / `app.js`(화면 흐름)
- `fonts/NeoDunggeunmo.woff`: 도트 글꼴. `img/`: 유물 사진(공공누리 제1유형만, 300KB 이하) + `img/manifest.json`(출처·라이선스 근거)
- `focus_guard.js`·`draft_guard.js`·`glossary.js`: history26 `snippets/` 사본(2026-11-02 기준)
- `tests/logic.test.mjs`: `node --test tests/logic.test.mjs` / `tools/export_puzzles.mjs`: 교사용 표(팀·유물·사진 출처·퍼즐·팀별 수장고 번호)를 data.js에서 뽑는다 / `tools/draw_pixels.mjs`: pixels.js를 만든다 / `tools/register_lesson.mjs`: 커리큘럼 등록(이미 등록됨)
- 활동 id: `CONFIG.GAME_DIG` = `문화사_유물발굴`, `CONFIG.GAME_ESCAPE` = `문화사_박물관방탈출` (커리큘럼 한 차시, 활동 2개). `CONFIG.GAME_QUIZ` = `문화사_팀테스트`는 커리큘럼에 없는 기록용 이름(지망만 남김).
- 주소 파라미터: `?screen=dig|escape`, `?mode=flex`(삼국·남북국 층·전시실 추가), `?solo=1`(방탈출 개인용), `?sid=&name=`, `?preview=1`

## 설계(3판, 2026-11-03 효니 확정)
- 팀 = 발굴 도구 4개 🖌️붓·⛏️곡괭이·🔍돋보기·🧭나침반 발굴단(`TEAMS`). ⓑ 수능 던전 팀(성적 균형)과 **따로**다. 성향 테스트(`QUIZ` 4문항) → `Logic.quizRanking`이 1~4지망 → 자동 제출(`문화사_팀테스트`). 학생 화면에는 팀 이름이 아니라 성향(`type`: 섬세형·끈기형·탐구형·이끄는형)만 보인다.
- 팀 뽑기·결산은 **history26 교사 대시보드 «👥 모둠·팀» 탭의 «🏺 문화사 발굴단»**(`history26/js/09-dash-culture.js`, v142)이 한다. 대시보드가 게임활동_로그를 바로 읽고, 이 레포 `logic.js`를 배포 주소에서 불러 `Logic.drawTeams`(인원 차이 최대 1명, 1지망 수 최우선 — 헝가리안)·`Logic.teamResults`·`Logic.parseNumbers`를 쓴다. 확정 팀·결석 번호는 백엔드 시트 `문화사팀`(`cultureTeamsSave`·`mode=cultureTeams`, 교사 전용). **이 함수들의 이름·인자를 바꾸면 대시보드도 고친다.** 학생은 칠판을 보고 앱에서 팀을 고른다(`culture-dig:team:<학번>`, 모드와 상관없음).
- 발굴: 층마다 블록 10개(5×2) 중 7개에 유물·3개는 «돌멩이뿐». 자리는 학번+층 시드(`Logic.blockLayout`). 곡괭이 탭 3번. 이름 보기는 «그 층에서 먼저 캔 2개는 2지선다, 그다음 4지선다». 층 순서 `DIG_ORDER` = "top-down"(표토부터, 효니 확정). 개인 점수 `Logic.digScore`.
- 방탈출: 입장 때 «담당 전시실»(`esc.role`)을 고른다. 처음엔 담당 방만 열리고, 담당 방을 다 풀면 «도우러 가기»로 한 방(`esc.help`)을 더 연다. 다른 방 열쇠 숫자는 팀원에게 말로 받는다. 수장고 번호는 팀마다 전시실 순서가 다르다(`Logic.vaultOrder(teamIdx, n)` + `Logic.vaultCode(rooms, order)`; solo는 1실부터). 개인 점수 `Logic.escScore`(담당 방 퍼즐 힌트·오답 없이 3/그 밖 1 ×4 + 수장고 3 + 자물쇠 3 + 도움 2 = 20). 시간은 점수에 없다. solo·미리보기는 모든 방이 열린다.
- 팀 점수(`SCORING`, 수능 던전 재설계안 2-3과 같은 틀): 팀 평균(분모 = 출석자 전원, 미제출 0점, 결석만 뺌) → 순위 포인트 40/30/20/10(동점 같은 포인트, 다음 순위 건너뜀, `Logic.rankPoints`) + 전원 제출 +5 + 전원 탈출 +5(방탈출). 대시보드 «🏺 문화사 팀» 탭이 `Logic.teamResults`로 계산.
- 사진: `ARTIFACTS[].photo`. 공공누리 제1유형만. 사진이 없거나 블록 속 미리보기에는 `pixels.js`의 32×32 도트 그림(`PIXEL_ART32`/`PIXEL_PAL32`). 탭하면 라이트박스 + 출처 한 줄.
- 배색은 나무·석재·황동(style.css 머리 주석), 팀색 `--t-<팀>`. 도트 글꼴은 제목·블록·HUD만, 본문은 Noto Sans KR 16px 이상, 수첩은 손글씨 Gaegu.
- 움직임: Scroll-triggered(수첩 쪽·전시실 타일), Sticky(상단바·HUD — HUD에 «우리 팀 순서»대로 n실 숫자), Scroll Snap(수첩 ◀▶), 곡괭이 0.18초·등장 도트→선명 0.5초. `prefers-reduced-motion`이면 전부 끈다.

## 규칙
- 교과서(비상 역사② 이병인) 밖 사실을 넣지 않는다. 유물·퍼즐마다 `page`를 붙인다. 팀·퍼즐·사진을 고치면 `node tools/export_puzzles.mjs`로 교사용 안내 아래쪽 표를 다시 뽑는다(안내 위쪽 1~4절은 손으로 쓴 부분).
- 수장고 기본 번호는 전시실 순서대로 각 방 `key` 숫자(공통 8593, 유연 98593). 팀별 번호는 `vaultOrder`로 돌린 것. 방을 더하거나 순서를 바꾸면 테스트 기대값도 바꾼다.
- 제출은 기본 제출 경로. `groupId` = `3-반-팀`(solo는 `학번(개인)`). 대시보드는 `choicesJson.score.score`(발굴·방탈출)·`choicesJson.escaped`·`choicesJson.ranking`(테스트)을 읽는다(없으면 `choiceSummary`의 `점수 n`). 이 필드 이름을 바꾸면 대시보드도 고친다. 방탈출은 다시 낼 수 있고 대시보드는 같은 학번의 마지막 제출을 쓴다.
- 학번·이름 명단을 레포에 넣지 않는다. 백엔드는 `history26_backend`, URL·ID·토큰을 새로 적지 않는다. 이 앱이 쓰는 백엔드 경로는 기본 제출뿐(팀 저장은 대시보드가).
- 태블릿 기본(폭 3단계). 작업 브랜치 → 테스트 → 세 폭 내장 브라우저 확인 → 검토자 1회 → PR → `gh pr merge`(병합은 Claude) → 배포 주소를 내장 브라우저로 직접 확인 → 효니에게 Ctrl+F5 안내.
- 미리보기(`?preview=1`)에서는 «건너뛰기»·«이 층 전부 캐기»·«해결 처리»·«아무 팀» 버튼으로 넘어가고 저장·제출(테스트 포함)을 하지 않는다. 실제 학번으로 열면 성향 테스트가 끝나는 순간 시트에 한 줄 간다 — 시험할 때는 미리보기로.
- 학생 화면 문자열에 «기숙사»·옛 팀 이름(청자단 등)·검증 라벨을 쓰지 않는다(테스트가 잡는다).
