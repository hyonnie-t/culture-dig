/* app.js — 화면 흐름. 데이터는 data.js, 판정은 logic.js.
 * 규칙(webapp-rules): 함수 선언을 먼저 끝내고 init()은 파일 맨 끝에서 부른다(TDZ). FocusGuard·DraftGuard는 학번이 확정되는 지점에서.
 * 제출: 기본 제출 경로(gameName·studentId·studentName·reflection·choiceSummary·choicesJson·groupId). 백엔드 URL은 history26 스킬 문서와 grep으로 대조했다.
 * 2026-11-03 2판: 팀 배정 성향 테스트 / 블록 캐기 발굴 / 수첩(Scroll Snap) / 평면도·진열장·수장고 / 사진 라이트박스 / ?solo=1
 */
const CONFIG = {
  SHEET_WEBAPP_URL: "https://script.google.com/macros/s/AKfycbyXSjCfWY_HiZFqW_OBR-FQDoIfF1z_STqyKWUI31MacHeY3u7hbirFSFDvW-5yuUHaJQ/exec",
  GAME_DIG: "문화사_유물발굴",        // 커리큘럼 활동 id와 글자까지 같게
  GAME_ESCAPE: "문화사_박물관방탈출",
  HINT_PENALTY_SEC: 60,
  WRONG_PENALTY_SEC: 20, // 4지선다·열쇠 숫자 오답 1회마다(찍기 방지)
  TAPS_TO_BREAK: 3       // 블록을 깨는 데 드는 곡괭이 탭 수
};

const S = {
  sid: "", name: "", grade: 0, ban: 0, no: 0, preview: false, solo: false,
  mode: "basic", screen: "", team: null, quiz: null, after: "",
  dig: null, esc: null, sending: false
};
let timerHandle = null;

const $ = (id) => document.getElementById(id);
const skip = () => S.preview; // 미리보기: 필수 활동을 안 해도 넘어간다
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CIRC = ["①", "②", "③", "④", "⑤"], KOR = ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ"];
const teamOf = (id) => TEAMS.find((t) => t.id === id) || null;
const artById = (id) => ARTIFACTS.find((a) => a.id === id);

/* ───────── 저장(새로고침 대비) ─────────
 * 팀은 모드(flex)와 상관없는 키에 둔다(모드를 바꿔도 팀은 그대로). 진행(dig·esc)은 모드별. */
function storeKey(kind) { return "culture-dig:" + kind + ":" + S.mode + ":" + S.sid; }
function teamKey() { return "culture-dig:team:" + S.sid; }
function save() {
  if (S.preview || !S.sid) return;
  try {
    localStorage.setItem(teamKey(), JSON.stringify({ team: S.team, quiz: S.quiz }));
    localStorage.setItem(storeKey("dig"), JSON.stringify({ dig: S.dig }));
    localStorage.setItem(storeKey("esc"), JSON.stringify({ esc: S.esc }));
  } catch (e) { /* 저장소 막힘 — 무시 */ }
}
function load() {
  if (S.preview || !S.sid) return;
  try {
    const t = JSON.parse(localStorage.getItem(teamKey()) || "null");
    if (t && t.team && teamOf(t.team)) { S.team = t.team; S.quiz = t.quiz || null; }
    const d = JSON.parse(localStorage.getItem(storeKey("dig")) || "null");
    if (d && d.dig && d.dig.mode === S.mode && d.dig.blocks) S.dig = d.dig; // 1판(블록 없음) 저장본은 버린다
    const e = JSON.parse(localStorage.getItem(storeKey("esc")) || "null");
    if (e && e.esc && e.esc.mode === S.mode) S.esc = e.esc;
  } catch (e) { /* 무시 */ }
}

/* 보기 순서 섞기: 학번(또는 모둠)+문항 id 시드라 새로고침해도 같다. 돌려주는 값은 원본 인덱스 배열. */
function orderOf(len, seedStr, avoidIdentity) {
  const idx = []; for (let i = 0; i < len; i++) idx.push(i);
  let out = Logic.shuffle(idx, Logic.seeded(seedStr));
  if (avoidIdentity && len > 1 && out.every((v, i) => v === i)) out = out.slice().reverse(); // 짝 맞추기만: 항등 배열이면 뒤집는다(보기 섞기에는 안 씀 — 정답 위치가 쏠린다)
  return out;
}

/* ───────── 화면 전환 ───────── */
function show(id) {
  document.querySelectorAll(".scr").forEach((s) => { s.hidden = s.id !== id; });
  S.screen = id;
  window.scrollTo({ top: 0 });
  renderTop();
}
function renderTop() {
  const t = $("topStat");
  const tm = teamOf(S.team);
  const parts = [];
  if (tm) parts.push(tm.emoji + " <b>" + esc(tm.id) + "</b>");
  if (S.screen === "scrDig" && S.dig) {
    const sc = Logic.digScore(S.dig.results);
    parts.push("점수 <b>" + sc.score + "</b>");
  }
  if (S.name) parts.push(esc(S.name));
  t.innerHTML = parts.join(" · ");
  const inEsc = (S.screen === "scrRooms" || S.screen === "scrPuzzle" || S.screen === "scrVault") && S.esc && S.esc.start;
  $("escHud").hidden = !inEsc;
  if (inEsc) renderHud();
}
function renderHud() {
  $("hudTimer").textContent = Logic.fmtElapsed(elapsedSec());
  const rooms = roomsNow();
  $("hudKeys").innerHTML = "🔑 " + rooms.map((r) => roomDone(r) ? '<span class="k-got">' + roomKey(r) + "</span>" : '<span class="k-no">_</span>').join("");
}

/* Scroll-triggered: 보이는 순간 한 번 떠오름 */
function reveal(container) {
  const items = container.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) { items.forEach((el) => el.classList.add("show")); return; }
  const io = new IntersectionObserver((ents) => {
    ents.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("show"); io.unobserve(en.target); } });
  }, { threshold: 0.1 });
  items.forEach((el, i) => { el.style.transitionDelay = (i * 0.05) + "s"; io.observe(el); });
}

