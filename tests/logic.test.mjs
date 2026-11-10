// node --test tests/  — 판정 로직과 데이터 무결성 검사 (빌드 없이 vm으로 data.js·logic.js를 읽는다)
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ctx = { window: undefined, globalThis: undefined };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(here, "..", "data.js"), "utf8") +
  "\nthis.ERAS=ERAS;this.LAYERS=LAYERS;this.ARTIFACTS=ARTIFACTS;this.ROOMS=ROOMS;this.VAULT=VAULT;this.WRITING=WRITING;this.GLOSSARY=GLOSSARY;this.TEAMS=TEAMS;this.QUIZ=QUIZ;this.BLOCKS_PER_LAYER=BLOCKS_PER_LAYER;this.DIG_ORDER=DIG_ORDER;this.SCORING=SCORING;", ctx);
vm.runInContext(fs.readFileSync(path.join(here, "..", "logic.js"), "utf8"), ctx);
const { Logic, ERAS, LAYERS, ARTIFACTS, ROOMS, VAULT, WRITING, GLOSSARY, TEAMS, QUIZ, BLOCKS_PER_LAYER, DIG_ORDER, SCORING } = ctx;

test("5판 오답 단서: 기본 전시실 퍼즐과 마지막 자물쇠는 모두 why(교과서 쪽 포함)가 있다", () => {
  const list = ROOMS.filter((r) => !r.flexOnly).flatMap((r) => r.puzzles).concat([VAULT.final]);
  assert.equal(list.length, 17);
  for (const p of list) {
    assert.ok(typeof p.why === "string" && p.why.length >= 15, p.id + " why 없음");
    if (p.id !== "V1") assert.ok(/[0-9]쪽/.test(p.why), p.id + " why에 쪽 없음");
  }
});

test("모드별 지층·전시실 수, 파는 순서", () => {
  assert.equal(Logic.layersFor("basic", LAYERS).join(), "goryeo,joseon");
  assert.equal(Logic.layersFor("flex", LAYERS).join(), "samguk,goryeo,joseon");
  assert.equal(Logic.layersFor("flex", LAYERS, "top-down").join(), "joseon,goryeo,samguk");
  assert.equal(DIG_ORDER, "top-down"); // 효니 확정 2026-11-03: 표토부터
  assert.equal(Logic.roomsFor("basic", ROOMS).length, 4);
  assert.equal(Logic.roomsFor("flex", ROOMS).length, 5);
});

test("층마다 유물 6개 + 흘러든 유물 1개, 쪽수·보기·배경·복원이 다 있다", () => {
  for (const l of LAYERS) {
    const arts = Logic.artifactsOf(l.id, ARTIFACTS);
    assert.equal(arts.filter(a => !a.intruder).length, 6, l.id);
    assert.equal(arts.filter(a => a.intruder).length, 1, l.id);
    assert.ok(l.block && l.blockName, l.id + " 블록 색");
    for (const a of arts) {
      assert.ok(/쪽/.test(a.page), a.id + " 쪽수");
      assert.ok(a.clue && !a.clue.includes(a.name), a.id + " 단서에 이름이 들어 있음");
      if (a.intruder) {
        assert.ok(ERAS[a.trueEra] && a.trueEra !== a.layer, a.id);
        assert.ok(a.eraQ && a.eraQ.options.length === 4 && a.eraQ.options[a.eraQ.answer], a.id + " eraQ 4지선다");
        assert.ok(a.eraQ.options[a.eraQ.answer].startsWith(ERAS[a.trueEra].short.split("·")[0]), a.id + " eraQ 정답이 진짜 시대로 시작");
        continue;
      }
      assert.equal(a.distractors.length, 3, a.id + " 오답 보기 3개");
      assert.equal(a.bg.options.length, 4, a.id + " 배경 보기 4개");
      assert.ok(a.bg.answer >= 0 && a.bg.answer < 4, a.id);
      assert.equal(a.repair.options.length, 3, a.id + " 복원 보기 3개");
      assert.ok(a.repair.sentence.includes("___"), a.id + " 빈칸");
      assert.ok(a.note, a.id + " 노트 한 줄");
    }
  }
});

