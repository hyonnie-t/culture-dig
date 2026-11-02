/* app.js — 화면 흐름. 데이터는 data.js, 판정은 logic.js.
 * 규칙(webapp-rules): 함수 선언을 먼저 끝내고 init()은 파일 맨 끝에서 부른다(TDZ). FocusGuard·DraftGuard는 학번이 확정되는 지점에서.
 * 제출: 기본 제출 경로(gameName·studentId·studentName·reflection·choiceSummary·choicesJson·groupId). 백엔드 URL은 history26 스킬 문서와 grep으로 대조했다.
 */
const CONFIG = {
  SHEET_WEBAPP_URL: "https://script.google.com/macros/s/AKfycbyXSjCfWY_HiZFqW_OBR-FQDoIfF1z_STqyKWUI31MacHeY3u7hbirFSFDvW-5yuUHaJQ/exec",
  GAME_DIG: "문화사_유물발굴",        // 커리큘럼 활동 id와 글자까지 같게
  GAME_ESCAPE: "문화사_박물관방탈출",
  HINT_PENALTY_SEC: 60,
  WRONG_PENALTY_SEC: 20 // 4지선다·열쇠 숫자 오답 1회마다(찍기 방지)
};

const S = {
  sid: "", name: "", grade: 0, ban: 0, no: 0, preview: false,
  mode: "basic", screen: "", house: null,
  dig: null, esc: null, sending: false
};
let timerHandle = null;

const $ = (id) => document.getElementById(id);
const skip = () => S.preview; // 미리보기: 필수 활동을 안 해도 넘어간다
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CIRC = ["①", "②", "③", "④", "⑤"], KOR = ["ㄱ", "ㄴ", "ㄷ", "ㄹ", "ㅁ"];

