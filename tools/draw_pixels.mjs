// tools/draw_pixels.mjs — 유물 21개의 32×32 도트 그림을 그려 ../pixels.js 로 쓴다.
// 실행: node tools/draw_pixels.mjs   (외부 패키지 없음)
// 광원은 왼쪽 위. 윤곽선은 마지막에 outline()이 바깥 1px로 두른다(그림은 1~30칸 안에 그린다).
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const PAL = {
  K: "#1b1410", G: "#3a2e24",
  a: "#2d6b5e", b: "#4c9583", c: "#7cbfa6", d: "#c4ead8", W: "#f6f2e4",          // 청자·흰 상감
  e: "#5b3a1f", f: "#8c5b30", g: "#b98a52", h: "#e3c48e",                        // 나무
  i: "#5d5953", j: "#8b857b", l: "#b6afa2", m: "#ddd6c8", n: "#f3f0e8",          // 돌(화강암·대리석)
  o: "#7c5512", p: "#b9871f", q: "#e3b947", r: "#fff2ae",                        // 금동
  s: "#263f35", t: "#456a55", u: "#6c9278", v: "#a6c5a6", w: "#e4e4da",          // 청동·은
  x: "#7c2119", y: "#b8382b", z: "#e46a4c",                                      // 빨강
  A: "#1c2747", B: "#33477a", C: "#5c76ac",                                      // 쪽빛
  D: "#c7b48a", E: "#e9dcb6", F: "#fcf6e3",                                      // 종이
  H: "#8b6a1c", I: "#c99d38", J: "#ecca6c",                                      // 황색 표지
  L: "#2b5520", M: "#4c8a2c", N: "#8cc24c",                                      // 초록
  O: "#b44a72", P: "#ef8aaa", Q: "#ffd3df",                                      // 복숭아꽃
  S: "#535d55", T: "#848c80", U: "#b5b8a6", V: "#e8e4cf",                        // 분청
  X: "#a26c24", Y: "#d39f48", Z: "#efcb7d",                                      // 고분 벽 황토
  2: "#2a2e35", 3: "#474e58", 4: "#6f7883", 5: "#9aa3ad",                        // 기와
  6: "#e2862c", 7: "#2f8f86", 8: "#c8d6dc",
};

const N = 32;
let G;
const begin = () => { G = Array.from({ length: N }, () => Array(N).fill(".")); };
const inb = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
let CLIP = null; // 정해 두면 그 마스크 안에만 그린다
const px = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (inb(x, y) && c && (!CLIP || CLIP(x, y))) G[y][x] = c; };
// 작은 스프라이트: rows 문자열, '.'은 건너뜀
const sprite = (x0, y0, rows) => rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== ".") px(x0 + i, y0 + j, ch); }));
const get = (x, y) => (inb(x, y) ? G[y][x] : ".");
const rect = (x, y, w, h, c) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px(i, j, c); };
const hline = (x0, x1, y, c) => { for (let i = Math.min(x0, x1); i <= Math.max(x0, x1); i++) px(i, y, c); };
const vline = (x, y0, y1, c) => { for (let j = Math.min(y0, y1); j <= Math.max(y0, y1); j++) px(x, j, c); };
function line(x0, y0, x1, y1, c) {
  [x0, y0, x1, y1] = [x0, y0, x1, y1].map(Math.round);
  let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, err = dx + dy;
  for (;;) { px(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
}
const pts = (list, c) => list.forEach(([x, y]) => px(x, y, c));
const hash = (x, y, s = 0) => (((x * 73856093) ^ (y * 19349663) ^ (s * 83492791)) >>> 0) % 100;

// ── 마스크(칸 목록) ──
const M = (fn) => { const m = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (fn(x, y)) m.push([x, y]); return m; };
const ellM = (cx, cy, rx, ry) => M((x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1);
const rectM = (x0, y0, w, h) => M((x, y) => x >= x0 && x < x0 + w && y >= y0 && y < y0 + h);
function polyM(P) {
  return M((x, y) => {
    const X = x + 0.5, Y = y + 0.5; let ins = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const [xi, yi] = P[i], [xj, yj] = P[j];
      if ((yi > Y) !== (yj > Y) && X < ((xj - xi) * (Y - yi)) / (yj - yi) + xi) ins = !ins;
    }
    return ins;
  });
}
// 좌우 대칭 회전체: hws[k] = y0+k 줄의 반폭. cx=16이면 x는 16-hw … 15+hw
const lathe = (cx, y0, hws) => { const m = []; hws.forEach((hw, k) => { for (let x = cx - hw; x < cx + hw; x++) m.push([x, y0 + k]); }); return m; };
const minus = (a, b) => { const S = new Set(b.map(([x, y]) => x + "," + y)); return a.filter(([x, y]) => !S.has(x + "," + y)); };
const fill = (m, c) => m.forEach(([x, y]) => px(x, y, c));
const fillIf = (m, fn) => m.forEach(([x, y]) => { const c = fn(x, y); if (c) px(x, y, c); });
const has = (m) => { const S = new Set(m.map(([x, y]) => x + "," + y)); return (x, y) => S.has(x + "," + y); };
// 경계 칸(4방향 이웃 중 마스크 밖이 있는 칸)
function edge(m, c, sides = "tblr") {
  const h = has(m);
  m.forEach(([x, y]) => {
    if ((sides.includes("t") && !h(x, y - 1)) || (sides.includes("b") && !h(x, y + 1)) || (sides.includes("l") && !h(x - 1, y)) || (sides.includes("r") && !h(x + 1, y))) px(x, y, c);
  });
}
// 명암: ramp = [어두움, 중간, 밝음, 하이라이트?]. 광원 왼쪽 위.
function shade(m, ramp, o = {}) {
  const rows = {}, cols = {};
  for (const [x, y] of m) {
    rows[y] = rows[y] || [99, -1]; rows[y][0] = Math.min(rows[y][0], x); rows[y][1] = Math.max(rows[y][1], x);
    cols[x] = cols[x] || [99, -1]; cols[x][0] = Math.min(cols[x][0], y); cols[x][1] = Math.max(cols[x][1], y);
  }
  const wx = o.wx ?? 0.8, wy = 1 - wx, lt = o.lt ?? 0.24, dk = o.dk ?? 0.72;
  for (const [x, y] of m) {
    const r = rows[y], c = cols[x];
    const tx = (x - r[0]) / Math.max(1, r[1] - r[0]);
    const ty = (y - c[0]) / Math.max(1, c[1] - c[0]);
    const s = tx * wx + ty * wy;
    let col = s < lt ? ramp[2] : s > dk ? ramp[0] : ramp[1];
    if (ramp[3] && o.hi !== false && tx > (o.hx0 ?? 0.1) && tx < (o.hx1 ?? 0.24) && ty > (o.hy0 ?? 0.1) && ty < (o.hy1 ?? 0.42)) col = ramp[3];
    px(x, y, col);
  }
}
// 바깥 1px 윤곽선
function outline(c = "K") {
  const S = G.map((r) => r.slice());
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (S[y][x] !== ".") continue;
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inb(x + dx, y + dy) && S[y + dy][x + dx] !== ".");
    if (nb) G[y][x] = c;
  }
}