test("블록 배치: 층 유물 7개가 10칸에 한 번씩, 나머지는 돌멩이, 시드가 같으면 같은 자리", () => {
  const ids = Logic.artifactsOf("goryeo", ARTIFACTS).map(a => a.id);
  const lay = Logic.blockLayout(ids, BLOCKS_PER_LAYER, "30501:goryeo");
  assert.equal(lay.length, BLOCKS_PER_LAYER);
  assert.equal(lay.filter(x => x === null).length, BLOCKS_PER_LAYER - ids.length);
  assert.equal(new Set(lay.filter(Boolean)).size, ids.length);
  assert.equal(lay.join(), Logic.blockLayout(ids, BLOCKS_PER_LAYER, "30501:goryeo").join());
  assert.notEqual(lay.join(), Logic.blockLayout(ids, BLOCKS_PER_LAYER, "30502:goryeo").join());
});

test("이름 보기는 층에서 먼저 캔 2개가 2지선다, 그다음 4지선다, 정답 포함, 학번이 같으면 순서 고정", () => {
  const arts = Logic.artifactsOf("goryeo", ARTIFACTS).filter(a => !a.intruder);
  assert.equal(Logic.nameChoices(arts[4], 0, "30501").length, 4); // 2026-11-10: 처음부터 4지선다
  assert.equal(Logic.nameChoices(arts[1], 1, "30501").length, 4);
  assert.equal(Logic.nameChoices(arts[0], 2, "30501").length, 4);
  const c1 = Logic.nameChoices(arts[3], 3, "30501"), c2 = Logic.nameChoices(arts[3], 3, "30501");
  assert.equal(c1.join("|"), c2.join("|"));
  assert.ok(c1.includes(arts[3].name));
});

test("성향 테스트: 4문항 × 보기 4개가 팀 하나씩, 많이 고른 순서가 지망, 동점은 시드로", () => {
  assert.equal(QUIZ.length, 4);
  assert.equal(TEAMS.map(t => t.id).join(), "붓,곡괭이,돋보기,나침반");
  for (const q of QUIZ) {
    assert.equal(q.options.length, 4);
    assert.equal(new Set(q.options.map(o => o.t)).size, 4, "보기마다 다른 팀");
    for (const o of q.options) assert.ok(TEAMS.some(t => t.id === o.t), o.t);
  }
  const allPick = QUIZ.map(q => q.options.findIndex(o => o.t === "곡괭이"));
  const r = Logic.quizRanking(allPick, QUIZ, TEAMS, "30507");
  assert.equal(r.ranking[0], "곡괭이"); assert.equal(r.ranking.length, 4); assert.equal(r.tally["곡괭이"], 4);
  const half = QUIZ.map((q, i) => q.options.findIndex(o => o.t === (i < 2 ? "붓" : "돋보기")));
  const h1 = Logic.quizRanking(half, QUIZ, TEAMS, "30501");
  assert.equal(h1.ranking.slice(0, 2).sort().join(), "돋보기,붓");
  assert.equal(h1.ranking.join(), Logic.quizRanking(half, QUIZ, TEAMS, "30501").ranking.join(), "같은 학번이면 같은 결과");
  assert.ok(new Set(QUIZ.map(q => q.options[0].t)).size > 1);
});

test("번호 목록 읽기", () => {
  assert.equal(Logic.parseNumbers("1-3, 21~22 25 3").join(), "1,2,3,21,22,25");
  assert.equal(Logic.parseNumbers("x, 0, 100").length, 0);
});