/* ───────── 유물 그림: 사진(공공누리 1유형) 또는 도트 아이콘 ───────── */
function pixelSvg(id) {
  const rows = PIXEL_ICONS[PIXEL_FOR[id] || "vase"];
  const rects = [];
  rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const ch = row[x]; if (ch !== "." && PIXEL_PALETTE[ch]) rects.push('<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + PIXEL_PALETTE[ch] + '"/>'); } });
  return '<svg viewBox="0 0 12 12" shape-rendering="crispEdges" role="img" aria-label="도트 그림">' + rects.join("") + "</svg>";
}
function artVisual(a) {
  if (a.photo && a.photo.src) return '<img src="' + esc(a.photo.src) + '" alt="' + esc(a.name) + '" loading="lazy">';
  return pixelSvg(a.id);
}
function creditText(a) {
  if (a.photo && a.photo.src) return "사진: " + a.photo.credit + " · " + a.photo.source + " · " + a.photo.license + (a.photo.note ? " · " + a.photo.note : "");
  return "그림: 직접 그린 도트 아이콘";
}
function bindZoom(el, a) {
  if (!el || !a.photo || !a.photo.src) return;
  el.addEventListener("click", () => openLightbox(a.photo.src, a.name + " (" + a.page + ") — " + creditText(a)));
}
function openLightbox(src, cap) {
  $("lbImg").src = src; $("lbImg").alt = cap; $("lbCap").textContent = cap;
  $("lightbox").hidden = false;
}
function closeLightbox() { $("lightbox").hidden = true; $("lbImg").src = ""; }

/* ───────── 첫 화면 ───────── */
function renderHome() {
  const box = $("teamBox");
  const tm = teamOf(S.team);
  if (tm) {
    box.innerHTML = '<div class="team-badge" data-team="' + esc(tm.id) + '"><span class="tb-emoji">' + tm.emoji + '</span><div><div class="tb-name">' + esc(tm.id) + '</div><div class="tb-sub">' + esc(tm.dir) + ' · ' + esc(tm.trait) + '</div></div></div>' +
      '<div class="team-actions"><button type="button" class="btn ghost small" id="teamChange">팀 바꾸기 (선생님이 정해 줬을 때)</button></div><div id="teamPick" hidden></div>';
    $("teamChange").addEventListener("click", () => { const p = $("teamPick"); p.hidden = !p.hidden; if (!p.hidden) renderTeamPick(p); });
  } else {
    box.innerHTML = '<p>짧은 성향 테스트 4문항으로 팀이 정해져. 팀은 사신도의 네 신(청룡·백호·주작·현무, 교과서 40~41쪽)이고, 다음 수업들에서도 같은 팀이야.</p>' +
      '<button type="button" class="btn primary" id="quizStart">🧭 발굴단 성향 테스트 시작</button>' +
      (skip() ? ' <button type="button" class="btn ghost small" id="quizSkip">미리보기: 아무 팀</button>' : "");
    $("quizStart").addEventListener("click", () => { S.after = ""; startQuiz(); });
    const qs = $("quizSkip"); if (qs) qs.addEventListener("click", () => { S.team = TEAMS[0].id; renderHome(); renderTop(); });
  }
  const ready = !!S.team || skip();
  $("goDig").disabled = !ready;
  $("goEscape").disabled = !ready;
  $("goDig").querySelector(".act-title").textContent = (S.dig && S.dig.done ? "1차시 · 유물 발굴 (수첩 보기)" : "1차시 · 유물 발굴");
  $("goEscape").querySelector(".act-desc").textContent = S.solo ? "개인용(?solo=1). 혼자 전시실 퍼즐을 풀어 열쇠 숫자를 모으고 수장고 문을 연다." : "모둠 태블릿 1대로 함께. 전시실 퍼즐을 풀어 열쇠 숫자를 모으고 수장고 문을 연다.";
  const layers = Logic.layersFor(S.mode, LAYERS, DIG_ORDER).map((id) => LAYERS.find((l) => l.id === id).title).join(" → ");
  $("modeNote").textContent = (S.mode === "flex" ? "유연 모드(3층·5실): " : "공통 모드(2층·4실): ") + layers;
  $("homeEyebrow").textContent = S.mode === "flex" ? "3학년 한국사 · 문화사 · 교과서 36~43, 64~71, 100~109, 128~133쪽" : "3학년 한국사 · 문화사 · 교과서 100~109, 128~133쪽";
  $("modeLink").textContent = " · " + (S.mode === "flex" ? "공통 모드로(고려·조선 전기만)" : "유연 모드로(삼국·남북국 층 추가)");
  $("modeLink").hidden = !S.preview; // 학생 화면에서는 숨긴다(진행이 섞이지 않게). 모드는 선생님이 주소로 정한다.
}
function renderTeamPick(p) {
  p.innerHTML = '<div class="team-grid" style="margin-top:.6rem">' + TEAMS.map((t) =>
    '<button type="button" class="team-btn' + (S.team === t.id ? " sel" : "") + '" data-team="' + esc(t.id) + '"><span class="t-emoji">' + t.emoji + '</span><span class="t-name">' + esc(t.id) + '</span><span class="t-desc">' + esc(t.dir) + '</span></button>').join("") + "</div>";
  p.querySelectorAll(".team-btn").forEach((b) => b.addEventListener("click", () => { S.team = b.dataset.team; save(); renderHome(); renderTop(); }));
}

/* ───────── 성향 테스트 ───────── */
function startQuiz() {
  S.quiz = { answers: [], i: 0 };
  renderQuiz(); show("scrQuiz");
}
function renderQuiz() {
  const card = $("quizCard");
  const q = S.quiz;
  if (q.i < QUIZ.length) {
    const item = QUIZ[q.i];
    const ord = orderOf(item.options.length, (S.sid || "p") + ":quiz:" + q.i); // 학생마다 보기 순서가 달라 «친구 따라 고르기»가 덜하다
    card.innerHTML = '<div class="q-prog">' + QUIZ.map((x, k) => '<span class="q-dot' + (k < q.i ? " done" : (k === q.i ? " on" : "")) + '"></span>').join("") + '</div>' +
      '<div class="eyebrow pixel">발굴단 성향 테스트 · ' + (q.i + 1) + '/' + QUIZ.length + '</div><p class="q-text">' + esc(item.q) + '</p>' +
      '<div class="q-opts">' + ord.map((oi, k) => '<button type="button" class="q-opt" data-i="' + oi + '">' + CIRC[k] + ' ' + esc(item.options[oi].text) + '</button>').join("") + '</div>' +
      '<p class="muted" style="margin-top:.6rem">정답은 없어. 제일 «나 같은» 것을 골라.</p>';
    card.querySelectorAll(".q-opt").forEach((b) => b.addEventListener("click", () => { q.answers[q.i] = Number(b.dataset.i); q.i++; renderQuiz(); }));
  } else {
    const r = Logic.assignTeam(q.answers, QUIZ, TEAMS, S.no);
    S.team = r.team; save();
    const tm = teamOf(r.team);
    card.innerHTML = '<div class="q-result"><span class="r-emoji">' + tm.emoji + '</span><div class="r-name">너는 ' + esc(tm.id) + '!</div><p>' + esc(tm.dir) + '. ' + esc(tm.trait) + '.</p>' +
      (r.tied.length > 1 ? '<p class="muted">두 팀이 같은 점수라 번호로 정했어.</p>' : "") +
      '<p class="muted">같은 팀 친구들과 다음 수업까지 함께 움직여.</p>' +
      '<button type="button" class="btn primary" id="quizGo">' + (S.after === "dig" ? "⛏️ 발굴하러 가기" : (S.after === "escape" ? "🏛️ 방탈출 입장으로" : "첫 화면으로")) + '</button></div>';
    $("quizGo").addEventListener("click", () => { renderHome(); if (S.after === "dig") startDig(); else if (S.after === "escape") renderEscapeEntry(); else show("scrHome"); });
    renderTop();
  }
  card.classList.remove("pop"); void card.offsetWidth; card.classList.add("pop");
}

/* ───────── 발굴(블록 캐기) ───────── */
function newDig() {
  const order = Logic.layersFor(S.mode, LAYERS, DIG_ORDER);
  const blocks = {};
  order.forEach((lid) => { blocks[lid] = Logic.blockLayout(Logic.artifactsOf(lid, ARTIFACTS).map((a) => a.id), BLOCKS_PER_LAYER, (S.sid || "preview") + ":" + lid); });
  return { mode: S.mode, order: order, layerIdx: 0, blocks: blocks, taps: {}, holes: {}, results: [], cur: null, done: false };
}
function curLayerId() { return S.dig.order[S.dig.layerIdx]; }
function curLayer() { return LAYERS.find((x) => x.id === curLayerId()); }
function layerFound(lid) { return S.dig.results.filter((r) => r.layer === lid); }
function layerComplete(lid) { return layerFound(lid).length >= Logic.artifactsOf(lid, ARTIFACTS).length; }

/* 지층 단면: 위(표토)부터 아래(가장 오래된 층)로 그린다. 파는 순서와 상관없이 지질 순서. */
function renderStrata() {
  const geo = LAYERS.filter((l) => S.dig.order.includes(l.id)).slice().reverse(); // 배열은 아래부터라 뒤집어 위부터
  const rows = ['<div class="stratum tex-top">표토<span class="st-sub">지금 서 있는 땅</span></div>'];
  geo.forEach((l) => {
    const arts = Logic.artifactsOf(l.id, ARTIFACTS);
    const got = layerFound(l.id).length;
    const idx = S.dig.order.indexOf(l.id);
    const cls = idx < S.dig.layerIdx ? "done" : (idx === S.dig.layerIdx ? "active" : "locked");
    rows.push('<div class="stratum tex-' + l.block + " " + cls + '">' + esc(l.title) + '<span class="st-sub">' + esc(l.sub) + '</span><span class="st-prog">' + (cls === "locked" ? "🔒" : got + "/" + arts.length) + '</span></div>');
  });
  rows.push('<p class="strata-foot">' + (DIG_ORDER === "top-down" ? "⛏️ 표토부터 파 내려간다. 아래로 갈수록 옛날" : "⛏️ 아래 층부터 판다. 아래가 더 옛날") + '</p>');
  $("strata").innerHTML = rows.join("");
}

function renderBlocks() {
  const l = curLayer();
  const lay = S.dig.blocks[l.id];
  const complete = layerComplete(l.id);
  const html = ['<h2>⛏️ ' + esc(l.title) + '</h2><p class="mine-sub">' + esc(l.sub) + ' · ' + esc(l.blockName) + ' 블록을 곡괭이로 ' + CONFIG.TAPS_TO_BREAK + '번 두드리면 깨져. 유물이 있는 자리는 비밀이야.</p>', '<div class="blk-grid">'];
  lay.forEach((aid, i) => {
    const key = l.id + ":" + i;
    const taps = S.dig.taps[key] || 0;
    if (S.dig.holes[key]) {
      if (aid) {
        const a = artById(aid), r = S.dig.results.find((x) => x.id === aid);
        const open = S.dig.cur && S.dig.cur.id === aid;
        const state = r ? (r.intruder ? "흘러듦" : (r.firstTry ? "발굴" : (r.repaired ? "복원" : "조각"))) : "…";
        html.push('<button type="button" class="blk hole' + (open ? " open" : "") + (r && r.broken ? " broken" : "") + '" data-i="' + i + '" ' + (open ? "" : "disabled") + '><span class="blk-in">' +
          (a.photo && a.photo.src ? '<img class="blk-thumb" src="' + esc(a.photo.src) + '" alt="">' : '<span class="blk-thumb px">' + pixelSvg(a.id) + '</span>') +
          '<span class="blk-state">' + state + '</span></span></button>');
      } else {
        html.push('<button type="button" class="blk hole" disabled><span class="blk-in">🪨<br>돌멩이뿐</span></button>');
      }
    } else {
      html.push('<button type="button" class="blk tex-' + l.block + (taps >= 2 ? " c2" : (taps >= 1 ? " c1" : "")) + '" data-i="' + i + '" aria-label="블록 ' + (i + 1) + '"><span class="pick">⛏️</span></button>');
    }
  });
  html.push("</div>");
  html.push('<div class="mine-foot"><span class="toast" id="mineToast"></span>' +
    (complete ? '<button type="button" class="btn primary" id="nextLayer">' + (S.dig.layerIdx + 1 < S.dig.order.length ? "다음 층으로 →" : "📒 발굴 수첩 펴기") + '</button>' : "") +
    (skip() && !complete ? '<button type="button" class="btn ghost small" id="skipLayer">미리보기: 이 층 전부 캐기</button>' : "") + '</div>');
  $("blockCard").innerHTML = html.join("");
  $("blockCard").querySelectorAll(".blk:not([disabled])").forEach((b) => b.addEventListener("click", () => onBlock(Number(b.dataset.i), b)));
  const nl = $("nextLayer"); if (nl) nl.addEventListener("click", nextLayer);
  const sl = $("skipLayer"); if (sl) sl.addEventListener("click", skipLayer);
  renderStrata();
  renderTop();
}

function onBlock(i, btn) {
  const l = curLayer();
  const key = l.id + ":" + i;
  if (S.dig.holes[key]) { if (S.dig.cur) $("artCard").scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  if (S.dig.cur) { $("mineToast").textContent = "먼저 꺼낸 유물부터 처리해!"; $("artCard").scrollIntoView({ behavior: "smooth", block: "start" }); return; }
  S.dig.taps[key] = (S.dig.taps[key] || 0) + 1;
  btn.classList.remove("hit"); void btn.offsetWidth; btn.classList.add("hit");
  if (S.dig.taps[key] >= CONFIG.TAPS_TO_BREAK) {
    S.dig.holes[key] = true;
    const aid = S.dig.blocks[l.id][i];
    save();
    btn.classList.add("crumble");
    setTimeout(() => {
      if (aid) openArtifact(aid, i);
      else { renderBlocks(); $("mineToast").textContent = "🪨 돌멩이뿐… 다른 블록을 파 보자."; }
    }, 200);
  } else {
    btn.classList.remove("c1", "c2"); btn.classList.add(S.dig.taps[key] >= 2 ? "c2" : "c1");
    $("mineToast").textContent = S.dig.taps[key] === 1 ? "쩍… 금이 갔다" : "쩌적!! 한 번만 더";
    save();
  }
}

function openArtifact(aid, blockIdx) {
  const a = artById(aid);
  S.dig.cur = { id: a.id, step: a.intruder ? "era1" : "name", tries: 0, repairTries: 0, blockIdx: blockIdx };
  save();
  renderBlocks();
  renderArtifact(true);
}

function renderArtifact(fresh) {
  const card = $("artCard");
  const c = S.dig.cur;
  const a = artById(c.id);
  const l = curLayer();
  const eraName = ERAS[l.id].name;
  const found = layerFound(l.id).length;
  const h = ['<div class="eyebrow pixel">' + esc(l.title) + ' · ' + (found + 1) + '/' + Logic.artifactsOf(l.id, ARTIFACTS).length + '</div>'];
  h.push('<h2 class="pixel">흙 속에서 무언가 나왔다!</h2>');
  h.push('<div class="art-head"><div><div class="photo-frame' + (fresh ? " reveal-px" : "") + '" id="artPhoto">' + artVisual(a) + (a.photo ? '<span class="zoom">🔍 확대</span>' : "") + '</div><p class="credit">' + esc(creditText(a)) + '</p></div>');
  h.push('<div><div class="clue">' + esc(a.clue) + '</div>');

  if (c.step === "name") {
    const choices = Logic.nameChoices(a, layerFound(l.id).filter((r) => !r.intruder).length, S.sid || "preview");
    h.push('<h3>이 유물의 이름은?</h3><div class="choice-grid">' + choices.map((n) => '<button type="button" class="choice" data-v="' + esc(n) + '">' + esc(n) + '</button>').join("") + '</div>');
    if (skip()) h.push('<button type="button" class="btn ghost small" id="skipBtn">미리보기: 건너뛰기</button>');
  } else if (c.step === "repair") {
    h.push('<p class="result-line bad">💥 틀렸어! 유물이 깨졌다. 문장을 채워 복원하자. (정답: <b>' + esc(a.name) + '</b>)</p>');
    h.push('<p>' + esc(a.repair.sentence).replace("___", '<span class="blank">　</span>') + '</p>');
    h.push('<div class="chips">' + orderOf(a.repair.options.length, S.sid + ":rp:" + a.id).map((i) => '<button type="button" class="chip" data-i="' + i + '">' + esc(a.repair.options[i]) + '</button>').join("") + '</div>');
  } else if (c.step === "bg") {
    h.push('<p class="result-line good">' + (c.firstTry ? "⛏️ 발굴 성공! " : (c.repaired ? "🩹 복원 완료! " : "🧩 조각으로 남겼어. ")) + '<b>' + esc(a.name) + '</b> <span class="muted">(' + esc(a.page) + ')</span></p>');
    h.push('<h3>왜 ' + esc(eraName) + '에 나왔을까?</h3><p>' + esc(a.bg.q) + '</p>');
    h.push('<div class="choice-grid">' + orderOf(a.bg.options.length, S.sid + ":bg:" + a.id).map((i, k) => '<button type="button" class="choice" data-i="' + i + '">' + CIRC[k] + ' ' + esc(a.bg.options[i]) + '</button>').join("") + '</div>');
  } else if (c.step === "era1") {
    h.push('<h3>이 유물은 ' + esc(eraName) + ' 층에서 나왔어. 정말 ' + esc(eraName) + '의 유물일까?</h3>');
    h.push('<div class="choice-grid"><button type="button" class="choice" data-v="yes">맞아, ' + esc(eraName) + ' 유물이야</button><button type="button" class="choice" data-v="no">아니야, 다른 시대에서 흘러든 유물이야</button></div>');
  } else if (c.step === "era2") {
    h.push('<p class="result-line good">🔍 잘 봤어! 그럼 어느 시대 유물일까?</p>');
    h.push('<div class="choice-grid">' + Object.keys(ERAS).filter((k) => k !== l.id).map((k) => '<button type="button" class="choice" data-v="' + k + '">' + esc(ERAS[k].name) + '</button>').join("") + '</div>');
  } else if (c.step === "result") {
    const r = S.dig.results.find((x) => x.id === a.id);
    if (a.intruder) {
      h.push('<p class="result-line ' + (r.eraCorrect ? "good" : "bad") + '">' + (r.eraCorrect ? "✓ 맞아. " : "✗ 아쉽다. ") + '<b>' + esc(a.name) + '</b>은(는) <b>' + esc(ERAS[a.trueEra].name) + '</b> 유물이야. <span class="muted">(' + esc(a.page) + ')</span></p>');
    } else {
      h.push('<p class="result-line ' + (r.bgCorrect ? "good" : "bad") + '">' + (r.bgCorrect ? "✓ 배경까지 맞혔어!" : "✗ 배경은 이거야 — " + esc(a.bg.options[a.bg.answer])) + '</p>');
    }
    h.push('<div class="note-line">📒 수첩에 적힘: ' + esc(a.note) + '</div>');
    h.push('<button type="button" class="btn primary" id="nextSpot">⛏️ 계속 파기 →</button>');
  }
  h.push("</div></div>");
  card.innerHTML = h.join("");
  card.hidden = false;
  renderTop();
  card.classList.remove("pop"); void card.offsetWidth; card.classList.add("pop");
  if (fresh) card.scrollIntoView({ behavior: "smooth", block: "start" });

  bindZoom($("artPhoto"), a);
  card.querySelectorAll(".choice").forEach((b) => b.addEventListener("click", () => onChoice(b, a)));
  card.querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () => onRepair(b, a)));
  const nx = $("nextSpot"); if (nx) nx.addEventListener("click", nextSpot);
  const sk = $("skipBtn"); if (sk) sk.addEventListener("click", () => { pushResult(a, { firstTry: true, bgCorrect: true }); S.dig.cur.step = "result"; renderArtifact(); });
}

