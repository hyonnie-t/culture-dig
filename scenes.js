/* scenes.js — 7판(2026-11-12) 장면형 방탈출의 방 데이터. 화면은 scene.js, 판정은 logic.js.
 * 배경 그림은 힉스필드(gpt_image_2_6)로 만든 AI 그림이다(img/scene/room1~4.jpg, 1500×1008).
 * spots = 누를 자리 [왼쪽%, 위%, 너비%, 높이%] (그림 기준). 그림을 바꾸면 이 좌표도 다시 잰다.
 * 역사 사실은 여기 넣지 않는다 — 문제는 data.js(ROOMS)·variants.js가 맡고, 이 파일은 방 안 물건과 이야기 글만 다룬다.
 * 한 방의 흐름: 어두움 → 숨은 곳(hide 3곳)에서 부싯돌·열쇠·재료1 → 등 켜기 → case(퍼즐1)→재료2 → drawers(열쇠, 퍼즐2)→재료3
 *   → station(재료 3개 조합 → 세 자리 번호) → crate(번호, 퍼즐3) → safe(다른 방 벽의 무늬 4개 + 퍼즐4 → 열쇠 숫자) → 비밀 2곳(jar·rug). */
const SCENE_SYMS = [
  { ch: "☾", name: "달" }, { ch: "☁", name: "구름" }, { ch: "✿", name: "꽃" },
  { ch: "▲", name: "산" }, { ch: "≈", name: "물결" }, { ch: "★", name: "별" }
];

const SCENE_ITEMS = {
  flint: { name: "부싯돌", img: "it_flint", desc: "불을 붙일 수 있다. 꺼진 등에 써 보자." },
  key: { name: "놋쇠 열쇠", img: "it_key", desc: "작은 열쇠다. 서랍장 열쇠 구멍에 맞을 것 같다." },
  a1: { name: "흰 흙", img: "it_white", desc: "곱게 갠 흰 흙이다." },
  a2: { name: "조각칼", img: "it_knife", desc: "그릇에 무늬를 새기는 칼이다." },
  a3: { name: "검은 흙", img: "it_black", desc: "곱게 갠 검은 흙이다." },
  b1: { name: "먹", img: "it_ink", desc: "잘 갈아 둔 먹이다." },
  b2: { name: "목판", img: "it_block", desc: "글자를 거꾸로 새긴 나무판이다." },
  b3: { name: "종이", img: "it_paper", desc: "아무것도 적히지 않은 종이다." },
  c1: { name: "물병", img: "it_bottle", desc: "물이 가득 든 병이다." },
  c2: { name: "놋항아리", img: "it_jar", desc: "물시계에서 빠진 항아리 같다." },
  c3: { name: "종 망치", img: "it_mallet", desc: "작은 종을 치는 망치다." },
  d1: { name: "그림 조각 ①", img: "it_piece", desc: "찢어진 그림의 한 조각이다." },
  d2: { name: "그림 조각 ②", img: "it_piece", desc: "찢어진 그림의 한 조각이다." },
  d3: { name: "그림 조각 ③", img: "it_piece", desc: "찢어진 그림의 한 조각이다." }
};

/* 숨은 곳에서 물건이 나올 때의 한 줄(자리별) */
const SCENE_FIND = {
  jar: "항아리 속에 손을 넣었다. 바닥에서 무언가 잡힌다.",
  rug: "깔개 한쪽을 들췄다. 그 아래 무언가 놓여 있다.",
  obj2: "틈새를 더듬었다. 무언가 끼워져 있다.",
  table: "책상 아래를 더듬었다. 무언가 붙어 있다."
};

