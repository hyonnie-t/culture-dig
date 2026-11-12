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
    var n = 4; // 2026-11-10: 처음 2개 2지선다를 없앰(효니 «질문이 너무 쉽다»). foundCount는 인자 호환용
    var ds = art.distractors.slice(0, n - 1);
    return shuffle([art.name].concat(ds), seeded(seedStr + ":" + art.id));
  }

  /* drawTeams·teamResults·rankPoints·parseNumbers는 history26 대시보드 «🏺 문화사 팀» 탭(js/09-dash-culture.js)이 이 파일을 불러 쓴다(v142).
   * 이름·인자를 바꾸면 대시보드도 같이 고친다. */
  /* 성향 테스트 → 1~4지망. answers = 문항별로 고른 보기 인덱스. 많이 고른 팀이 앞, 동점은 시드(학번)로 섞는다. */
  function quizRanking(answers, QUIZ, TEAMS, seedStr) {
    var tally = {};
    TEAMS.forEach(function (t) { tally[t.id] = 0; });
    QUIZ.forEach(function (q, i) {
      var o = q.options[answers[i]];
      if (o && tally[o.t] != null) tally[o.t]++;
    });
    var ids = shuffle(TEAMS.map(function (t) { return t.id; }), seeded("rank:" + seedStr));
    var ranking = ids.slice().sort(function (a, b) { return tally[b] - tally[a] || ids.indexOf(a) - ids.indexOf(b); });
    return { ranking: ranking, tally: tally };
  }

  /* «1-13, 21-34 35» → [1..13, 21..35] (정렬·중복 제거, 1~99만) */
  function parseNumbers(text) {
    var out = {};
    String(text || "").split(/[,\s]+/).forEach(function (tok) {
      var m = tok.match(/^(\d{1,2})(?:[-~–](\d{1,2}))?$/);
      if (!m) return;
      var a = Number(m[1]), b = m[2] ? Number(m[2]) : a;
      if (a > b) { var t = a; a = b; b = t; }
      for (var k = a; k <= b; k++) if (k >= 1 && k <= 99) out[k] = true;
    });
    return Object.keys(out).map(Number).sort(function (x, y) { return x - y; });
  }

  /* 헝가리안(최소 비용 배정). cost[i][j], 행 수 n ≤ 열 수 m. 행 i → 열 번호 배열을 돌려준다. */
  function hungarian(cost) {
    var n = cost.length, m = cost[0].length, INF = 1e15, i, j;
    var u = [], v = [], p = [], way = [];
    for (j = 0; j <= Math.max(n, m); j++) { u[j] = 0; v[j] = 0; p[j] = 0; way[j] = 0; }
    for (i = 1; i <= n; i++) {
      p[0] = i;
      var j0 = 0, minv = [], used = [];
      for (j = 0; j <= m; j++) { minv[j] = INF; used[j] = false; }
      do {
        used[j0] = true;
        var i0 = p[j0], delta = INF, j1 = 0;
        for (j = 1; j <= m; j++) if (!used[j]) {
          var cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
        for (j = 0; j <= m; j++) { if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta; }
        j0 = j1;
      } while (p[j0] !== 0);
      do { var jj = way[j0]; p[j0] = p[jj]; j0 = jj; } while (j0);
    }
    var res = [];
    for (j = 1; j <= m; j++) if (p[j]) res[p[j] - 1] = j - 1;
    return res;
  }

  /* 균형 팀 뽑기: nos = 번호 목록, prefs = { 번호: [1지망, 2지망, …] }(없으면 지망 없음).
   * 팀 인원 차이는 최대 1명. 그 안에서 1지망을 가장 많이 살리고, 그다음 2지망·3지망 순으로 살리는 배정(사전식), 같으면 시드로 랜덤.
   * 돌려주는 값: { assign: {번호: 팀}, sizes: {팀: 수}, first: 1지망 반영 수, second: 2지망 반영 수, withPref: 테스트 낸 수 } */
  function drawTeams(nos, prefs, TEAMS, seedStr) {
    var rnd = seeded("draw:" + seedStr);
    var ids = TEAMS.map(function (t) { return t.id; });
    var list = shuffle(nos.slice(), rnd);
    var n = list.length, k = ids.length, base = Math.floor(n / k), extra = n % k;
    var combos = [];
    (function pick(start, chosen) {
      if (chosen.length === extra) { combos.push(chosen.slice()); return; }
      for (var i = start; i < k; i++) { chosen.push(i); pick(i + 1, chosen); chosen.pop(); }
    })(0, []);
    combos = shuffle(combos, rnd);
    function rankCost(no, teamId) {
      var p = prefs && prefs[no];
      if (!p || !p.length) return 0;
      var r = p.indexOf(teamId);
      if (r === 0) return 0;
      return 100 + (r < 0 ? 3 : r); // 1지망이 아니면 크게(100): 1지망 수가 최우선, 그 안에서 2지망 > 3지망 > 4지망 (인원 40명 이하라 100이면 충분)
    }
    var best = null;
    combos.forEach(function (cb) {
      var slots = [];
      ids.forEach(function (id, ti) { var cap = base + (cb.indexOf(ti) >= 0 ? 1 : 0); for (var c = 0; c < cap; c++) slots.push(id); });
      slots = shuffle(slots, rnd);
      if (!n) { if (!best) best = { total: 0, slots: slots, res: [] }; return; }
      var cost = list.map(function (no) { return slots.map(function (id) { return rankCost(no, id); }); });
      var res = hungarian(cost);
      var total = 0; res.forEach(function (j, i) { total += cost[i][j]; });
      if (!best || total < best.total) best = { total: total, slots: slots, res: res };
    });
    var assign = {}, sizes = {}, first = 0, second = 0, withPref = 0;
    ids.forEach(function (id) { sizes[id] = 0; });
    list.forEach(function (no, i) {
      var id = best.slots[best.res[i]];
      assign[no] = id; sizes[id]++;
      var p = prefs && prefs[no];
      if (p && p.length) { withPref++; if (p[0] === id) first++; else if (p[1] === id) second++; }
    });
    return { assign: assign, sizes: sizes, first: first, second: second, withPref: withPref };
  }

  /* 순위 포인트: avgs = {팀: 평균}. 같은 평균은 같은 순위·같은 포인트, 다음 순위는 건너뛴다(40·40·20·10). */
  function rankPoints(avgs, POINTS) {
    var ids = Object.keys(avgs);
    var out = {};
    ids.forEach(function (id) {
      var better = ids.filter(function (o) { return avgs[o] > avgs[id] + 1e-9; }).length;
      out[id] = { rank: better + 1, points: POINTS[better] != null ? POINTS[better] : 0 };
    });
    return out;
  }

  /* 차시 팀 결산. teams = {번호: 팀}, absent = [결석 번호], rows = {번호: {score, escaped}}(제출한 학생만), kind = "dig"|"escape".
   * 팀 평균의 분모는 출석자 전원(미제출 0점). 결석만 뺀다. 출석자가 0명인 팀은 평균 0·보너스 없음. */
  function teamResults(teams, absent, rows, kind, TEAMS, SC) {
    var ab = {}; (absent || []).forEach(function (no) { ab[no] = true; });
    var res = {};
    TEAMS.forEach(function (t) { res[t.id] = { team: t.id, present: 0, submitted: 0, escaped: 0, sum: 0, avg: 0, bonus: 0 }; });
    Object.keys(teams).forEach(function (no) {
      var r = res[teams[no]]; if (!r || ab[no]) return;
      r.present++;
      var row = rows[no];
      if (row) { r.submitted++; r.sum += Number(row.score) || 0; if (row.escaped) r.escaped++; }
    });
    var avgs = {};
    TEAMS.forEach(function (t) {
      var r = res[t.id];
      r.avg = r.present ? Math.round(r.sum / r.present * 100) / 100 : 0;
      avgs[t.id] = r.avg;
      if (r.present && r.submitted === r.present) r.bonus += SC.BONUS_ALL_SUBMIT;
      if (kind === "escape" && r.present && r.escaped === r.present) r.bonus += SC.BONUS_ALL_ESCAPE;
    });
    var rp = rankPoints(avgs, SC.RANK_POINTS);
    TEAMS.forEach(function (t) { var r = res[t.id]; r.rank = rp[t.id].rank; r.points = rp[t.id].points; r.total = r.points + r.bonus; });
    return res;
  }

  /* 수장고 번호 순서: 팀마다 전시실 순서가 다르다(다른 팀 번호를 받아 적어도 안 열리게). 기본 순서를 팀 번호만큼 돌린다.
   * teamIdx < 0(개인용·팀 없음)이면 1→2→3…. 돌려주는 값은 전시실 인덱스 배열. */
  function vaultOrder(teamIdx, roomCount) {
    var ids = []; for (var i = 0; i < roomCount; i++) ids.push(i);
    if (teamIdx < 0) return ids;
    var base = roomCount === 5 ? [2, 0, 4, 1, 3] : [2, 0, 3, 1];
    var k = teamIdx % base.length;
    return base.slice(k).concat(base.slice(0, k));
  }

  /* 방탈출 개인 점수. esc = 진행 상태(role·solved·attempts·vaultCode·escapedAt), rooms = 이 모드의 전시실들. */
  function escScore(esc, rooms, SC) {
    var s = { role: 0, clean: 0, vault: 0, final: 0, help: 0, secret: 0, score: 0 };
    var role = rooms[esc.role];
    if (role) role.puzzles.forEach(function (p) {
      if (!esc.solved[p.id]) return;
      var a = (esc.attempts || {})[p.id] || {};
      if (!a.hint && (a.tries || 0) <= 1) { s.clean++; s.role += SC.ESC_CLEAN; } else s.role += SC.ESC_SOLVED;
    });
    // 🕵️ 비밀 진열장(2026-11-12): 담당 방 secrets — 힌트 없이, 정답 상자가 열리기 전(두 번째 시도까지) 풀면 각 ESC_SECRET
    if (role && role.secrets && SC.ESC_SECRET) role.secrets.forEach(function (p) {
      if (!esc.solved[p.id]) return;
      var a = (esc.attempts || {})[p.id] || {};
      if (!a.hint && (a.tries || 0) <= 2) s.secret += SC.ESC_SECRET;
    });
    if (esc.vaultCode) s.vault = SC.ESC_VAULT;
    if (esc.escapedAt) s.final = SC.ESC_FINAL;
    var helped = rooms.some(function (r, i) { return i !== esc.role && r.puzzles.every(function (p) { return esc.solved[p.id]; }); });
    if (helped) s.help = SC.ESC_HELP;
    s.score = s.role + s.vault + s.final + s.help + s.secret;
    return s;
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

  function vaultCode(rooms, order) { // order: 전시실 인덱스 순서(Logic.vaultOrder). 없으면 1번부터.
    var list = order ? order.map(function (i) { return rooms[i]; }) : rooms;
    return list.map(function (r) {
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

  /* 모둠 코드: 반·팀을 담는다. 예) 3-5-곡괭이. 개인(solo)은 학번에 (개인)을 붙인다. */
  function teamCode(ban, teamName) {
    return "3-" + String(ban || "?") + "-" + String(teamName || "").replace(/\s+/g, "");
  }
  function soloCode(sid) { return String(sid || "") + "(개인)"; }

  /* 서술형 글자 수(공백 제외) */
  function countChars(t) { return String(t || "").replace(/\s/g, "").length; }

  root.Logic = {
    seeded: seeded, shuffle: shuffle, layersFor: layersFor, roomsFor: roomsFor, artifactsOf: artifactsOf,
    blockLayout: blockLayout, nameChoices: nameChoices, quizRanking: quizRanking, parseNumbers: parseNumbers, drawTeams: drawTeams,
    rankPoints: rankPoints, teamResults: teamResults, vaultOrder: vaultOrder, escScore: escScore,
    checkMatch: checkMatch, checkOrder: checkOrder, checkChoice: checkChoice, checkKey: checkKey,
    vaultCode: vaultCode, digScore: digScore, fmtElapsed: fmtElapsed, teamCode: teamCode, soloCode: soloCode, countChars: countChars
  };
})(typeof window !== "undefined" ? window : globalThis);