function pushResult(a, extra) {
  const base = { id: a.id, layer: a.layer, name: a.name, intruder: !!a.intruder, firstTry: false, repaired: false, broken: false, bgCorrect: false, eraCorrect: false };
  const r = Object.assign(base, extra);
  const i = S.dig.results.findIndex((x) => x.id === a.id);
  if (i >= 0) S.dig.results[i] = r; else S.dig.results.push(r);
  save();
  return r;
}

function onChoice(btn, a) {
  const c = S.dig.cur;
  const card = $("artCard");
  if (c.step === "name") {
    const ok = btn.dataset.v === a.name;
    if (ok) { c.firstTry = true; c.step = "bg"; btn.classList.add("right"); setTimeout(() => renderArtifact(), 350); }
    else { btn.classList.add("wrong"); card.classList.add("shake"); c.step = "repair"; setTimeout(() => renderArtifact(), 400); }
    card.querySelectorAll(".choice").forEach((b) => { b.disabled = true; });
    save();
  } else if (c.step === "bg") {
    const i = Number(btn.dataset.i);
    const ok = i === a.bg.answer;
    card.querySelectorAll(".choice").forEach((b) => { b.disabled = true; });
    btn.classList.add(ok ? "right" : "wrong");
    pushResult(a, { firstTry: !!c.firstTry, repaired: !!c.repaired, broken: !c.firstTry && !c.repaired, bgCorrect: ok });
    c.step = "result"; save();
    setTimeout(() => renderArtifact(), 400);
  } else if (c.step === "era1") {
    card.querySelectorAll(".choice").forEach((b) => { b.disabled = true; });
    if (btn.dataset.v === "no") { btn.classList.add("right"); c.step = "era2"; save(); setTimeout(() => renderArtifact(), 350); }
    else { btn.classList.add("wrong"); card.classList.add("shake"); pushResult(a, { eraCorrect: false }); c.step = "result"; save(); setTimeout(() => renderArtifact(), 400); }
  } else if (c.step === "era2") {
    card.querySelectorAll(".choice").forEach((b) => { b.disabled = true; });
    const ok = btn.dataset.v === a.trueEra;
    btn.classList.add(ok ? "right" : "wrong");
    pushResult(a, { eraCorrect: ok }); c.step = "result"; save();
    setTimeout(() => renderArtifact(), 400);
  }
}