test("팀 뽑기: 인원 차이 최대 1명, 지망을 살리고, 같은 시드면 같은 결과", () => {
  const ids = TEAMS.map(t => t.id);
  for (const n of [0, 1, 7, 25, 26, 27, 28, 33]) {
    const nos = Array.from({ length: n }, (_, i) => i + 1);
    const d = Logic.drawTeams(nos, {}, TEAMS, "5반");
    const sizes = ids.map(id => d.sizes[id]);
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, n + "명 " + sizes);
    assert.equal(Object.keys(d.assign).length, n);
  }
  // 모두 1지망이 «붓»이어도 7명만 붓(균등 우선), 2지망이 고르게 흩어져 있으면 나머지는 2지망
  const nos = Array.from({ length: 28 }, (_, i) => i + 1);
  const prefs = {};
  nos.forEach((no, i) => { prefs[no] = ["붓", ids[1 + (i % 3)], ...ids.filter(x => x !== "붓" && x !== ids[1 + (i % 3)])]; });
  const d = Logic.drawTeams(nos, prefs, TEAMS, "6반");
  assert.equal(d.sizes["붓"], 7);
  assert.equal(d.first, 7); assert.equal(d.second, 21); assert.equal(d.withPref, 28);
  assert.deepEqual(d.assign, Logic.drawTeams(nos, prefs, TEAMS, "6반").assign);
  // 지망이 고르게 나뉘면 전원 1지망
  const even = {}; nos.forEach((no, i) => { even[no] = [ids[i % 4]]; });
  assert.equal(Logic.drawTeams(nos, even, TEAMS, "7반").first, 28);
  // 1지망 수가 최우선(검토 재현 사례: 8명, 가능한 1지망 최대 5명) — 무작위 지망에서도 완전 탐색 최대치와 같다
  const firsts = { 1: "나침반", 2: "붓", 3: "곡괭이", 4: "붓", 5: "나침반", 6: "붓", 7: "붓", 8: "나침반" };
  const p8 = {}; Object.keys(firsts).forEach(no => { p8[no] = [firsts[no], ...ids.filter(x => x !== firsts[no])]; });
  assert.equal(Logic.drawTeams([1, 2, 3, 4, 5, 6, 7, 8], p8, TEAMS, "s").first, 5);
  const rnd = Logic.seeded("fuzz");
  for (let k = 0; k < 60; k++) {
    const n = 8 + Math.floor(rnd() * 25), nn = Array.from({ length: n }, (_, i) => i + 1), pp = {};
    nn.forEach(no => { pp[no] = Logic.shuffle(ids, rnd); });
    const cnt = {}; ids.forEach(id => { cnt[id] = 0; }); nn.forEach(no => cnt[pp[no][0]]++);
    const base = Math.floor(n / 4), ex = n % 4;
    // 최대 1지망 수 = 큰 팀(ex개)을 어디에 두느냐에 따라 Σ min(지망 수, 정원)의 최댓값
    let best = 0;
    for (let mask = 0; mask < 16; mask++) {
      if (ids.filter((_, i) => mask >> i & 1).length !== ex) continue;
      best = Math.max(best, ids.reduce((s, id, i) => s + Math.min(cnt[id], base + (mask >> i & 1)), 0));
    }
    assert.equal(Logic.drawTeams(nn, pp, TEAMS, "f" + k).first, best, n + "명 " + k);
  }
  // 시드가 다르면 (대개) 다르게 섞인다
  assert.notDeepEqual(Logic.drawTeams(nos, {}, TEAMS, "a").assign, Logic.drawTeams(nos, {}, TEAMS, "b").assign);
});

test("순위 포인트: 동점은 같은 순위, 다음 순위 건너뜀", () => {
  const P = SCORING.RANK_POINTS;
  const r = Logic.rankPoints({ 붓: 10, 곡괭이: 10, 돋보기: 8, 나침반: 3 }, P);
  assert.deepEqual([r.붓.points, r.곡괭이.points, r.돋보기.points, r.나침반.points], [40, 40, 20, 10]);
  assert.equal(r.돋보기.rank, 3);
  const all = Logic.rankPoints({ 붓: 5, 곡괭이: 5, 돋보기: 5, 나침반: 5 }, P);
  assert.ok(Object.values(all).every(x => x.points === 40));
});

test("팀 결산: 평균 분모는 출석자 전원(미제출 0점), 결석은 뺌, 보너스", () => {
  const teams = { 1: "붓", 2: "붓", 3: "붓", 4: "곡괭이", 5: "곡괭이", 6: "돋보기", 7: "나침반" };
  const rows = { 1: { score: 20, escaped: true }, 2: { score: 10, escaped: true }, 4: { score: 18, escaped: true }, 5: { score: 12, escaped: false }, 6: { score: 9, escaped: true } };
  const res = Logic.teamResults(teams, [3, 7], rows, "escape", TEAMS, SCORING);
  assert.equal(res.붓.present, 2); assert.equal(res.붓.avg, 15); // 3번 결석 → 분모 2
  assert.equal(res.붓.bonus, 10); // 전원 제출 + 전원 탈출
  assert.equal(res.곡괭이.avg, 15); assert.equal(res.곡괭이.bonus, 5); // 탈출 못 한 사람 있음
  assert.equal(res.붓.points, 40); assert.equal(res.곡괭이.points, 40); assert.equal(res.돋보기.points, 20);
  assert.equal(res.나침반.present, 0); assert.equal(res.나침반.bonus, 0); assert.equal(res.나침반.points, 10); // 출석 0명 → 평균 0 → 4위
  const noSubmit = Logic.teamResults(teams, [7], rows, "dig", TEAMS, SCORING);
  assert.equal(noSubmit.붓.avg, 10); // 3번 출석·미제출 → 0점으로 분모에 들어감
  assert.equal(noSubmit.붓.bonus, 0);
  assert.equal(noSubmit.곡괭이.bonus, 5); // 발굴엔 전원 탈출 보너스 없음
});

