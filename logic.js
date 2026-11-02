/* logic.js — 판정·계산 로직 (브라우저와 node 테스트가 같이 쓴다. DOM을 만지지 않는다.)
 * 브라우저: <script src="logic.js"> 뒤 window.Logic / node: tests/logic.test.mjs 가 vm으로 읽는다.
 */
(function (root) {
  /* 시드 난수 — 같은 학번이면 보기 순서가 같아 새로고침해도 헷갈리지 않는다. */
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

  /* 모드: "basic"(고려+조선 전기) / "flex"(삼국·남북국 층·전시실까지). 아래 층부터 파는 순서로 돌려준다. */
  function layersFor(mode, LAYERS) {
    return LAYERS.filter(function (l) { return mode === "flex" || !l.flexOnly; }).map(function (l) { return l.id; });
  }
  function roomsFor(mode, ROOMS) {
    return ROOMS.filter(function (r) { return mode === "flex" || !r.flexOnly; });
  }
  function artifactsOf(layerId, ARTIFACTS) {
    return ARTIFACTS.filter(function (a) { return a.layer === layerId; });
  }

  /* 이름 맞히기 보기: 층 안에서 앞 2개는 2지선다, 그다음부터 4지선다(단계 상승). 흘러든 유물은 시대 보기. */
  function nameChoices(art, indexInLayer, seedStr) {
    var n = indexInLayer < 2 ? 2 : 4;
    var ds = art.distractors.slice(0, n - 1);
    return shuffle([art.name].concat(ds), seeded(seedStr + ":" + art.id));
  }
  function eraChoices(ERAS, mode) {
    var ids = Object.keys(ERAS).filter(function (k) { return mode === "flex" || k !== "samguk" || true; });
    return ids; // 세 시대 모두 보기로 둔다(기본 모드에서도 삼국·남북국을 오답 보기로 쓴다)
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

  /* 모둠 코드: 반·기숙사를 담는다. 예) 3-5-청자단 */
  function teamCode(ban, houseName) {
    return "3-" + String(ban || "?") + "-" + String(houseName || "").replace(/\s+/g, "");
  }

  /* 서술형 글자 수(공백 제외) */
  function countChars(t) { return String(t || "").replace(/\s/g, "").length; }

  root.Logic = {
    seeded: seeded, shuffle: shuffle, layersFor: layersFor, roomsFor: roomsFor, artifactsOf: artifactsOf,
    nameChoices: nameChoices, eraChoices: eraChoices,
    checkMatch: checkMatch, checkOrder: checkOrder, checkChoice: checkChoice, checkKey: checkKey,
    vaultCode: vaultCode, digScore: digScore, fmtElapsed: fmtElapsed, teamCode: teamCode, countChars: countChars
  };
})(typeof window !== "undefined" ? window : globalThis);
