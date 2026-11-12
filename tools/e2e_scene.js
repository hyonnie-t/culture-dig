/* tools/e2e_scene.js — 7판 장면형 방탈출을 화면에서 끝까지 눌러 보는 점검(개발용, 앱이 불러 쓰지 않는다).
 * 쓰는 법: 로컬 서버로 ?screen=escape&solo=1&sid=39999&name=시험 을 연 뒤 콘솔에서
 *   eval(await (await fetch("tools/e2e_scene.js")).text()); await E2E.run()
 * 버튼을 실제 DOM click으로 누른다(정답은 data에서 읽는다). 제출(POST)은 막는다. 돌려주는 값 = { ok, log[] }. */
window.E2E = (function () {
  const log = []; let fails = 0;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const ok = (cond, msg) => { if (!cond) { fails++; log.push("✗ " + msg); } else log.push("✓ " + msg); return cond; };
  const q = (sel) => document.querySelector(sel);
  const spot = (name) => q('.sc-spot[data-s="' + name + '"]');
  const sayNow = async () => { await sleep(700); return (q("#scSay").textContent || ""); };
  const modalOpen = () => !q("#scModal").hidden;
  const modalText = () => q("#scModalIn").innerText;
  const closeM = () => { const b = q("#scModalIn [data-close]"); if (b) b.click(); };
  const pickItem = (id) => { const b = q('#scInv .sc-slot[data-id="' + id + '"]'); if (b) b.click(); return !!b; };

  async function solve(p0) { // 열린 퍼즐 모달을 정답으로 푼다
    const p = Scene.puzOf(p0);
    if (!modalOpen()) return ok(false, p.id + " 퍼즐 창이 안 열림");
    if (p.type === "match") {
      for (let i = 0; i < p.pairs.length; i++) { q('#scModalIn .m-left[data-i="' + i + '"]').click(); q('#scModalIn .m-right[data-ri="' + i + '"]').click(); }
      q("#checkBtn").click();
    } else if (p.type === "order") {
      for (let guard = 0; guard < 40; guard++) {
        const arr = S.esc.attempts[p.id].arr; let moved = false;
        for (let i = 0; i < p.items.length; i++) {
          if (arr[i] !== p.items[i]) { const from = arr.indexOf(p.items[i]); q('#scModalIn [data-up="' + from + '"]').click(); moved = true; break; }
        }
        if (!moved) break;
      }
      q("#checkBtn").click();
    } else if (p.type === "choice") {
      q('#scModalIn .choice[data-i="' + p.answer + '"]').click();
    } else if (p.type === "key") {
      q("#keyIn").value = String(p.answer); q("#checkBtn").click();
    }
    await sleep(480);
    return ok(!!S.esc.solved[p.id], p.id + "(" + p.type + ") 풀림");
  }

  async function playRoom(i, withSecrets) {
    const rooms = roomsNow(), r = rooms[i], c = SCENES[r.id], n = rooms.length;
    q('.room-tile[data-i="' + i + '"]').click(); await sleep(80);
    if (!ok(S.screen === "scrScene", (i + 1) + "실 입장")) return;
    const sc = () => S.esc.sc[r.id];
    if (i !== S.esc.role) { // 도우러 간 방(2026-11-12 35분 맞춤): 등이 켜져 있고 열쇠·첫 재료가 가방에
      ok(sc().lit && sc().inv.indexOf("key") >= 0 && sc().inv.indexOf(c.mats[0]) >= 0 && sc().inv.indexOf("flint") < 0, (i + 1) + "실(도움) 바로 시작: " + sc().inv.join(","));
    } else {
    // 어두울 때: 숨은 곳이 아닌 자리는 막힌다
    spot("safe").click(); ok(/어두워서/.test(await sayNow()), (i + 1) + "실 어두울 때 금고 막힘");
    c.hide.forEach((h) => spot(h).click());
    ok(sc().inv.length === 3 && sc().inv.indexOf("flint") >= 0 && sc().inv.indexOf("key") >= 0, (i + 1) + "실 숨은 곳 3곳에서 물건 3개: " + sc().inv.join(","));
    spot("lantern").click(); ok(!sc().lit, (i + 1) + "실 부싯돌을 안 고르면 등이 안 켜짐");
    pickItem("flint"); spot("lantern").click(); await sleep(60);
    ok(sc().lit && sc().inv.indexOf("flint") < 0, (i + 1) + "실 등 켜짐");
    }
    // 진열장(퍼즐1) → 재료2
    spot("case").click(); await solve(r.puzzles[0]); await sleep(50);
    ok(sc().inv.indexOf(c.mats[1]) >= 0, (i + 1) + "실 재료2 얻음");
    // 서랍: 열쇠 없이 → 막힘, 열쇠로 → 퍼즐2 → 재료3
    spot("drawers").click(); ok(!sc().drawer && !modalOpen(), (i + 1) + "실 열쇠를 안 고르면 서랍 잠김");
    pickItem("key"); spot("drawers").click(); await sleep(50);
    await solve(r.puzzles[1]); await sleep(50);
    ok(sc().inv.indexOf(c.mats[2]) >= 0, (i + 1) + "실 재료3 얻음");
    // 상자: 번호 없이는 안 열림
    spot("crate").click(); await sleep(30);
    q("#scCodeIn").value = "000"; q("#scCodeBtn").click(); ok(!sc().crate, (i + 1) + "실 틀린 번호로 상자 안 열림"); closeM();
    // 작업대: 재료 3개 → 조합 → 번호
    spot(c.station).click(); await sleep(30);
    for (let k = 0; k < 3; k++) { const b = q("#scModalIn [data-put]"); if (b) b.click(); await sleep(20); }
    const cb = q("#scCombine"); ok(!!cb, (i + 1) + "실 조합 버튼 나옴"); if (cb) cb.click(); await sleep(40);
    const code = Logic.comboCode((S.sid || "t") + ":" + r.id);
    ok(sc().combo && modalText().replace(/[^0-9]/g, "").indexOf(code) >= 0, (i + 1) + "실 조합 → 번호 " + code); closeM();
    // 금고: 봉인 2/3이면 막힘
    spot("safe").click(); ok(/봉인/.test(await sayNow()) && !modalOpen(), (i + 1) + "실 봉인이 남으면 금고 막힘");
    spot("crate").click(); await sleep(30); q("#scCodeIn").value = code; q("#scCodeBtn").click(); await sleep(60);
    await solve(r.puzzles[2]); await sleep(60);
    // 벽: 다른 방 금고 무늬
    spot("wall").click(); await sleep(30);
    const j = (i - 1 + n) % n, wsy = Logic.crossSymbols(Scene.teamSeed(), rooms[j].id, SCENE_SYMS.length, 4);
    ok(modalText().indexOf((j + 1) + "실 금고") >= 0 && wsy.every((k) => modalText().indexOf(SCENE_SYMS[k].name) >= 0), (i + 1) + "실 벽 = " + (j + 1) + "실 금고 무늬 " + wsy.map((k) => SCENE_SYMS[k].name).join(""));
    closeM();
    // 금고: 틀린 무늬 → 막힘, 맞는 무늬 → 퍼즐4 → 열쇠 숫자
    spot("safe").click(); await sleep(30);
    const want = Logic.crossSymbols(Scene.teamSeed(), r.id, SCENE_SYMS.length, 4);
    const wrong = want.slice().reverse();
    for (const k of wrong) { q('#scModalIn .sc-symbtn[data-k="' + k + '"]').click(); await sleep(15); }
    ok(!sc().sym, (i + 1) + "실 틀린 무늬 순서는 안 열림");
    for (const k of want) { q('#scModalIn .sc-symbtn[data-k="' + k + '"]').click(); await sleep(15); }
    await sleep(80);
    ok(sc().sym, (i + 1) + "실 맞는 무늬로 무늬판 통과");
    await solve(r.puzzles[3]); await sleep(120);
    const key = Logic.teamKey(Scene.teamSeed(), r.id);
    ok(modalOpen() && modalText().indexOf("열쇠 숫자: " + key) >= 0, (i + 1) + "실 금고 열림 → 열쇠 숫자 " + key);
    closeM();
    if (withSecrets) {
      for (const [nm, k] of [["jar", 0], ["rug", 1]]) { spot(nm).click(); await sleep(30); await solve(r.secrets[k]); await sleep(60); }
    }
    ok(q("#scSpots .sc-spot.secret") == null, (i + 1) + "실 남은 비밀 칸 표시 없음");
    q("#scBack").click(); await sleep(60);
    ok(S.screen === "scrRooms", (i + 1) + "실 → 복도");
  }

  async function vault() {
    const rooms = roomsNow();
    q("#toVault").click(); await sleep(60);
    q("#codeIn").value = "0000"; q("#codeBtn").click(); ok(!S.esc.vaultCode, "수장고: 틀린 번호 막힘");
    const code = Logic.vaultCode2(Scene.teamSeed(), rooms, vaultOrderNow());
    q("#codeIn").value = code; q("#codeBtn").click(); await sleep(60);
    ok(!!S.esc.vaultCode, "수장고 번호 " + code + " 통과");
    const fin = Scene.puzOf(VAULT.final);
    for (let guard = 0; guard < 40; guard++) {
      const arr = S.esc.attempts.V1.arr; let moved = false;
      for (let i = 0; i < fin.items.length; i++) if (arr[i] !== fin.items[i]) { q('#vaultCard [data-up="' + arr.indexOf(fin.items[i]) + '"]').click(); moved = true; break; }
      if (!moved) break;
    }
    q("#finalBtn").click(); await sleep(80);
    ok(!!S.esc.escapedAt && S.screen === "scrEscaped", "마지막 자물쇠 → 탈출");
  }

  async function run(opts) {
    opts = opts || {};
    log.length = 0; fails = 0;
    const realFetch = window.fetch;
    window.fetch = (u, o) => (o && o.method === "POST" ? Promise.reject(new Error("E2E: POST 막음")) : realFetch(u, o));
    try {
      const rooms = roomsNow();
      const order = opts.rooms || rooms.map((_, i) => i);
      for (const i of order) await playRoom(i, i === S.esc.role);
      if (!opts.noVault) {
        await vault();
        const sc = escNow();
        ok(sc.score === (opts.expect != null ? opts.expect : ESC_MAX), "점수 " + sc.score + " (담당 " + sc.role + " 비밀 " + sc.secret + " 수장고 " + sc.vault + " 자물쇠 " + sc.final + " 도움 " + sc.help + ")");
      }
    } catch (e) { fails++; log.push("✗ 예외: " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e)); }
    window.fetch = realFetch;
    return { ok: fails === 0, fails: fails, log: log };
  }
  return { run: run, playRoom: playRoom };
})();