function onRepair(btn, a) {
  const c = S.dig.cur;
  const i = Number(btn.dataset.i);
  const card = $("artCard");
  if (i === a.repair.answer) {
    btn.classList.add("right"); c.repaired = true; c.step = "bg";
    card.querySelector(".blank").textContent = a.repair.options[i];
    card.querySelectorAll(".chip").forEach((b) => { b.disabled = true; });
    save(); setTimeout(() => renderArtifact(), 450);
  } else {
    btn.classList.add("wrong"); btn.disabled = true; c.repairTries++;
    if (c.repairTries >= 2) { // 두 번 틀리면 조각으로 남긴다
      card.querySelector(".blank").textContent = a.repair.options[a.repair.answer];
      card.querySelectorAll(".chip").forEach((b) => { b.disabled = true; });
      c.step = "bg"; save(); setTimeout(() => renderArtifact(), 600);
    }
    save();
  }
}

function nextSpot() {
  if (S.dig.done) return;
  S.dig.cur = null;
  $("artCard").hidden = true; $("artCard").innerHTML = "";
  save();
  renderBlocks();
  $("blockCard").scrollIntoView({ behavior: "smooth", block: "start" });
  if (layerComplete(curLayerId())) $("mineToast").textContent = "이 층은 다 캤어! ";
}
function nextLayer() {
  S.dig.layerIdx++;
  if (S.dig.layerIdx >= S.dig.order.length) { S.dig.layerIdx = S.dig.order.length - 1; S.dig.done = true; save(); renderNote(); show("scrNote"); return; }
  save();
  renderBlocks();
}
function skipLayer() { // 미리보기 전용
  const l = curLayer();
  S.dig.blocks[l.id].forEach((aid, i) => { S.dig.holes[l.id + ":" + i] = true; if (aid && !S.dig.results.find((r) => r.id === aid)) pushResult(artById(aid), { firstTry: true, bgCorrect: true, eraCorrect: true }); });
  S.dig.cur = null; $("artCard").hidden = true;
  renderBlocks();
}

function startDig() {
  if (!S.dig) S.dig = newDig();
  if (S.dig.done) { renderNote(); show("scrNote"); return; }
  show("scrDig");
  renderBlocks();
  if (S.dig.cur) renderArtifact(false); else $("artCard").hidden = true;
}