const ART = {};
const save = (id, ol = true) => { if (ol) outline(); ART[id] = G.map((r) => r.join("")); };

// ════════════════ 고려 ════════════════
// g1 청자 상감 운학문 매병
begin();
{
  const body = lathe(16, 1, [3, 3, 2, 6, 9, 11, 12, 12, 12, 12, 12, 11, 11, 11, 10, 10, 10, 9, 9, 9, 8, 8, 8, 7, 7, 7, 7, 7, 8, 8]);
  shade(body, ["a", "b", "c", "d"], { hy0: 0.18, hy1: 0.45 });
  hline(14, 17, 3, "a"); hline(13, 18, 1, "c"); px(13, 2, "c");
  // 어깨 여의두 띠
  for (let x = 7; x <= 24; x++) { px(x, 6, x % 2 ? "W" : "a"); }
  for (let x = 6; x <= 25; x += 3) px(x, 7, "W");
  CLIP = has(body);
  // 원 안의 학(흑백상감 원)
  const ring = minus(ellM(12.5, 16.5, 5.3, 5.3), ellM(12.5, 16.5, 4.3, 4.3)); fill(ring, "W");
  sprite(9, 13, [
    ".....W..",
    "y...WW..",
    "KW.WW...",
    "..WWWW..",
    "...WWWW.",
    ".....K.K",
  ]);
  // 원 밖, 내려오는 학
  sprite(19, 9, [
    "W...W",
    ".W.W.",
    "..W..",
    "..K..",
  ]);
  // 구름(흰 몸 + 검은 끝)
  const cloud = (x, y) => sprite(x, y, [".WW.", "WWWK"]);
  cloud(19, 17); cloud(17, 22); cloud(8, 23); cloud(20, 26 - 13); cloud(6, 9);
  // 아래 연판 띠
  hline(9, 22, 25, "W");
  for (let x = 10; x <= 21; x += 2) { px(x, 26, "W"); px(x, 27, "W"); }
  hline(8, 23, 29, "a");
  CLIP = null;
}
save("g1");

// g2 팔만대장경판
begin();
{
  const board = rectM(6, 8, 20, 17);
  fill(board, "g");
  hline(6, 25, 8, "h"); hline(6, 25, 24, "f"); vline(25, 8, 24, "f");
  // 글자 칸 테두리
  const tx0 = 8, tx1 = 23, ty0 = 10, ty1 = 22;
  hline(tx0, tx1, ty0, "f"); hline(tx0, tx1, ty1, "f"); vline(tx0, ty0, ty1, "f"); vline(tx1, ty0, ty1, "f");
  // 판심(가운데 칸)
  vline(15, ty0, ty1, "f"); vline(16, ty0, ty1, "f"); px(15, 12, "e"); px(16, 12, "e"); px(15, 20, "e"); px(16, 20, "e");
  // 새긴 글자(세로줄)
  for (let x = tx0 + 2; x < tx1; x += 2) {
    if (x === 15 || x === 16) continue;
    for (let y = ty0 + 2; y < ty1 - 1; y++) if (hash(x, y, 2) < 62) px(x, y, "e");
  }
  // 마구리(양끝 막대)
  for (const x0 of [2, 26]) {
    const end = rectM(x0, 6, 4, 21);
    shade(end, ["e", "f", "g"], { hi: false, wx: 0.9 });
    hline(x0, x0 + 3, 6, "g");
    rect(x0, 7, 4, 2, "p"); rect(x0, 23, 4, 2, "p"); px(x0, 7, "q"); px(x0, 23, "q"); px(x0 + 3, 8, "o"); px(x0 + 3, 24, "o");
    px(x0 + 1, 15, "e"); px(x0 + 2, 15, "e");
  }
}
save("g2");

// 책(선장본) 공통: 표지 x3..26 y2..26, 오른쪽 묶음(오침), 오른쪽·아래 종이 두께
function book({ cover, thread, slip = "F", ink = "G", slipMarks, sym }) {
  // 종이 두께
  rect(5, 27, 23, 2, "E"); hline(5, 27, 28, "D"); for (let x = 6; x <= 27; x += 3) px(x, 27, "F");
  rect(27, 4, 2, 25, "E"); vline(28, 4, 28, "D"); for (let y = 5; y <= 27; y += 3) px(27, y, "F");
  const cv = rectM(3, 2, 24, 25);
  shade(cv, cover, { wx: 0.7, lt: 0.12, dk: 0.86, hi: false });
  hline(3, 26, 2, cover[2]); vline(3, 2, 26, cover[2]);
  // 접힌 선과 오침 실
  vline(23, 3, 25, cover[0]);
  for (const y of [4, 9, 14, 19, 24]) { hline(24, 26, y, thread); px(23, y, "K"); }
  vline(26, 4, 24, thread);
  // 제첨(제목 쪽지)
  if (slip) {
    rect(5, 4, 5, 14, slip); vline(9, 4, 17, "D"); hline(5, 17, 17, "D");
    (slipMarks || [6, 7, 9, 10, 12, 13, 15]).forEach((yy) => { px(7, yy, ink); });
  }
  sym && sym();
}

// g3 『직지』 + 금속활자
begin();
book({
  cover: ["e", "f", "g"], thread: "y",
  slipMarks: [6, 7, 8, 10, 11, 13, 14],
  sym: () => {
    // 표지 오른쪽에 찍힌 도장
    rect(17, 5, 4, 4, "y"); px(18, 6, "z"); px(19, 7, "x"); px(18, 7, "z");
    // 금속활자 한 개(앞으로 튀어나옴)
    const top = polyM([[9, 18], [18, 18], [21, 21], [12, 21]]); fill(top, "l");
    const front = rectM(12, 21, 10, 8); shade(front, ["i", "j", "l"], { hi: false });
    const side = polyM([[9, 18], [12, 21], [12, 29], [9, 26]]); fill(side, "i");
    hline(12, 21, 21, "m");
    // 활자 윗면의 뒤집힌 글자(볼록)
    pts([[12, 19], [13, 19], [14, 19], [15, 19], [16, 19], [14, 20], [13, 20], [17, 20], [18, 20]], "q");
    pts([[14, 23], [15, 23], [16, 23], [17, 23], [18, 23], [16, 24], [16, 25], [14, 25], [18, 25], [15, 26], [17, 26]], "G");
  },
});
save("g3");

