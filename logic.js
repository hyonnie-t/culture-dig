/* logic.js — 판정·계산 로직 (브라우저와 node 테스트가 같이 쓴다. DOM을 만지지 않는다.)
 * 브라우저: <script src="logic.js"> 뒤 window.Logic / node: tests/logic.test.mjs 가 vm으로 읽는다.
 */
(function (root) {
  /* 시드 난수 — 같은 학번이면 보기 순서·블록 자리가 같아 새로고침해도 헷갈리지 않는다. */
  function seeded(seedStr) {
    var h = 2166136261;
    var s = String(seedStr || "seed");
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return function () { h ^= h << 13; h >>>= 0; h ^= h >>> 17; h ^= h << 5; h >>>= 0; return (h % 100000) / 100000; };
  }
  function shuffle(arr, rnd) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /* 모드: "basic"(고려+조선 전기) / "flex"(삼국·남북국 층·전시실까지).
   * order: "bottom-up"(아래 층부터, 기본) / "top-down"(표토부터 파 내려가기). 파는 순서대로 층 id를 돌려준다. */
  function layersFor(mode, LAYERS, order) {
    var ids = LAYERS.filter(function (l) { return mode === "flex" || !l.flexOnly; }).map(function (l) { return l.id; });
    return order === "top-down" ? ids.slice().reverse() : ids;
  }
  function roomsFor(mode, ROOMS) {
    return ROOMS.filter(function (r) { return mode === "flex" || !r.flexOnly; });
  }
  function artifactsOf(layerId, ARTIFACTS) {
    return ARTIFACTS.filter(function (a) { return a.layer === layerId; });
  }

  /* 블록 배치: 층의 유물 id들을 total개 블록에 흩어 놓고 나머지는 null(돌멩이뿐). 학번+층 시드라 새로고침해도 같은 자리. */
  function blockLayout(artIds, total, seedStr) {
    var cells = artIds.slice();
    while (cells.length < total) cells.push(null);
    return shuffle(cells.slice(0, total), seeded(seedStr + ":blocks"));
  }

  /* 이름 맞히기 보기: 층에서 먼저 캔 2개(흘러든 유물 제외)는 2지선다, 그다음부터 4지선다(단계 상승). foundCount = 그 층에서 이미 이름을 맞혀 본 유물 수. */
  function nameChoices(art, foundCount, seedStr) {
    var n = foundCount < 2 ? 2 : 4;
    var ds = art.distractors.slice(0, n - 1);
    return shuffle([art.name].concat(ds), seeded(seedStr + ":" + art.id));
  }

  /* 성향 테스트 → 팀. answers = 문항별로 고른 보기 인덱스. 최다 득표 팀, 동점이면 학번 번호(no)로 가른다(번호 없으면 첫 팀). */
  function assignTeam(answers, QUIZ, TEAMS, no) {
    var tally = {};
    TEAMS.forEach(function (t) { tally[t.id] = 0; });
    QUIZ.forEach(function (q, i) {
      var o = q.options[answers[i]];
      if (o && tally[o.t] != null) tally[o.t]++;
    });
    var best = -1, tied = [];
    TEAMS.forEach(function (t) {
      if (tally[t.id] > best) { best = tally[t.id]; tied = [t.id]; }
      else if (tally[t.id] === best) tied.push(t.id);
    });
    var k = Number(no) > 0 ? (Number(no) - 1) % tied.length : 0;
    return { team: tied[k], tally: tally, tied: tied };
  }

  /* 퍼즐 판정 */
  function checkMatch(puzzle, mapping) {
    // mapping: { leftIndex: rightIndex } — 오른쪽은 화면에서 섞어 보여 주므로 원본 pairs 기준 인덱스로 받는다.
    var ok = 0;
    puzzle.pairs.forEach(function (p, i) { if (mapping[i] === i) ok++; });
    return { correct: ok === puzzle.pairs.length, ok: ok, total: puzzle.pairs.length };
  }
  function checkOrder(items, arranged) {
    var ok = 0;
    items.forEach(function (it, i) { if (arranged[i] === it) ok++; });
    return { correct: ok === items.length, ok: ok, total: items.length };
  }
  function checkChoice(puzzle, idx) { return { correct: Number(idx) === puzzle.answer }; }
  function checkKey(puzzle, text) { return { correct: String(text || "").trim() === String(puzzle.answer) }; }

  function vaultCode(rooms) {
    return rooms.map(function (r) {
      var k = r.puzzles.filter(function (p) { return p.type === "key"; })[0];
      return k ? String(k.answer) : "";
    }).join("");
  }

  /* 발굴 점수: 첫 시도 정답 2점, 복원 1점, 배경 질문 정답 +1, 흘러든 유물 시대 정답 +1 */
  function digScore(results) {
    var s = { found: 0, repaired: 0, broken: 0, bg: 0, intruder: 0, score: 0 };
    results.forEach(function (r) {
      if (r.intruder) { if (r.eraCorrect) { s.intruder++; s.score += 1; } return; }
      if (r.firstTry) { s.found++; s.score += 2; }
      else if (r.repaired) { s.repaired++; s.score += 1; }
      else s.broken++;
      if (r.bgCorrect) { s.bg++; s.score += 1; }
    });
    return s;
  }

  function fmtElapsed(sec) {
    sec = Math.max(0, Math.round(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + "분 " + (s < 10 ? "0" : "") + s + "초";
  }

  /* 모둠 코드: 반·팀을 담는다. 예) 3-5-청룡. 개인(solo)은 학번에 (개인)을 붙인다. */
  function teamCode(ban, teamName) {
    return "3-" + String(ban || "?") + "-" + String(teamName || "").replace(/\s+/g, "");
  }
  function soloCode(sid) { return String(sid || "") + "(개인)"; }

  /* 서술형 글자 수(공백 제외) */
  function countChars(t) { return String(t || "").replace(/\s/g, "").length; }

  root.Logic = {
    seeded: seeded, shuffle: shuffle, layersFor: layersFor, roomsFor: roomsFor, artifactsOf: artifactsOf,
    blockLayout: blockLayout, nameChoices: nameChoices, assignTeam: assignTeam,
    checkMatch: checkMatch, checkOrder: checkOrder, checkChoice: checkChoice, checkKey: checkKey,
    vaultCode: vaultCode, digScore: digScore, fmtElapsed: fmtElapsed, teamCode: teamCode, soloCode: soloCode, countChars: countChars
  };
})(typeof window !== "undefined" ? window : globalThis);