/* ───────── 발굴 수첩 ───────── */
function renderNote() {
  const sc = Logic.digScore(S.dig.results);
  const tm = teamOf(S.team);
  const book = $("noteBook");
  book.querySelectorAll(".page:not(#pageWrite)").forEach((p) => p.remove());
  const pages = [];
  pages.push('<div class="page page-cover"><div class="cover-in"><p class="cover-title">발굴 수첩</p><p class="cover-sub">' + esc(S.name || "") + (tm ? ' · ' + tm.emoji + ' ' + esc(tm.id) : "") + '</p>' +
    '<p class="cover-meta">발굴 ' + sc.found + ' · 복원 ' + sc.repaired + ' · 조각 ' + sc.broken + ' · 배경 ' + sc.bg + ' · 흘러든 유물 ' + sc.intruder + '</p><span class="cover-score">팀 점수 ' + sc.score + '점</span>' +
    '<p class="cover-meta">▶ 를 눌러 한 쪽씩 넘겨. 마지막 쪽에서 한 줄을 쓰고 제출해.</p></div></div>');
  S.dig.results.forEach((r, k) => {
    const a = artById(r.id);
    const state = r.intruder ? (ERAS[a.trueEra].name + "에서 흘러든 유물" + (r.eraCorrect ? " ✓" : "")) : (r.firstTry ? "발굴 ✓" : (r.repaired ? "복원 ✓" : "조각")) + (r.bgCorrect ? " · 배경 ✓" : "");
    pages.push('<div class="page page-paper" data-art="' + esc(a.id) + '"><div class="page-in"><p class="p-title">' + (k + 1) + '. ' + esc(a.name) + ' <span class="p-page">' + esc(a.page) + '</span></p>' +
      '<div class="p-body"><div><div class="taped" data-zoom="' + esc(a.id) + '">' + artVisual(a) + '</div><p class="credit">' + esc(creditText(a)) + '</p></div>' +
      '<div><p class="p-state">' + esc(state) + '</p><p class="p-note"><span class="hand-blue">' + esc(a.note) + '</span></p><p class="muted">단서: ' + esc(a.clue) + '</p></div></div></div></div>');
  });
  $("pageWrite").insertAdjacentHTML("beforebegin", pages.join(""));
  book.querySelectorAll(".taped").forEach((el) => bindZoom(el, artById(el.dataset.zoom)));
  $("writePrompt").textContent = WRITING.prompt;
  $("writeMin").textContent = WRITING.min;
  $("writeText").placeholder = WRITING.placeholder;
  $("hintBox").textContent = WRITING.hint;
  const picks = S.dig.results.filter((r) => !r.intruder);
  $("writePick").innerHTML = picks.map((r) => '<option value="' + esc(r.name) + '">' + esc(r.name) + '</option>').join("");
  if (S.dig.submitted) { $("submitDig").disabled = true; $("submitDig").textContent = "제출 완료"; $("noteMsg").textContent = "제출했어. 선생님 화면에 들어갔어."; }
  book.scrollLeft = 0;
  updatePageNum();
}
function pageCount() { return $("noteBook").querySelectorAll(".page").length; }
function pageIndex() { const b = $("noteBook"); return Math.round(b.scrollLeft / Math.max(1, b.clientWidth)); }
function updatePageNum() { $("pgNum").textContent = (pageIndex() + 1) + "/" + pageCount(); }
function flipPage(d) {
  const b = $("noteBook");
  const i = Math.min(pageCount() - 1, Math.max(0, pageIndex() + d));
  b.scrollTo({ left: i * b.clientWidth, behavior: "smooth" });
  setTimeout(updatePageNum, 350);
}

async function submitDig() {
  if (S.sending || (S.dig && S.dig.submitted)) return;
  const text = $("writeText").value.trim();
  const n = Logic.countChars(text);
  if (n < WRITING.min && !skip()) { $("noteErr").textContent = "조금만 더 써 줘. " + WRITING.min + "자는 돼야 해."; return; }
  $("noteErr").textContent = "";
  const sc = Logic.digScore(S.dig.results);
  const team = S.team || "";
  const pick = $("writePick").value;
  const payload = {
    studentId: S.sid, studentName: S.name, gameName: CONFIG.GAME_DIG,
    groupId: team,
    choiceSummary: (team || "팀 없음") + " / 발굴 " + sc.found + " 복원 " + sc.repaired + " 조각 " + sc.broken + " 배경 " + sc.bg + " 흘러든 " + sc.intruder + " / " + sc.score + "점 / " + S.mode,
    diffSummary: "",
    reflection: "[" + pick + "] " + text,
    choicesJson: JSON.stringify({ house: team, team: team, quiz: S.quiz ? S.quiz.answers : null, mode: S.mode, score: sc, results: S.dig.results, pick: pick, ts: new Date().toISOString() })
  };
  Object.assign(payload, FocusGuard.payload());
  S.sending = true; $("submitDig").disabled = true; $("submitDig").textContent = "보내는 중…";
  try {
    await postToSheet(payload);
  } catch (e) {
    $("noteErr").textContent = e.locked ? e.message : "저장이 안 됐어. 인터넷을 확인하고 다시 눌러 줘.";
    S.sending = false; $("submitDig").disabled = false; $("submitDig").textContent = "발굴 수첩 제출";
    return;
  }
  S.sending = false; S.dig.submitted = true; save();
  if (window.DraftGuard) DraftGuard.clear(); // 저장 성공 → 임시저장 삭제
  $("submitDig").textContent = "제출 완료";
  $("noteMsg").textContent = S.preview ? "미리보기라 저장하지 않았어." : "제출했어! 팀 점수 " + sc.score + "점이 기록됐어.";
}

/* ───────── 방탈출 ───────── */
function newEsc() {
  return { mode: S.mode, team: "", teamName: "", start: 0, hints: 0, solved: {}, roomIdx: -1, puzIdx: 0, vaultCode: false, escapedAt: 0, submitted: false, attempts: {}, solo: S.solo };
}
function elapsedSec() {
  if (!S.esc || !S.esc.start) return 0;
  const end = S.esc.escapedAt || Date.now();
  return Math.round((end - S.esc.start) / 1000) + S.esc.hints * CONFIG.HINT_PENALTY_SEC + (S.esc.wrongs || 0) * CONFIG.WRONG_PENALTY_SEC;
}
function tickTimer() {
  const el = $("hudTimer");
  if (el && !$("escHud").hidden) el.textContent = Logic.fmtElapsed(elapsedSec());
}
function startTimerLoop() { if (timerHandle) clearInterval(timerHandle); timerHandle = setInterval(tickTimer, 1000); }

function renderEscapeEntry() {
  if (!S.esc) S.esc = newEsc();
  if (!S.esc.start) S.esc.team = S.solo ? Logic.soloCode(S.sid) : Logic.teamCode(S.ban, S.team || "모둠"); // 입장 전에는 팀이 바뀌면 코드도 따라간다
  $("teamCode").value = S.esc.team;
  $("teamName").value = S.esc.teamName || "";
  $("escFirstLine").textContent = S.solo ? "🧑 개인용(?solo=1) — 혼자 푼다" : "👥 모둠 태블릿 1대로 함께 푼다 (대표 학번으로 제출)";
  $("teamCodeNote").textContent = S.solo ? "개인용이라 모둠 코드는 학번이야." : "모둠 코드는 반과 팀으로 자동으로 채워져. 선생님이 다른 코드를 주면 그걸로 바꿔.";
  if (S.esc.start) { renderRooms(); show("scrRooms"); return; }
  show("scrEscape");
}
function startEscape() {
  S.esc.team = $("teamCode").value.trim() || S.esc.team;
  S.esc.teamName = $("teamName").value.trim();
  S.esc.start = Date.now();
  save();
  renderRooms(); show("scrRooms"); startTimerLoop();
}
function roomsNow() { return Logic.roomsFor(S.mode, ROOMS); }
function roomDone(r) { return r.puzzles.every((p) => S.esc.solved[p.id]); }
function roomKey(r) { const k = r.puzzles.find((p) => p.type === "key"); return k ? String(k.answer) : ""; }
const PUZ_ICON = { match: "🏺", choice: "📜", order: "🪜", key: "🔑" };

