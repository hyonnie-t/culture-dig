/* app.js — 화면 흐름. 데이터는 data.js, 판정은 logic.js.
 * 규칙(webapp-rules): 함수 선언을 먼저 끝내고 init()은 파일 맨 끝에서 부른다(TDZ). FocusGuard·DraftGuard는 학번이 확정되는 지점에서.
 * 제출: 기본 제출 경로(gameName·studentId·studentName·reflection·choiceSummary·choicesJson·groupId). 백엔드 URL은 history26 스킬 문서와 grep으로 대조했다.
 * 2026-11-03 2판: 블록 캐기 발굴 / 수첩(Scroll Snap) / 평면도·진열장·수장고 / 사진 라이트박스 / ?solo=1
 * 2026-11-03 3판(1인 1태블릿): 성향 테스트는 지망만 받고 팀은 교사 «팀 뽑기»(?screen=teams)가 균등하게 → 학생이 고름 /
 *   방탈출은 담당 전시실 + 팀원에게 열쇠 숫자 받기 + 팀별 수장고 순서, 전원 각자 제출 / 교사 «결산판»(?screen=board)이 평균·순위 포인트
 */
const CONFIG = {
  SHEET_WEBAPP_URL: "https://script.google.com/macros/s/AKfycbyXSjCfWY_HiZFqW_OBR-FQDoIfF1z_STqyKWUI31MacHeY3u7hbirFSFDvW-5yuUHaJQ/exec",
  GAME_DIG: "문화사_유물발굴",        // 커리큘럼 활동 id와 글자까지 같게
  GAME_ESCAPE: "문화사_박물관방탈출",
  GAME_QUIZ: "문화사_팀테스트",      // 커리큘럼에 없는 기록용 이름(팀 뽑기에 붙여 넣을 지망만 남긴다)
  TAPS_TO_BREAK: 3       // 블록을 깨는 데 드는 곡괭이 탭 수
};
const GAME_NAMES = [CONFIG.GAME_DIG, CONFIG.GAME_ESCAPE, CONFIG.GAME_QUIZ];

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
function storeKey(kind) { return "culture-dig:" + kind + (kind === "esc" && S.solo ? "-solo" : "") + ":" + S.mode + ":" + S.sid; } // 개인용 방탈출은 팀 진행과 따로 저장
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
    if (t) { if (t.team && teamOf(t.team)) S.team = t.team; S.quiz = t.quiz || null; }
    const d = JSON.parse(localStorage.getItem(storeKey("dig")) || "null");
    if (d && d.dig && d.dig.mode === S.mode && d.dig.blocks) S.dig = d.dig; // 1판(블록 없음) 저장본은 버린다
    const e = JSON.parse(localStorage.getItem(storeKey("esc")) || "null");
    if (e && e.esc && e.esc.mode === S.mode && e.esc.role != null) S.esc = e.esc; // 2판(모둠 태블릿) 저장본은 버린다
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
  if (S.esc && S.esc.start && /^scr(Rooms|Puzzle|Vault|Escaped)$/.test(S.screen)) parts.push("점수 <b>" + escNow().score + "</b>/20");
  if (S.name) parts.push(esc(S.name));
  t.innerHTML = parts.join(" · ");
  const inEsc = (S.screen === "scrRooms" || S.screen === "scrPuzzle" || S.screen === "scrVault") && S.esc && S.esc.start;
  $("escHud").hidden = !inEsc;
  if (inEsc) renderHud();
}
function renderHud() {
  $("hudTimer").textContent = Logic.fmtElapsed(elapsedSec());
  const rooms = roomsNow();
  // 우리 팀 수장고 순서대로: 내가 푼 방은 숫자, 아직이면 «n실 _»(팀원에게 물어볼 자리)
  $("hudKeys").innerHTML = "🔑 " + vaultOrderNow().map((i) => '<span class="k-room">' + (i + 1) + '실</span>' + (roomDone(rooms[i]) ? '<span class="k-got">' + roomKey(rooms[i]) + "</span>" : '<span class="k-no">_</span>')).join(" ");
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
/* 도트 그림(pixels.js, 유물마다 32×32). 같은 색이 가로로 이어지면 rect 하나로 묶어 SVG를 가볍게 한다. */
const pixelCache = {};
function pixelSvg(id) {
  if (pixelCache[id]) return pixelCache[id];
  const rows = PIXEL_ART32[id] || [];
  const rects = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const ch = row[x]; let w = 1;
      while (x + w < row.length && row[x + w] === ch) w++;
      if (ch !== "." && PIXEL_PAL32[ch]) rects.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="1" fill="' + PIXEL_PAL32[ch] + '"/>');
      x += w;
    }
  });
  return (pixelCache[id] = '<svg viewBox="0 0 32 32" shape-rendering="crispEdges" role="img" aria-label="도트 그림">' + rects.join("") + "</svg>");
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
function teamTitle(tm) { return tm.emoji + " " + tm.id + " 발굴단"; }
function renderHome() {
  const box = $("teamBox");
  const tm = teamOf(S.team);
  const quizDone = !!(S.quiz && S.quiz.ranking);
  if (tm) {
    box.innerHTML = '<div class="team-badge" data-team="' + esc(tm.id) + '"><span class="tb-emoji">' + tm.emoji + '</span><div><div class="tb-name">' + esc(tm.id) + ' 발굴단</div><div class="tb-sub">' + esc(tm.tool) + '</div></div></div>' +
      '<div class="team-actions"><button type="button" class="btn ghost small" id="teamChange">팀 바꾸기 (잘못 골랐을 때)</button></div><div id="teamPick" hidden></div>';
    $("teamChange").addEventListener("click", () => { const p = $("teamPick"); p.hidden = !p.hidden; if (!p.hidden) renderTeamPick(p); });
  } else if (!quizDone && !S.solo) {
    box.innerHTML = '<p>먼저 짧은 성향 테스트(4문항)를 해. 선생님이 모두의 결과를 보고 <b>인원이 고르게</b> 네 팀(🖌️붓·⛏️곡괭이·🔍돋보기·🧭나침반 발굴단)으로 나눠 칠판에 띄워 줄 거야.</p>' +
      '<button type="button" class="btn primary" id="quizStart">🧭 발굴단 성향 테스트 시작</button>' +
      ' <button type="button" class="btn ghost small" id="teamDirect">칠판에 팀이 벌써 떠 있어</button>' +
      (skip() ? ' <button type="button" class="btn ghost small" id="quizSkip">미리보기: 아무 팀</button>' : "") + '<div id="teamPick" hidden></div>';
    $("quizStart").addEventListener("click", () => { S.after = ""; startQuiz(); });
    $("teamDirect").addEventListener("click", () => { const p = $("teamPick"); p.hidden = !p.hidden; if (!p.hidden) renderTeamPick(p); });
    const qs = $("quizSkip"); if (qs) qs.addEventListener("click", () => { S.team = TEAMS[0].id; renderHome(); renderTop(); });
  } else {
    const ty = quizDone ? teamOf(S.quiz.ranking[0]) : null;
    box.innerHTML = (ty ? '<p>너의 성향: <b>' + esc(ty.type) + '</b> — ' + esc(ty.trait) + '.</p>' : "") +
      '<p><b>칠판에서 내 번호가 있는 팀</b>을 눌러. 팀이 아직 안 떴으면 발굴부터 시작해도 돼(수첩을 낼 때까지 고르면 돼).</p><div id="teamPick"></div>';
    renderTeamPick($("teamPick"));
    if (quizDone && !S.quiz.submitted && !skip()) box.insertAdjacentHTML("beforeend", '<p class="err">성향 테스트 결과가 아직 선생님께 안 갔어. <button type="button" class="btn small" id="quizResend">다시 보내기</button></p>');
    const rs = $("quizResend"); if (rs) rs.addEventListener("click", () => sendQuiz().then(renderHome));
  }
  $("goDig").disabled = !(S.team || quizDone || skip());
  $("goEscape").disabled = !(S.team || S.solo || skip());
  $("goDig").querySelector(".act-title").textContent = (S.dig && S.dig.done ? "1차시 · 유물 발굴 (수첩 보기)" : "1차시 · 유물 발굴");
  $("goEscape").querySelector(".act-desc").textContent = S.solo ? "개인용(?solo=1). 모든 전시실이 열려 있어. 혼자 열쇠 숫자를 모아 수장고 문을 연다." : "내 태블릿으로 «담당 전시실» 하나를 푼다. 다른 방 열쇠 숫자는 팀원에게 물어 모아야 수장고 문이 열린다.";
  const layers = Logic.layersFor(S.mode, LAYERS, DIG_ORDER).map((id) => LAYERS.find((l) => l.id === id).title).join(" → ");
  $("modeNote").textContent = (S.mode === "flex" ? "유연 모드(3층·5실): " : "공통 모드(2층·4실): ") + "파는 순서 " + layers;
  $("homeEyebrow").textContent = S.mode === "flex" ? "3학년 한국사 · 문화사 · 교과서 36~43, 64~71, 100~109, 128~133쪽" : "3학년 한국사 · 문화사 · 교과서 100~109, 128~133쪽";
  $("modeLink").textContent = " · " + (S.mode === "flex" ? "공통 모드로(고려·조선 전기만)" : "유연 모드로(삼국·남북국 층 추가)");
  $("modeLink").hidden = !S.preview; // 학생 화면에서는 숨긴다(진행이 섞이지 않게). 모드는 선생님이 주소로 정한다.
}
function renderTeamPick(p, after) {
  p.innerHTML = '<div class="team-grid" style="margin-top:.6rem">' + TEAMS.map((t) =>
    '<button type="button" class="team-btn' + (S.team === t.id ? " sel" : "") + '" data-team="' + esc(t.id) + '"><span class="t-emoji">' + t.emoji + '</span><span class="t-name">' + esc(t.id) + '</span><span class="t-desc">발굴단</span></button>').join("") + "</div>";
  p.querySelectorAll(".team-btn").forEach((b) => b.addEventListener("click", () => {
    S.team = b.dataset.team; save(); renderTop();
    if (after) after(); else renderHome();
  }));
}