// g4 영주 부석사 무량수전
begin();
{
  // 기단
  const base = rectM(1, 27, 30, 3); shade(base, ["i", "j", "l"], { hi: false, wx: 0.5 });
  hline(1, 30, 27, "m"); rect(12, 28, 8, 2, "l"); hline(12, 19, 28, "m"); hline(12, 19, 29, "j");
  // 벽·문
  rect(2, 15, 28, 12, "E");
  for (const y of [19, 23]) hline(2, 29, y, "D");
  for (let x = 3; x <= 29; x += 2) vline(x, 17, 26, "D");
  hline(2, 29, 26, "g");
  hline(2, 29, 15, "F"); hline(2, 29, 16, "x");
  // 기둥(배흘림: 아래 1/3이 불룩)
  for (const p of [2, 7, 12, 18, 23, 28]) {
    vline(p, 15, 26, "f"); vline(p + 1, 15, 26, "e");
    for (const yy of [20, 21, 22, 23]) { px(p - 1, yy, "g"); px(p + 2, yy, "e"); }
    for (const yy of [19, 24]) { px(p - 1, yy, "D"); px(p + 2, yy, "D"); }
    px(p, 15, "6"); px(p + 1, 15, "6");
  }
  // 주심포(기둥 위 공포)·창방
  hline(1, 30, 14, "7"); hline(1, 30, 13, "e");
  for (const p of [2, 7, 12, 18, 23, 28]) { rect(p - 1, 12, 4, 2, "g"); px(p - 1, 12, "h"); px(p + 2, 13, "e"); px(p, 13, "y"); px(p + 1, 13, "7"); }
  // 현판
  rect(13, 12, 6, 3, "e"); hline(14, 17, 13, "q"); px(13, 12, "f");
  // 팔작지붕
  const roof = M((x, y) => {
    const dx = Math.abs(x + 0.5 - 16);
    const top = dx <= 6.5 ? 2 : dx <= 9.5 ? 2 + (dx - 6.5) : 5 + (dx - 9.5) * 0.55;
    const bot = 11.5 - Math.max(0, dx - 8) * 0.45;
    return dx <= 15.5 && y >= top && y <= bot;
  });
  fillIf(roof, (x, y) => (x % 2 ? "3" : "4"));
  // 위쪽(합각 부분)은 밝게, 처마 끝은 어둡게
  roof.forEach(([x, y]) => { if (x < 12 && y < 7 && x % 2 === 0) px(x, y, "5"); });
  edge(roof, "2", "b");
  hline(9, 22, 2, "2"); px(8, 1, "2"); px(23, 1, "2"); px(9, 1, "3"); px(22, 1, "3");
  // 처마 아래 그늘
  hline(2, 29, 12, "2");
  for (const p of [2, 7, 12, 18, 23, 28]) { px(p, 12, "g"); px(p + 1, 12, "f"); }
  rect(13, 12, 6, 2, "e"); hline(14, 17, 13, "q");
  // 막새 점
  roof.forEach(([x, y]) => { if (!roof.some(([a, b]) => a === x && b === y + 1) && x % 2 === 0) px(x, y, "l"); });
}
save("g4");

// g5 논산 관촉사 석조 미륵보살 입상
begin();
{
  const stone = ["i", "j", "l", "m"];
  // 보관: 꼭지 + 작은 판 + 큰 네모 판 + 원통
  rect(15, 1, 2, 1, "j");
  const plate1 = rectM(12, 2, 8, 1); fill(plate1, "l");
  rect(15, 3, 2, 1, "j");
  const plate = rectM(6, 4, 20, 2); shade(plate, stone, { hi: false, wx: 0.9 }); hline(6, 25, 5, "i");
  const cyl = rectM(13, 6, 6, 4); shade(cyl, stone, { hi: false });
  hline(12, 19, 9, "j");
  // 얼굴(크고 긴 얼굴)
  const face = M((x, y) => y >= 10 && y <= 20 && x >= 10 && x <= 21 && !(y >= 19 && (x < 11 || x > 20)) && !(y === 20 && (x < 12 || x > 19)));
  shade(face, ["j", "l", "m", "n"], { hy0: 0.05, hy1: 0.3, hx0: 0.05, hx1: 0.2 });
  // 귀
  vline(9, 12, 18, "l"); vline(22, 12, 18, "j"); px(9, 18, "j"); px(22, 18, "i");
  // 눈썹·눈·백호·코·입
  hline(11, 14, 12, "j"); hline(17, 20, 12, "j");
  hline(11, 14, 14, "i"); hline(17, 20, 14, "i"); px(13, 14, "K"); px(18, 14, "K");
  px(15, 11, "q"); px(16, 11, "q");
  vline(15, 14, 16, "l"); px(16, 16, "j"); px(15, 17, "j");
  hline(14, 17, 18, "x"); px(15, 18, "y"); px(16, 18, "y");
  // 목
  rect(13, 21, 6, 1, "j");
  // 몸(돌기둥 같은 몸)
  const body = rectM(8, 22, 16, 9); shade(body, stone, { hi: false, wx: 0.85 });
  // 옷 주름
  for (const yy of [26, 28, 30]) { hline(10, 21, yy, "j"); }
  vline(9, 23, 30, "l");
  // 두 손과 연꽃 가지
  rect(11, 23, 4, 3, "m"); px(11, 23, "n"); hline(11, 14, 25, "l");
  rect(17, 24, 4, 3, "m"); hline(17, 20, 26, "l");
  line(13, 23, 12, 21, "L"); pts([[11, 20], [12, 20], [13, 20], [12, 19]], "P"); px(12, 20, "Q");
}
save("g5");