/* 평면도: 전시실 타일 + 수장고 문 */
function renderRooms() {
  const rooms = roomsNow();
  const allDone = rooms.every(roomDone);
  const h = ['<div class="floor-head"><h2>🗺️ 박물관 평면도</h2><span>' + esc(S.esc.team) + (S.esc.teamName ? " · " + esc(S.esc.teamName) : "") + ' · 힌트 ' + S.esc.hints + '회</span></div><div class="floor-in">'];
  rooms.forEach((r, i) => {
    const n = r.puzzles.filter((p) => S.esc.solved[p.id]).length;
    const done = roomDone(r);
    h.push('<button type="button" class="room-tile reveal ' + r.era + (done ? " done" : "") + '" data-i="' + i + '"><span class="door"></span><span class="cases">' + r.puzzles.map((p) => '<span class="case' + (S.esc.solved[p.id] ? " on" : "") + '"></span>').join("") + '</span>' +
      '<span class="r-title">' + (i + 1) + '. ' + esc(r.title) + '</span><span class="r-sub">' + esc(r.sub) + ' · 퍼즐 ' + n + '/' + r.puzzles.length + '</span>' +
      '<span class="r-key' + (done ? "" : " locked") + '">' + (done ? "🔑 " + roomKey(r) : "🔒 잠김") + '</span></button>');
  });
  if (S.esc.escapedAt) {
    h.push('<button type="button" class="room-tile vault-tile reveal" id="toEscaped"><span class="wheel"></span><span class="r-title">🎉 수장고 열림 — 탈출!</span><span class="r-sub">' + Logic.fmtElapsed(elapsedSec()) + '</span><span class="r-key">기록 보기</span></button>');
  } else {
    h.push('<button type="button" class="room-tile vault-tile reveal" id="toVault"' + (allDone || skip() ? "" : " disabled") + '><span class="wheel"></span><span class="r-title">🚪 수장고 문</span><span class="r-sub">' + esc(VAULT.code_hint) + '</span><span class="r-key">열쇠 ' + rooms.filter(roomDone).length + '/' + rooms.length + (allDone ? " — 열 수 있어!" : "") + '</span></button>');
  }
  h.push("</div>");
  $("floorMap").innerHTML = h.join("");
  reveal($("floorMap"));
  $("floorMap").querySelectorAll(".room-tile[data-i]").forEach((b) => b.addEventListener("click", () => openRoom(Number(b.dataset.i))));
  const te = $("toEscaped"); if (te) te.addEventListener("click", () => { renderEscaped(); show("scrEscaped"); });
  const tv = $("toVault"); if (tv) tv.addEventListener("click", () => { renderVault(); show("scrVault"); });
  renderTop(); startTimerLoop();
}

function openRoom(i) {
  S.esc.roomIdx = i;
  const r = roomsNow()[i];
  const firstOpen = r.puzzles.findIndex((p) => !S.esc.solved[p.id]);
  S.esc.puzIdx = firstOpen < 0 ? 0 : firstOpen;
  save();
  renderPuzzle(); show("scrPuzzle");
}

function renderPuzzle() {
  const r = roomsNow()[S.esc.roomIdx];
  const p = r.puzzles[S.esc.puzIdx];
  const solved = !!S.esc.solved[p.id];
  const st = S.esc.attempts[p.id] || (S.esc.attempts[p.id] = { hint: false, tries: 0 });
  // 진열장 벽: 퍼즐 하나 = 진열장 하나
  $("roomShelf").innerHTML = '<div class="shelf-title"><span>' + r.emoji + ' ' + esc(r.title) + ' <span style="opacity:.8">' + esc(r.sub) + '</span></span><button type="button" class="btn small" id="backRooms" style="box-shadow:none">← 평면도</button></div>' +
    '<div class="shelf-row">' + r.puzzles.map((pp, k) => '<button type="button" class="case-btn' + (S.esc.solved[pp.id] ? " done" : "") + (k === S.esc.puzIdx ? " cur" : "") + '" data-k="' + k + '"><span class="c-item">' + PUZ_ICON[pp.type] + '</span>' + esc(pp.id) + (S.esc.solved[pp.id] ? " ✓" : "") + '</button>').join("") + '</div>';
  $("roomShelf").querySelectorAll(".case-btn").forEach((b) => b.addEventListener("click", () => { S.esc.puzIdx = Number(b.dataset.k); save(); renderPuzzle(); }));
  $("backRooms").addEventListener("click", () => { renderRooms(); show("scrRooms"); });

  const typeName = { match: "짝 맞추기", order: "순서 정렬", choice: "사료 읽고 고르기", key: "열쇠 숫자" }[p.type];
  const h = ['<div class="eyebrow">📋 안내판 ' + esc(p.id) + ' · ' + esc(typeName) + ' · <span class="muted">' + esc(p.page) + '</span></div>'];
  h.push('<p style="font-size:1.05rem">' + esc(p.q) + '</p>');

  if (solved) {
    h.push('<p class="result-line good">✓ 해결한 퍼즐이야.</p>');
    if (p.type === "key") h.push('<div class="key-reveal">🔑 이 방의 열쇠 숫자: ' + esc(p.answer) + '</div>');
  } else if (p.type === "match") {
    const rights = orderOf(p.pairs.length, p.id + ":" + (S.esc.team || "t"), true);
    st.rights = rights; st.map = st.map || {}; st.selLeft = null;
    const usedRi = new Set(Object.keys(st.map).map((k) => st.map[k]));
    h.push('<div class="match-grid"><div class="match-col"><h3>유물</h3>' + p.pairs.map((pr, i) => '<button type="button" class="m-item m-left' + (st.map[i] != null ? " paired" : "") + '" data-i="' + i + '"><span class="m-tag">' + CIRC[i] + '</span>' + esc(pr[0]) + (st.map[i] != null ? ' <span class="m-tag">→ ' + KOR[rights.indexOf(st.map[i])] + '</span>' : "") + '</button>').join("") + '</div>');
    h.push('<div class="match-col"><h3>설명</h3>' + rights.map((ri, k) => '<button type="button" class="m-item m-right' + (usedRi.has(ri) ? " used" : "") + '" data-ri="' + ri + '"><span class="m-tag">' + KOR[k] + '</span>' + esc(p.pairs[ri][1]) + (usedRi.has(ri) ? '<span class="m-used">사용됨</span>' : "") + '</button>').join("") + '</div></div>');
    h.push('<p class="muted">왼쪽 유물을 누르고, 맞는 설명을 눌러 짝지어. 쓴 설명은 «사용됨»으로 표시돼(다시 누르면 옮겨져). 네 쌍을 다 지으면 확인.</p>');
    h.push('<button type="button" class="btn primary" id="checkBtn">확인</button>');
  } else if (p.type === "order") {
    if (!st.arr) { st.arr = Logic.shuffle(p.items, Logic.seeded(p.id + ":" + (S.esc.team || "t"))); if (st.arr.join() === p.items.join()) st.arr = st.arr.slice().reverse(); }
    h.push('<ol class="order-list">' + st.arr.map((it, i) => '<li class="order-item"><span class="o-no">' + (i + 1) + '</span><span class="o-txt">' + esc(it) + '</span><button type="button" class="o-btn" data-up="' + i + '" aria-label="위로">▲</button><button type="button" class="o-btn" data-down="' + i + '" aria-label="아래로">▼</button></li>').join("") + '</ol>');
    h.push('<p class="muted">▲▼로 순서를 바꿔. 1번이 가장 이른 것.</p><button type="button" class="btn primary" id="checkBtn">확인</button>');
  } else if (p.type === "choice") {
    h.push('<div class="choice-grid">' + orderOf(p.options.length, (S.esc.team || "t") + ":" + p.id).map((i, k) => '<button type="button" class="choice" data-i="' + i + '">' + CIRC[k] + ' ' + esc(p.options[i]) + '</button>').join("") + '</div>');
  } else if (p.type === "key") {
    h.push('<p><input id="keyIn" class="key-input" inputmode="numeric" maxlength="1" autocomplete="off" aria-label="열쇠 숫자"></p><button type="button" class="btn primary" id="checkBtn">확인</button>');
  }
  h.push('<p class="err" id="puzErr"></p>');
  if (!solved) h.push('<button type="button" class="btn ghost small" id="hintBtn">💡 힌트 보기 (+1분)</button><p class="hint-box" id="puzHint"' + (st.hint ? "" : " hidden") + '>' + esc(p.hint) + '</p>');
  if (skip() && !solved) h.push('<button type="button" class="btn ghost small" id="skipPuz">미리보기: 해결 처리</button>');
  h.push('<div class="row-between" style="margin-top:.8rem"><button type="button" class="btn" id="backRooms2">← 평면도</button>' + (solved ? '<button type="button" class="btn primary" id="nextPuz">다음 진열장 →</button>' : "") + '</div>');

  const card = $("puzzleCard");
  card.innerHTML = h.join("");
  $("backRooms2").addEventListener("click", () => { renderRooms(); show("scrRooms"); });
  const nx = $("nextPuz"); if (nx) nx.addEventListener("click", () => { const k = r.puzzles.findIndex((pp) => !S.esc.solved[pp.id]); if (k < 0) { renderRooms(); show("scrRooms"); } else { S.esc.puzIdx = k; save(); renderPuzzle(); } });
  const hb = $("hintBtn"); if (hb) hb.addEventListener("click", () => { if (!st.hint) { st.hint = true; S.esc.hints++; save(); } $("puzHint").hidden = false; renderTop(); });
  const sp = $("skipPuz"); if (sp) sp.addEventListener("click", () => { S.esc.solved[p.id] = true; save(); renderPuzzle(); });

  if (solved) { renderTop(); return; }
  if (p.type === "match") {
    card.querySelectorAll(".m-left").forEach((b) => b.addEventListener("click", () => { st.selLeft = Number(b.dataset.i); card.querySelectorAll(".m-left").forEach((x) => x.classList.remove("sel")); b.classList.add("sel"); }));
    card.querySelectorAll(".m-right").forEach((b) => b.addEventListener("click", () => {
      if (st.selLeft == null) { $("puzErr").textContent = "먼저 왼쪽 유물을 눌러."; return; }
      const ri = Number(b.dataset.ri);
      Object.keys(st.map).forEach((k) => { if (st.map[k] === ri) delete st.map[k]; }); // 한 설명은 한 유물에만
      st.map[st.selLeft] = ri; st.selLeft = null; $("puzErr").textContent = "";
      save(); renderPuzzle();
    }));
    $("checkBtn").addEventListener("click", () => {
      if (Object.keys(st.map).length < p.pairs.length) { $("puzErr").textContent = "네 쌍을 다 지어 줘."; return; }
      const res = Logic.checkMatch(p, st.map); st.tries++;
      if (res.correct) solvePuzzle(p); else { $("puzErr").textContent = res.ok + "/" + res.total + " 맞음. 짝을 바꿔 다시 해 봐."; card.classList.add("shake"); setTimeout(() => card.classList.remove("shake"), 400); save(); }
    });
  } else if (p.type === "order") {
    card.querySelectorAll("[data-up]").forEach((b) => b.addEventListener("click", () => { const i = Number(b.dataset.up); if (i > 0) { const t = st.arr[i]; st.arr[i] = st.arr[i - 1]; st.arr[i - 1] = t; save(); renderPuzzle(); } }));
    card.querySelectorAll("[data-down]").forEach((b) => b.addEventListener("click", () => { const i = Number(b.dataset.down); if (i < st.arr.length - 1) { const t = st.arr[i]; st.arr[i] = st.arr[i + 1]; st.arr[i + 1] = t; save(); renderPuzzle(); } }));
    $("checkBtn").addEventListener("click", () => {
      const res = Logic.checkOrder(p.items, st.arr); st.tries++;
      if (res.correct) solvePuzzle(p); else { $("puzErr").textContent = res.ok + "/" + res.total + " 자리가 맞아. 다시 놓아 봐."; card.classList.add("shake"); setTimeout(() => card.classList.remove("shake"), 400); save(); }
    });
  } else if (p.type === "choice") {
    card.querySelectorAll(".choice").forEach((b) => b.addEventListener("click", () => {
      st.tries++;
      if (Logic.checkChoice(p, b.dataset.i).correct) { b.classList.add("right"); solvePuzzle(p); }
      else { b.classList.add("wrong"); b.disabled = true; S.esc.wrongs = (S.esc.wrongs || 0) + 1; $("puzErr").textContent = "아니야. 사료를 다시 읽어 봐. (+" + (CONFIG.WRONG_PENALTY_SEC) + "초)"; save(); renderTop(); }
    }));
  } else if (p.type === "key") {
    $("checkBtn").addEventListener("click", () => {
      st.tries++;
      if (Logic.checkKey(p, $("keyIn").value).correct) solvePuzzle(p); else { S.esc.wrongs = (S.esc.wrongs || 0) + 1; $("puzErr").textContent = "그 숫자가 아니야. (+" + CONFIG.WRONG_PENALTY_SEC + "초)"; save(); renderTop(); }
    });
    $("keyIn").addEventListener("keydown", (e) => { if (e.key === "Enter") $("checkBtn").click(); });
  }
  renderTop();
}