/* ───────── 성향 테스트(지망만 받는다 — 팀은 선생님이 고르게 나눈다) ───────── */
function startQuiz() {
  S.quiz = { answers: [], i: 0 };
  renderQuiz(); show("scrQuiz");
}
async function sendQuiz() {
  const q = S.quiz;
  if (!q || !q.ranking || q.submitted || S.preview || !S.sid) return;
  const ty = teamOf(q.ranking[0]);
  try {
    await postToSheet({
      studentId: S.sid, studentName: S.name, gameName: CONFIG.GAME_QUIZ, groupId: "",
      choiceSummary: "지망 " + q.ranking.join(">") + " · " + ty.type,
      diffSummary: "",
      reflection: "성향 테스트: " + ty.type,
      choicesJson: JSON.stringify({ answers: q.answers, ranking: q.ranking, tally: q.tally, ts: new Date().toISOString() })
    });
    q.submitted = true; save();
  } catch (e) { /* 첫 화면의 «다시 보내기»로 */ }
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
    if (!q.ranking) { const r = Logic.quizRanking(q.answers, QUIZ, TEAMS, S.sid || "p"); q.ranking = r.ranking; q.tally = r.tally; save(); sendQuiz(); }
    const ty = teamOf(q.ranking[0]);
    card.innerHTML = '<div class="q-result"><span class="r-emoji">✨</span><div class="r-name">너는 ' + esc(ty.type) + '!</div><p>' + esc(ty.trait) + '. 그게 너의 발굴 스타일이야.</p>' +
      '<p class="muted">선생님이 반 전체 결과를 보고 인원이 고르게 네 팀으로 나눠 칠판에 띄워 줄 거야. </p>' +
      '<button type="button" class="btn primary" id="quizGo">' + (S.after === "dig" ? "⛏️ 발굴하러 가기" : "첫 화면으로") + '</button></div>';
    $("quizGo").addEventListener("click", () => { renderHome(); if (S.after === "dig") startDig(); else show("scrHome"); });
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
    '<p class="cover-meta">발굴 ' + sc.found + ' · 복원 ' + sc.repaired + ' · 조각 ' + sc.broken + ' · 배경 ' + sc.bg + ' · 흘러든 유물 ' + sc.intruder + '</p><span class="cover-score">내 점수 ' + sc.score + '점</span>' +
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
  if (!S.team && !skip()) { $("noteErr").textContent = "팀을 먼저 골라 줘. 칠판에서 내 번호가 있는 팀을 눌러."; const p = $("notePick"); p.hidden = false; renderTeamPick(p, () => { p.hidden = true; $("noteErr").textContent = ""; renderTop(); }); return; }
  const team = S.team || "";
  const code = team ? Logic.teamCode(S.ban, team) : "";
  const pick = $("writePick").value;
  const payload = {
    studentId: S.sid, studentName: S.name, gameName: CONFIG.GAME_DIG,
    groupId: code,
    choiceSummary: "점수 " + sc.score + " · " + (team || "팀 없음") + " · 발굴 " + sc.found + " 복원 " + sc.repaired + " 조각 " + sc.broken + " 배경 " + sc.bg + " 흘러든 " + sc.intruder + " · " + S.mode,
    diffSummary: "",
    reflection: "[" + pick + "] " + text,
    choicesJson: JSON.stringify({ team: team, teamCode: code, quiz: S.quiz ? S.quiz.ranking || null : null, mode: S.mode, score: sc, results: S.dig.results, pick: pick, ts: new Date().toISOString() })
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
  $("noteMsg").textContent = S.preview ? "미리보기라 저장하지 않았어." : "제출했어! 내 점수 " + sc.score + "점이 팀 평균에 들어가.";
}

/* ───────── 방탈출(1인 1태블릿: 담당 전시실 + 팀원에게 열쇠 숫자 받기) ─────────
 * role = 담당 전시실 인덱스. 처음엔 담당 방만 열린다. 담당 방을 다 풀면 «도우러 가기»로 한 방(help)을 더 열 수 있다.
 * 개인용(?solo=1)·미리보기는 모든 방이 열린다. 수장고 번호는 팀마다 전시실 순서가 다르다(Logic.vaultOrder). */
function newEsc() {
  return { mode: S.mode, team: "", start: 0, hints: 0, solved: {}, role: -1, help: -1, roomIdx: -1, puzIdx: 0, vaultCode: false, escapedAt: 0, submittedScore: -1, submittedEscaped: false, attempts: {}, solo: S.solo };
}
function elapsedSec() {
  if (!S.esc || !S.esc.start) return 0;
  const end = S.esc.escapedAt || Date.now();
  return Math.round((end - S.esc.start) / 1000);
}
function tickTimer() {
  const el = $("hudTimer");
  if (el && !$("escHud").hidden) el.textContent = Logic.fmtElapsed(elapsedSec());
}
function startTimerLoop() { if (timerHandle) clearInterval(timerHandle); timerHandle = setInterval(tickTimer, 1000); }

function roomsNow() { return Logic.roomsFor(S.mode, ROOMS); }
function roomDone(r) { return r.puzzles.every((p) => S.esc.solved[p.id]); }
function roomKey(r) { const k = r.puzzles.find((p) => p.type === "key"); return k ? String(k.answer) : ""; }
function teamIdx() { return S.solo ? -1 : TEAMS.findIndex((t) => t.id === S.team); }
function vaultOrderNow() { return Logic.vaultOrder(teamIdx(), roomsNow().length); }
function curEscCode() { return S.solo ? Logic.soloCode(S.sid) : Logic.teamCode(S.ban, S.team || "팀"); } // 입장 뒤 팀을 바꿔도 조번호가 따라간다
function escNow() { return Logic.escScore(S.esc, roomsNow(), SCORING); }
function roomOpen(i) {
  if (S.solo || skip()) return true;
  return i === S.esc.role || i === S.esc.help;
}
function canHelp() { const rooms = roomsNow(); return !S.solo && S.esc.help < 0 && S.esc.role >= 0 && roomDone(rooms[S.esc.role]); }
const PUZ_ICON = { match: "🏺", choice: "📜", order: "🪜", key: "🔑" };

function renderEscapeEntry() {
  if (!S.esc) S.esc = newEsc();
  if (S.esc.start) { renderRooms(); show("scrRooms"); return; }
  const tm = teamOf(S.team);
  $("escFirstLine").textContent = S.solo ? "🧑 개인용(?solo=1) — 모든 전시실이 열려 있어" : "📱 내 태블릿으로 «담당 전시실» 하나를 맡는다";
  $("escTeam").innerHTML = S.solo ? "개인용: 기록 이름은 <b>" + esc(Logic.soloCode(S.sid)) + "</b>" :
    (tm ? '우리 팀: <b>' + esc(teamTitle(tm)) + '</b> <button type="button" class="btn ghost small" id="escTeamChange">팀 바꾸기</button><div id="escTeamPick" hidden></div>' : '<span class="err">첫 화면에서 팀을 먼저 골라 줘.</span>');
  const tc = $("escTeamChange"); if (tc) tc.addEventListener("click", () => { const p = $("escTeamPick"); p.hidden = !p.hidden; if (!p.hidden) renderTeamPick(p, renderEscapeEntry); });
  const rooms = roomsNow();
  $("rolePick").innerHTML = rooms.map((r, i) => '<button type="button" class="chip role-chip' + (S.esc.role === i ? " sel" : "") + '" data-i="' + i + '">' + r.emoji + " " + (i + 1) + "실 " + esc(r.title) + "</button>").join("");
  $("rolePick").querySelectorAll(".role-chip").forEach((b) => b.addEventListener("click", () => { S.esc.role = Number(b.dataset.i); save(); renderEscapeEntry(); }));
  $("roleNote").textContent = S.solo ? "처음 풀 방을 골라. 점수는 이 방을 «담당 방»으로 계산해." : "팀원끼리 먼저 정하고 각자 눌러. 방마다 1~2명씩. 담당 방 열쇠 숫자는 그 방을 맡은 사람만 알게 돼 — 다른 팀원들이 너에게 물어볼 거야.";
  $("startEscape").disabled = !((S.team || S.solo || skip()) && S.esc.role >= 0);
  show("scrEscape");
}
function startEscape() {
  if (S.esc.role < 0) return;
  S.esc.team = S.solo ? Logic.soloCode(S.sid) : Logic.teamCode(S.ban, S.team || "팀");
  S.esc.start = Date.now();
  save();
  renderRooms(); show("scrRooms"); startTimerLoop();
}

/* 평면도: 전시실 타일 + 수장고 문 */
function renderRooms() {
  const rooms = roomsNow();
  const order = vaultOrderNow();
  const sc = escNow();
  const h = ['<div class="floor-head"><h2>🗺️ 박물관 평면도</h2><span>' + esc(curEscCode()) + ' · 담당 ' + (S.esc.role + 1) + '실</span></div><div class="floor-in">'];
  rooms.forEach((r, i) => {
    const n = r.puzzles.filter((p) => S.esc.solved[p.id]).length;
    const done = roomDone(r);
    const open = roomOpen(i);
    const tag = i === S.esc.role ? '<span class="r-tag">내 담당</span>' : (i === S.esc.help ? '<span class="r-tag help">도우러 감</span>' : "");
    let key;
    if (done) key = '<span class="r-key">🔑 ' + roomKey(r) + '</span>';
    else if (open) key = '<span class="r-key locked">퍼즐 ' + n + '/' + r.puzzles.length + '</span>';
    else if (canHelp()) key = '<span class="r-key locked">🤝 도우러 가기</span>';
    else key = '<span class="r-key locked">🔒 담당 친구에게 숫자를 물어봐</span>';
    h.push('<button type="button" class="room-tile reveal ' + r.era + (done ? " done" : "") + (open ? "" : " shut") + '" data-i="' + i + '"><span class="door"></span><span class="cases">' + r.puzzles.map((p) => '<span class="case' + (S.esc.solved[p.id] ? " on" : "") + '"></span>').join("") + '</span>' +
      '<span class="r-title">' + (i + 1) + '실. ' + esc(r.title) + '</span><span class="r-sub">' + esc(r.sub) + '</span>' + tag + key + '</button>');
  });
  const orderTxt = order.map((i) => (i + 1) + "실").join(" → ");
  if (S.esc.escapedAt) {
    h.push('<button type="button" class="room-tile vault-tile reveal" id="toEscaped"><span class="wheel"></span><span class="r-title">🎉 수장고 열림 — 탈출!</span><span class="r-sub">' + Logic.fmtElapsed(elapsedSec()) + '</span><span class="r-key">기록 보기</span></button>');
  } else {
    h.push('<button type="button" class="room-tile vault-tile reveal" id="toVault"><span class="wheel"></span><span class="r-title">🚪 수장고 문</span><span class="r-sub">우리 팀 순서: ' + orderTxt + '</span><span class="r-key">열쇠 숫자 ' + rooms.length + '개를 모아서</span></button>');
  }
  h.push("</div>");
  h.push('<div class="floor-foot"><span>내 점수 <b>' + sc.score + '</b>/20 · 담당 방 ' + sc.role + ' · 수장고 ' + sc.vault + ' · 자물쇠 ' + sc.final + ' · 도움 ' + sc.help + '</span>' +
    (S.esc.escapedAt ? "" : '<button type="button" class="btn small" id="submitNow">지금까지 기록 제출</button>') + '</div><p class="err" id="floorErr"></p><p class="ok" id="floorMsg"></p>');
  $("floorMap").innerHTML = h.join("");
  reveal($("floorMap"));
  $("floorMap").querySelectorAll(".room-tile[data-i]").forEach((b) => b.addEventListener("click", () => tryOpenRoom(Number(b.dataset.i))));
  const te = $("toEscaped"); if (te) te.addEventListener("click", () => { renderEscaped(); show("scrEscaped"); });
  const tv = $("toVault"); if (tv) tv.addEventListener("click", () => { renderVault(); show("scrVault"); });
  const sn = $("submitNow"); if (sn) sn.addEventListener("click", () => submitEscape("floor"));
  renderTop(); startTimerLoop();
}
function tryOpenRoom(i) {
  if (roomOpen(i)) { openRoom(i); return; }
  if (canHelp()) {
    if (!confirm((i + 1) + "실을 도우러 갈까? 도우러 가는 방은 한 곳만 고를 수 있어.")) return;
    S.esc.help = i; save(); openRoom(i); return;
  }
  $("floorErr").textContent = (i + 1) + "실은 담당 친구가 풀고 있어. 열쇠 숫자는 그 친구에게 물어봐." + (S.esc.role >= 0 && !roomDone(roomsNow()[S.esc.role]) ? " 내 담당 방을 다 풀면 한 방을 도우러 갈 수 있어." : "");
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
  const seed = S.sid || "t"; // 보기 순서는 학생마다 다르다(같은 방 친구 화면을 그대로 베끼지 못하게)
  // 진열장 벽: 퍼즐 하나 = 진열장 하나
  $("roomShelf").innerHTML = '<div class="shelf-title"><span>' + r.emoji + ' ' + (S.esc.roomIdx + 1) + '실 ' + esc(r.title) + ' <span style="opacity:.8">' + esc(r.sub) + '</span></span><button type="button" class="btn small" id="backRooms" style="box-shadow:none">← 평면도</button></div>' +
    '<div class="shelf-row">' + r.puzzles.map((pp, k) => '<button type="button" class="case-btn' + (S.esc.solved[pp.id] ? " done" : "") + (k === S.esc.puzIdx ? " cur" : "") + '" data-k="' + k + '"><span class="c-item">' + PUZ_ICON[pp.type] + '</span>' + esc(pp.id) + (S.esc.solved[pp.id] ? " ✓" : "") + '</button>').join("") + '</div>';
  $("roomShelf").querySelectorAll(".case-btn").forEach((b) => b.addEventListener("click", () => { S.esc.puzIdx = Number(b.dataset.k); save(); renderPuzzle(); }));
  $("backRooms").addEventListener("click", () => { renderRooms(); show("scrRooms"); });

  const typeName = { match: "짝 맞추기", order: "순서 정렬", choice: "사료 읽고 고르기", key: "열쇠 숫자" }[p.type];
  const isRole = S.esc.roomIdx === S.esc.role;
  const h = ['<div class="eyebrow">📋 안내판 ' + esc(p.id) + ' · ' + esc(typeName) + ' · <span class="muted">' + esc(p.page) + '</span></div>'];
  h.push('<p style="font-size:1.05rem">' + esc(p.q) + '</p>');

  if (solved) {
    h.push('<p class="result-line good">✓ 해결한 퍼즐이야.</p>');
    if (p.type === "key") h.push('<div class="key-reveal">🔑 ' + (S.esc.roomIdx + 1) + '실 열쇠 숫자: ' + esc(p.answer) + '</div><p class="muted">팀원들에게 «' + (S.esc.roomIdx + 1) + '실은 ' + esc(p.answer) + '»라고 알려 줘. 너도 다른 방 숫자를 물어 모아.</p>');
  } else if (p.type === "match") {
    const rights = orderOf(p.pairs.length, p.id + ":" + seed, true);
    st.rights = rights; st.map = st.map || {}; st.selLeft = null;
    const usedRi = new Set(Object.keys(st.map).map((k) => st.map[k]));
    h.push('<div class="match-grid"><div class="match-col"><h3>유물</h3>' + p.pairs.map((pr, i) => '<button type="button" class="m-item m-left' + (st.map[i] != null ? " paired" : "") + '" data-i="' + i + '"><span class="m-tag">' + CIRC[i] + '</span>' + esc(pr[0]) + (st.map[i] != null ? ' <span class="m-tag">→ ' + KOR[rights.indexOf(st.map[i])] + '</span>' : "") + '</button>').join("") + '</div>');
    h.push('<div class="match-col"><h3>설명</h3>' + rights.map((ri, k) => '<button type="button" class="m-item m-right' + (usedRi.has(ri) ? " used" : "") + '" data-ri="' + ri + '"><span class="m-tag">' + KOR[k] + '</span>' + esc(p.pairs[ri][1]) + (usedRi.has(ri) ? '<span class="m-used">사용됨</span>' : "") + '</button>').join("") + '</div></div>');
    h.push('<p class="muted">왼쪽 유물을 누르고, 맞는 설명을 눌러 짝지어. 쓴 설명은 «사용됨»으로 표시돼(다시 누르면 옮겨져). 네 쌍을 다 지으면 확인.</p>');
    h.push('<button type="button" class="btn primary" id="checkBtn">확인</button>');
  } else if (p.type === "order") {
    if (!st.arr) { st.arr = Logic.shuffle(p.items, Logic.seeded(p.id + ":" + seed)); if (st.arr.join() === p.items.join()) st.arr = st.arr.slice().reverse(); }
    h.push('<ol class="order-list">' + st.arr.map((it, i) => '<li class="order-item"><span class="o-no">' + (i + 1) + '</span><span class="o-txt">' + esc(it) + '</span><button type="button" class="o-btn" data-up="' + i + '" aria-label="위로">▲</button><button type="button" class="o-btn" data-down="' + i + '" aria-label="아래로">▼</button></li>').join("") + '</ol>');
    h.push('<p class="muted">▲▼로 순서를 바꿔. 1번이 가장 이른 것.</p><button type="button" class="btn primary" id="checkBtn">확인</button>');
  } else if (p.type === "choice") {
    h.push('<div class="choice-grid">' + orderOf(p.options.length, seed + ":" + p.id).map((i, k) => '<button type="button" class="choice" data-i="' + i + '">' + CIRC[k] + ' ' + esc(p.options[i]) + '</button>').join("") + '</div>');
  } else if (p.type === "key") {
    h.push('<p><input id="keyIn" class="key-input" inputmode="numeric" maxlength="1" autocomplete="off" aria-label="열쇠 숫자"></p><button type="button" class="btn primary" id="checkBtn">확인</button>');
  }
  h.push('<p class="err" id="puzErr"></p>');
  if (!solved) h.push('<button type="button" class="btn ghost small" id="hintBtn">💡 힌트 보기' + (isRole ? " (이 퍼즐은 1점이 돼)" : "") + '</button><p class="hint-box" id="puzHint"' + (st.hint ? "" : " hidden") + '>' + esc(p.hint) + '</p>');
  if (skip() && !solved) h.push('<button type="button" class="btn ghost small" id="skipPuz">미리보기: 해결 처리</button>');
  h.push('<div class="row-between" style="margin-top:.8rem"><button type="button" class="btn" id="backRooms2">← 평면도</button>' + (solved ? '<button type="button" class="btn primary" id="nextPuz">다음 진열장 →</button>' : "") + '</div>');

  const card = $("puzzleCard");
  card.innerHTML = h.join("");
  $("backRooms2").addEventListener("click", () => { renderRooms(); show("scrRooms"); });
  const nx = $("nextPuz"); if (nx) nx.addEventListener("click", () => { const k = r.puzzles.findIndex((pp) => !S.esc.solved[pp.id]); if (k < 0) { renderRooms(); show("scrRooms"); } else { S.esc.puzIdx = k; save(); renderPuzzle(); } });
  const hb = $("hintBtn"); if (hb) hb.addEventListener("click", () => { if (!st.hint) { st.hint = true; S.esc.hints++; save(); } $("puzHint").hidden = false; renderTop(); });
  const sp = $("skipPuz"); if (sp) sp.addEventListener("click", () => { S.esc.solved[p.id] = true; save(); renderPuzzle(); });

  if (solved) { renderTop(); return; }
  const miss = (msg) => { $("puzErr").textContent = msg; card.classList.add("shake"); setTimeout(() => card.classList.remove("shake"), 400); save(); renderTop(); };
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
      if (res.correct) solvePuzzle(p); else miss(res.ok + "/" + res.total + " 맞음. 짝을 바꿔 다시 해 봐.");
    });
  } else if (p.type === "order") {
    card.querySelectorAll("[data-up]").forEach((b) => b.addEventListener("click", () => { const i = Number(b.dataset.up); if (i > 0) { const t = st.arr[i]; st.arr[i] = st.arr[i - 1]; st.arr[i - 1] = t; save(); renderPuzzle(); } }));
    card.querySelectorAll("[data-down]").forEach((b) => b.addEventListener("click", () => { const i = Number(b.dataset.down); if (i < st.arr.length - 1) { const t = st.arr[i]; st.arr[i] = st.arr[i + 1]; st.arr[i + 1] = t; save(); renderPuzzle(); } }));
    $("checkBtn").addEventListener("click", () => {
      const res = Logic.checkOrder(p.items, st.arr); st.tries++;
      if (res.correct) solvePuzzle(p); else miss(res.ok + "/" + res.total + " 자리가 맞아. 다시 놓아 봐.");
    });
  } else if (p.type === "choice") {
    card.querySelectorAll(".choice").forEach((b) => b.addEventListener("click", () => {
      st.tries++;
      if (Logic.checkChoice(p, b.dataset.i).correct) { b.classList.add("right"); solvePuzzle(p); }
      else { b.classList.add("wrong"); b.disabled = true; miss("아니야. 사료를 다시 읽어 봐."); }
    }));
  } else if (p.type === "key") {
    $("checkBtn").addEventListener("click", () => {
      st.tries++;
      if (Logic.checkKey(p, $("keyIn").value).correct) solvePuzzle(p); else miss("그 숫자가 아니야.");
    });
    $("keyIn").addEventListener("keydown", (e) => { if (e.key === "Enter") $("checkBtn").click(); });
  }
  renderTop();
}