/* ───────── 저장(새로고침 대비) ───────── */
function storeKey(kind) { return "culture-dig:" + kind + ":" + S.mode + ":" + S.sid; }
function save() {
  if (S.preview || !S.sid) return;
  try {
    localStorage.setItem(storeKey("dig"), JSON.stringify({ house: S.house, dig: S.dig }));
    localStorage.setItem(storeKey("esc"), JSON.stringify({ esc: S.esc }));
  } catch (e) { /* 저장소 막힘 — 무시 */ }
}
function load() {
  if (S.preview || !S.sid) return;
  try {
    const d = JSON.parse(localStorage.getItem(storeKey("dig")) || "null");
    if (d && d.dig && d.dig.mode === S.mode) { S.house = d.house; S.dig = d.dig; }
    else if (d && d.house) S.house = d.house;
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
  const h = S.house ? HOUSES.find((x) => x.id === S.house) : null;
  const parts = [];
  if (h) parts.push(h.emoji + " <b>" + esc(h.name) + "</b>");
  if (S.screen === "scrDig" && S.dig) {
    const sc = Logic.digScore(S.dig.results);
    parts.push("점수 <b>" + sc.score + "</b>");
  }
  if ((S.screen === "scrRooms" || S.screen === "scrPuzzle" || S.screen === "scrVault") && S.esc && S.esc.start) {
    parts.push("⏱ <b class=\"timer\" id=\"timerTxt\">" + Logic.fmtElapsed(elapsedSec()) + "</b>");
  }
  if (S.name) parts.push(esc(S.name));
  t.innerHTML = parts.join(" · ");
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

/* ───────── 첫 화면 ───────── */
function renderHome() {
  const grid = $("houseGrid");
  const rec = S.no ? (S.no - 1) % 4 : -1;
  grid.innerHTML = HOUSES.map((h, i) =>
    '<button type="button" class="house-btn' + (S.house === h.id ? " sel" : "") + (i === rec ? " rec" : "") + '" data-house="' + h.id + '">' +
    '<span class="h-emoji">' + h.emoji + '</span><span class="h-name">' + esc(h.name) + '</span><span class="h-desc">' + esc(h.desc) + '</span></button>'
  ).join("");
  grid.querySelectorAll(".house-btn").forEach((b) => b.addEventListener("click", () => { S.house = b.dataset.house; save(); renderHome(); renderTop(); }));
  const ready = !!S.house || skip();
  $("goDig").disabled = !ready;
  $("goEscape").disabled = !ready;
  $("goDig").querySelector(".act-title").textContent = (S.dig && S.dig.done ? "1차시 · 유물 발굴 (노트 보기)" : "1차시 · 유물 발굴");
  const layers = Logic.layersFor(S.mode, LAYERS).map((id) => LAYERS.find((l) => l.id === id).title).join(" → ");
  $("modeNote").textContent = (S.mode === "flex" ? "유연 모드(3층·5실): " : "공통 모드(2층·4실): ") + layers;
  $("homeEyebrow").textContent = S.mode === "flex" ? "3학년 한국사 · 문화사 · 교과서 36~43, 64~71, 100~109, 128~133쪽" : "3학년 한국사 · 문화사 · 교과서 100~109, 128~133쪽";
  $("modeLink").textContent = " · " + (S.mode === "flex" ? "공통 모드로(고려·조선 전기만)" : "유연 모드로(삼국·남북국 층 추가)");
  $("modeLink").hidden = !S.preview; // 학생 화면에서는 숨긴다(진행이 섞이지 않게). 모드는 선생님이 주소로 정한다.
}

/* ───────── 발굴 ───────── */
function newDig() {
  const order = Logic.layersFor(S.mode, LAYERS);
  return { mode: S.mode, order: order, layerIdx: 0, spotIdx: 0, results: [], cur: null, done: false };
}
function curLayerId() { return S.dig.order[S.dig.layerIdx]; }
function curArts() { return Logic.artifactsOf(curLayerId(), ARTIFACTS); }

function renderStrata() {
  const order = S.dig.order; // 아래부터
  const rows = ['<div class="stratum top">표토<span class="st-sub">지금 서 있는 땅</span></div>'];
  for (let i = order.length - 1; i >= 0; i--) {
    const l = LAYERS.find((x) => x.id === order[i]);
    const arts = Logic.artifactsOf(l.id, ARTIFACTS);
    const got = S.dig.results.filter((r) => r.layer === l.id).length;
    const cls = i < S.dig.layerIdx ? "done" : (i === S.dig.layerIdx ? "active" : "locked");
    rows.push('<div class="stratum ' + l.id + " " + cls + '">' + esc(l.title) + '<span class="st-sub">' + esc(l.sub) + '</span><span class="st-prog">' + (cls === "locked" ? "🔒" : got + "/" + arts.length) + '</span></div>');
  }
  rows.push('<p class="muted" style="margin:.4rem 0 0">⛏️ 아래 층부터 판다</p>');
  $("strata").innerHTML = rows.join("");
}

function renderSpots() {
  const l = LAYERS.find((x) => x.id === curLayerId());
  const arts = curArts();
  const html = ['<h2>' + esc(l.title) + ' <span class="muted">' + esc(l.sub) + '</span></h2>',
    '<p class="muted">흙더미를 순서대로 눌러 파. 이름을 맞히면 발굴, 틀리면 깨져서 복원해야 해.</p>', '<div class="spot-grid">'];
  arts.forEach((a, i) => {
    const r = S.dig.results.find((x) => x.id === a.id);
    if (r) {
      html.push('<div class="spot dug' + (r.broken ? " broken" : "") + '"><span class="sp-emoji">' + a.emoji + '</span>' + esc(a.name) + '<span class="muted">' + (r.intruder ? (r.eraCorrect ? "흘러든 유물 ✓" : "흘러든 유물") : (r.firstTry ? "발굴 ✓" : (r.repaired ? "복원 ✓" : "조각"))) + '</span></div>');
    } else if (i === S.dig.spotIdx) {
      html.push('<button type="button" class="spot next" id="digNext"><span class="sp-emoji">🟫</span>⛏️ 여기 파기</button>');
    } else {
      html.push('<div class="spot waiting"><span class="sp-emoji">🟫</span>' + (i + 1) + '번째</div>');
    }
  });
  html.push("</div>");
  $("spotCard").innerHTML = html.join("");
  const nb = $("digNext");
  if (nb) nb.addEventListener("click", openArtifact);
  renderStrata();
  renderTop();
}

function openArtifact() {
  const arts = curArts();
  const a = arts[S.dig.spotIdx];
  S.dig.cur = { id: a.id, step: a.intruder ? "era1" : "name", tries: 0, repairTries: 0 };
  save();
  renderArtifact();
}

function renderArtifact() {
  const card = $("artCard");
  const arts = curArts();
  const a = arts[S.dig.spotIdx];
  const c = S.dig.cur;
  const l = LAYERS.find((x) => x.id === curLayerId());
  const eraName = ERAS[l.id].name;
  const h = ['<div class="eyebrow">' + esc(l.title) + ' · ' + (S.dig.spotIdx + 1) + '/' + arts.length + '</div>'];
  h.push('<h2>' + a.emoji + ' 흙 속에서 무언가 나왔다</h2>');
  h.push('<div class="clue">' + esc(a.clue) + '</div>');

  if (c.step === "name") {
    const choices = Logic.nameChoices(a, S.dig.spotIdx, S.sid || "preview");
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
    h.push('<div class="note-line">📒 노트: ' + esc(a.note) + '</div>');
    h.push('<button type="button" class="btn primary" id="nextSpot">다음 흙더미 →</button>');
  }
  card.innerHTML = h.join("");
  card.hidden = false;
  renderTop();
  card.classList.remove("pop"); void card.offsetWidth; card.classList.add("pop");
  card.scrollIntoView({ behavior: "smooth", block: "start" });

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
    if (ok) { c.firstTry = true; c.step = "bg"; btn.classList.add("right"); setTimeout(renderArtifact, 350); }
    else { btn.classList.add("wrong"); card.classList.add("shake"); c.step = "repair"; setTimeout(renderArtifact, 400); }
    card.querySelectorAll(".choice").forEach((b) => { b.disabled = true; });
    save();
  } else if (c.step === "bg") {
    const i = Number(btn.dataset.i);
    const ok = i === a.bg.answer;
    card.querySelectorAll(".choice").forEach((b) => { b.disabled = true; });
    btn.classList.add(ok ? "right" : "wrong");
    pushResult(a, { firstTry: !!c.firstTry, repaired: !!c.repaired, broken: !c.firstTry && !c.repaired, bgCorrect: ok });
    c.step = "result"; save();
    setTimeout(renderArtifact, 400);
  } else if (c.step === "era1") {
    card.querySelectorAll(".choice").forEach((b) => { b.disabled = true; });
    if (btn.dataset.v === "no") { btn.classList.add("right"); c.step = "era2"; save(); setTimeout(renderArtifact, 350); }
    else { btn.classList.add("wrong"); card.classList.add("shake"); pushResult(a, { eraCorrect: false }); c.step = "result"; save(); setTimeout(renderArtifact, 400); }
  } else if (c.step === "era2") {
    card.querySelectorAll(".choice").forEach((b) => { b.disabled = true; });
    const ok = btn.dataset.v === a.trueEra;
    btn.classList.add(ok ? "right" : "wrong");
    pushResult(a, { eraCorrect: ok }); c.step = "result"; save();
    setTimeout(renderArtifact, 400);
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
    save(); setTimeout(renderArtifact, 450);
  } else {
    btn.classList.add("wrong"); btn.disabled = true; c.repairTries++;
    if (c.repairTries >= 2) { // 두 번 틀리면 조각으로 남긴다
      card.querySelector(".blank").textContent = a.repair.options[a.repair.answer];
      card.querySelectorAll(".chip").forEach((b) => { b.disabled = true; });
      c.step = "bg"; save(); setTimeout(renderArtifact, 600);
    }
    save();
  }
}

function nextSpot() {
  const arts = curArts();
  if (S.dig.done) return;
  S.dig.spotIdx++;
  S.dig.cur = null;
  $("artCard").hidden = true; $("artCard").innerHTML = "";
  if (S.dig.spotIdx >= arts.length) {
    S.dig.layerIdx++; S.dig.spotIdx = 0;
    if (S.dig.layerIdx >= S.dig.order.length) { S.dig.done = true; save(); renderNote(); show("scrNote"); return; }
  }
  save();
  renderSpots();
}

function startDig() {
  if (!S.dig) S.dig = newDig();
  if (S.dig.done) { renderNote(); show("scrNote"); return; }
  show("scrDig");
  renderSpots();
  if (S.dig.cur) renderArtifact(); else $("artCard").hidden = true;
}

/* ───────── 발굴 노트 ───────── */
function renderNote() {
  const sc = Logic.digScore(S.dig.results);
  const h = HOUSES.find((x) => x.id === S.house);
  $("noteSummary").textContent = (h ? h.emoji + " " + h.name + " · " : "") + "발굴 " + sc.found + " · 복원 " + sc.repaired + " · 조각 " + sc.broken + " · 배경 " + sc.bg + " · 흘러든 유물 " + sc.intruder + " → 기숙사 점수 " + sc.score + "점";
  $("noteList").innerHTML = S.dig.results.map((r) => {
    const a = ARTIFACTS.find((x) => x.id === r.id);
    const state = r.intruder ? (ERAS[a.trueEra].name + "에서 흘러든 유물" + (r.eraCorrect ? " ✓" : "")) : (r.firstTry ? "발굴 ✓" : (r.repaired ? "복원 ✓" : "조각")) + (r.bgCorrect ? " · 배경 ✓" : "");
    return '<div class="note-item reveal' + (r.broken ? " broken" : "") + '"><span class="n-emoji">' + a.emoji + '</span><div><div class="n-name">' + esc(a.name) + ' <span class="muted">' + esc(a.page) + '</span></div><div class="n-state">' + esc(state) + '</div><div class="n-note">' + esc(a.note) + '</div></div></div>';
  }).join("");
  reveal($("noteList"));
  $("writePrompt").textContent = WRITING.prompt;
  $("writeMin").textContent = WRITING.min;
  $("writeText").placeholder = WRITING.placeholder;
  $("hintBox").textContent = WRITING.hint;
  const picks = S.dig.results.filter((r) => !r.intruder);
  $("writePick").innerHTML = picks.map((r) => '<option value="' + esc(r.name) + '">' + esc(r.name) + '</option>').join("");
  if (S.dig.submitted) { $("submitDig").disabled = true; $("submitDig").textContent = "제출 완료"; $("noteMsg").textContent = "제출했어. 선생님 화면에 들어갔어."; }
}

async function submitDig() {
  if (S.sending || (S.dig && S.dig.submitted)) return;
  const text = $("writeText").value.trim();
  const n = Logic.countChars(text);
  if (n < WRITING.min && !skip()) { $("noteErr").textContent = "조금만 더 써 줘. " + WRITING.min + "자는 돼야 해."; return; }
  $("noteErr").textContent = "";
  const sc = Logic.digScore(S.dig.results);
  const h = HOUSES.find((x) => x.id === S.house);
  const pick = $("writePick").value;
  const payload = {
    studentId: S.sid, studentName: S.name, gameName: CONFIG.GAME_DIG,
    groupId: h ? h.name : "",
    choiceSummary: (h ? h.name : "기숙사 없음") + " / 발굴 " + sc.found + " 복원 " + sc.repaired + " 조각 " + sc.broken + " 배경 " + sc.bg + " 흘러든 " + sc.intruder + " / " + sc.score + "점 / " + S.mode,
    diffSummary: "",
    reflection: "[" + pick + "] " + text,
    choicesJson: JSON.stringify({ house: h ? h.name : "", mode: S.mode, score: sc, results: S.dig.results, pick: pick, ts: new Date().toISOString() })
  };
  Object.assign(payload, FocusGuard.payload());
  S.sending = true; $("submitDig").disabled = true; $("submitDig").textContent = "보내는 중…";
  try {
    await postToSheet(payload);
  } catch (e) {
    $("noteErr").textContent = e.locked ? e.message : "저장이 안 됐어. 인터넷을 확인하고 다시 눌러 줘.";
    S.sending = false; $("submitDig").disabled = false; $("submitDig").textContent = "발굴 노트 제출";
    return;
  }
  S.sending = false; S.dig.submitted = true; save();
  if (window.DraftGuard) DraftGuard.clear(); // 저장 성공 → 임시저장 삭제
  $("submitDig").textContent = "제출 완료";
  $("noteMsg").textContent = S.preview ? "미리보기라 저장하지 않았어." : "제출했어! 기숙사 점수 " + sc.score + "점이 기록됐어.";
}

/* ───────── 방탈출 ───────── */
function newEsc() {
  const rooms = Logic.roomsFor(S.mode, ROOMS);
  return { mode: S.mode, team: "", teamName: "", start: 0, hints: 0, solved: {}, roomIdx: -1, puzIdx: 0, vaultCode: false, escapedAt: 0, submitted: false, attempts: {} };
}
function elapsedSec() {
  if (!S.esc || !S.esc.start) return 0;
  const end = S.esc.escapedAt || Date.now();
  return Math.round((end - S.esc.start) / 1000) + S.esc.hints * CONFIG.HINT_PENALTY_SEC + (S.esc.wrongs || 0) * CONFIG.WRONG_PENALTY_SEC;
}
function tickTimer() {
  const el = $("timerTxt");
  if (el) el.textContent = Logic.fmtElapsed(elapsedSec());
}
function startTimerLoop() { if (timerHandle) clearInterval(timerHandle); timerHandle = setInterval(tickTimer, 1000); }

function renderEscapeEntry() {
  if (!S.esc) S.esc = newEsc();
  const h = HOUSES.find((x) => x.id === S.house);
  if (!S.esc.team) S.esc.team = Logic.teamCode(S.ban, h ? h.name : "모둠");
  $("teamCode").value = S.esc.team;
  $("teamName").value = S.esc.teamName || "";
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

function renderRooms() {
  const rooms = roomsNow();
  $("roomGrid").innerHTML = rooms.map((r, i) => {
    const n = r.puzzles.filter((p) => S.esc.solved[p.id]).length;
    const done = roomDone(r);
    return '<button type="button" class="room reveal ' + r.era + '" data-i="' + i + '"><span class="r-emoji">' + r.emoji + '</span><span class="r-title">' + (i + 1) + '. ' + esc(r.title) + '</span><span class="r-sub">' + esc(r.sub) + ' · 퍼즐 ' + n + '/' + r.puzzles.length + '</span><span class="r-key' + (done ? "" : " locked") + '">' + (done ? "🔑 " + roomKey(r) : "🔒") + '</span></button>';
  }).join("");
  reveal($("roomGrid"));
  $("roomGrid").querySelectorAll(".room").forEach((b) => b.addEventListener("click", () => openRoom(Number(b.dataset.i))));
  const allDone = rooms.every(roomDone);
  const v = $("vaultEntry");
  if (S.esc.escapedAt) {
    v.innerHTML = '<h2>🎉 이미 탈출했어</h2><p>' + Logic.fmtElapsed(elapsedSec()) + '</p><button type="button" class="btn primary" id="toEscaped">기록 보기</button>';
    $("toEscaped").addEventListener("click", () => { renderEscaped(); show("scrEscaped"); });
  } else {
    v.innerHTML = '<h2>🔐 금고</h2><p>' + esc(VAULT.code_hint) + '</p><p class="muted">열쇠 ' + rooms.filter(roomDone).length + '/' + rooms.length + ' 모음' + (allDone ? " — 금고를 열 수 있어!" : "") + '</p>' +
      '<button type="button" class="btn ' + (allDone || skip() ? "primary" : "ghost") + '" id="toVault"' + (allDone || skip() ? "" : " disabled") + '>금고로 가기</button>';
    $("toVault").addEventListener("click", () => { renderVault(); show("scrVault"); });
  }
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
  const h = ['<div class="eyebrow">' + r.emoji + ' ' + esc(r.title) + ' · <span class="muted">' + esc(p.page) + '</span></div>'];
  h.push('<div class="puz-list">' + r.puzzles.map((pp, k) => '<button type="button" class="puz-pill' + (S.esc.solved[pp.id] ? " done" : "") + (k === S.esc.puzIdx ? " cur" : "") + '" data-k="' + k + '">' + esc(pp.id) + (pp.type === "key" ? " 🔑" : "") + (S.esc.solved[pp.id] ? " ✓" : "") + '</button>').join("") + '</div>');
  const typeName = { match: "짝 맞추기", order: "순서 정렬", choice: "사료 읽고 고르기", key: "열쇠 숫자" }[p.type];
  h.push('<h2>' + esc(typeName) + '</h2><p>' + esc(p.q) + '</p>');

  if (solved) {
    h.push('<p class="result-line good">✓ 해결한 퍼즐이야.</p>');
    if (p.type === "key") h.push('<div class="key-reveal">🔑 이 방의 열쇠 숫자: ' + esc(p.answer) + '</div>');
  } else if (p.type === "match") {
    const rights = orderOf(p.pairs.length, p.id + ":" + (S.esc.team || "t"), true);
    st.rights = rights; st.map = st.map || {}; st.selLeft = null;
    h.push('<div class="match-grid"><div class="match-col"><h3>유물</h3>' + p.pairs.map((pr, i) => '<button type="button" class="m-item m-left' + (st.map[i] != null ? " paired" : "") + '" data-i="' + i + '"><span class="m-tag">' + CIRC[i] + '</span>' + esc(pr[0]) + (st.map[i] != null ? ' <span class="m-tag">→ ' + KOR[rights.indexOf(st.map[i])] + '</span>' : "") + '</button>').join("") + '</div>');
    h.push('<div class="match-col"><h3>설명</h3>' + rights.map((ri, k) => '<button type="button" class="m-item m-right" data-ri="' + ri + '"><span class="m-tag">' + KOR[k] + '</span>' + esc(p.pairs[ri][1]) + '</button>').join("") + '</div></div>');
    h.push('<p class="muted">왼쪽 유물을 누르고, 맞는 설명을 눌러 짝지어. 네 쌍을 다 지으면 확인.</p>');
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
  h.push('<div class="row-between" style="margin-top:.8rem"><button type="button" class="btn" id="backRooms">← 전시실 목록</button>' + (solved ? '<button type="button" class="btn primary" id="nextPuz">다음 퍼즐 →</button>' : "") + '</div>');

  const card = $("puzzleCard");
  card.innerHTML = h.join("");
  card.querySelectorAll(".puz-pill").forEach((b) => b.addEventListener("click", () => { S.esc.puzIdx = Number(b.dataset.k); save(); renderPuzzle(); }));
  $("backRooms").addEventListener("click", () => { renderRooms(); show("scrRooms"); });
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

function renderVault() {
  const rooms = roomsNow();
  const st = S.esc.attempts.V1 || (S.esc.attempts.V1 = { hint: false, tries: 0 });
  const items = S.mode === "flex" ? VAULT.final.flexItems : VAULT.final.items;
  const h = ['<h2>🔐 금고</h2>'];
  if (!S.esc.vaultCode) {
    h.push('<p>' + esc(VAULT.code_hint) + ' (' + rooms.length + '자리)</p>');
    h.push('<p><input id="codeIn" class="code-input" inputmode="numeric" maxlength="' + rooms.length + '" autocomplete="off" aria-label="금고 번호"></p>');
    h.push('<button type="button" class="btn primary" id="codeBtn">열기</button><p class="err" id="vErr"></p>');
  } else {
    if (!st.arr) { st.arr = Logic.shuffle(items, Logic.seeded("V1:" + (S.esc.team || "t"))); if (st.arr.join() === items.join()) st.arr = st.arr.slice().reverse(); }
    h.push('<p class="result-line good">🔓 번호가 맞았다! 마지막 자물쇠 하나.</p><p>' + esc(VAULT.final.q) + ' <span class="muted">(' + esc(VAULT.final.page) + ')</span></p>');
    h.push('<ol class="order-list">' + st.arr.map((it, i) => '<li class="order-item"><span class="o-no">' + (i + 1) + '</span><span class="o-txt">' + esc(it) + '</span><button type="button" class="o-btn" data-up="' + i + '" aria-label="위로">▲</button><button type="button" class="o-btn" data-down="' + i + '" aria-label="아래로">▼</button></li>').join("") + '</ol>');
    h.push('<button type="button" class="btn primary" id="finalBtn">자물쇠 열기</button><p class="err" id="vErr"></p>');
    h.push('<button type="button" class="btn ghost small" id="hintBtn">💡 힌트 보기 (+1분)</button><p class="hint-box" id="puzHint"' + (st.hint ? "" : " hidden") + '>' + esc(VAULT.final.hint) + '</p>');
  }
  h.push('<p style="margin-top:.8rem"><button type="button" class="btn" id="backRooms">← 전시실 목록</button></p>');
  const card = $("vaultCard");
  card.innerHTML = h.join("");
  $("backRooms").addEventListener("click", () => { renderRooms(); show("scrRooms"); });
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
    $("hintBtn").addEventListener("click", () => { if (!st.hint) { st.hint = true; S.esc.hints++; save(); } $("puzHint").hidden = false; renderTop(); });
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
    choiceSummary: S.esc.team + " / " + Logic.fmtElapsed(sec) + " / 힌트 " + S.esc.hints + " / " + S.mode,
    diffSummary: "",
    reflection: "탈출 " + Logic.fmtElapsed(sec) + " · 모둠 " + S.esc.team + (S.esc.teamName ? "(" + S.esc.teamName + ")" : "") + " · 힌트 " + S.esc.hints + "회 · 오답 " + (S.esc.wrongs || 0) + "회 · 시도 " + tries,
    choicesJson: JSON.stringify({ team: S.esc.team, teamName: S.esc.teamName, house: (HOUSES.find((x) => x.id === S.house) || {}).name || "", mode: S.mode, elapsedSec: sec, hints: S.esc.hints, wrongs: S.esc.wrongs || 0, start: S.esc.start, escapedAt: S.esc.escapedAt, attempts: S.esc.attempts, ts: new Date().toISOString() })
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
  $("escMsg").textContent = S.preview ? "미리보기라 저장하지 않았어." : "제출했어! 순위는 선생님이 정리해 줄 거야.";
}

/* ───────── 서버 ───────── */
async function postToSheet(payload) {
  if (S.preview) return { result: "success", preview: true };
  const res = await fetch(CONFIG.SHEET_WEBAPP_URL, { method: "POST", body: JSON.stringify(payload) });
  const json = await res.json();
  if (json.result !== "success") {
    const err = new Error(json.message || "저장 실패");
    err.locked = !!json.locked;
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
  if (window.DraftGuard) DraftGuard.start({ key: CONFIG.GAME_DIG, sid: S.sid }); // 발굴 노트 글 임시저장
}

function route() {
  const q = new URLSearchParams(location.search);
  const screen = q.get("screen");
  if (screen === "dig") { renderHome(); if (S.house || skip()) startDig(); else show("scrHome"); }
  else if (screen === "escape") { renderHome(); if (S.house || skip()) renderEscapeEntry(); else show("scrHome"); }
  else { renderHome(); show("scrHome"); }
}

function init() {
  const q = new URLSearchParams(location.search);
  S.preview = q.get("preview") === "1";
  S.mode = q.get("mode") === "flex" ? "flex" : "basic";
  if (S.preview) $("previewBar").hidden = false;

  $("brandBtn").addEventListener("click", () => { renderHome(); show("scrHome"); });
  $("goDig").addEventListener("click", startDig);
  $("goEscape").addEventListener("click", renderEscapeEntry);
  $("startEscape").addEventListener("click", startEscape);
  $("submitDig").addEventListener("click", submitDig);
  $("submitEscape").addEventListener("click", submitEscape);
  $("hintToggle").addEventListener("click", () => { $("hintBox").hidden = !$("hintBox").hidden; });
  $("writeText").addEventListener("input", () => { $("writeCount").textContent = Logic.countChars($("writeText").value); });
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
  Glossary.start({ terms: GLOSSARY, unique: true, skip: ["#topbar", ".puz-list", ".spot", ".house-btn", ".act-btn", ".room", ".chips", ".choice-grid", ".m-item", ".order-item", ".key-reveal"] }); // 어려운 낱말 풀이
}

init();