function solvePuzzle(p) {
  S.esc.solved[p.id] = true; save();
  setTimeout(renderPuzzle, 350);
}

/* 수장고 문: 번호판 → 마지막 자물쇠(순서 정렬) */
function renderVault() {
  const rooms = roomsNow();
  const st = S.esc.attempts.V1 || (S.esc.attempts.V1 = { hint: false, tries: 0 });
  const items = S.mode === "flex" ? VAULT.final.flexItems : VAULT.final.items;
  const h = ['<h2>🚪 수장고 문</h2>'];
  if (!S.esc.vaultCode) {
    h.push('<p>' + esc(VAULT.code_hint) + ' (' + rooms.length + '자리)</p>');
    h.push('<div class="keypad"><input id="codeIn" class="code-input" inputmode="numeric" maxlength="' + rooms.length + '" autocomplete="off" aria-label="수장고 번호"></div>');
    h.push('<p><button type="button" class="btn primary" id="codeBtn">열기</button></p><p class="err" id="vErr"></p>');
  } else {
    if (!st.arr) { st.arr = Logic.shuffle(items, Logic.seeded("V1:" + (S.esc.team || "t"))); if (st.arr.join() === items.join()) st.arr = st.arr.slice().reverse(); }
    h.push('<p class="result-line good" style="color:#8cff9a">🔓 번호가 맞았다! 마지막 자물쇠 하나.</p><p>' + esc(VAULT.final.q) + ' <span class="muted">(' + esc(VAULT.final.page) + ')</span></p>');
    h.push('<ol class="order-list">' + st.arr.map((it, i) => '<li class="order-item"><span class="o-no">' + (i + 1) + '</span><span class="o-txt">' + esc(it) + '</span><button type="button" class="o-btn" data-up="' + i + '" aria-label="위로">▲</button><button type="button" class="o-btn" data-down="' + i + '" aria-label="아래로">▼</button></li>').join("") + '</ol>');
    h.push('<button type="button" class="btn primary" id="finalBtn">자물쇠 열기</button><p class="err" id="vErr"></p>');
    h.push('<button type="button" class="btn ghost small" id="vHintBtn" style="color:#fff">💡 힌트 보기 (+1분)</button><p class="hint-box" id="vHint"' + (st.hint ? "" : " hidden") + '>' + esc(VAULT.final.hint) + '</p>');
  }
  h.push('<p style="margin-top:.8rem"><button type="button" class="btn" id="vBack">← 평면도</button></p>');
  const card = $("vaultCard");
  card.innerHTML = h.join("");
  $("vBack").addEventListener("click", () => { renderRooms(); show("scrRooms"); });
  const cb = $("codeBtn");
  if (cb) {
    cb.addEventListener("click", () => {
      const ok = $("codeIn").value.trim() === Logic.vaultCode(rooms) || (skip() && !$("codeIn").value.trim());
      if (ok) { S.esc.vaultCode = true; save(); renderVault(); } else { $("vErr").textContent = "번호가 틀렸어. 전시실 순서대로 열쇠 숫자를 다시 모아 봐."; card.classList.add("shake"); setTimeout(() => card.classList.remove("shake"), 400); }
    });
    $("codeIn").addEventListener("keydown", (e) => { if (e.key === "Enter") cb.click(); });
  }
  const fb = $("finalBtn");
  if (fb) {
    card.querySelectorAll("[data-up]").forEach((b) => b.addEventListener("click", () => { const i = Number(b.dataset.up); if (i > 0) { const t = st.arr[i]; st.arr[i] = st.arr[i - 1]; st.arr[i - 1] = t; save(); renderVault(); } }));
    card.querySelectorAll("[data-down]").forEach((b) => b.addEventListener("click", () => { const i = Number(b.dataset.down); if (i < st.arr.length - 1) { const t = st.arr[i]; st.arr[i] = st.arr[i + 1]; st.arr[i + 1] = t; save(); renderVault(); } }));
    fb.addEventListener("click", () => {
      st.tries++;
      const res = Logic.checkOrder(items, st.arr);
      if (res.correct || skip()) { S.esc.escapedAt = Date.now(); save(); if (timerHandle) clearInterval(timerHandle); renderEscaped(); show("scrEscaped"); }
      else { $("vErr").textContent = res.ok + "/" + res.total + " 자리가 맞아."; card.classList.add("shake"); setTimeout(() => card.classList.remove("shake"), 400); save(); }
    });
    $("vHintBtn").addEventListener("click", () => { if (!st.hint) { st.hint = true; S.esc.hints++; save(); } $("vHint").hidden = false; renderTop(); });
  }
  renderTop();
}