function solvePuzzle(p) {
  S.esc.solved[p.id] = true; save();
  setTimeout(renderPuzzle, 350);
}

/* 수장고 문: 번호판(우리 팀 순서) → 마지막 자물쇠(순서 정렬) */
function renderVault() {
  const rooms = roomsNow();
  const order = vaultOrderNow();
  const st = S.esc.attempts.V1 || (S.esc.attempts.V1 = { hint: false, tries: 0 });
  const items = S.mode === "flex" ? VAULT.final.flexItems : VAULT.final.items;
  const h = ['<h2>🚪 수장고 문</h2>'];
  if (!S.esc.vaultCode) {
    h.push('<p>' + esc(VAULT.code_hint) + '</p>');
    h.push('<p class="vault-order">우리 팀 순서: ' + order.map((i) => '<span class="vo-room">' + (i + 1) + '실' + (roomDone(rooms[i]) ? " " + roomKey(rooms[i]) : " ?") + '</span>').join(" → ") + '</p>');
    h.push('<div class="keypad"><input id="codeIn" class="code-input" inputmode="numeric" maxlength="' + rooms.length + '" autocomplete="off" aria-label="수장고 번호"></div>');
    h.push('<p><button type="button" class="btn primary" id="codeBtn">열기</button></p><p class="err" id="vErr"></p>');
  } else {
    if (!st.arr) { st.arr = Logic.shuffle(items, Logic.seeded("V1:" + (S.sid || "t"))); if (st.arr.join() === items.join()) st.arr = st.arr.slice().reverse(); }
    h.push('<p class="result-line good" style="color:#8cff9a">🔓 번호가 맞았다! 마지막 자물쇠 하나.</p><p>' + esc(VAULT.final.q) + ' <span class="muted">(' + esc(VAULT.final.page) + ')</span></p>');
    h.push('<ol class="order-list">' + st.arr.map((it, i) => '<li class="order-item"><span class="o-no">' + (i + 1) + '</span><span class="o-txt">' + esc(it) + '</span><button type="button" class="o-btn" data-up="' + i + '" aria-label="위로">▲</button><button type="button" class="o-btn" data-down="' + i + '" aria-label="아래로">▼</button></li>').join("") + '</ol>');
    h.push('<button type="button" class="btn primary" id="finalBtn">자물쇠 열기</button><p class="err" id="vErr"></p>');
    h.push('<button type="button" class="btn ghost small" id="vHintBtn" style="color:#fff">💡 힌트 보기</button><p class="hint-box" id="vHint"' + (st.hint ? "" : " hidden") + '>' + esc(VAULT.final.hint) + '</p>');
  }
  h.push('<p style="margin-top:.8rem"><button type="button" class="btn" id="vBack">← 평면도</button></p>');
  const card = $("vaultCard");
  card.innerHTML = h.join("");
  $("vBack").addEventListener("click", () => { renderRooms(); show("scrRooms"); });
  const cb = $("codeBtn");
  if (cb) {
    cb.addEventListener("click", () => {
      const ok = $("codeIn").value.trim() === Logic.vaultCode(rooms, order) || (skip() && !$("codeIn").value.trim());
      if (ok) { S.esc.vaultCode = true; save(); renderVault(); } else { $("vErr").textContent = "번호가 틀렸어. «우리 팀 순서»대로 열쇠 숫자를 다시 모아 봐."; card.classList.add("shake"); setTimeout(() => card.classList.remove("shake"), 400); }
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
  const sc = escNow();
  $("escapedSummary").innerHTML = "<b>" + esc(curEscCode()) + "</b> · 담당 " + (S.esc.role + 1) + "실 · 걸린 시간 " + Logic.fmtElapsed(elapsedSec()) +
    "<br>내 점수 <b>" + sc.score + "</b>/20 (담당 방 " + sc.role + " · 수장고 " + sc.vault + " · 자물쇠 " + sc.final + " · 도움 " + sc.help + ")";
  const done = S.esc.submittedEscaped;
  $("submitEscape").disabled = done; $("submitEscape").textContent = done ? "제출 완료" : "탈출 기록 제출";
  if (done) $("escMsg").textContent = "기록이 선생님 화면에 들어갔어. 아직 못 나온 팀원에게 숫자를 알려 줘 — 팀 전원이 탈출하면 보너스야!";
}

/* 제출: 수업 끝까지 못 나와도 «지금까지 기록 제출»로 낸다(미제출은 팀 평균에서 0점). 점수가 오르면 다시 낼 수 있고, 결산판은 마지막 줄을 쓴다. */
async function submitEscape(from) {
  const fromFloor = from === "floor";
  const errEl = fromFloor ? $("floorErr") : $("escErr"), msgEl = fromFloor ? $("floorMsg") : $("escMsg");
  const btn = fromFloor ? $("submitNow") : $("submitEscape");
  const sc = escNow();
  const escaped = !!S.esc.escapedAt;
  if (S.sending) return;
  if (S.esc.submittedScore === sc.score && S.esc.submittedEscaped === escaped) { msgEl.textContent = "이미 이 점수로 제출했어."; return; }
  const sec = elapsedSec();
  const tries = Object.keys(S.esc.attempts).map((k) => k + ":" + (S.esc.attempts[k].tries || 0) + (S.esc.attempts[k].hint ? "h" : "")).join(" ");
  const payload = {
    studentId: S.sid, studentName: S.name, gameName: CONFIG.GAME_ESCAPE,
    groupId: curEscCode(),
    choiceSummary: "점수 " + sc.score + " · " + (S.solo ? "개인" : (S.team || "")) + " · 담당 " + (S.esc.role + 1) + "실 · " + (escaped ? "탈출함" : "탈출 못 함") + " · " + Logic.fmtElapsed(sec) + " · " + S.mode,
    diffSummary: "",
    reflection: (escaped ? "탈출 " : "진행 ") + Logic.fmtElapsed(sec) + " · " + curEscCode() + " · 담당 " + (S.esc.role + 1) + "실 · 점수 " + sc.score + " · 힌트 " + S.esc.hints + "회 · 시도 " + tries,
    choicesJson: JSON.stringify({ team: S.team || "", teamCode: curEscCode(), solo: !!S.solo, mode: S.mode, role: S.esc.role, help: S.esc.help, score: sc, escaped: escaped, elapsedSec: sec, hints: S.esc.hints, start: S.esc.start, escapedAt: S.esc.escapedAt, attempts: S.esc.attempts, ts: new Date().toISOString() })
  };
  Object.assign(payload, FocusGuard.payload());
  S.sending = true; if (btn) { btn.disabled = true; btn.textContent = "보내는 중…"; }
  try {
    await postToSheet(payload);
  } catch (e) {
    errEl.textContent = e.locked ? e.message : "저장이 안 됐어. 인터넷을 확인하고 다시 눌러 줘.";
    S.sending = false; if (btn) { btn.disabled = false; btn.textContent = fromFloor ? "지금까지 기록 제출" : "탈출 기록 제출"; }
    return;
  }
  S.sending = false; S.esc.submittedScore = sc.score; S.esc.submittedEscaped = escaped; save();
  if (btn) { btn.disabled = !fromFloor; btn.textContent = fromFloor ? "지금까지 기록 제출" : "제출 완료"; }
  errEl.textContent = "";
  msgEl.textContent = S.preview ? "미리보기라 저장하지 않았어." : "제출했어! 내 점수 " + sc.score + "점이 팀 평균에 들어가." + (escaped ? "" : " 더 풀면 다시 낼 수 있어.");
}

/* ───────── 교사 화면: 팀 뽑기(?screen=teams) · 결산판(?screen=board) ─────────
 * 학번·이름 명단은 공개 레포에 두지 않는다. 번호 목록·붙여 넣은 행·확정한 팀은 이 기기(교사 PC) 브라우저에만 남는다(localStorage). 서버에 보내지 않는다. */
const BANS = [5, 6, 7, 8];
function tKey(kind, ban) { return "culture-dig:teacher:" + kind + ":" + ban; }
function tLoad(kind, ban) { try { return JSON.parse(localStorage.getItem(tKey(kind, ban)) || "null"); } catch (e) { return null; } }
function tSave(kind, ban, v) { try { localStorage.setItem(tKey(kind, ban), JSON.stringify(v)); } catch (e) { /* 저장소 막힘 */ } }
const T = { ban: 5, draw: null, salt: 0 };

function banSelect(id, onChange) {
  const el = $(id);
  el.innerHTML = BANS.map((b) => '<option value="' + b + '"' + (b === T.ban ? " selected" : "") + ">3학년 " + b + "반</option>").join("");
  el.onchange = () => { T.ban = Number(el.value); onChange(); };
}

function renderTeams() {
  banSelect("tBan", () => { T.draw = null; renderTeams(); });
  const saved = tLoad("teams", T.ban);
  if (!$("tNos").dataset.ban || Number($("tNos").dataset.ban) !== T.ban) {
    const inp = tLoad("input", T.ban) || {};
    $("tNos").value = inp.nos || (saved ? Object.keys(saved.assign).join(", ") : "");
    $("tPaste").value = inp.paste || "";
    $("tNos").dataset.ban = T.ban;
  }
  const shown = T.draw || saved;
  $("tStatus").innerHTML = saved ? "확정한 팀이 있어(" + esc(saved.at || "") + "). «뽑기»를 다시 누르면 새로 뽑고, «확정»해야 바뀐다." : "아직 확정한 팀이 없어.";
  $("tConfirm").disabled = !T.draw;
  $("tResult").innerHTML = shown ? teamBoardHtml(shown) : "";
}
function teamBoardHtml(d) {
  const by = {}; TEAMS.forEach((t) => { by[t.id] = []; });
  Object.keys(d.assign).map(Number).sort((a, b) => a - b).forEach((no) => by[d.assign[no]].push(no));
  return '<p class="muted">' + (d.withPref ? "성향 테스트 낸 학생 " + d.withPref + "명 중 1지망 " + d.first + "명 · 2지망 " + d.second + "명" : "성향 테스트 결과 없이 랜덤") + " · 팀 인원 " + TEAMS.map((t) => by[t.id].length).join("/") + "</p>" +
    '<div class="board-teams">' + TEAMS.map((t) => '<div class="bt-col" data-team="' + esc(t.id) + '"><div class="bt-head">' + t.emoji + " " + esc(t.id) + '<small>발굴단 · ' + by[t.id].length + '명</small></div><div class="bt-nos">' + by[t.id].map((no) => "<span>" + no + "</span>").join("") + "</div></div>").join("") + "</div>";
}
function doDraw() {
  const nos = Logic.parseNumbers($("tNos").value);
  tSave("input", T.ban, { nos: $("tNos").value, paste: $("tPaste").value });
  if (!nos.length) { $("tErr").textContent = "번호를 넣어 줘(예: 1-13, 21-34)."; return; }
  $("tErr").textContent = "";
  const rows = Logic.parsePasted($("tPaste").value, T.ban, CONFIG.GAME_QUIZ, GAME_NAMES, TEAMS);
  const prefs = {}; Object.keys(rows).forEach((no) => { if (rows[no].prefs) prefs[no] = rows[no].prefs; });
  const stray = Object.keys(prefs).filter((no) => nos.indexOf(Number(no)) < 0);
  T.salt++;
  T.draw = Logic.drawTeams(nos, prefs, TEAMS, T.ban + ":" + Date.now() + ":" + T.salt);
  T.draw.at = new Date().toLocaleString("ko-KR");
  if (stray.length) $("tErr").textContent = "번호 목록에 없는데 테스트를 낸 번호: " + stray.join(", ") + " (넣으려면 번호 목록에 더해 다시 뽑기)";
  renderTeams();
}
function doConfirm() {
  if (!T.draw) return;
  tSave("teams", T.ban, T.draw);
  T.draw = null; renderTeams();
  $("tStatus").innerHTML += " <b>확정했어.</b> 칠판에 띄우면 학생들이 자기 팀을 고른다.";
}

function renderBoard() {
  banSelect("bBan", () => { $("bPaste").value = ""; renderBoard(); });
  const teams = tLoad("teams", T.ban);
  const kind = $("bKind").value;
  if (!teams) { $("bOut").innerHTML = '<p class="err">' + T.ban + '반은 «팀 뽑기»에서 확정한 팀이 없어. 먼저 팀을 확정해 줘(이 기기에서).</p>'; $("bAbsent").innerHTML = ""; return; }
  const st = tLoad("board:" + kind, T.ban) || { absent: [], paste: "" };
  if ($("bPaste").dataset.k !== T.ban + kind) { $("bPaste").value = st.paste || ""; $("bPaste").dataset.k = T.ban + kind; }
  const absent = st.absent || [];
  const nos = Object.keys(teams.assign).map(Number).sort((a, b) => a - b);
  $("bAbsent").innerHTML = TEAMS.map((t) => '<div class="ab-row"><span class="ab-team">' + t.emoji + " " + esc(t.id) + '</span>' + nos.filter((no) => teams.assign[no] === t.id).map((no) => '<button type="button" class="chip ab-chip' + (absent.indexOf(no) >= 0 ? " off" : "") + '" data-no="' + no + '">' + no + "</button>").join("") + "</div>").join("");
  $("bAbsent").querySelectorAll(".ab-chip").forEach((b) => b.addEventListener("click", () => {
    const no = Number(b.dataset.no); const k = absent.indexOf(no);
    if (k >= 0) absent.splice(k, 1); else absent.push(no);
    tSave("board:" + kind, T.ban, { absent: absent, paste: $("bPaste").value }); renderBoard();
  }));
  const game = kind === "escape" ? CONFIG.GAME_ESCAPE : CONFIG.GAME_DIG;
  const rows = Logic.parsePasted($("bPaste").value, T.ban, game, GAME_NAMES, TEAMS);
  const stray = Object.keys(rows).filter((no) => !teams.assign[no]);
  if (!Object.keys(rows).length) { $("bOut").innerHTML = '<p class="muted">제출 행을 붙여 넣으면 팀별 평균·순위 포인트가 나와. (학번과 «점수 n»이 든 줄만 읽어.)</p>'; try { localStorage.removeItem(tKey("result:" + kind, T.ban)); } catch (e) { /* 무시 */ } return; }
  const res = Logic.teamResults(teams.assign, absent, rows, kind, TEAMS, SCORING);
  if (Object.keys(rows).length) tSave("result:" + kind, T.ban, res); else { try { localStorage.removeItem(tKey("result:" + kind, T.ban)); } catch (e) { /* 무시 */ } } // 붙여 넣기 전 빈 결과가 합계에 섞이지 않게
  const other = tLoad("result:" + (kind === "escape" ? "dig" : "escape"), T.ban);
  const sorted = TEAMS.slice().sort((a, b) => res[a.id].rank - res[b.id].rank);
  const h = ['<table class="board-table"><thead><tr><th>순위</th><th>팀</th><th>출석</th><th>제출</th>' + (kind === "escape" ? "<th>탈출</th>" : "") + '<th>평균</th><th>순위 포인트</th><th>보너스</th><th>이번 차시</th>' + (other ? "<th>문화사 합계</th>" : "") + "</tr></thead><tbody>"];
  sorted.forEach((t) => {
    const r = res[t.id];
    h.push("<tr><td>" + r.rank + "위</td><td>" + t.emoji + " " + esc(t.id) + "</td><td>" + r.present + "</td><td>" + r.submitted + "</td>" + (kind === "escape" ? "<td>" + r.escaped + "</td>" : "") + "<td><b>" + r.avg + "</b></td><td>" + r.points + "</td><td>" + (r.bonus ? "+" + r.bonus : "0") + "</td><td><b>" + r.total + "</b></td>" + (other ? "<td><b>" + (r.total + (other[t.id] ? other[t.id].total : 0)) + "</b></td>" : "") + "</tr>");
  });
  h.push("</tbody></table>");
  h.push('<p class="muted">읽은 제출 ' + Object.keys(rows).length + '명' + (stray.length ? " · 팀 명단에 없는 번호 " + stray.join(", ") + "(계산에서 뺌)" : "") + ' · 결석 ' + absent.length + '명(평균에서 뺌) · 미제출은 0점으로 평균에 들어감.</p>');
  $("bOut").innerHTML = h.join("");
}

function initTeacher(screen) {
  document.body.classList.add("teacher");
  $("topStat").textContent = "선생님 화면";
  if (screen === "teams") {
    show("scrTeams"); renderTeams();
    $("tDraw").addEventListener("click", doDraw);
    $("tConfirm").addEventListener("click", doConfirm);
  } else {
    show("scrBoard"); renderBoard();
    $("bKind").addEventListener("change", renderBoard);
    $("bPaste").addEventListener("input", () => {
      const kind = $("bKind").value; const st = tLoad("board:" + kind, T.ban) || { absent: [] };
      st.paste = $("bPaste").value; tSave("board:" + kind, T.ban, st); renderBoard();
    });
  }
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
  if (screen === "dig") { if (S.team || (S.quiz && S.quiz.ranking) || skip()) startDig(); else { S.after = "dig"; startQuiz(); } }
  else if (screen === "escape") { if (S.team || S.solo || skip()) renderEscapeEntry(); else show("scrHome"); } // 팀이 없으면 첫 화면에서 고른다
  else show("scrHome");
}

function init() {
  const q = new URLSearchParams(location.search);
  S.preview = q.get("preview") === "1";
  S.mode = q.get("mode") === "flex" ? "flex" : "basic";
  S.solo = q.get("solo") === "1";
  if (S.preview) $("previewBar").hidden = false;

  $("brandBtn").addEventListener("click", () => { if (document.body.classList.contains("teacher")) return; renderHome(); show("scrHome"); }); // 교사 화면에서는 학생 흐름을 열지 않는다
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

  const tscr = q.get("screen");
  if (tscr === "teams" || tscr === "board") { initTeacher(tscr); return; } // 교사 화면: 로그인·학생 기록 없음

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