test("수장고 순서: 팀마다 다르고, 개인용은 1번부터", () => {
  const rooms = Logic.roomsFor("basic", ROOMS);
  const codes = TEAMS.map((t, i) => Logic.vaultCode(rooms, Logic.vaultOrder(i, rooms.length)));
  assert.equal(new Set(codes).size, 4, codes.join());
  assert.ok(codes.every(c => c.length === 4 && c.split("").sort().join() === "8593".split("").sort().join()));
  assert.equal(Logic.vaultCode(rooms, Logic.vaultOrder(-1, rooms.length)), "8593");
  const flex = Logic.roomsFor("flex", ROOMS);
  const fcodes = TEAMS.map((t, i) => Logic.vaultCode(flex, Logic.vaultOrder(i, 5)));
  assert.equal(new Set(fcodes).size, 4);
  for (let i = 0; i < 4; i++) assert.equal(new Set(Logic.vaultOrder(i, 5)).size, 5);
});

test("방탈출 개인 점수: 담당 방 12 + 수장고 3 + 자물쇠 3 + 도움 2 = 최대 20", () => {
  const rooms = Logic.roomsFor("basic", ROOMS);
  const solved = {}, attempts = {};
  rooms[1].puzzles.forEach(p => { solved[p.id] = true; attempts[p.id] = { tries: 1, hint: false }; });
  rooms[2].puzzles.forEach(p => { solved[p.id] = true; });
  const full = Logic.escScore({ role: 1, solved, attempts, vaultCode: true, escapedAt: 1 }, rooms, SCORING);
  assert.equal(full.score, 20);
  attempts[rooms[1].puzzles[0].id] = { tries: 2, hint: false };
  attempts[rooms[1].puzzles[1].id] = { tries: 1, hint: true };
  const part = Logic.escScore({ role: 1, solved, attempts, vaultCode: false, escapedAt: 0 }, rooms, SCORING);
  assert.equal(part.role, 3 + 3 + 1 + 1); assert.equal(part.help, 2); assert.equal(part.score, 10);
  assert.equal(Logic.escScore({ role: 0, solved: {}, attempts: {} }, rooms, SCORING).score, 0);
});

test("전시실 퍼즐: 유형별 필드와 열쇠 숫자가 한 자리, 금고 번호", () => {
  for (const r of ROOMS) {
    const keys = r.puzzles.filter(p => p.type === "key");
    assert.equal(keys.length, 1, r.id + " 열쇠 퍼즐 1개");
    assert.match(String(keys[0].answer), /^\d$/, r.id + " 열쇠는 숫자 한 자리");
    for (const p of r.puzzles) {
      assert.ok(p.hint && p.q && p.page, p.id + " 문항·힌트·쪽수");
      if (p.type === "match") assert.equal(p.pairs.length, 4, p.id);
      if (p.type === "order") assert.ok(p.items.length >= 4, p.id);
      if (p.type === "choice") { assert.equal(p.options.length, 4, p.id); assert.ok(p.answer >= 0 && p.answer < 4, p.id); }
    }
  }
  assert.equal(Logic.vaultCode(Logic.roomsFor("basic", ROOMS)), "8593");
  assert.equal(Logic.vaultCode(Logic.roomsFor("flex", ROOMS)), "98593");
});

test("판정 함수", () => {
  const A1 = ROOMS.find(r => r.id === "A").puzzles[0];
  assert.equal(Logic.checkMatch(A1, { 0: 0, 1: 1, 2: 2, 3: 3 }).correct, true);
  assert.equal(Logic.checkMatch(A1, { 0: 1, 1: 0, 2: 2, 3: 3 }).ok, 2);
  const A3 = ROOMS.find(r => r.id === "A").puzzles[2];
  assert.equal(Logic.checkOrder(A3.items, A3.items.slice()).correct, true);
  assert.equal(Logic.checkOrder(A3.items, A3.items.slice().reverse()).correct, false);
  assert.equal(Logic.checkChoice({ answer: 1 }, 1).correct, true);
  assert.equal(Logic.checkKey({ answer: "8" }, " 8 ").correct, true);
  assert.equal(Logic.checkKey({ answer: "8" }, "7").correct, false);
});