// g6 청동 은입사 물가 풍경 무늬 정병
begin();
{
  const prof = [1, 1, 2, 1, 1, 1, 1, 1, 4, 2, 2, 3, 5, 7, 8, 9, 10, 10, 10, 10, 10, 10, 10, 9, 9, 8, 8, 6, 7, 7];
  const body = lathe(16, 1, prof);
  shade(body, ["s", "t", "u", "v"], { hy0: 0.45, hy1: 0.62 });
  hline(13, 18, 9, "u"); px(12, 9, "v");
  hline(14, 17, 3, "w");
  // 귀때(옆 주둥이)
  rect(25, 15, 2, 2, "t"); px(27, 14, "u"); px(27, 15, "t"); px(25, 15, "u");
  // 녹 점
  pts([[8, 20], [9, 21], [21, 23], [14, 16], [23, 19], [10, 24]], "c");
  // 은입사: 늘어진 버드나무(우산 모양)
  vline(12, 18, 26, "w");
  sprite(8, 17, [
    "...www...",
    "..w...w..",
    ".w.....w.",
    "w.......w",
    "w.......w",
    ".........",
    "w.......w",
  ]);
  // 갈대 한 포기
  vline(21, 21, 26, "w"); px(22, 20, "w"); px(20, 23, "w");
  // 물결과 오리, 날아가는 새
  for (let x = 7; x <= 24; x++) px(x, 27, x % 3 === 0 ? "u" : "w");
  sprite(16, 24, ["..w", "www"]);
  sprite(17, 18, ["w.w", ".w."]);
  hline(13, 18, 28, "s"); hline(9, 22, 30, "s");
  // 목의 은선
  for (const yy of [5, 7]) { px(15, yy, "w"); }
  hline(11, 20, 13, "w");
}
save("g6");

// gx 『삼강행실도』(펼친 책: 왼쪽 그림, 오른쪽 글)
begin();
{
  // 표지(아래로 보이는 쪽빛 테)
  const cv = polyM([[1, 7], [16, 5], [31, 7], [31, 28], [16, 27], [1, 28]]);
  fill(cv, "A"); edge(cv, "B", "t");
  const left = polyM([[2, 6], [15, 4], [16, 4], [16, 26], [15, 26], [2, 27]]);
  const right = polyM([[16, 4], [17, 4], [30, 6], [30, 27], [17, 26], [16, 26]]);
  fill(left, "F"); fill(right, "E");
  edge(left, "D", "b"); edge(right, "D", "br");
  vline(16, 4, 26, "D"); vline(15, 5, 26, "E"); vline(17, 5, 26, "D");
  // 왼쪽: 그림 칸
  const fr = rectM(4, 8, 10, 15); fill(fr, "F");
  hline(4, 13, 8, "x"); hline(4, 13, 22, "x"); vline(4, 8, 22, "x"); vline(13, 8, 22, "x");
  // 집 지붕
  pts([[8, 10], [9, 10], [10, 10], [11, 10]], "3"); hline(7, 12, 11, "2"); rect(8, 12, 4, 3, "g"); px(9, 13, "e"); px(10, 13, "e");
  // 나무
  rect(5, 10, 2, 3, "M"); px(5, 10, "N"); vline(6, 13, 15, "e");
  // 사람 둘: 엎드린 사람, 앉은 어른
  pts([[10, 17], [11, 17]], "G"); rect(10, 18, 3, 2, "B"); px(12, 17, "E");
  pts([[6, 18], [7, 19], [8, 19], [8, 20], [9, 20]], "y"); px(6, 17, "G"); px(5, 18, "G");
  hline(5, 12, 21, "D");
  // 오른쪽: 글 줄
  hline(18, 28, 8, "x"); hline(18, 28, 23, "x"); vline(18, 8, 23, "x"); vline(28, 8, 23, "x");
  for (let x = 20; x <= 27; x += 2) for (let y = 10; y <= 21; y++) if (hash(x, y, 9) < 70) px(x, y, "G");
  // 그림자 아래
}
save("gx");

// ════════════════ 조선 ════════════════
// j1 『훈민정음』 해례본
begin();
book({
  cover: ["H", "I", "J"], thread: "y",
  slipMarks: [6, 7, 9, 10, 12, 13],
  sym: () => {
    rect(11, 5, 11, 20, "F"); hline(11, 21, 24, "D"); vline(21, 5, 24, "D");
    const ink = "K";
    // ㄱ
    hline(12, 15, 7, ink); vline(15, 7, 10, ink);
    // ㄴ
    vline(17, 7, 10, ink); hline(17, 20, 10, ink);
    // ㅁ
    hline(12, 15, 13, ink); hline(12, 15, 16, ink); vline(12, 13, 16, ink); vline(15, 13, 16, ink);
    // ㅅ
    px(18, 13, ink); px(18, 14, ink); px(17, 15, ink); px(19, 15, ink); px(16, 16, ink); px(20, 16, ink);
    // ㅇ
    pts([[13, 19], [14, 19], [12, 20], [15, 20], [12, 21], [15, 21], [13, 22], [14, 22]], ink);
    // ㆍ ㅡ ㅣ (천지인)
    rect(17, 19, 2, 2, "y"); hline(17, 20, 22, ink); vline(20, 18, 21, ink);
  },
});
save("j1");

// j2 앙부일구
begin();
{
  const br = ["s", "t", "u", "v"];
  // 십자 받침(물 수평 홈)
  const barH = rectM(2, 25, 28, 2); shade(barH, ["s", "t", "u"], { hi: false, wx: 0.6 }); hline(2, 29, 25, "u");
  const barV = rectM(12, 25, 8, 5); shade(barV, ["s", "t", "u"], { hi: false, wx: 0.6 });
  hline(3, 28, 26, "s"); vline(15, 26, 28, "s"); px(15, 26, "C"); px(16, 26, "C"); px(8, 26, "C"); px(23, 26, "C"); hline(12, 19, 29, "s");
  // 다리 4개(위쪽 용머리)
  for (const [xa, xb] of [[5, 4], [25, 26]]) { line(xa, 15, xb, 24, "t"); line(xa + 1, 15, xb + 1, 24, "s"); }
  for (const x of [10, 20]) { vline(x, 17, 24, "u"); vline(x + 1, 17, 24, "s"); }
  pts([[4, 16], [5, 15], [26, 15], [27, 16], [10, 17], [20, 17]], "v");
  // 솥 몸(반구)
  const outer = minus(ellM(16, 9, 13.5, 9.5), rectM(0, 0, 32, 10));
  shade(outer, br, { hy0: 0.1, hy1: 0.5, hx0: 0.12, hx1: 0.25 });
  for (let x = 5; x <= 26; x++) px(x, 13, x % 2 ? "w" : "u");
  // 입 테두리
  const rim = ellM(16, 8.5, 13.5, 5.5); fill(rim, "u"); edge(rim, "v", "tl"); edge(rim, "t", "b");
  // 안쪽(먼 벽은 밝고 가까운 벽은 어둡다)
  const inner = ellM(16, 8.8, 11.5, 4.3);
  fillIf(inner, (x, y) => (y <= 6 ? "u" : y <= 8 ? "t" : "s"));
  CLIP = has(inner);
  // 시각선: 바닥 가운데로 모이는 은선
  for (const x of [6, 9, 12, 20, 23, 26]) line(x, 5, Math.round(16 + (x - 16) * 0.35), 12, "w");
  // 절기선: 가로 호
  edge(ellM(16, 9.2, 8.5, 2.6), "w", "b");
  CLIP = null;
  // 영침(북쪽 테두리에서 가운데로 뻗은 바늘)
  line(16, 4, 16, 10, "r"); px(17, 4, "q"); px(16, 11, "q");
}
save("j2");

