/* scene.js — 7판(2026-11-12) 장면형 방탈출 화면. 방 그림 위 «누를 자리»를 눌러 물건을 찾고, 조합하고, 자물쇠(=data.js 퍼즐)를 푼다.
 * 방 데이터는 scenes.js, 달라지는 값(문제 변형·숨긴 자리·번호·무늬·열쇠 숫자)은 logic.js가 학번·팀 시드로 정한다.
 * 점수·저장 키는 6판 그대로다: 퍼즐을 풀면 S.esc.solved[id], 시도는 S.esc.attempts[id]. 방 안 진행은 S.esc.sc[방 id].
 * app.js보다 먼저 불러도 된다(함수 안에서만 app.js 전역을 쓴다). */
const Scene = (function () {
  let cur = null;          // 지금 열린 퍼즐 { p0, after }
  let sel = null;          // 가방에서 고른 물건 id
  let sayTimer = null;
  let audioCtx = null;

  const room = () => roomsNow()[S.esc.roomIdx];
  const conf = () => SCENES[room().id];
  const stuSeed = () => S.sid || "t";
  const teamSeed = () => (S.solo ? "solo:" + (S.sid || "t") : String(S.ban || "0") + ":" + (S.team || "팀"));
  const puzOf = (p) => Logic.pickVariant(p, (typeof PUZZLE_ALTS !== "undefined" ? PUZZLE_ALTS : {})[p.id], stuSeed());
  const keyOf = (r) => Logic.teamKey(teamSeed(), r.id);
  const comboOf = (r) => Logic.comboCode(stuSeed() + ":" + r.id);
  function st(r) {
    if (!S.esc.sc) S.esc.sc = {};
    return S.esc.sc[r.id] || (S.esc.sc[r.id] = { lit: false, got: {}, inv: [], placed: [], combo: false, drawer: false, crate: false, sym: false, entered: false });
  }
  const layoutOf = (r) => Logic.hideLayout(stuSeed() + ":" + r.id, SCENES[r.id].hide, ["flint", "key", SCENES[r.id].mats[0]]);
  const solved = (p) => !!S.esc.solved[p.id];
  const sealCount = (r) => r.puzzles.slice(0, 3).filter(solved).length;
  const has = (s, id) => s.inv.indexOf(id) >= 0;
  function give(s, id) { if (!has(s, id)) s.inv.push(id); }
  function take(s, id) { s.inv = s.inv.filter((x) => x !== id); if (sel === id) sel = null; }
  const itemImg = (id, cls) => '<img class="' + (cls || "it-img") + '" src="img/scene/' + SCENE_ITEMS[id].img + '.jpg" alt="">';
  const josa = (w, a, b) => { const c = w.charCodeAt(w.length - 1); return (c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28) ? a : b; }; // 받침 있으면 a

  /* ── 소리(기본 꺼짐, 파일 없이 브라우저가 만드는 짧은 음) ── */
  const soundOn = () => { try { return localStorage.getItem("culture-dig:sound") === "1"; } catch (e) { return false; } };
  function sfx(kind) {
    if (!soundOn()) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const seq = { tap: [[330, 0.05]], pick: [[523, 0.07], [784, 0.1]], open: [[392, 0.08], [523, 0.08], [784, 0.16]], bad: [[196, 0.12], [156, 0.16]], light: [[294, 0.1], [440, 0.1], [587, 0.2]], bell: [[988, 0.3]] }[kind] || [[440, 0.05]];
      let t = audioCtx.currentTime;
      seq.forEach(([f, d]) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = kind === "bad" ? "sawtooth" : "triangle"; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + d + 0.02); t += d;
      });
    } catch (e) { /* 소리는 없어도 된다 */ }
  }

  /* ── 말풍선(아래 이야기 줄) ── */
  function say(txt) {
    const el = $("scSay"); if (!el) return;
    if (sayTimer) { clearInterval(sayTimer); sayTimer = null; }
    if (reduceMotion()) { el.textContent = txt; return; }
    let n = 0; el.textContent = "";
    sayTimer = setInterval(() => { n += 2; el.textContent = txt.slice(0, n); if (n >= txt.length) { clearInterval(sayTimer); sayTimer = null; } }, 24);
  }

  /* ── 열기·그리기 ── */
  function open(i) {
    S.esc.roomIdx = i; sel = null; cur = null;
    const r = room(), s = st(r);
    save(); draw(); closeModal();
    show("scrScene"); placeSay(); panTo(0);
    if (!s.entered && i !== S.esc.role) { // 35분 안에 끝나게(2026-11-12 효니): 도우러 간 방은 어둠·숨은 물건 찾기를 건너뛴다 — 등은 켜져 있고, 서랍 열쇠·첫 재료는 가방에
      s.entered = true; s.lit = true;
      conf().hide.forEach((h) => { s.got[h] = true; });
      [SCENE_ITEMS.key ? "key" : null, conf().mats[0]].forEach((id) => { if (id) give(s, id); });
      save(); draw();
      say((S.solo ? "야간 관리인이" : "먼저 온 팀원이") + " 등을 켜 두고, 서랍 열쇠와 재료 하나를 찾아 두었다. 가방을 열어 보고 바로 자물쇠로 가자.");
    } else if (!s.entered) { s.entered = true; save(); say(conf().enter); }
    else say(s.lit ? (i + 1) + "실로 돌아왔다." : conf().enter);
  }
  function badgeOf(name) {
    const r = room(), c = conf(), s = st(r), P = r.puzzles;
    if (name === "lantern") return s.lit ? "" : "";
    if (name === "case") return solved(P[0]) ? "✓" : "";
    if (name === "drawers") return solved(P[1]) ? "✓" : (s.drawer ? "…" : "");
    if (name === "crate") return solved(P[2]) ? "✓" : (s.crate ? "…" : "");
    if (name === c.station) return s.combo ? "✓" : "";
    if (name === "safe") return solved(P[3]) ? "🔑" : "";
    return "";
  }
  function secretAt(name) { // 비밀 진열장 2개는 금고를 연 뒤 항아리·깔개 자리에 열린다
    const i = S.esc.roomIdx, r = room();
    if (!secretsOpen(i) || !solved(r.puzzles[3])) return null; // 미리보기에서도 금고를 연 뒤에만
    const k = name === "jar" ? 0 : name === "rug" ? 1 : -1;
    return k >= 0 && r.secrets && r.secrets[k] ? r.secrets[k] : null;
  }
  function draw() {
    const r = room(), c = conf(), s = st(r), i = S.esc.roomIdx;
    $("scTitle").textContent = r.emoji + " " + (i + 1) + "실 · " + r.title;
    const bg = $("scBg"); if (bg.getAttribute("src") !== c.bg) bg.setAttribute("src", c.bg);
    const stage = $("scStage");
    stage.classList.toggle("dark", !s.lit); stage.classList.toggle("lit", !!s.lit);
    const L = c.spots.lantern; // 켜진 등의 불빛 자리
    stage.style.setProperty("--gx", (L[0] + L[2] / 2) + "%"); stage.style.setProperty("--gy", (L[1] + L[3] / 2) + "%");
    $("scSpots").innerHTML = Object.keys(c.spots).map((name) => {
      const b = c.spots[name], bd = badgeOf(name), sec = secretAt(name);
      const glow = sec && !solved(sec) ? " secret" : "";
      return '<button type="button" class="sc-spot' + glow + '" data-s="' + name + '" style="left:' + b[0] + '%;top:' + b[1] + '%;width:' + b[2] + '%;height:' + b[3] + '%" aria-label="' + esc(c.names[name]) + '">' +
        (bd ? '<span class="sc-badge">' + bd + '</span>' : "") + (glow ? '<span class="sc-badge sec">🕵️</span>' : "") + '</button>';
    }).join("");
    $("scSpots").querySelectorAll(".sc-spot").forEach((b) => b.addEventListener("click", (e) => { moveLight(e); onSpot(b.dataset.s, b); }));
    $("scSeal").innerHTML = "봉인 " + [0, 1, 2].map((k) => '<i class="' + (solved(r.puzzles[k]) ? "on" : "") + '"></i>').join("") + (solved(r.puzzles[3]) ? ' <b class="sc-keynum">🔑 ' + keyOf(r) + '</b>' : "");
    $("scSound").textContent = soundOn() ? "🔊" : "🔇";
    $("scSkip").hidden = !skip();
    drawInv();
    renderTop();
  }
  function drawInv() {
    const s = st(room());
    const slots = [];
    for (let k = 0; k < Math.max(5, s.inv.length); k++) {
      const id = s.inv[k];
      slots.push(id ? '<button type="button" class="sc-slot has' + (sel === id ? " sel" : "") + '" data-id="' + id + '" aria-label="' + esc(SCENE_ITEMS[id].name) + '">' + itemImg(id) + '<span>' + esc(SCENE_ITEMS[id].name) + '</span></button>' : '<span class="sc-slot"></span>');
    }
    $("scInv").innerHTML = '<span class="sc-bag">🎒</span>' + slots.join("");
    $("scInv").querySelectorAll(".sc-slot.has").forEach((b) => b.addEventListener("click", () => {
      const id = b.dataset.id;
      sel = sel === id ? null : id; sfx("tap"); drawInv();
      say(sel ? "«" + SCENE_ITEMS[id].name + "» — " + SCENE_ITEMS[id].desc + " 쓸 곳을 눌러 봐." : "물건을 내려놓았다.");
    }));
  }
  function moveLight(e) {
    const stage = $("scStage"); if (!stage || !e) return;
    const rc = stage.getBoundingClientRect(); if (!rc.width) return;
    const pt = e.touches && e.touches[0] ? e.touches[0] : e;
    if (pt.clientX == null) return;
    stage.style.setProperty("--lx", ((pt.clientX - rc.left) / rc.width * 100).toFixed(1) + "%");
    stage.style.setProperty("--ly", ((pt.clientY - rc.top) / rc.height * 100).toFixed(1) + "%");
  }
  function popAt(btn, html) { // 물건을 얻을 때 그 자리에서 떠오르는 그림
    const fx = $("scFx"); if (!fx || !btn) return;
    const d = document.createElement("span"); d.className = "sc-pop";
    d.style.left = (parseFloat(btn.style.left) + parseFloat(btn.style.width) / 2) + "%";
    d.style.top = (parseFloat(btn.style.top) + parseFloat(btn.style.height) / 2) + "%";
    d.innerHTML = html; fx.appendChild(d); setTimeout(() => d.remove(), 1300);
  }
  function gain(s, id, btn, lead) {
    give(s, id); save(); sfx("pick");
    const nm = SCENE_ITEMS[id].name;
    popAt(btn, itemImg(id, "pop-img"));
    say((lead ? lead + " " : "") + "«" + nm + "»" + josa(nm, "을", "를") + " 얻었다.");
    drawInv();
  }

  /* ── 누를 자리 ── */
  function onSpot(name, btn) {
    const r = room(), c = conf(), s = st(r), P = r.puzzles, i = S.esc.roomIdx;
    sfx("tap");
    if (name === "lantern") {
      if (s.lit) { say("등이 방을 밝히고 있다."); return; }
      if (sel === "flint") { s.lit = true; take(s, "flint"); save(); sfx("light"); draw(); say("부싯돌을 치자 불꽃이 튀었다. 등에 불이 붙고, 방이 환해졌다. 이제 방 안을 샅샅이 살펴보자."); return; }
      say(has(s, "flint") ? "가방에서 부싯돌을 고른 다음, 등을 눌러 봐." : "꺼진 등이다. 불을 붙일 것이 필요하다."); return;
    }
    if (c.hide.indexOf(name) >= 0 && !s.got[name]) {
      s.got[name] = true;
      gain(s, layoutOf(r)[name], btn, SCENE_FIND[name]); return;
    }
    if (!s.lit) { say("너무 어두워서 «" + c.names[name] + "»" + josa(c.names[name], "은", "는") + " 잘 보이지 않는다. 먼저 불을 밝혀야겠다."); return; }
    if (name === c.station) { openStation(); return; }
    if (name === "safe" || name === "wall") panTo(c.spots[name][0] + c.spots[name][2] / 2);
    if (name === "case") {
      if (solved(P[0])) { say(c.names.case + josa(c.names.case, "은", "는") + " 열려 있다. 더 나올 것은 없다."); return; }
      openPuzzle(P[0], () => gain(s, c.mats[1], btn, "딸깍. " + c.names.case + josa(c.names.case, "이", "가") + " 열렸다.")); return;
    }
    if (name === "drawers") {
      if (!s.drawer) {
        if (sel === "key" || (skip() && !has(s, "key"))) { s.drawer = true; take(s, "key"); save(); sfx("open"); draw(); }
        else { say(has(s, "key") ? "가방에서 열쇠를 고른 다음, 서랍장을 눌러 봐." : "서랍이 잠겨 있다. 작은 열쇠 구멍이 보인다."); return; }
      }
      if (solved(P[1])) { say("서랍은 비었다."); return; }
      openPuzzle(P[1], () => gain(s, c.mats[2], btn, "서랍 안쪽 칸이 열렸다.")); return;
    }
    if (name === "crate") {
      if (!s.crate) { openCode(); return; }
      if (solved(P[2])) { say(c.names.crate + josa(c.names.crate, "은", "는") + " 비었다."); return; }
      openPuzzle(P[2], () => { draw(); say("세 번째 봉인이 풀렸다. 금고에서 덜컹, 소리가 난다."); }); return;
    }
    if (name === "wall") { openWall(); return; }
    if (name === "safe") {
      if (sealCount(r) < 3) { say("금고에 봉인 세 개가 걸려 있다. 진열장·서랍·상자의 자물쇠를 모두 풀어야 움직인다. (지금 " + sealCount(r) + "/3)"); return; }
      if (!s.sym) { openSym(); return; }
      if (!solved(P[3])) { openPuzzle(P[3], () => { draw(); openKey(); }); return; }
      openKey(); return;
    }
    const sec = secretAt(name);
    if (sec) {
      if (solved(sec)) { say("비밀 칸은 이미 열었다."); return; }
      openPuzzle(sec, () => { draw(); say("비밀 칸이 열렸다!"); }); return;
    }
    say("«" + c.names[name] + "»" + josa(c.names[name], "을", "를") + " 다시 살펴봤다. 더 나오는 것이 없다.");
  }

  /* ── 모달 ── */
  function modal(html, cls) {
    const m = $("scModal"); $("scModalIn").className = "sc-modal-in " + (cls || ""); $("scModalIn").innerHTML = html; m.hidden = false;
    const x = $("scModalIn").querySelector("[data-close]"); if (x) x.addEventListener("click", closeModal);
  }
  function closeModal() { const m = $("scModal"); if (m) m.hidden = true; cur = null; }
  const closeBtn = '<button type="button" class="btn" data-close>닫기</button>';

  /* 작업대: 재료 3개를 올리고 조합 → 세 자리 번호 */
  function openStation() {
    const r = room(), c = conf(), s = st(r), code = comboOf(r);
    const codeView = r.id === "C" ? code.split("").map((d) => d + "번").join(" · ") : code;
    if (s.combo) { modal('<h3>' + esc(c.names[c.station]) + '</h3><p>' + esc(c.comboLabel) + '</p><div class="sc-code-big">' + esc(codeView) + '</div><p class="muted">이 번호는 어디에 쓸까? 번호로 잠긴 것을 찾아봐.</p>' + closeBtn); return; }
    const need = c.mats;
    const h = ['<h3>' + esc(c.names[c.station]) + '</h3><p>' + esc(c.stationLook) + '</p><div class="sc-bench">'];
    need.forEach((id) => { const on = s.placed.indexOf(id) >= 0; h.push('<span class="sc-bslot' + (on ? " on" : "") + '">' + (on ? itemImg(id) + '<small>' + esc(SCENE_ITEMS[id].name) + '</small>' : '<small>?</small>') + '</span>'); });
    h.push('</div>');
    const mine = need.filter((id) => has(s, id));
    if (mine.length) h.push('<p class="muted">가방 속 재료를 눌러 올려놓아.</p><div class="sc-bench-inv">' + mine.map((id) => '<button type="button" class="sc-slot has" data-put="' + id + '">' + itemImg(id) + '<span>' + esc(SCENE_ITEMS[id].name) + '</span></button>').join("") + '</div>');
    else if (s.placed.length < need.length) h.push('<p class="muted">재료가 더 필요하다. (' + s.placed.length + '/' + need.length + ') 방 안의 다른 자물쇠를 풀면 나올지도 몰라.</p>');
    if (s.placed.length === need.length) h.push('<button type="button" class="btn primary" id="scCombine">조합하기</button>');
    if (skip() && s.placed.length < need.length) h.push('<button type="button" class="btn ghost small" id="scSkipComb">미리보기: 바로 조합</button>');
    h.push(closeBtn);
    modal(h.join(""));
    $("scModalIn").querySelectorAll("[data-put]").forEach((b) => b.addEventListener("click", () => { const id = b.dataset.put; take(s, id); s.placed.push(id); save(); sfx("pick"); drawInv(); openStation(); }));
    const done = () => {
      s.combo = true; s.placed = need.slice(); need.forEach((id) => take(s, id)); save(); sfx(r.id === "C" ? "bell" : "open"); draw();
      modal('<h3>' + esc(c.names[c.station]) + '</h3><p class="sc-story">' + esc(c.combine) + '</p><div class="sc-code-big pop">' + esc(codeView) + '</div><p class="muted">이 번호는 어디에 쓸까? 번호로 잠긴 것을 찾아봐.</p>' + closeBtn);
      say(c.comboLabel + ": " + codeView);
    };
    const cb = $("scCombine"); if (cb) cb.addEventListener("click", done);
    const sk = $("scSkipComb"); if (sk) sk.addEventListener("click", done);
  }

  /* 상자: 세 자리 번호 */
  function openCode() {
    const r = room(), c = conf(), s = st(r);
    modal('<h3>' + esc(c.names.crate) + '</h3><p>세 자리 번호 자물쇠가 걸려 있다.</p><p><input id="scCodeIn" class="code-input" inputmode="numeric" maxlength="3" autocomplete="off" aria-label="세 자리 번호"></p><p class="err" id="scCodeErr"></p><button type="button" class="btn primary" id="scCodeBtn">열기</button> ' + closeBtn);
    const go = () => {
      const v = $("scCodeIn").value.trim();
      if (v === comboOf(r) || (skip() && !v)) { s.crate = true; save(); sfx("open"); draw(); closeModal(); say("번호가 맞았다. " + c.names.crate + josa(c.names.crate, "이", "가") + " 열렸다."); onSpot("crate"); }
      else { sfx("bad"); $("scCodeErr").textContent = s.combo ? "번호가 틀렸어. " + c.names[c.station] + "에서 나온 번호를 다시 봐." : "번호가 틀렸어. 이 번호는 방 안 어딘가에서 직접 만들어 내야 해."; shake(); }
    };
    $("scCodeBtn").addEventListener("click", go);
    $("scCodeIn").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  }
  function shake() { const el = $("scModalIn"); el.classList.add("shake"); setTimeout(() => el.classList.remove("shake"), 400); }

  /* 벽 그림: 다른 방 금고의 무늬(엇갈린 단서) */
  function openWall() {
    const rooms = roomsNow(), n = rooms.length, i = S.esc.roomIdx, c = conf();
    const j = (i - 1 + n) % n; // 이 방 벽의 무늬는 j번 방 금고를 연다(Logic.crossSource(j, n) === i)
    const syms = Logic.crossSymbols(teamSeed(), rooms[j].id, SCENE_SYMS.length, 4);
    modal('<h3>' + esc(c.names.wall) + '</h3><p>가장자리를 살짝 들추자, 뒤쪽 벽에 무늬 네 개가 차례로 그려져 있다. 그 아래 작은 글씨: <b>«' + (j + 1) + '실 금고»</b></p>' +
      '<div class="sc-syms">' + syms.map((k, o) => '<span class="sc-sym"><small>' + (o + 1) + '</small>' + SCENE_SYMS[k].ch + '<em>' + SCENE_SYMS[k].name + '</em></span>').join("") + '</div>' +
      '<p class="muted">' + (S.solo ? (j + 1) + "실 금고 앞에서 이 순서를 떠올려." : (j + 1) + "실을 맡은 친구가 이 무늬를 물어볼 거야. 순서대로 또박또박 알려 줘.") + '</p>' + closeBtn);
  }

  /* 금고 1단계: 무늬 네 개 */
  function openSym() {
    const rooms = roomsNow(), n = rooms.length, i = S.esc.roomIdx, r = room(), s = st(r);
    const src = Logic.crossSource(i, n), want = Logic.crossSymbols(teamSeed(), r.id, SCENE_SYMS.length, 4);
    let got = [];
    const paint = () => {
      modal('<h3>금고 — 무늬판</h3><p>봉인이 모두 풀리자 무늬 단추 여섯 개가 솟아올랐다. 네 개를 순서대로 눌러야 한다.</p>' +
        '<p class="muted">이 순서는 <b>' + (src + 1) + '실 벽 그림 뒤</b>에 그려져 있다고 한다. ' + (S.solo ? "직접 가서 보고 와." : (src + 1) + "실을 맡은 친구에게 물어봐.") + '</p>' +
        '<div class="sc-symline">' + [0, 1, 2, 3].map((k) => '<span class="sc-sym small">' + (got[k] != null ? SCENE_SYMS[got[k]].ch : "") + '</span>').join("") + '</div>' +
        '<div class="sc-sympad">' + SCENE_SYMS.map((y, k) => '<button type="button" class="sc-symbtn" data-k="' + k + '"' + (got.indexOf(k) >= 0 ? " disabled" : "") + '>' + y.ch + '<em>' + y.name + '</em></button>').join("") + '</div>' +
        '<p class="err" id="scSymErr"></p><button type="button" class="btn ghost small" id="scSymReset">지우기</button> ' + (skip() ? '<button type="button" class="btn ghost small" id="scSymSkip">미리보기: 통과</button> ' : "") + closeBtn);
      $("scModalIn").querySelectorAll(".sc-symbtn").forEach((b) => b.addEventListener("click", () => {
        got.push(Number(b.dataset.k)); sfx("tap");
        if (got.length < 4) { paint(); return; }
        if (got.join() === want.join()) pass();
        else { sfx("bad"); got = []; paint(); $("scSymErr").textContent = "무늬판이 덜컥, 제자리로 돌아갔다. 순서를 다시 확인해 봐."; shake(); }
      }));
      $("scSymReset").addEventListener("click", () => { got = []; paint(); });
      const sk = $("scSymSkip"); if (sk) sk.addEventListener("click", pass);
    };
    const pass = () => { s.sym = true; save(); sfx("open"); closeModal(); say("무늬가 맞았다. 금고 문에 마지막 숫자판이 드러났다."); onSpot("safe"); };
    paint();
  }

  /* 금고가 열린 뒤: 열쇠 숫자 */
  function openKey() {
    const r = room(), i = S.esc.roomIdx, k = keyOf(r), mine = i === S.esc.role;
    sfx("open");
    modal('<h3>금고가 열렸다!</h3><p class="sc-story">금고 안에 숫자를 새긴 놋쇠 패가 들어 있다.</p><div class="key-reveal pop">🔑 ' + (i + 1) + '실 열쇠 숫자: ' + esc(k) + '</div>' +
      '<p class="muted">' + (S.solo ? "수장고 문에서 이 숫자를 써." : "팀원들에게 «" + (i + 1) + "실은 " + esc(k) + "»라고 알려 줘. <b>박물관 규칙: 숫자와 함께 이 방 유물 하나를 설명해 주기.</b>") + '</p>' +
      (mine && room().secrets && room().secrets.some((p) => !solved(p)) ? '<p class="secret-open pop">🕵️ 방 어딘가에서 <b>비밀 칸 두 곳</b>이 열렸다! 반짝이는 곳을 찾아봐. 하나에 +1점(힌트 없이·정답 상자가 열리기 전에 풀면).</p>' : "") + closeBtn);
  }

  /* ── 퍼즐(자물쇠) ── 6판 renderPuzzle과 같은 판정·점수·오답 단서. 문제만 학생마다 다른 변형으로 뽑는다. */
  function openPuzzle(p0, after) { cur = { p0: p0, after: after }; drawPuzzle(); }
  function drawPuzzle() {
    if (!cur) return;
    const p = puzOf(cur.p0), after = cur.after;
    const a = S.esc.attempts[p.id] || (S.esc.attempts[p.id] = { hint: false, tries: 0 });
    const seed = stuSeed();
    const isRole = S.esc.roomIdx === S.esc.role && !p.secret;
    const typeName = p.secret ? "🕵️ 비밀 칸" : { match: "뒤섞인 명판", order: "나무패 네 개", choice: "안쪽의 쪽지", key: "마지막 숫자판" }[p.type];
    const h = ['<div class="eyebrow">🔒 ' + esc(typeName) + ' · <span class="muted">' + esc(p.page) + '</span></div>'];
    if (!p.secret) h.push('<p class="sc-lockline">' + esc(SCENE_LOCK[p.type]) + '</p>');
    h.push('<p class="sc-q">' + esc(p.q) + '</p>');
    if (p.type === "match") {
      const rights = orderOf(p.pairs.length, p.id + ":" + seed, true);
      a.map = a.map || {}; a.selLeft = null;
      const used = new Set(Object.keys(a.map).map((k) => a.map[k]));
      h.push('<div class="match-grid"><div class="match-col"><h3>유물</h3>' + p.pairs.map((pr, i) => '<button type="button" class="m-item m-left' + (a.map[i] != null ? " paired" : "") + '" data-i="' + i + '"><span class="m-tag">' + CIRC[i] + '</span>' + esc(pr[0]) + (a.map[i] != null ? ' <span class="m-tag">→ ' + KOR[rights.indexOf(a.map[i])] + '</span>' : "") + '</button>').join("") + '</div>');
      h.push('<div class="match-col"><h3>설명</h3>' + rights.map((ri, k) => '<button type="button" class="m-item m-right' + (used.has(ri) ? " used" : "") + '" data-ri="' + ri + '"><span class="m-tag">' + KOR[k] + '</span>' + esc(p.pairs[ri][1]) + (used.has(ri) ? '<span class="m-used">사용됨</span>' : "") + '</button>').join("") + '</div></div>');
      h.push('<p class="muted">왼쪽을 누르고, 맞는 설명을 눌러 짝지어. 네 쌍을 다 지으면 확인.</p><button type="button" class="btn primary" id="checkBtn">확인</button>');
    } else if (p.type === "order") {
      if (!a.arr || a.arr.slice().sort().join() !== p.items.slice().sort().join()) { a.arr = Logic.shuffle(p.items, Logic.seeded(p.id + ":" + seed)); if (a.arr.join() === p.items.join()) a.arr = a.arr.slice().reverse(); }
      h.push('<ol class="order-list">' + a.arr.map((it, i) => '<li class="order-item"><span class="o-no">' + (i + 1) + '</span><span class="o-txt">' + esc(it) + '</span><button type="button" class="o-btn" data-up="' + i + '" aria-label="위로">▲</button><button type="button" class="o-btn" data-down="' + i + '" aria-label="아래로">▼</button></li>').join("") + '</ol>');
      h.push('<p class="muted">▲▼로 순서를 바꿔. 1번이 가장 이른 것.</p><button type="button" class="btn primary" id="checkBtn">확인</button>');
    } else if (p.type === "choice") {
      const wrongs = a.wrong || [];
      h.push('<div class="choice-grid">' + orderOf(p.options.length, seed + ":" + p.id).map((i, k) => '<button type="button" class="choice' + (wrongs.includes(i) ? " wrong" : "") + '" data-i="' + i + '"' + (wrongs.includes(i) ? " disabled" : "") + '>' + CIRC[k] + ' ' + esc(p.options[i]) + '</button>').join("") + '</div>');
    } else if (p.type === "key") {
      h.push('<p><input id="keyIn" class="key-input" inputmode="numeric" maxlength="' + String(p.answer).length + '" style="width:' + (String(p.answer).length * 1.1 + 1.6) + 'em" autocomplete="off" aria-label="숫자"></p><button type="button" class="btn primary" id="checkBtn">확인</button>');
    }
    h.push('<p class="err" id="puzErr"></p>');
    h.push(revealBox(p, a, null, isRole));
    h.push('<button type="button" class="btn ghost small" id="hintBtn">💡 힌트 보기' + (isRole ? " (이 자물쇠는 1점이 돼)" : p.secret ? " (이 비밀 칸은 0점이 돼)" : "") + '</button><p class="hint-box" id="puzHint"' + (a.hint ? "" : " hidden") + '>' + esc(p.hint) + '</p>');
    if (skip()) h.push('<button type="button" class="btn ghost small" id="skipPuz">미리보기: 해결 처리</button>');
    h.push('<div style="margin-top:.6rem">' + closeBtn + '</div>');
    const keep = cur; modal(h.join(""), "puz"); cur = keep;
    const card = $("scModalIn");
    let locked = false; // 정답 뒤 0.38초 동안, 또는 빠른 두 번 누르기로 시도 횟수가 늘지 않게
    const win = () => {
      locked = true;
      S.esc.solved[p.id] = true; save(); sfx("open");
      card.classList.add("solved");
      setTimeout(() => { closeModal(); draw(); if (after) after(); }, 380);
    };
    const miss = (msg) => {
      sfx("bad"); save();
      if (needsReveal(p, a) && !card.querySelector(".reveal-box")) { drawPuzzle(); $("puzErr").textContent = msg; return; }
      $("puzErr").textContent = msg + (a.tries === 1 ? " 📖 " + p.page + "을 다시 봐." : "");
      shake(); renderTop();
    };
    $("hintBtn").addEventListener("click", () => { if (!a.hint) { a.hint = true; S.esc.hints++; save(); } $("puzHint").hidden = false; renderTop(); });
    const sp = $("skipPuz"); if (sp) sp.addEventListener("click", () => { if (!locked) win(); });
    if (p.type === "match") {
      card.querySelectorAll(".m-left").forEach((b) => b.addEventListener("click", () => { a.selLeft = Number(b.dataset.i); card.querySelectorAll(".m-left").forEach((x) => x.classList.remove("sel")); b.classList.add("sel"); }));
      card.querySelectorAll(".m-right").forEach((b) => b.addEventListener("click", () => {
        if (a.selLeft == null) { $("puzErr").textContent = "먼저 왼쪽을 눌러."; return; }
        const ri = Number(b.dataset.ri);
        Object.keys(a.map).forEach((k) => { if (a.map[k] === ri) delete a.map[k]; });
        a.map[a.selLeft] = ri; a.selLeft = null; save(); drawPuzzle();
      }));
      $("checkBtn").addEventListener("click", () => {
        if (Object.keys(a.map).length < p.pairs.length) { $("puzErr").textContent = "네 쌍을 다 지어 줘."; return; }
        if (locked) return;
        const res = Logic.checkMatch(p, a.map); a.tries++;
        if (res.correct) win(); else miss(res.ok + "/" + res.total + " 맞음. 짝을 바꿔 다시 해 봐.");
      });
    } else if (p.type === "order") {
      const swap = (x, y) => { const t = a.arr[x]; a.arr[x] = a.arr[y]; a.arr[y] = t; save(); drawPuzzle(); };
      card.querySelectorAll("[data-up]").forEach((b) => b.addEventListener("click", () => { const i = Number(b.dataset.up); if (i > 0) swap(i, i - 1); }));
      card.querySelectorAll("[data-down]").forEach((b) => b.addEventListener("click", () => { const i = Number(b.dataset.down); if (i < a.arr.length - 1) swap(i, i + 1); }));
      $("checkBtn").addEventListener("click", () => { if (locked) return; const res = Logic.checkOrder(p.items, a.arr); a.tries++; if (res.correct) win(); else miss(res.ok + "/" + res.total + " 자리가 맞아. 다시 놓아 봐."); });
    } else if (p.type === "choice") {
      card.querySelectorAll(".choice").forEach((b) => b.addEventListener("click", () => {
        if (locked) return;
        a.tries++;
        if (Logic.checkChoice(p, b.dataset.i).correct) { b.classList.add("right"); win(); }
        else { b.classList.add("wrong"); b.disabled = true; a.wrong = (a.wrong || []).concat(Number(b.dataset.i)); miss("아니야. 다시 읽어 봐."); }
      }));
    } else if (p.type === "key") {
      const go = () => { if (locked) return; a.tries++; if (Logic.checkKey(p, $("keyIn").value).correct) win(); else miss("그 숫자가 아니야."); };
      $("checkBtn").addEventListener("click", go);
      $("keyIn").addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    }
  }

  /* 폰(폭 700px 아래)에서는 이야기 줄을 그림 밖(가방 위)으로 옮긴다 — 그림을 옆으로 밀어도 글이 따라 밀리지 않게 */
  function placeSay() {
    const say = $("scSay"), stage = $("scStage"), pan = $("scPan"); if (!say || !stage || !pan) return;
    const narrow = window.matchMedia("(max-width:700px)").matches;
    if (narrow && say.parentElement === stage) pan.parentElement.insertBefore(say, pan);
    if (!narrow && say.parentElement !== stage) stage.insertBefore(say, $("scModal"));
    say.classList.toggle("flow", narrow);
  }
  /* 폰: 누른 자리가 화면 밖으로 반쯤 나가 있으면 그쪽으로 조금 밀어 준다. 방에 들어오면 등이 있는 왼쪽부터 */
  function panTo(pct) {
    const wrap = document.querySelector(".sc-stage-wrap"), stage = $("scStage"); if (!wrap || !stage) return;
    if (wrap.scrollWidth <= wrap.clientWidth + 2) return;
    const x = stage.offsetWidth * pct / 100 - wrap.clientWidth / 2;
    wrap.scrollTo({ left: Math.max(0, x), behavior: reduceMotion() ? "auto" : "smooth" });
  }

  /* ── 한 번만 거는 것들 ── */
  function init() {
    const stage = $("scStage"); if (!stage || stage.dataset.on) return; stage.dataset.on = "1";
    ["pointermove", "pointerdown", "touchmove"].forEach((ev) => stage.addEventListener(ev, moveLight, { passive: true }));
    $("scBack").addEventListener("click", () => { closeModal(); renderRooms(); show("scrRooms"); });
    $("scGlint").addEventListener("click", () => { // 살펴볼 곳: 누를 자리를 잠깐 비춘다(벌점 없음 — 태블릿에는 마우스 올리기가 없다)
      stage.classList.add("glint"); setTimeout(() => stage.classList.remove("glint"), 1800);
      say(st(room()).lit ? "눌러 볼 수 있는 곳이 잠깐 반짝인다." : "어둠 속에서 희미하게 윤곽이 보인다. 손전등을 움직이며 눌러 봐.");
    });
    $("scSound").addEventListener("click", () => { try { localStorage.setItem("culture-dig:sound", soundOn() ? "0" : "1"); } catch (e) { /* 저장 못 해도 된다 */ } $("scSound").textContent = soundOn() ? "🔊" : "🔇"; sfx("pick"); });
    $("scSkip").addEventListener("click", () => { // 미리보기: 이 방을 끝낸 상태로
      const r = room(), s = st(r);
      r.puzzles.forEach((p) => { S.esc.solved[p.id] = true; });
      s.lit = true; s.drawer = true; s.crate = true; s.sym = true; s.combo = true; s.inv = []; conf().hide.forEach((x) => { s.got[x] = true; });
      save(); draw(); say("미리보기: 이 방을 끝낸 상태로 바꿨다.");
    });
    $("scModal").addEventListener("click", (e) => { if (e.target === $("scModal")) closeModal(); });
    placeSay(); window.addEventListener("resize", placeSay);
  }

  return { open: open, init: init, keyOf: keyOf, teamSeed: teamSeed, puzOf: puzOf, sealCount: sealCount };
})();
