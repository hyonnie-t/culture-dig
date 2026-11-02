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
  "\nthis.ERAS=ERAS;this.LAYERS=LAYERS;this.ARTIFACTS=ARTIFACTS;this.ROOMS=ROOMS;this.VAULT=VAULT;this.WRITING=WRITING;this.GLOSSARY=GLOSSARY;this.HOUSES=HOUSES;", ctx);
vm.runInContext(fs.readFileSync(path.join(here, "..", "logic.js"), "utf8"), ctx);
const { Logic, ERAS, LAYERS, ARTIFACTS, ROOMS, VAULT, WRITING, GLOSSARY, HOUSES } = ctx;

test("모드별 지층·전시실 수", () => {
  assert.equal(Logic.layersFor("basic", LAYERS).join(), "goryeo,joseon");
  assert.equal(Logic.layersFor("flex", LAYERS).join(), "samguk,goryeo,joseon");
  assert.equal(Logic.roomsFor("basic", ROOMS).length, 4);
  assert.equal(Logic.roomsFor("flex", ROOMS).length, 5);
});

test("층마다 유물 6개 + 흘러든 유물 1개, 쪽수·보기·배경·복원이 다 있다", () => {
  for (const l of LAYERS) {
    const arts = Logic.artifactsOf(l.id, ARTIFACTS);
    assert.equal(arts.filter(a => !a.intruder).length, 6, l.id);
    assert.equal(arts.filter(a => a.intruder).length, 1, l.id);
    for (const a of arts) {
      assert.ok(/쪽/.test(a.page), a.id + " 쪽수");
      assert.ok(a.clue && !a.clue.includes(a.name), a.id + " 단서에 이름이 들어 있음");
      if (a.intruder) { assert.ok(ERAS[a.trueEra] && a.trueEra !== a.layer, a.id); continue; }
      assert.equal(a.distractors.length, 3, a.id + " 오답 보기 3개");
      assert.equal(a.bg.options.length, 4, a.id + " 배경 보기 4개");
      assert.ok(a.bg.answer >= 0 && a.bg.answer < 4, a.id);
      assert.equal(a.repair.options.length, 3, a.id + " 복원 보기 3개");
      assert.ok(a.repair.sentence.includes("___"), a.id + " 빈칸");
      assert.ok(a.note, a.id + " 노트 한 줄");
    }
  }
});

test("이름 보기는 앞 2개 2지선다, 뒤는 4지선다, 정답 포함, 학번이 같으면 순서 고정", () => {
  const arts = Logic.artifactsOf("goryeo", ARTIFACTS).filter(a => !a.intruder);
  assert.equal(Logic.nameChoices(arts[0], 0, "30501").length, 2);
  assert.equal(Logic.nameChoices(arts[1], 1, "30501").length, 2);
  assert.equal(Logic.nameChoices(arts[2], 2, "30501").length, 4);
  const c1 = Logic.nameChoices(arts[3], 3, "30501"), c2 = Logic.nameChoices(arts[3], 3, "30501");
  assert.equal(c1.join("|"), c2.join("|"));
  assert.ok(c1.includes(arts[3].name));
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
  assert.equal(Logic.vaultCode(Logic.roomsFor("basic", ROOMS)), "8734");
  assert.equal(Logic.vaultCode(Logic.roomsFor("flex", ROOMS)), "98734");
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

test("발굴 점수 계산", () => {
  const s = Logic.digScore([
    { firstTry: true, bgCorrect: true },      // 2 + 1
    { firstTry: false, repaired: true, bgCorrect: false }, // 1
    { firstTry: false, repaired: false },     // 0
    { intruder: true, eraCorrect: true }      // 1
  ]);
  assert.equal(JSON.stringify(s), JSON.stringify({ found: 1, repaired: 1, broken: 1, bg: 1, intruder: 1, score: 5 }));
  assert.equal(Logic.fmtElapsed(125), "2분 05초");
  assert.equal(Logic.teamCode(5, "청자단"), "3-5-청자단");
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

test("학생 화면 문자열에 검증 라벨이 없다", () => {
  const src = fs.readFileSync(path.join(here, "..", "data.js"), "utf8") + fs.readFileSync(path.join(here, "..", "app.js"), "utf8") + fs.readFileSync(path.join(here, "..", "index.html"), "utf8");
  for (const bad of ["검수", "원문 대조", "대조 전", "미확인", "[2차]", "(2차)", "확인 전"]) assert.ok(!src.includes(bad), bad);
});

test("기숙사 4개, 어휘 사전은 비어 있지 않다", () => {
  assert.equal(HOUSES.length, 4);
  assert.ok(Object.keys(GLOSSARY).length > 30);
});