test("발굴 점수 계산, 모둠 코드", () => {
  const s = Logic.digScore([
    { firstTry: true, bgCorrect: true },      // 2 + 1
    { firstTry: false, repaired: true, bgCorrect: false }, // 1
    { firstTry: false, repaired: false },     // 0
    { intruder: true, eraCorrect: true }      // 1
  ]);
  assert.equal(JSON.stringify(s), JSON.stringify({ found: 1, repaired: 1, broken: 1, bg: 1, intruder: 1, score: 5 }));
  assert.equal(Logic.fmtElapsed(125), "2분 05초");
  assert.equal(Logic.teamCode(5, "청룡"), "3-5-청룡");
  assert.equal(Logic.soloCode("30512"), "30512(개인)");
});

test("예시(placeholder)·힌트에 정답 낱말이 없다", () => {
  const answers = ARTIFACTS.map(a => a.name.replace(/[『』「」]/g, ""));
  assert.ok(!answers.some(n => WRITING.placeholder.includes(n)));
  for (const r of ROOMS) for (const p of r.puzzles) {
    if (p.type === "choice") assert.ok(!p.hint.includes(p.options[p.answer]), p.id + " 힌트에 정답");
    if (p.type === "key") assert.ok(!new RegExp("(^|[^0-9])" + p.answer + "([^0-9]|$)").test(p.hint.replace(/\d{4}/g, "")), p.id + " 힌트에 열쇠 숫자");
  }
  for (const a of ARTIFACTS) if (!a.intruder) {
    assert.ok(!a.bg.q.includes(a.bg.options[a.bg.answer]), a.id);
  }
});

test("학생 화면 문자열에 검증 라벨·옛 기숙사 이름이 없다", () => {
  const src = fs.readFileSync(path.join(here, "..", "data.js"), "utf8") + fs.readFileSync(path.join(here, "..", "app.js"), "utf8") + fs.readFileSync(path.join(here, "..", "index.html"), "utf8");
  for (const bad of ["검수", "원문 대조", "대조 전", "미확인", "[2차]", "(2차)", "확인 전", "기숙사", "청자단", "활자단", "앙부단", "사군자단"]) assert.ok(!src.includes(bad), bad);
});

test("사진·도트 그림: 사진이 있으면 출처·공공누리 1유형, 모든 유물에 고유한 32×32 도트 그림", () => {
  const px = { };
  vm.createContext(px);
  vm.runInContext(fs.readFileSync(path.join(here, "..", "pixels.js"), "utf8") + "\nthis.A=PIXEL_ART32;this.P=PIXEL_PAL32;", px);
  for (const a of ARTIFACTS) {
    if (a.photo) {
      assert.ok(a.photo.src && a.photo.src.startsWith("img/"), a.id + " 사진 경로");
      assert.ok(a.photo.credit, a.id + " 출처");
      assert.ok(/공공누리 제?1유형/.test(a.photo.license), a.id + " 라이선스");
      assert.ok(fs.existsSync(path.join(here, "..", a.photo.src)), a.id + " 파일 있음");
      assert.ok(fs.statSync(path.join(here, "..", a.photo.src)).size <= 300 * 1024, a.id + " 300KB 이하");
    }
    const rows = px.A[a.id];
    assert.ok(rows, a.id + " 도트 그림");
    assert.equal(rows.length, 32, a.id);
    for (const r of rows) { assert.equal(r.length, 32, a.id); for (const ch of r) assert.ok(ch === "." || px.P[ch], a.id + " 색 " + ch); }
  }
  const all = ARTIFACTS.map(a => px.A[a.id].join(""));
  assert.equal(new Set(all).size, ARTIFACTS.length, "유물마다 다른 그림");
});

test("팀 4개, 어휘 사전은 비어 있지 않다", () => {
  assert.equal(TEAMS.length, 4);
  assert.ok(Object.keys(GLOSSARY).length > 30);
});