function renderEscaped() {
  const sec = elapsedSec();
  $("escapedSummary").innerHTML = "<b>" + esc(S.esc.team) + (S.esc.teamName ? " (" + esc(S.esc.teamName) + ")" : "") + "</b> · 기록 <b>" + Logic.fmtElapsed(sec) + "</b> (힌트 " + S.esc.hints + "회 ×1분, 오답 " + (S.esc.wrongs || 0) + "회 ×20초 포함) · " + (S.mode === "flex" ? "5실" : "4실");
  if (S.esc.submitted) { $("submitEscape").disabled = true; $("submitEscape").textContent = "제출 완료"; $("escMsg").textContent = "기록이 선생님 화면에 들어갔어."; }
}

async function submitEscape() {
  if (S.sending || S.esc.submitted) return;
  const sec = elapsedSec();
  const tries = Object.keys(S.esc.attempts).map((k) => k + ":" + (S.esc.attempts[k].tries || 0)).join(" ");
  const payload = {
    studentId: S.sid, studentName: S.name, gameName: CONFIG.GAME_ESCAPE,
    groupId: S.esc.team,
    choiceSummary: S.esc.team + " / " + Logic.fmtElapsed(sec) + " / 힌트 " + S.esc.hints + " / " + S.mode + (S.solo ? " / 개인" : ""),
    diffSummary: "",
    reflection: "탈출 " + Logic.fmtElapsed(sec) + " · 모둠 " + S.esc.team + (S.esc.teamName ? "(" + S.esc.teamName + ")" : "") + " · 힌트 " + S.esc.hints + "회 · 오답 " + (S.esc.wrongs || 0) + "회 · 시도 " + tries,
    choicesJson: JSON.stringify({ team: S.esc.team, teamName: S.esc.teamName, house: S.team || "", solo: !!S.solo, mode: S.mode, elapsedSec: sec, hints: S.esc.hints, wrongs: S.esc.wrongs || 0, start: S.esc.start, escapedAt: S.esc.escapedAt, attempts: S.esc.attempts, ts: new Date().toISOString() })
  };
  Object.assign(payload, FocusGuard.payload());
  S.sending = true; $("submitEscape").disabled = true; $("submitEscape").textContent = "보내는 중…";
  try {
    await postToSheet(payload);
  } catch (e) {
    $("escErr").textContent = e.locked ? e.message : "저장이 안 됐어. 인터넷을 확인하고 다시 눌러 줘.";
    S.sending = false; $("submitEscape").disabled = false; $("submitEscape").textContent = "탈출 기록 제출";
    return;
  }
  S.sending = false; S.esc.submitted = true; save();
  $("submitEscape").textContent = "제출 완료";
  $("escMsg").textContent = S.preview ? "미리보기라 저장하지 않았어." : "제출했어! 탈출 순서는 선생님이 정리해 줄 거야.";
}

/* ───────── 서버 ───────── */
async function postToSheet(payload) {
  if (S.preview) return { result: "success", preview: true };
  const res = await fetch(CONFIG.SHEET_WEBAPP_URL, { method: "POST", body: JSON.stringify(payload) });
  const json = await res.json();
  if (json.result !== "success") {
    const err = new Error(json.message || "저장 실패");
    err.locked = !!json.locked || !!json.needLogin; // 백엔드 문구(잠금·로그인 필요)는 그대로 보여 준다
    throw err;
  }
  return json;
}

/* ───────── 시작 ───────── */
function setStudent(sid, name) {
  S.sid = String(sid || "").trim(); S.name = String(name || "").trim();
  if (/^\d{5}$/.test(S.sid)) { S.grade = Number(S.sid[0]); S.ban = Number(S.sid.slice(1, 3)); S.no = Number(S.sid.slice(3)); }
  load();
  const scr = new URLSearchParams(location.search).get("screen");
  FocusGuard.start({ key: (scr === "escape" ? CONFIG.GAME_ESCAPE : CONFIG.GAME_DIG) + ":" + S.sid }); // 작성 중 화면 이탈·붙여넣기 기록
  if (window.DraftGuard) DraftGuard.start({ key: CONFIG.GAME_DIG, sid: S.sid }); // 발굴 수첩 글 임시저장
}

function route() {
  const q = new URLSearchParams(location.search);
  const screen = q.get("screen");
  renderHome();
  if (screen === "dig") { if (S.team || skip()) startDig(); else { S.after = "dig"; startQuiz(); } }
  else if (screen === "escape") { if (S.team || skip()) renderEscapeEntry(); else { S.after = "escape"; startQuiz(); } }
  else show("scrHome");
}

function init() {
  const q = new URLSearchParams(location.search);
  S.preview = q.get("preview") === "1";
  S.mode = q.get("mode") === "flex" ? "flex" : "basic";
  S.solo = q.get("solo") === "1";
  if (S.preview) $("previewBar").hidden = false;

  $("brandBtn").addEventListener("click", () => { renderHome(); show("scrHome"); });
  $("goDig").addEventListener("click", startDig);
  $("goEscape").addEventListener("click", renderEscapeEntry);
  $("startEscape").addEventListener("click", startEscape);
  $("submitDig").addEventListener("click", submitDig);
  $("submitEscape").addEventListener("click", submitEscape);
  $("hintToggle").addEventListener("click", () => { $("hintBox").hidden = !$("hintBox").hidden; });
  $("writeText").addEventListener("input", () => { $("writeCount").textContent = Logic.countChars($("writeText").value); });
  $("pgPrev").addEventListener("click", () => flipPage(-1));
  $("pgNext").addEventListener("click", () => flipPage(1));
  $("noteBook").addEventListener("scroll", () => { clearTimeout(S._pgT); S._pgT = setTimeout(updatePageNum, 120); });
  $("lbClose").addEventListener("click", closeLightbox);
  $("lightbox").addEventListener("click", (e) => { if (e.target === $("lightbox")) closeLightbox(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("lightbox").hidden) closeLightbox(); });
  $("modeLink").addEventListener("click", (e) => {
    e.preventDefault();
    const u = new URL(location.href);
    if (S.mode === "flex") u.searchParams.delete("mode"); else u.searchParams.set("mode", "flex");
    location.href = u.toString();
  });

  const sid = q.get("sid"), name = q.get("name");
  if (S.preview) { setStudent(sid || "preview", name || "미리보기"); route(); }
  else if (sid && name) { setStudent(sid, name); route(); }
  else {
    show("scrLogin");
    $("loginBtn").addEventListener("click", () => {
      const s = $("inSid").value.trim(), n = $("inName").value.trim();
      if (!/^\d{5}$/.test(s) || !n) { $("loginErr").textContent = "학번 5자리와 이름을 적어 줘."; return; }
      setStudent(s, n); route();
    });
  }
  Glossary.start({ terms: GLOSSARY, unique: true, skip: ["#topbar", "#escHud", ".strata", ".mine h2", ".shelf", ".blk", ".team-btn", ".team-badge", ".q-opt", ".act-btn", ".room-tile", ".chips", ".choice-grid", ".m-item", ".order-item", ".key-reveal", ".page-cover", ".credit"] }); // 어려운 낱말 풀이
}

init();