// j3 『칠정산』(역법서 + 해·달·별)
begin();
book({
  cover: ["A", "B", "C"], thread: "q", slip: "E",
  slipMarks: [6, 7, 8, 10, 11, 13, 14, 15],
  sym: () => {
    // 궤도 점선
    const orb = minus(ellM(16, 14, 6.5, 6.5), ellM(16, 14, 5.6, 5.6));
    orb.forEach(([x, y]) => { if ((x + y) % 2 === 0) px(x, y, "C"); });
    // 해
    const sun = ellM(15, 10, 3, 3); shade(sun, ["y", "z", "6"], { hi: false }); px(14, 9, "J");
    pts([[15, 5], [15, 15], [10, 10], [20, 10], [12, 7], [18, 7], [12, 13], [18, 13]], "J");
    // 달(초승달)
    const moon = minus(ellM(17, 20, 3.5, 3.5), ellM(18.6, 19.2, 3, 3)); fill(moon, "w"); px(14, 19, "F");
    // 별
    pts([[20, 16], [12, 23], [21, 22], [11, 17], [19, 4]], "r");
  },
});
save("j3");

// j4 분청사기 상감 연꽃 넝쿨 무늬 병
begin();
{
  const prof = [4, 3, 2, 2, 2, 2, 2, 3, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 11, 11, 11, 10, 10, 9, 8, 6, 5, 5];
  const body = lathe(16, 2, prof);
  shade(body, ["S", "T", "U", "V"], { hy0: 0.55, hy1: 0.72 });
  hline(12, 19, 2, "V"); hline(13, 18, 3, "S");
  CLIP = has(body);
  // 바탕 인화 점(촘촘한 회색 점)
  body.forEach(([x, y]) => { if (y >= 15 && y <= 24 && (x + 2 * y) % 5 === 0) px(x, y, "S"); });
  // 목 띠
  for (const yy of [6, 9]) hline(14, 17, yy, "V");
  // 어깨 연판 띠
  hline(10, 21, 14, "V");
  for (let x = 10; x <= 21; x += 3) { px(x + 1, 12, "V"); px(x, 13, "V"); px(x + 1, 13, "V"); px(x + 2, 13, "S"); }
  // 큰 연꽃(흰 꽃잎 + 검은 윤곽)
  sprite(9, 15, [
    "...SVS...",
    "..SVVVS..",
    "SVSVyVSVS",
    "SVVVVVVVS",
    ".SVVVVVS.",
    "..SSVSS..",
    "....V....",
    "....V....",
  ]);
  // 넝쿨과 잎
  line(13, 23, 16, 25, "V"); line(17, 17, 20, 15, "V"); line(20, 15, 23, 18, "V");
  sprite(21, 19, ["SV.", "VVS", ".S."]);
  sprite(18, 22, [".VV", "VVS", "SS."]);
  // 아래 연판 띠
  hline(7, 24, 25, "V");
  for (let x = 8; x <= 23; x += 2) px(x, 26, "V");
  hline(11, 20, 29, "U"); hline(11, 20, 30, "T");
  CLIP = null;
}
save("j4");

// j5 「몽유도원도」(가로 두루마리)
begin();
{
  // 비단 테두리와 그림 바탕
  rect(3, 6, 26, 20, "B"); hline(3, 28, 6, "C");
  const paper = rectM(4, 8, 24, 16); fill(paper, "E");
  paper.forEach(([x, y]) => { if (hash(x, y, 5) < 8) px(x, y, "D"); });
  // 기암 산(왼쪽은 현실 세계 낮은 산, 오른쪽으로 갈수록 높고 기이하게)
  const peaks = [
    [[4, 23], [6, 17], [8, 19], [10, 15], [12, 23]],
    [[9, 23], [12, 11], [14, 14], [15, 9], [17, 15], [18, 23]],
    [[16, 23], [18, 13], [20, 9], [21, 12], [23, 8], [25, 14], [27, 11], [27, 23]],
  ];
  peaks.forEach((P, k) => {
    const m = polyM(P).filter(([x, y]) => y >= 8 && y <= 23 && x >= 4 && x <= 27);
    shade(m, k === 1 ? ["i", "j", "l"] : ["G", "X", "Y"], { wx: 0.8, hi: false });
  });
  // 주름(준법) 몇 줄
  pts([[13, 14], [14, 17], [12, 18], [19, 15], [21, 16], [24, 14], [22, 19], [7, 20]], "G");
  // 안개
  hline(9, 15, 20, "F"); hline(18, 24, 17, "F"); hline(5, 9, 22, "F");
  // 복숭아꽃 숲(도원)
  for (const [x, y] of [[20, 19], [22, 20], [24, 18], [19, 21], [23, 22], [25, 21], [21, 22], [26, 19]]) {
    px(x, y, "P"); px(x + 1, y, "Q"); px(x, y + 1, "O");
  }
  pts([[17, 21], [16, 22]], "P");
  // 오른쪽 위 낙관
  rect(25, 9, 2, 2, "y"); vline(26, 12, 15, "G");
  // 두루마리 축(양끝)
  for (const x0 of [1, 29]) { rect(x0, 5, 2, 22, "f"); vline(x0, 5, 26, "g"); rect(x0, 3, 2, 2, "e"); rect(x0, 27, 2, 2, "e"); px(x0, 3, "f"); }
}
save("j5");

// j6 『농사직설』(책 + 벼 이삭)
begin();
book({
  cover: ["L", "M", "N"], thread: "J",
  slipMarks: [6, 7, 9, 10, 12, 13],
  sym: () => {
    // 벼 줄기 두 가닥 + 긴 잎
    line(10, 29, 18, 9, "H"); line(11, 29, 19, 9, "J");
    line(13, 29, 15, 15, "H");
    line(15, 21, 22, 17, "L"); line(16, 21, 22, 18, "N");
    line(12, 23, 9, 15, "L"); line(13, 23, 10, 15, "N");
    // 고개 숙인 이삭(낟알 덩어리)
    const ear = [[18, 8], [19, 8], [20, 9], [21, 10], [21, 11], [22, 12], [22, 13], [23, 14], [23, 15], [23, 16]];
    ear.forEach(([x, y], k) => { px(x, y, "q"); px(x + 1, y, k % 2 ? "J" : "r"); px(x - 1, y + 1, "I"); });
    const ear2 = [[15, 14], [16, 14], [17, 15], [17, 16], [18, 17], [18, 18]];
    ear2.forEach(([x, y], k) => { px(x, y, "q"); px(x + 1, y, k % 2 ? "J" : "r"); px(x - 1, y + 1, "I"); });
  },
});
save("j6");