const SCENES = {
  A: {
    bg: "img/scene/room1.jpg",
    spots: { lantern: [7, 24, 6.5, 22], case: [13, 33, 15.5, 40], obj2: [29.5, 40, 10, 34], wall: [40, 24, 32.5, 29.5], table: [40.5, 55, 30.5, 23], drawers: [72.5, 48, 12, 26], safe: [85, 44.5, 14, 30], jar: [2.5, 70, 14, 24.5], crate: [17, 78, 11.5, 15.5], rug: [29, 79.5, 51, 15.5] },
    names: { case: "청자 진열장", obj2: "불상 받침대", wall: "벽 그림", table: "작업대", drawers: "서랍장", safe: "금고", jar: "큰 항아리", crate: "나무 상자", rug: "깔개", lantern: "등" },
    hide: ["jar", "rug", "obj2"], station: "table", mats: ["a1", "a2", "a3"],
    enter: "1실. 청자의 푸른빛도 어둠에 잠겼다. 손전등 불빛이 닿는 곳만 보인다.",
    stationLook: "작업대에 무늬 없는 그릇이 놓여 있다. 무늬를 새기고 빛깔 다른 흙을 메워 넣으면 될 것 같다.",
    combine: "조각칼로 그릇에 무늬를 새기고, 흰 흙과 검은 흙을 메워 넣었다. 흑백 무늬가 살아나더니… 그릇 바닥에 숫자가 드러났다.",
    comboLabel: "그릇 바닥의 숫자"
  },
  B: {
    bg: "img/scene/room2.jpg",
    spots: { lantern: [6.5, 21, 5.5, 18], case: [11.5, 31, 16.5, 43], obj2: [28.5, 34, 12, 40], wall: [42, 25.5, 27.5, 25], table: [40.5, 51.5, 30, 25], drawers: [70.5, 43, 13, 31], safe: [83.5, 41, 15.5, 33], jar: [4, 68, 12.5, 21], crate: [17, 74.5, 12, 14], rug: [30, 77, 49.5, 17] },
    names: { case: "목판 꽂이", obj2: "책장", wall: "벽 그림", table: "인쇄대", drawers: "서랍장", safe: "금고", jar: "큰 항아리", crate: "나무 궤", rug: "깔개", lantern: "등" },
    hide: ["jar", "rug", "obj2"], station: "table", mats: ["b1", "b2", "b3"],
    enter: "2실. 목판과 책 냄새가 난다. 손전등 불빛이 닿는 곳만 보인다.",
    stationLook: "인쇄대가 비어 있다. 글자를 새긴 판과 먹, 종이가 있으면 찍어 볼 수 있다.",
    combine: "목판에 먹을 고르게 바르고, 종이를 덮어 문질렀다. 종이를 떼어 내자… 글자 사이에 숫자가 찍혀 있다.",
    comboLabel: "찍혀 나온 숫자"
  },
  C: {
    bg: "img/scene/room3.jpg",
    spots: { lantern: [8.5, 27, 6.5, 14], case: [8.5, 47, 13.5, 29], obj2: [23, 26.5, 13.5, 50], wall: [37.5, 19.5, 31.5, 22], table: [36.5, 42, 32.5, 39], drawers: [69.5, 48, 13, 28], safe: [82.5, 43, 16, 33], jar: [1.5, 73, 12, 20.5], crate: [13, 79, 10.5, 14], rug: [24, 81, 57, 14.5] },
    names: { case: "해시계", obj2: "물시계", wall: "돌에 새긴 별자리", table: "혼천의 탁자", drawers: "서랍장", safe: "금고", jar: "큰 항아리", crate: "나무 상자", rug: "깔개", lantern: "등" },
    hide: ["jar", "rug", "table"], station: "obj2", mats: ["c1", "c2", "c3"],
    enter: "3실. 별자리를 새긴 돌이 달빛을 받아 희미하게 빛난다. 손전등 불빛이 닿는 곳만 보인다.",
    stationLook: "물시계다. 항아리 하나가 빠져 있고, 물도 말랐다. 종을 칠 망치도 없다.",
    combine: "빠진 항아리를 끼우고 물을 부었다. 물이 차례로 흘러내리더니… 망치가 종을 친다. 울린 횟수를 세어 보니 숫자가 된다.",
    comboLabel: "종이 울린 횟수"
  },
  D: {
    bg: "img/scene/room4.jpg",
    spots: { lantern: [9, 23, 5.5, 24], case: [16, 32, 13.5, 44], obj2: [30.5, 27.5, 9, 36], wall: [41.5, 29, 31, 26], table: [40, 53.5, 31.5, 25.5], drawers: [73, 48, 11.5, 28], safe: [84, 46, 14.5, 30], jar: [3, 70, 12.5, 21.5], crate: [15, 78.5, 12.5, 14], rug: [28, 79.5, 54, 15] },
    names: { case: "자기 진열장", obj2: "대나무 그림 족자", wall: "벽 그림", table: "선비의 책상", drawers: "서랍장", safe: "금고", jar: "큰 항아리", crate: "나무 궤", rug: "깔개", lantern: "등" },
    hide: ["jar", "rug", "obj2"], station: "table", mats: ["d1", "d2", "d3"],
    enter: "4실. 먹 냄새가 은은하다. 손전등 불빛이 닿는 곳만 보인다.",
    stationLook: "책상 위에 빈 종이가 펼쳐져 있다. 찢어진 그림 조각을 모아 여기서 맞춰 볼 수 있다.",
    combine: "그림 조각 세 개를 종이 위에 맞췄다. 찢긴 자리가 꼭 들어맞는다. 뒤집어 보니… 누군가 숫자를 적어 두었다.",
    comboLabel: "그림 뒤의 숫자"
  }
};

/* 자물쇠 종류별 한 줄(퍼즐 type → 방 안 물건에 붙는 설명) */
const SCENE_LOCK = {
  match: "명판이 뒤섞여 있다. 유물과 설명을 바로 짝지으면 열린다.",
  choice: "안쪽에 쪽지가 붙어 있다. 쪽지의 물음에 답하면 열린다.",
  order: "나무패 네 개가 걸려 있다. 순서대로 놓으면 열린다.",
  key: "마지막 숫자판이다. 물음의 답을 넣으면 열린다."
};

if (typeof module !== "undefined") module.exports = { SCENES, SCENE_ITEMS, SCENE_SYMS, SCENE_FIND, SCENE_LOCK };