// jx 개성 경천사지 10층 석탑
begin();
{
  const marble = ["j", "l", "m", "n"];
  const story = (y, hwRoof, hwBody, bodyRows) => {
    const body = lathe(16, y + 1, Array(bodyRows).fill(hwBody));
    shade(body, marble, { hi: false, wx: 0.95, lt: 0.3, dk: 0.62 });
    const roof = lathe(16, y, [hwRoof]); fill(roof, "m"); hline(16 - hwRoof, 15 + hwRoof, y, "m");
    px(16 - hwRoof, y, "l"); px(15 + hwRoof, y, "j");
    px(16 - hwRoof - 1, y, "m"); px(16 + hwRoof, y, "l"); // 처마 끝
    hline(16 - hwRoof + 1, 15 + hwRoof - 1, y + 1, "i"); // 처마 그늘
    return body;
  };
  // 아래 3층: 亞자 기단(가운데가 튀어나와 밝고, 양옆이 들어가 어둡다)
  const ya = (y, hw, rows, roofHw) => {
    const b = story(y, roofHw, hw, rows);
    const inner = Math.round(hw * 0.5);
    b.forEach(([x, yy]) => {
      const dx = Math.abs(x + 0.5 - 16);
      if (yy === y + 1) return;
      if (dx > inner + 2) px(x, yy, x < 16 ? "l" : "j");
      else if (dx > inner) px(x, yy, "j");
      else px(x, yy, x < 16 ? "n" : "m");
    });
    // 조각 무늬(불·보살 감실)
    for (let x = 16 - hw + 2; x < 16 + hw - 2; x += 3) px(x, y + rows, "l");
  };
  ya(25, 12, 4, 14); hline(2, 29, 30, "j");
  ya(21, 10, 3, 12);
  ya(17, 8, 3, 10);
  let y = 15;
  const roofs = [8, 7, 7, 6, 6, 5, 5];
  roofs.forEach((r) => { story(y, r, r - 2, 1); y -= 2; });
  // 상륜
  rect(15, 1, 2, 2, "l"); rect(14, 2, 4, 1, "m"); px(15, 1, "n");
}
save("jx");

// ════════════════ 삼국·남북국 ════════════════
// s1 백제 금동 대향로
begin();
{
  const gold = ["o", "p", "q", "r"];
  // 용 받침(똬리 + 들어 올린 발 + 꼬리)
  fill(ellM(16, 26.2, 5.5, 1.3), "o");
  const coil = minus(ellM(16, 26.5, 10.5, 3.8), ellM(16, 26.2, 5.5, 1.3));
  shade(coil, gold, { hi: false, wx: 0.9 });
  coil.forEach(([x, y]) => { if ((x - y) % 4 === 0) px(x, y, "o"); if ((x - y) % 4 === 1 && y < 27) px(x, y, "r"); });
  sprite(4, 20, ["q.q", ".p.", ".pp", "..p"]);
  sprite(25, 21, ["..q", ".pq", "pp."]);
  // 용의 목: 몸통을 입으로 받친다
  const neck = rectM(14, 20, 4, 4); shade(neck, gold, { hi: false });
  pts([[15, 21], [16, 22]], "o"); pts([[13, 20], [18, 20]], "r"); px(18, 21, "y"); px(13, 21, "p");
  // 연꽃 몸통(꽃잎이 겹친 사발)
  const bowl = minus(ellM(16, 14, 8.5, 6), rectM(0, 0, 32, 15));
  shade(bowl, gold, { hi: false });
  bowl.forEach(([x, y]) => { if (x % 3 === 0) px(x, y, "o"); });
  for (let x = 8; x <= 23; x += 3) px(x + 1, 15, "r");
  // 뚜껑: 산봉우리가 겹겹이
  const lid = ellM(16, 10.5, 6.5, 4.6);
  shade(lid, gold, { hy0: 0.15, hy1: 0.45 });
  for (const [cx, cy] of [[13, 8], [17, 7], [19, 9], [11, 11], [15, 10], [19, 12], [21, 11], [13, 13], [17, 13]]) {
    px(cx, cy, "r"); px(cx - 1, cy + 1, "q"); px(cx + 1, cy + 1, "o");
  }
  edge(lid, "o", "b");
  // 봉황(날개 펴고 꼬리 들고)
  sprite(10, 1, [
    "pp.....qq..",
    ".pp...qrqy.",
    "..ppqqqq...",
    "...pqqqp...",
    "....oqo.pp.",
  ]);
}
save("s1");

// s2 경주 첨성대
begin();
{
  const st = ["i", "j", "l", "m"];
  // 기단 두 단
  const b2 = rectM(2, 28, 28, 2); shade(b2, ["i", "j", "l"], { hi: false, wx: 0.6 }); hline(2, 29, 28, "m");
  const b1 = rectM(5, 26, 22, 2); shade(b1, ["i", "j", "l"], { hi: false, wx: 0.6 }); hline(5, 26, 26, "m");
  // 몸통(아래로 갈수록 불룩한 병 모양)
  const prof = []; for (let y = 7; y <= 25; y++) { const t = (y - 7) / 18; prof.push(Math.round(4.6 + 5.2 * t * t)); }
  const body = lathe(16, 7, prof);
  shade(body, ["j", "l", "m", "n"], { hy0: 0.3, hy1: 0.65, lt: 0.2 });
  // 돌 켜(가로줄)와 엇갈린 이음매
  body.forEach(([x, y]) => {
    if (y % 2 === 0) px(x, y, get(x, y) === "n" ? "m" : get(x, y) === "m" ? "l" : "j");
    else if ((x + (y % 4 === 1 ? 0 : 2)) % 4 === 0) px(x, y, "j");
  });
  // 가운데 네모 창
  rect(14, 14, 4, 4, "K"); px(14, 14, "G"); hline(13, 18, 18, "n"); hline(14, 17, 13, "j");
  // 꼭대기 井자 틀
  const top = rectM(10, 3, 12, 4); fill(top, "l");
  hline(10, 21, 3, "m"); hline(10, 21, 5, "m"); hline(11, 20, 4, "i"); hline(11, 20, 6, "i");
  vline(10, 3, 6, "m"); vline(21, 3, 6, "j"); px(9, 3, "m"); px(22, 3, "j"); px(9, 5, "m"); px(22, 5, "j");
}
save("s2");

// s3 금동 연가 7년명 여래 입상
begin();
{
  // 광배(배 모양, 끝이 뾰족) — 몸보다 어둡게
  const halo = polyM([[16, 1], [21, 3], [25, 8], [26, 14], [25, 20], [22, 24], [10, 24], [7, 20], [6, 14], [7, 8], [11, 3]]);
  fill(halo, "o");
  halo.forEach(([x, y]) => { const d = Math.hypot(x - 16, (y - 13) * 0.8); if (Math.round(d) % 3 === 0) px(x, y, "p"); });
  edge(halo, "q", "tl"); edge(halo, "p", "br");
  // 몸(아래로 넓어지고 양옆 옷자락이 지느러미처럼 뻗음)
  const robe = polyM([[12, 10], [20, 10], [21, 17], [24, 23], [8, 23], [11, 17]]);
  shade(robe, ["q", "q", "r"], { hi: false, wx: 0.85, lt: 0.35, dk: 0.85 });
  for (const yy of [13, 16, 19]) { line(13, yy, 16, yy + 2, "p"); line(16, yy + 2, 19, yy, "p"); }
  edge(robe, "K", "lr");
  // 머리(검은 머리·육계) + 얼굴
  rect(15, 3, 2, 1, "S"); rect(14, 4, 4, 2, "S"); px(14, 4, "T");
  const face = rectM(14, 6, 4, 4); fill(face, "q"); px(14, 6, "r"); px(14, 7, "r"); vline(17, 6, 9, "p");
  pts([[15, 7], [16, 7]], "o"); px(15, 9, "p");
  vline(13, 4, 9, "K"); vline(18, 4, 9, "K"); hline(14, 17, 2, "K"); px(14, 3, "K"); px(17, 3, "K");
  // 들어 올린 손(시무외인)·내린 손
  rect(10, 11, 2, 3, "r"); px(10, 10, "r"); px(11, 10, "q"); vline(9, 10, 13, "K"); px(12, 13, "p");
  rect(20, 16, 2, 2, "q");
  // 연화대·받침
  const lotus = ellM(16, 25, 6, 1.8); shade(lotus, ["o", "p", "q"], { hi: false });
  for (let x = 11; x <= 21; x += 2) px(x, 25, "r");
  rect(14, 26, 4, 1, "p");
  const drum = rectM(11, 27, 10, 2); shade(drum, ["o", "p", "q"], { hi: false });
  const foot = rectM(9, 29, 14, 2); shade(foot, ["o", "p", "q"], { hi: false }); hline(9, 22, 29, "q");
}
save("s3");

// s4 무용총 벽화(춤추는 사람들)
begin();
{
  const wall = M((x, y) => x >= 1 && x <= 30 && y >= 3 + (hash(x, 0, 4) < 30 ? 1 : 0) && y <= 28 - (hash(x, 1, 4) < 30 ? 1 : 0));
  fillIf(wall, (x, y) => { const h = hash(x, y, 7); return h < 22 ? "Z" : "Y"; });
  edge(wall, "E", "tblr");
  // 흘러내린 물감 자국
  wall.forEach(([x, y]) => { if (y > 24 && x % 6 === 2) px(x, y, "X"); });
  // 오른쪽 위 붉은 휘장
  rect(22, 3, 9, 2, "x"); px(30, 5, "x");
  // 흰 구름 무늬
  sprite(3, 4, [".FF.", "FFFF"]);
  // 춤추는 사람: 머리 → 저고리 → 바지/치마, 긴 소매를 뒤로 휘날림
  const dancer = (ox, oy, top, skirt) => {
    const T = (xx, yy) => (top === "dot" ? ((xx * 2 + yy) % 3 === 0 ? "G" : "F") : "y");
    // 머리
    pts([[ox + 2, oy], [ox + 3, oy]], "K"); pts([[ox + 2, oy + 1], [ox + 3, oy + 1]], "Z"); px(ox + 1, oy + 1, "K");
    // 저고리
    for (let yy = oy + 2; yy <= oy + 5; yy++) for (let xx = ox + 1; xx <= ox + 4; xx++) px(xx, yy, T(xx, yy));
    hline(ox + 1, ox + 4, oy + 5, "x");
    // 소매: 앞으로 한 팔, 뒤로 긴 소매
    hline(ox - 1, ox, oy + 3, T(ox, oy + 3)); px(ox - 1, oy + 4, "K");
    hline(ox + 5, ox + 6, oy + 2, T(ox + 5, oy + 2)); px(ox + 7, oy + 2, "K"); px(ox + 7, oy + 3, "K");
    // 아래옷
    if (skirt) { for (let yy = oy + 6; yy <= oy + 11; yy++) { const s = Math.floor((yy - oy - 6) / 2); hline(ox + 1 - s, ox + 4 + s, yy, "y"); } hline(ox - 1, ox + 6, oy + 11, "F"); }
    else { for (let yy = oy + 6; yy <= oy + 11; yy++) { hline(ox + 1, ox + 2, yy, "y"); hline(ox + 3, ox + 4, yy, "y"); } vline(ox + 2, oy + 8, oy + 11, "X"); px(ox + 3, oy + 8, "x"); }
    px(ox + 1, oy + 12, "K"); px(ox + 4, oy + 12, "K");
  };
  dancer(3, 6, "dot", false);
  dancer(12, 6, "red", true);
  dancer(21, 6, "dot", true);
  // 아래 줄: 노래하는 사람들
  [[4, "y"], [9, "F"], [14, "A"], [19, "y"], [24, "F"]].forEach(([x, c]) => {
    px(x, 21, "K"); px(x + 1, 21, "K"); px(x, 22, "Z"); px(x + 1, 22, "Z");
    rect(x - 1, 23, 4, 3, c); if (c === "F") { px(x - 1, 24, "G"); px(x + 1, 24, "G"); px(x, 25, "G"); px(x + 2, 25, "G"); }
  });
}
save("s4");

// s5 석굴암 본존상
begin();
{
  const body = ["i", "j", "l", "m"], skin = ["j", "l", "m", "n"];
  // 둥근 광배(머리 뒤)
  const halo = minus(ellM(16, 8, 8, 7.5), ellM(16, 8, 6.8, 6.3));
  fill(halo, "l"); edge(halo, "j", "br");
  // 연꽃 대좌
  const ped = rectM(5, 27, 22, 4); shade(ped, ["i", "j", "l"], { hi: false, wx: 0.7 });
  for (let x = 5; x <= 26; x += 3) { px(x, 27, "m"); px(x + 1, 27, "m"); px(x + 2, 28, "i"); }
  hline(5, 26, 30, "i");
  // 결가부좌 다리(넓은 무릎)
  const legs = ellM(16, 24.5, 13.5, 3.8); shade(legs, body, { hi: false });
  line(6, 25, 15, 23, "i"); line(17, 23, 26, 25, "i");
  pts([[19, 24], [20, 24], [21, 25]], "n"); // 위로 올린 발바닥
  // 몸
  const torso = polyM([[9, 14], [23, 14], [24, 23], [8, 23]]); shade(torso, body, { hi: false, wx: 0.85 });
  // 가사 주름(화면 오른쪽 어깨를 덮음)
  for (const k of [0, 3, 6]) line(16 + k, 14, 22 - k / 2, 22, "j");
  line(16, 14, 13, 22, "i");
  // 오른팔(화면 왼쪽) 무릎 아래로 내려 땅을 짚음(항마촉지인)
  vline(8, 16, 24, "m"); vline(9, 16, 23, "l"); vline(10, 17, 22, "j"); rect(7, 24, 3, 2, "m"); px(7, 25, "l");
  // 왼손(배 앞)
  rect(14, 21, 5, 2, "m"); hline(14, 18, 22, "j");
  // 목의 삼도
  rect(14, 13, 4, 1, "j"); px(14, 13, "l");
  // 얼굴
  const face = ellM(16, 9.5, 4.5, 4.5); shade(face, ["l", "m", "n", "n"], { hy0: 0.1, hy1: 0.4 });
  pts([[11, 8], [11, 9], [11, 10], [11, 11], [11, 12]], "l"); pts([[20, 8], [20, 9], [20, 10], [20, 11], [20, 12]], "j");
  hline(12, 14, 9, "i"); hline(17, 19, 9, "i"); hline(13, 14, 8, "l"); hline(17, 18, 8, "l"); px(15, 7, "l"); px(16, 7, "l");
  vline(15, 9, 11, "m"); px(16, 10, "l"); px(16, 11, "j"); hline(15, 16, 12, "i");
  // 나발 머리·육계
  const hair = minus(ellM(16, 7.5, 5, 4), rectM(0, 7, 32, 32)); fill(hair, "i");
  hair.forEach(([x, y]) => { if ((x + y) % 2 === 0) px(x, y, "j"); });
  const ush = ellM(16, 3.5, 2.5, 1.6); fillIf(ush, (x, y) => ((x + y) % 2 ? "i" : "j"));
}
save("s5");

// s6 성덕 대왕 신종
begin();
{
  const br = ["s", "t", "u", "v"];
  // 종 몸
  const prof = []; for (let y = 7; y <= 27; y++) { const t = (y - 7) / 20; prof.push(Math.round(8 + 4.4 * Math.pow(t, 1.6))); }
  prof[prof.length - 1] += 1;
  const body = lathe(16, 7, prof);
  shade(body, br, { hy0: 0.1, hy1: 0.5, hx0: 0.08, hx1: 0.2 });
  // 위 띠(상대)·아래 띠(하대)
  hline(8, 23, 7, "v"); for (let x = 8; x <= 23; x += 2) px(x, 8, "v");
  hline(4, 27, 24, "v"); for (let x = 5; x <= 26; x += 2) px(x, 25, "u");
  // 유곽(젖꼭지 네모)
  for (const x0 of [9, 19]) {
    hline(x0, x0 + 3, 9, "u"); hline(x0, x0 + 3, 13, "u"); vline(x0, 9, 13, "u"); vline(x0 + 3, 9, 13, "u");
    pts([[x0 + 1, 10], [x0 + 2, 11], [x0 + 1, 12]], "v");
  }
  // 비천상(무릎 꿇고 향로를 받든 모습) + 휘날리는 천
  pts([[11, 17], [11, 18]], "v"); rect(10, 19, 3, 2, "v"); px(13, 18, "v"); px(14, 18, "w");
  line(9, 18, 6, 16, "v"); line(13, 21, 15, 22, "v"); px(14, 17, "w");
  // 당좌(연꽃 치는 자리)
  const dz = ellM(21, 19.5, 2.2, 2.2); fill(dz, "u"); px(21, 19, "w"); edge(dz, "v", "tl");
  // 천판
  hline(9, 22, 6, "t");
  // 용뉴(용 고리)
  const loop = minus(ellM(15, 5.5, 4, 4), ellM(15, 5.5, 2, 2.2)).filter(([, y]) => y <= 5);
  shade(loop, br, { hi: false });
  px(11, 5, "u"); px(10, 5, "v"); px(10, 4, "u"); // 용 머리
  px(18, 5, "t");
  // 음통(대나무 마디 관)
  rect(19, 1, 2, 5, "t"); vline(19, 1, 5, "u"); hline(19, 20, 2, "v"); hline(19, 20, 4, "v");
}
save("s6");

// sx 『삼국사기』
begin();
book({
  cover: ["x", "y", "z"], thread: "F",
  slipMarks: [6, 7, 9, 10, 11, 13, 14, 15],
  sym: () => {
    rect(12, 6, 10, 16, "E"); hline(12, 21, 21, "D"); vline(21, 6, 21, "D");
    // 三
    rect(14, 8, 6, 2, "K"); rect(15, 12, 4, 2, "K"); rect(13, 16, 8, 2, "K");
    // 세 나라를 뜻하는 세 점(고구려·백제·신라)
    rect(12, 23, 2, 2, "q"); rect(16, 23, 2, 2, "F"); rect(20, 23, 2, 2, "A");
  },
});
save("sx");

// ── 출력 ──
const ORDER = ["g1", "g2", "g3", "g4", "g5", "g6", "gx", "j1", "j2", "j3", "j4", "j5", "j6", "jx", "s1", "s2", "s3", "s4", "s5", "s6", "sx"];
const used = new Set(); ORDER.forEach((id) => ART[id].forEach((r) => [...r].forEach((ch) => ch !== "." && used.add(ch))));
const palOut = Object.fromEntries(Object.entries(PAL).filter(([k]) => used.has(k)));
let out = "/* pixels.js — 유물별 32×32 도트 그림(직접 그림). '.' = 투명. tools/draw_pixels.mjs로 만든다. */\n";
out += "const PIXEL_PAL32 = " + JSON.stringify(palOut) + ";\n";
out += "const PIXEL_ART32 = {\n";
ORDER.forEach((id) => { out += "  " + id + ": [\n" + ART[id].map((r) => '    "' + r + '"').join(",\n") + "\n  ],\n"; });
out += "};\n";
const here = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(here, "..", "pixels.js"), out, "utf8");
console.log("pixels.js 작성:", ORDER.length, "개, 팔레트", Object.keys(palOut).length, "색");
